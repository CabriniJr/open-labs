/**
 * Instrumentação sem código: o que o agente vê, e o que fica escuro.
 *
 * O agente (Java agent, `opentelemetry-instrument`, o operator do Kubernetes)
 * instrumenta **bibliotecas**: o framework HTTP que recebe, o driver do banco, o
 * cliente HTTP que sai. Ele não sabe o que o seu código faz entre uma e outra. O
 * resultado é um trace com as bordas certas e um miolo opaco: o tempo que o
 * span do servidor passa sem filho nenhum é "self time" que ninguém explica.
 *
 * Um modelo puro: a pilha de uma requisição de checkout, passo a passo, com o
 * tempo de cada passo. O leitor escolhe quais passos do próprio código ganham
 * um span manual; o resto é o que o agente fez.
 *
 * Fontes: [Zero-code instrumentation](https://opentelemetry.io/docs/concepts/instrumentation/zero-code/)
 * e [Instrumentation libraries](https://opentelemetry.io/docs/concepts/instrumentation/libraries/).
 */

export type Camada = "framework" | "proprio" | "db" | "cliente";

export interface Passo {
  readonly id: string;
  readonly nome: string;
  readonly camada: Camada;
  readonly inicio: number;
  readonly fim: number;
  /** O nome do span que o agente cria, quando cria. */
  readonly spanAuto?: string;
}

/** Os passos de um POST /checkout, em ms. O `framework` é o span raiz e cobre tudo. */
export const PASSOS: readonly Passo[] = [
  { id: "cache", nome: "look up cart in local cache", camada: "proprio", inicio: 5, fim: 15 },
  { id: "preco", nome: "price the cart", camada: "proprio", inicio: 15, fim: 70 },
  { id: "db", nome: "SELECT stock", camada: "db", inicio: 70, fim: 110, spanAuto: "SELECT shop.stock" },
  { id: "regras", nome: "apply discount rules", camada: "proprio", inicio: 110, fim: 180 },
  { id: "pagamento", nome: "POST payments/charge", camada: "cliente", inicio: 180, fim: 230, spanAuto: "POST" },
];

export const DURACAO_DA_REQUISICAO = 240;
export const SPAN_RAIZ = "POST /checkout";

export const PASSOS_PROPRIOS = PASSOS.filter((p) => p.camada === "proprio").map((p) => p.id);

export interface SpanZeroCode {
  readonly nome: string;
  readonly inicio: number;
  readonly fim: number;
  readonly origem: "auto" | "manual";
  readonly camada: Camada;
}

export interface TraceZeroCode {
  readonly spans: readonly SpanZeroCode[];
  /** Os trechos do span raiz sem filho nenhum: o que o trace não explica. */
  readonly escuro: readonly { readonly inicio: number; readonly fim: number }[];
  readonly msEscuros: number;
  /** Fração do tempo da requisição coberta por algum span filho. */
  readonly cobertura: number;
}

export function traceDaRequisicao(manuais: ReadonlySet<string> = new Set()): TraceZeroCode {
  const spans: SpanZeroCode[] = [{ nome: SPAN_RAIZ, inicio: 0, fim: DURACAO_DA_REQUISICAO, origem: "auto", camada: "framework" }];
  for (const p of PASSOS) {
    if (p.spanAuto !== undefined) spans.push({ nome: p.spanAuto, inicio: p.inicio, fim: p.fim, origem: "auto", camada: p.camada });
    else if (manuais.has(p.id)) spans.push({ nome: p.nome, inicio: p.inicio, fim: p.fim, origem: "manual", camada: p.camada });
  }
  const filhos = spans.slice(1).sort((a, b) => a.inicio - b.inicio);
  const escuro: { inicio: number; fim: number }[] = [];
  let cursor = 0;
  for (const s of filhos) {
    if (s.inicio > cursor) escuro.push({ inicio: cursor, fim: s.inicio });
    cursor = Math.max(cursor, s.fim);
  }
  if (cursor < DURACAO_DA_REQUISICAO) escuro.push({ inicio: cursor, fim: DURACAO_DA_REQUISICAO });
  const msEscuros = escuro.reduce((n, e) => n + e.fim - e.inicio, 0);
  return { spans, escuro, msEscuros, cobertura: 1 - msEscuros / DURACAO_DA_REQUISICAO };
}
