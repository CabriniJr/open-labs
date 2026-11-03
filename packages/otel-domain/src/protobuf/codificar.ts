import type { AnyValue, ExportTraceServiceRequest, KeyValue, OtelSpan } from "../otlp.js";

/**
 * O codificador protobuf do envelope OTLP de traces, com os números de campo
 * de `opentelemetry-proto` (trace/v1, common/v1, resource/v1). É um codificador
 * de verdade — os bytes que ele escreve são os que um Collector lê — e é
 * pequeno de propósito: só os campos que o handbook usa, e cada campo escrito
 * devolve onde começa, onde acaba e o que é, para o lab poder apontar o byte.
 *
 * O formato do fio tem quatro jeitos de escrever um valor (wire types):
 * 0 varint, 1 fixed64, 2 com comprimento na frente (texto, bytes, mensagem
 * aninhada) e 5 fixed32. A chave de cada campo é `(número << 3) | wire type`,
 * ela mesma um varint.
 */
export type WireType = 0 | 1 | 2 | 5;
export type TipoDoCampo = "varint" | "fixed64" | "string" | "bytes" | "message";

export interface CampoCodificado {
  /** Caminho legível: `resource_spans[0].scope_spans[0].spans[1].name`. */
  readonly caminho: string;
  readonly nome: string;
  readonly numero: number;
  readonly wire: WireType;
  readonly tipo: TipoDoCampo;
  /** Byte onde a chave do campo começa. */
  readonly inicio: number;
  /** Byte logo depois do último byte do campo. */
  readonly fim: number;
  /** Quantos bytes são chave + comprimento, antes do valor. */
  readonly cabeca: number;
  /** Quantas mensagens o envolvem (0 = no topo do envelope). */
  readonly profundidade: number;
  /** O valor, como o leitor o reconheceria. Vazio numa mensagem. */
  readonly valor: string;
}

export interface Codificacao {
  readonly bytes: Uint8Array;
  readonly campos: readonly CampoCodificado[];
}

/** Um varint: sete bits por byte, o bit alto diz "tem mais". */
export function varint(n: bigint | number): number[] {
  let v = BigInt(n);
  if (v < 0n) v = (1n << 64n) + v; // int64 negativo: complemento de dois em 10 bytes
  const out: number[] = [];
  do {
    let b = Number(v & 0x7fn);
    v >>= 7n;
    if (v > 0n) b |= 0x80;
    out.push(b);
  } while (v > 0n);
  return out;
}

export function chave(numero: number, wire: WireType): number[] {
  return varint((numero << 3) | wire);
}

function fixed64(n: bigint): number[] {
  const out: number[] = [];
  let v = n;
  for (let i = 0; i < 8; i += 1) {
    out.push(Number(v & 0xffn));
    v >>= 8n;
  }
  return out;
}

const utf8 = (s: string): number[] => [...new TextEncoder().encode(s)];
function hexParaBytes(hex: string): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < hex.length; i += 2) out.push(Number.parseInt(hex.slice(i, i + 2), 16));
  return out;
}

/** Um campo a escrever: folha (com o valor já em bytes) ou mensagem (com filhos). */
type No =
  | { readonly nome: string; readonly numero: number; readonly tipo: Exclude<TipoDoCampo, "message">; readonly valor: string; readonly corpo: readonly number[] }
  | { readonly nome: string; readonly numero: number; readonly tipo: "message"; readonly filhos: readonly No[] };

const WIRE: Record<TipoDoCampo, WireType> = { varint: 0, fixed64: 1, string: 2, bytes: 2, message: 2 };

function escrever(nos: readonly No[], base: number, profundidade: number, pai: string, campos: CampoCodificado[]): number[] {
  const out: number[] = [];
  const contagem = new Map<string, number>();
  const repetidos = new Set(nos.filter((n, i) => nos.findIndex((m) => m.nome === n.nome) !== i).map((n) => n.nome));
  for (const no of nos) {
    const i = contagem.get(no.nome) ?? 0;
    contagem.set(no.nome, i + 1);
    const caminho = `${pai === "" ? "" : `${pai}.`}${no.nome}${repetidos.has(no.nome) || no.nome.endsWith("s") ? `[${i}]` : ""}`;
    const k = chave(no.numero, WIRE[no.tipo]);
    const inicio = base + out.length;
    if (no.tipo === "message") {
      // O filho primeiro, para saber o comprimento; os deslocamentos dele são
      // corrigidos quando a cabeça (chave + comprimento) tem tamanho conhecido.
      const dosFilhos: CampoCodificado[] = [];
      const corpo = escrever(no.filhos, 0, profundidade + 1, caminho, dosFilhos);
      const cabeca = [...k, ...varint(corpo.length)];
      const desloc = inicio + cabeca.length;
      campos.push({ caminho, nome: no.nome, numero: no.numero, wire: 2, tipo: "message", inicio, fim: desloc + corpo.length, cabeca: cabeca.length, profundidade, valor: "" });
      for (const c of dosFilhos) campos.push({ ...c, inicio: c.inicio + desloc, fim: c.fim + desloc });
      out.push(...cabeca, ...corpo);
    } else {
      const cabeca = WIRE[no.tipo] === 2 ? [...k, ...varint(no.corpo.length)] : k;
      campos.push({ caminho, nome: no.nome, numero: no.numero, wire: WIRE[no.tipo], tipo: no.tipo, inicio, fim: inicio + cabeca.length + no.corpo.length, cabeca: cabeca.length, profundidade, valor: no.valor });
      out.push(...cabeca, ...no.corpo);
    }
  }
  return out;
}

const texto = (nome: string, numero: number, s: string): No => ({ nome, numero, tipo: "string", valor: s, corpo: utf8(s) });

function anyValue(v: AnyValue): No[] {
  if (v.stringValue !== undefined) return [texto("string_value", 1, v.stringValue)];
  if (v.boolValue !== undefined) return [{ nome: "bool_value", numero: 2, tipo: "varint", valor: String(v.boolValue), corpo: varint(v.boolValue ? 1 : 0) }];
  if (v.intValue !== undefined) return [{ nome: "int_value", numero: 3, tipo: "varint", valor: v.intValue, corpo: varint(BigInt(v.intValue)) }];
  return [];
}

function atributos(attrs: readonly KeyValue[], numero: number): No[] {
  return attrs.map((a) => ({ nome: "attributes", numero, tipo: "message", filhos: [texto("key", 1, a.key), { nome: "value", numero: 2, tipo: "message", filhos: anyValue(a.value) }] }));
}

const KIND = ["", "INTERNAL", "SERVER", "CLIENT", "PRODUCER", "CONSUMER"];

function span(s: OtelSpan): No[] {
  const nos: No[] = [
    { nome: "trace_id", numero: 1, tipo: "bytes", valor: s.traceId, corpo: hexParaBytes(s.traceId) },
    { nome: "span_id", numero: 2, tipo: "bytes", valor: s.spanId, corpo: hexParaBytes(s.spanId) },
  ];
  if (s.parentSpanId !== undefined && s.parentSpanId !== "") nos.push({ nome: "parent_span_id", numero: 4, tipo: "bytes", valor: s.parentSpanId, corpo: hexParaBytes(s.parentSpanId) });
  nos.push(
    texto("name", 5, s.name),
    { nome: "kind", numero: 6, tipo: "varint", valor: `${s.kind} (${KIND[s.kind]})`, corpo: varint(s.kind) },
    { nome: "start_time_unix_nano", numero: 7, tipo: "fixed64", valor: s.startTimeUnixNano, corpo: fixed64(BigInt(s.startTimeUnixNano)) },
    { nome: "end_time_unix_nano", numero: 8, tipo: "fixed64", valor: s.endTimeUnixNano, corpo: fixed64(BigInt(s.endTimeUnixNano)) },
    ...atributos(s.attributes, 9),
  );
  return nos;
}

function arvoreDaRequisicao(req: ExportTraceServiceRequest): No[] {
  return req.resourceSpans.map((rs) => ({
    nome: "resource_spans",
    numero: 1,
    tipo: "message",
    filhos: [
      { nome: "resource", numero: 1, tipo: "message", filhos: atributos(rs.resource.attributes, 1) },
      ...rs.scopeSpans.map(
        (ss): No => ({
          nome: "scope_spans",
          numero: 2,
          tipo: "message",
          filhos: [{ nome: "scope", numero: 1, tipo: "message", filhos: [texto("name", 1, ss.scope.name)] }, ...ss.spans.map((sp): No => ({ nome: "spans", numero: 2, tipo: "message", filhos: span(sp) }))],
        }),
      ),
    ],
  }));
}

function codificarArvore(nos: readonly No[]): Codificacao {
  const campos: CampoCodificado[] = [];
  const bytes = escrever(nos, 0, 0, "", campos);
  return { bytes: Uint8Array.from(bytes), campos };
}

/** O `ExportTraceServiceRequest` em protobuf, com o mapa de cada campo. */
export function codificarRequisicao(req: ExportTraceServiceRequest): Codificacao {
  return codificarArvore(arvoreDaRequisicao(req));
}

/** As primeiras `n` folhas da árvore, na ordem de escrita, com as mensagens que as contêm. */
function podar(nos: readonly No[], n: number): { nos: No[]; resto: number } {
  const out: No[] = [];
  let resto = n;
  for (const no of nos) {
    if (resto <= 0) break;
    if (no.tipo === "message") {
      const dentro = podar(no.filhos, resto);
      if (dentro.nos.length === 0) continue;
      out.push({ ...no, filhos: dentro.nos });
      resto = dentro.resto;
    } else {
      out.push(no);
      resto -= 1;
    }
  }
  return { nos: out, resto };
}

const folhas = (nos: readonly No[]): number => nos.reduce((s, no) => s + (no.tipo === "message" ? folhas(no.filhos) : 1), 0);

/** Uma mensagem em volta do campo novo que mudou de comprimento. */
export interface Reacao {
  readonly campo: CampoCodificado;
  readonly antes: number;
  readonly depois: number;
  /** O varint do comprimento ganhou um byte: tudo depois dele andou uma casa. */
  readonly cresceu: boolean;
}

export interface EtapaDaCodificacao {
  readonly n: number;
  /** O campo escrito nesta etapa. */
  readonly campo: CampoCodificado;
  readonly cod: Codificacao;
  /** Mensagens que abriram nesta etapa (a cabeça delas apareceu agora). */
  readonly abertas: readonly CampoCodificado[];
  /** Mensagens que já existiam e mudaram de comprimento. */
  readonly reacoes: readonly Reacao[];
}

/**
 * A codificação em etapas: a requisição com uma folha, com duas, … até todas.
 * Cada etapa é uma codificação inteira de verdade, então o que muda de uma
 * para a outra é exatamente a reação do formato ao campo novo: a cabeça das
 * mensagens que abrem, e o comprimento de todas as que o envolvem — que,
 * passando de 127, ganha um byte e empurra o resto.
 */
export function etapasDaCodificacao(req: ExportTraceServiceRequest): readonly EtapaDaCodificacao[] {
  const arvore = arvoreDaRequisicao(req);
  const total = folhas(arvore);
  const etapas: EtapaDaCodificacao[] = [];
  let anterior: Codificacao = { bytes: new Uint8Array(), campos: [] };
  for (let n = 1; n <= total; n += 1) {
    const cod = codificarArvore(podar(arvore, n).nos);
    const antes = new Map(anterior.campos.map((c) => [c.caminho, c]));
    const novos = cod.campos.filter((c) => !antes.has(c.caminho));
    const campo = novos.find((c) => c.tipo !== "message")!;
    const abertas = novos.filter((c) => c.tipo === "message");
    const reacoes: Reacao[] = [];
    for (const c of cod.campos) {
      const a = antes.get(c.caminho);
      if (a === undefined || c.tipo !== "message") continue;
      const da = a.fim - a.inicio - a.cabeca;
      const de = c.fim - c.inicio - c.cabeca;
      if (da !== de) reacoes.push({ campo: c, antes: da, depois: de, cresceu: c.cabeca > a.cabeca });
    }
    etapas.push({ n, campo, cod, abertas, reacoes });
    anterior = cod;
  }
  return etapas;
}

/** O mesmo envelope em OTLP/JSON, em bytes UTF-8 — para comparar o tamanho. */
export function bytesEmJson(req: ExportTraceServiceRequest): number {
  return new TextEncoder().encode(JSON.stringify(req)).length;
}

export const hex = (b: number): string => b.toString(16).padStart(2, "0");
