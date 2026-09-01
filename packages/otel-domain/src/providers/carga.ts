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
