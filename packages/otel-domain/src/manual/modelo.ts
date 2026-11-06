import { idHex } from "../anatomia/carga.js";

/**
 * Spans à mão: um tracer em miniatura e o programa que o chama.
 *
 * Um redutor puro, com três regras da spec e nenhuma outra:
 * 1. **só sai o que terminou** — o processador manda o span ao exporter no
 *    `end()`; um span que nunca termina fica na memória e nunca chega;
 * 2. **depois do `end()`, nada gruda** — `setAttribute` num span encerrado é
 *    ignorado (a spec manda ignorar, e o SDK avisa no log, se avisar);
 * 3. **o filho cita o pai** — se o pai nunca é exportado, o filho chega ao
 *    backend apontando para um span que não existe: um órfão.
 *
 * E um aviso de convenção, que não é regra do SDK mas custa caro: o nome do
 * span é de baixa cardinalidade. Um id no nome faz de cada execução uma
 * operação diferente; o id mora num atributo.
 *
 * Fontes: [Span · End](https://opentelemetry.io/docs/specs/otel/trace/api/#end),
 * [Set Attributes](https://opentelemetry.io/docs/specs/otel/trace/api/#set-attributes)
 * e [Span name](https://opentelemetry.io/docs/specs/otel/trace/api/#span).
 */

export type Valor = string | number;

export interface SpanManual {
  readonly id: string;
  readonly nome: string;
  readonly parentId?: string;
  readonly atributos: Readonly<Record<string, Valor>>;
  /** Chaves que chegaram depois do `end()` e foram descartadas. */
  readonly ignorados: readonly string[];
  readonly inicio: number;
  readonly fim?: number;
}

export interface EstadoManual {
  readonly t: number;
  readonly traceId: string;
  /** A pilha do contexto: o topo é o span ativo. */
  readonly pilha: readonly string[];
  readonly spans: readonly SpanManual[];
  /** Ids na ordem em que o exporter os recebeu. */
  readonly exportados: readonly string[];
}

export function novoTracer(): EstadoManual {
  return { t: 0, traceId: idHex(32, "manual:trace"), pilha: [], spans: [], exportados: [] };
}

const PASSO_MS = 10;

export function iniciar(e: EstadoManual, nome: string): EstadoManual {
  const id = idHex(16, `manual:${e.spans.length}:${nome}`);
  const pai = e.pilha[e.pilha.length - 1];
  const span: SpanManual = { id, nome, ...(pai === undefined ? {} : { parentId: pai }), atributos: {}, ignorados: [], inicio: e.t };
  return { ...e, t: e.t + PASSO_MS, spans: [...e.spans, span], pilha: [...e.pilha, id] };
}

/** `span.setAttribute` no span com este nome. Encerrado, a chave é descartada. */
export function atribuir(e: EstadoManual, alvo: string, chave: string, valor: Valor): EstadoManual {
  const span = [...e.spans].reverse().find((s) => s.nome === alvo);
  if (span === undefined) return e;
  const novo: SpanManual = span.fim === undefined ? { ...span, atributos: { ...span.atributos, [chave]: valor } } : { ...span, ignorados: [...span.ignorados, chave] };
  return { ...e, t: e.t + PASSO_MS, spans: e.spans.map((s) => (s.id === span.id ? novo : s)) };
}

/** `span.end()`: carimba o fim, tira da pilha, e o processador entrega ao exporter. */
export function terminar(e: EstadoManual, alvo: string): EstadoManual {
  const span = [...e.spans].reverse().find((s) => s.nome === alvo && s.fim === undefined);
  if (span === undefined) return e;
  return {
    ...e,
    t: e.t + PASSO_MS,
    spans: e.spans.map((s) => (s.id === span.id ? { ...s, fim: e.t } : s)),
    pilha: e.pilha.filter((id) => id !== span.id),
    exportados: [...e.exportados, span.id],
  };
}

export interface NoBackend {
  readonly span: SpanManual;
  /** Cita um pai que o backend nunca recebeu. */
  readonly orfao: boolean;
}

/** O que o backend tem: só o que foi exportado, e quem ficou sem pai. */
export function noBackend(e: EstadoManual): { readonly recebidos: readonly NoBackend[]; readonly nuncaChegaram: readonly SpanManual[] } {
  const chegou = new Set(e.exportados);
  const porId = new Map(e.spans.map((s) => [s.id, s]));
  return {
    recebidos: e.exportados.map((id) => {
      const span = porId.get(id)!;
      return { span, orfao: span.parentId !== undefined && !chegou.has(span.parentId) };
    }),
    nuncaChegaram: e.spans.filter((s) => !chegou.has(s.id)),
  };
}

/** Um nome com id dentro: cada execução vira uma operação diferente. */
export function nomeDeAltaCardinalidade(nome: string): boolean {
  return /\d{3,}|[0-9a-f]{8,}/iu.test(nome);
}

// ── O programa do editor ──

export type Instrucao =
  | { readonly op: "start"; readonly nome: string; readonly codigo: string }
  | { readonly op: "attr"; readonly alvo: string; readonly chave: string; readonly valor: Valor; readonly codigo: string }
  | { readonly op: "end"; readonly alvo: string; readonly codigo: string };

/** O handler de checkout, instrumentado à mão. `nomeComId` troca o nome pela versão que custa caro. */
export function programa({ nomeComId }: { readonly nomeComId: boolean } = { nomeComId: false }): Instrucao[] {
  const raiz = nomeComId ? "checkout order 8812" : "checkout";
  return [
    { op: "start", nome: raiz, codigo: `const span = tracer.startSpan("${raiz}")` },
    { op: "attr", alvo: raiz, chave: "order.id", valor: 8812, codigo: `span.setAttribute("order.id", 8812)` },
    { op: "start", nome: "charge card", codigo: `const child = tracer.startSpan("charge card")` },
    { op: "attr", alvo: "charge card", chave: "payment.provider", valor: "acme", codigo: `child.setAttribute("payment.provider", "acme")` },
    { op: "end", alvo: "charge card", codigo: "child.end()" },
    { op: "end", alvo: raiz, codigo: "span.end()" },
    { op: "attr", alvo: raiz, chave: "order.total", valor: 129.9, codigo: `span.setAttribute("order.total", 129.9)` },
  ];
}

export function executar(e: EstadoManual, i: Instrucao): EstadoManual {
  switch (i.op) {
    case "start":
      return iniciar(e, i.nome);
    case "attr":
      return atribuir(e, i.alvo, i.chave, i.valor);
    case "end":
      return terminar(e, i.alvo);
  }
}

export interface OpcoesManuais {
  /** A linha `span.end()` comentada: o span da requisição nunca termina. */
  readonly esquecerEnd: boolean;
  /** O nome do span leva o id do pedido. */
  readonly nomeComId: boolean;
}

export const OPCOES_MANUAIS: OpcoesManuais = { esquecerEnd: false, nomeComId: false };

/** O programa, com as linhas que a opção comenta, e o estado depois de cada uma que rodou. */
export function rodarManual(opcoes: OpcoesManuais = OPCOES_MANUAIS): { readonly instrucao: Instrucao; readonly linha: number; readonly comentada: boolean; readonly estado: EstadoManual }[] {
  let e = novoTracer();
  const prog = programa({ nomeComId: opcoes.nomeComId });
  const raiz = prog[0]!.op === "start" ? prog[0]!.nome : "";
  return prog.map((instrucao, linha) => {
    const comentada = opcoes.esquecerEnd && instrucao.op === "end" && instrucao.alvo === raiz;
    if (!comentada) e = executar(e, instrucao);
    return { instrucao, linha, comentada, estado: e };
  });
}
