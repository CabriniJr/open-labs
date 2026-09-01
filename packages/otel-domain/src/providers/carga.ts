import type { Message } from "@ovh/depth-core";

/**
 * O que viaja pelas linhas deste lab.
 *
 * **Peso, não partícula.** Um lote de 512 spans é UMA mensagem de `weight: 512`,
 * e nunca 512 objetos: o motor conta peso, e instanciar um objeto por span é o
 * erro que trava o lab no browser assim que alguém sobe a carga.
 *
 * O registro é magro de propósito. Ele carrega só o que o envelope OTLP precisa
 * mais o bit que decide se o span sai — e o bit está aqui, e não numa flag do
 * modelo, porque é ele que o `traceparent` carrega pela rede.
 */
export interface RegistroDeSpan {
  readonly traceId: string;
  readonly spanId: string;
  readonly nome: string;
  /** O `InstrumentationScope`: de qual tracer este span nasceu. */
  readonly escopo: string;
  /** O bit `sampled` do `traceparent`. */
  readonly amostrado: boolean;
  /** O tick em que a instrumentação o criou. */
  readonly inicio: number;
}

/**
 * Um atributo de recurso. Mora aqui, e não em `labels.ts`, porque ele é **dado
 * do modelo** e não texto de tela: é ele que aparece campo por campo no envelope
 * OTLP, e o teste do invariante compara os dois.
 */
export interface AtributoDeRecurso {
  readonly chave: string;
  readonly valor: string;
}

export interface PlacaDeRecurso {
  readonly titulo: string;
  readonly attributes: readonly AtributoDeRecurso[];
}

const embaralhar = (texto: string): number => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < texto.length; i += 1) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
};

/**
 * Um id em hexadecimal, do comprimento que o W3C Trace Context exige — 32
 * dígitos para o trace, 16 para o span —, derivado da semente.
 *
 * Existe porque `traceparent` **recusa** id fora do formato, e um lab que
 * mostrasse `trace-3-0` na tela estaria ensinando um formato que a rede não
 * aceita. Determinístico: replay tem de reproduzir o mesmo header.
 */
export function idHex(digitos: number, semente: string): string {
  let bruto = "";
  for (let i = 0; bruto.length < digitos; i += 1) {
    bruto += embaralhar(`${semente}:${i}`).toString(16).padStart(8, "0");
  }
  const cortado = bruto.slice(0, digitos);
  // A spec proíbe o id todo em zeros, e um hash pode chegar lá.
  return /^0+$/u.test(cortado) ? `${cortado.slice(0, -1)}1` : cortado;
}

/** Os spans que uma mensagem carrega. Vazio quando ela não carrega nenhum. */
export function spansDa(m: Message): readonly RegistroDeSpan[] {
  const carga = m.data["spans"];
  return Array.isArray(carga) ? (carga as readonly RegistroDeSpan[]) : [];
}

/**
 * A espécie da carga, para o desenho.
 *
 * Existe porque `kind` de mensagem é palavra de **domínio**, e `depth-ui` é
 * agnóstico: um `[data-kind="span"]` no CSS do motor seria a fronteira furada.
 * Quem desenha pergunta a espécie ao domínio, e o domínio responde numa palavra
 * que o motor já conhece.
 */
export type EspecieDaCarga = "unidade" | "lote" | "pedido" | "medida";

export function especieDaCarga(m: Message): EspecieDaCarga {
  if (m.kind === "batch") return "lote";
  if (m.kind === "collect" || m.kind === "flush") return "pedido";
  if (m.kind === "point") return "medida";
  return "unidade";
}
