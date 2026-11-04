import { idHex } from "../anatomia/carga.js";

/**
 * Um log que sabe o trace dele: o contexto ativo, por thread, e a ponte que o
 * lê na hora do log.
 *
 * Um redutor puro. O processo tem threads, e cada thread tem a pilha de spans
 * ativos — o contexto é **da thread**, não do processo. Quatro verbos:
 * `abrirSpan`, `fecharSpan`, `logar` e `criarThread` (com ou sem levar o
 * contexto junto).
 *
 * O `LogRecord` ganha `trace_id` e `span_id` como **campos** quando a ponte do
 * log (log bridge / appender do SDK) está instalada: ela lê o contexto ativo da
 * thread que chamou o logger. Sem ponte, o desenvolvedor escreve o id no texto
 * da mensagem — e o backend, que junta por campo, não junta nada.
 *
 * Fontes: [Logs data model · TraceId/SpanId](https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-traceid),
 * [Logs Bridge API](https://opentelemetry.io/docs/specs/otel/logs/api/)
 * e [Context](https://opentelemetry.io/docs/specs/otel/context/).
 */

export interface Contexto {
  readonly traceId: string;
  readonly spanId: string;
}

export interface SpanDoLog extends Contexto {
  readonly nome: string;
  readonly parentId?: string;
  readonly thread: string;
  readonly aberto: boolean;
}

export interface RegistroDeLog {
  readonly n: number;
  readonly thread: string;
  readonly corpo: string;
  /** Campos do LogRecord: só a ponte os preenche, lendo o contexto ativo. */
  readonly traceId?: string;
  readonly spanId?: string;
}

export interface EstadoDoLog {
  readonly ponte: boolean;
  /** A pilha de spans ativos de cada thread. O topo é o contexto ativo. */
  readonly threads: Readonly<Record<string, readonly Contexto[]>>;
  readonly spans: readonly SpanDoLog[];
  readonly logs: readonly RegistroDeLog[];
  readonly seq: number;
}

export function novoProcesso(ponte: boolean): EstadoDoLog {
  return { ponte, threads: { main: [] }, spans: [], logs: [], seq: 0 };
}

export const contextoAtivo = (e: EstadoDoLog, thread: string): Contexto | null => {
  const pilha = e.threads[thread] ?? [];
  return pilha[pilha.length - 1] ?? null;
};

export function abrirSpan(e: EstadoDoLog, thread: string, nome: string): EstadoDoLog {
  const pai = contextoAtivo(e, thread);
  const seq = e.seq + 1;
  const ctx: Contexto = { traceId: pai?.traceId ?? idHex(32, `log:trace:${seq}`), spanId: idHex(16, `log:span:${seq}`) };
  const span: SpanDoLog = { ...ctx, nome, thread, aberto: true, ...(pai === null ? {} : { parentId: pai.spanId }) };
  return { ...e, seq, spans: [...e.spans, span], threads: { ...e.threads, [thread]: [...(e.threads[thread] ?? []), ctx] } };
}

export function fecharSpan(e: EstadoDoLog, thread: string): EstadoDoLog {
  const ativo = contextoAtivo(e, thread);
  if (ativo === null) return e;
  return {
    ...e,
    spans: e.spans.map((s) => (s.spanId === ativo.spanId ? { ...s, aberto: false } : s)),
    threads: { ...e.threads, [thread]: (e.threads[thread] ?? []).slice(0, -1) },
  };
}

/**
 * O desenvolvedor chama o logger. Com ponte, o registro sai com os campos do
 * contexto ativo **desta thread**. Sem ponte, o melhor que se faz é escrever o
 * id na mensagem, e isso é texto.
 */
export function logar(e: EstadoDoLog, thread: string, mensagem: string): EstadoDoLog {
  const ctx = contextoAtivo(e, thread);
  const n = e.logs.length + 1;
  const registro: RegistroDeLog =
    e.ponte && ctx !== null
      ? { n, thread, corpo: mensagem, traceId: ctx.traceId, spanId: ctx.spanId }
      : { n, thread, corpo: !e.ponte && ctx !== null ? `${mensagem} trace_id=${ctx.traceId}` : mensagem };
  return { ...e, logs: [...e.logs, registro] };
}

/**
 * Uma thread nova. O contexto não atravessa sozinho: ou quem cria a thread o
 * leva junto (`propagar`), ou ela nasce sem contexto ativo.
 */
export function criarThread(e: EstadoDoLog, de: string, nova: string, propagar: boolean): EstadoDoLog {
  const ctx = contextoAtivo(e, de);
  return { ...e, threads: { ...e.threads, [nova]: propagar && ctx !== null ? [ctx] : [] } };
}

export type Juncao = { readonly log: RegistroDeLog; readonly span: SpanDoLog; readonly motivo: "joined" } | { readonly log: RegistroDeLog; readonly motivo: "text-only" | "no-context" };

/**
 * O que o backend consegue fazer: juntar o log ao span **pelo campo**. Um id
 * escrito no texto não é campo; sem contexto, não há o que juntar.
 */
export function juntar(e: EstadoDoLog): Juncao[] {
  const porId = new Map(e.spans.map((s) => [s.spanId, s]));
  return e.logs.map((log) => {
    if (log.spanId !== undefined && porId.has(log.spanId)) return { log, span: porId.get(log.spanId)!, motivo: "joined" };
    return { log, motivo: log.corpo.includes("trace_id=") ? "text-only" : "no-context" };
  });
}

// ── O roteiro do showcase: um handler de checkout ──

export interface OpcoesDoLog {
  /** O appender do SDK (log bridge) está instalado. */
  readonly ponte: boolean;
  /** Quem cria a thread do e-mail leva o contexto junto. */
  readonly propagar: boolean;
}

export const OPCOES_DO_LOG: OpcoesDoLog = { ponte: true, propagar: true };

export type PassoDoLog =
  | { readonly tipo: "abrir"; readonly thread: string; readonly nome: string }
  | { readonly tipo: "fechar"; readonly thread: string }
  | { readonly tipo: "logar"; readonly thread: string; readonly mensagem: string }
  | { readonly tipo: "thread"; readonly de: string; readonly nova: string };

export const ROTEIRO_DO_LOG: readonly PassoDoLog[] = [
  { tipo: "abrir", thread: "main", nome: "POST /checkout" },
  { tipo: "logar", thread: "main", mensagem: "cart loaded" },
  { tipo: "abrir", thread: "main", nome: "charge card" },
  { tipo: "logar", thread: "main", mensagem: "card authorized" },
  { tipo: "fechar", thread: "main" },
  { tipo: "thread", de: "main", nova: "worker" },
  { tipo: "logar", thread: "worker", mensagem: "receipt email queued" },
  { tipo: "fechar", thread: "main" },
  { tipo: "logar", thread: "main", mensagem: "request finished" },
];

export function aplicar(e: EstadoDoLog, p: PassoDoLog, propagar: boolean): EstadoDoLog {
  switch (p.tipo) {
    case "abrir":
      return abrirSpan(e, p.thread, p.nome);
    case "fechar":
      return fecharSpan(e, p.thread);
    case "logar":
      return logar(e, p.thread, p.mensagem);
    case "thread":
      return criarThread(e, p.de, p.nova, propagar);
  }
}

/** Cada passo do roteiro e o estado depois dele. */
export function rodarLog(opcoes: OpcoesDoLog = OPCOES_DO_LOG): { readonly passo: PassoDoLog; readonly estado: EstadoDoLog }[] {
  let e = novoProcesso(opcoes.ponte);
  return ROTEIRO_DO_LOG.map((passo) => {
    e = aplicar(e, passo, opcoes.propagar);
    return { passo, estado: e };
  });
}
