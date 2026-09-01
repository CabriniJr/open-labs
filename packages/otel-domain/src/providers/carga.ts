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
/**
 * A espécie da carga.
 *
 * O número **não nomeia uma cor**: ele nomeia proeminência, do que mais puxa o
 * olho ao que menos puxa. Quem escolhe a tinta é o catálogo do palco; quem
 * escolhe o quanto aquela carga importa é este arquivo, e é decisão de domínio.
 *
 * Duas escolhas que valem justificativa:
 *
 * - **o descarte vem primeiro.** Num lab sobre quem decide o que sai do
 *   processo, a coisa que não se pode perder de vista é a carga que morre. Ela
 *   é o único evento aqui que é irreversível;
 * - **span e lote dividem a mesma tinta**, porque um lote **é** spans. A forma
 *   já separa os dois — um ponto contra um punhado —, e gastar uma segunda cor
 *   para dizer o que a forma já disse é gastar a distinção que falta para o
 *   envelope, que é outra coisa de verdade: dali para a frente não são mais
 *   spans, é um documento.
 */
export function especieDaCarga(m: Message): number | undefined {
  switch (m.kind) {
    case "dropped":
      return 1;
    case "span":
    case "batch":
      return 2;
    case "otlp-traces":
    case "otlp-logs":
    case "otlp-metrics":
      return 3;
    case "log":
      return 4;
    case "measurement":
    case "point":
      return 5;
    default:
      return undefined;
  }
}

/**
 * O que a carga leva, em uma linha, para o rótulo em cima do fio.
 *
 * Peso, e não conteúdo: um lote de 512 spans não cabe num rótulo, e o que o
 * leitor precisa saber olhando a linha é **quantos** atravessaram — que é o
 * número que muda quando ele mexe num controle.
 */
export function leituraDaCarga(m: Message): string | undefined {
  if (m.kind === "dropped") return `−${m.weight}`;
  if (m.weight <= 0) return undefined;
  return String(m.weight);
}
