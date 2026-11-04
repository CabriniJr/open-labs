import { idHex } from "../anatomia/carga.js";
import { formatTraceparent, parseTraceparent } from "../traceparent.js";

/**
 * Propagar por uma fila: o contexto viaja **dentro da mensagem**, ou não viaja.
 *
 * Um redutor puro, com o relógio dado por quem chama. O produtor atende uma
 * requisição (um trace novo), abre o span de `publish` e — se injeta — escreve o
 * `traceparent` desse span nos headers da mensagem. A fila guarda. O consumidor
 * tira e extrai:
 *
 * - **uma mensagem** — o span de `process` tem como **pai** o span de `publish`:
 *   o trace continua, do outro lado da fila;
 * - **um lote** — mensagens de traces diferentes chegam juntas, e um span só não
 *   pode ter três pais. Ele abre um trace próprio e aponta para cada `publish`
 *   com um **link**.
 *
 * Sem injeção, o consumidor não tem o que extrair: o span de `process` nasce
 * raiz de um trace novo, e o trace do produtor termina no `publish`. Nada erra.
 *
 * Fontes: [Messaging spans](https://opentelemetry.io/docs/specs/semconv/messaging/messaging-spans/),
 * [Links between spans](https://opentelemetry.io/docs/specs/otel/overview/#links-between-spans)
 * e [Injecting context](https://opentelemetry.io/docs/specs/otel/context/api-propagators/).
 */

export type TipoDoSpan = "SERVER" | "PRODUCER" | "CONSUMER";

export interface SpanDaFila {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentId?: string;
  readonly nome: string;
  readonly tipo: TipoDoSpan;
  readonly servico: "checkout" | "fulfillment";
  /** Os spans para os quais este aponta sem ser filho deles. */
  readonly links: readonly { readonly traceId: string; readonly spanId: string }[];
  readonly inicio: number;
}

export interface Mensagem {
  readonly id: string;
  readonly pedido: number;
  readonly publicadaEm: number;
  readonly headers: Readonly<Record<string, string>>;
}

export interface Consumo {
  readonly mensagens: readonly (Mensagem & { readonly esperou: number })[];
  readonly span: SpanDaFila;
  readonly modo: "um" | "lote";
}

export interface EstadoDaFila {
  readonly t: number;
  readonly injetar: boolean;
  readonly pedidos: number;
  readonly fila: readonly Mensagem[];
  readonly spans: readonly SpanDaFila[];
  readonly consumos: readonly Consumo[];
}

export function novaFila(injetar: boolean): EstadoDaFila {
  return { t: 0, injetar, pedidos: 0, fila: [], spans: [], consumos: [] };
}

export function esperar(e: EstadoDaFila, ms: number): EstadoDaFila {
  return { ...e, t: e.t + ms };
}

/** Uma requisição chega ao checkout, que publica um pedido. */
export function publicar(e: EstadoDaFila): EstadoDaFila {
  const n = e.pedidos + 1;
  const traceId = idHex(32, `fila:trace:${n}`);
  const raiz: SpanDaFila = { traceId, spanId: idHex(16, `fila:req:${n}`), nome: "POST /orders", tipo: "SERVER", servico: "checkout", links: [], inicio: e.t };
  const pub: SpanDaFila = { traceId, spanId: idHex(16, `fila:pub:${n}`), parentId: raiz.spanId, nome: "orders publish", tipo: "PRODUCER", servico: "checkout", links: [], inicio: e.t };
  const headers = e.injetar ? { traceparent: formatTraceparent({ traceId, spanId: pub.spanId, sampled: true }) } : {};
  const msg: Mensagem = { id: `msg-${n}`, pedido: n, publicadaEm: e.t, headers };
  return { ...e, pedidos: n, fila: [...e.fila, msg], spans: [...e.spans, raiz, pub] };
}

/** O consumidor tira uma mensagem: o span de process é filho do publish, se houver de quem. */
export function consumirUm(e: EstadoDaFila): EstadoDaFila {
  const [msg, ...resto] = e.fila;
  if (msg === undefined) return e;
  const ctx = msg.headers.traceparent === undefined ? null : parseTraceparent(msg.headers.traceparent);
  const span: SpanDaFila = {
    traceId: ctx?.traceId ?? idHex(32, `fila:orfao:${msg.id}`),
    spanId: idHex(16, `fila:proc:${msg.id}`),
    ...(ctx === null ? {} : { parentId: ctx.spanId }),
    nome: "orders process",
    tipo: "CONSUMER",
    servico: "fulfillment",
    links: [],
    inicio: e.t,
  };
  return { ...e, fila: resto, spans: [...e.spans, span], consumos: [...e.consumos, { mensagens: [{ ...msg, esperou: e.t - msg.publicadaEm }], span, modo: "um" }] };
}

/** O consumidor tira tudo de uma vez: um span, um trace novo, um link por mensagem que trouxe contexto. */
export function consumirLote(e: EstadoDaFila): EstadoDaFila {
  if (e.fila.length === 0) return e;
  const chave = e.fila.map((m) => m.id).join(",");
  const links = e.fila.flatMap((m) => {
    const ctx = m.headers.traceparent === undefined ? null : parseTraceparent(m.headers.traceparent);
    return ctx === null ? [] : [{ traceId: ctx.traceId, spanId: ctx.spanId }];
  });
  const span: SpanDaFila = { traceId: idHex(32, `fila:lote:${chave}`), spanId: idHex(16, `fila:lote:span:${chave}`), nome: "orders process", tipo: "CONSUMER", servico: "fulfillment", links, inicio: e.t };
  return { ...e, fila: [], spans: [...e.spans, span], consumos: [...e.consumos, { mensagens: e.fila.map((m) => ({ ...m, esperou: e.t - m.publicadaEm })), span, modo: "lote" }] };
}

/** O que o backend mostra: um trace por id, com quem aponta para ele de fora. */
export interface TraceDaFila {
  readonly traceId: string;
  readonly spans: readonly SpanDaFila[];
  /** Spans de outros traces que têm link para um span deste. */
  readonly apontadoPor: readonly SpanDaFila[];
  /** O trace começa num CONSUMER sem pai e sem link: um órfão do outro lado da fila. */
  readonly orfao: boolean;
}

export function tracesDaFila(e: EstadoDaFila): TraceDaFila[] {
  const ids = [...new Set(e.spans.map((s) => s.traceId))];
  return ids.map((traceId) => {
    const spans = e.spans.filter((s) => s.traceId === traceId);
    const apontadoPor = e.spans.filter((s) => s.traceId !== traceId && s.links.some((l) => l.traceId === traceId));
    const raiz = spans.find((s) => s.parentId === undefined);
    return { traceId, spans, apontadoPor, orfao: raiz?.tipo === "CONSUMER" && raiz.links.length === 0 };
  });
}

// ── O roteiro do showcase ──

export interface OpcoesDaFila {
  readonly injetar: boolean;
  readonly modo: "um" | "lote";
}

export const OPCOES_DA_FILA: OpcoesDaFila = { injetar: true, modo: "um" };

export type PassoDaFila = { readonly tipo: "publicar" } | { readonly tipo: "esperar"; readonly ms: number } | { readonly tipo: "consumir" };

export function roteiroDaFila(opcoes: OpcoesDaFila): PassoDaFila[] {
  const publicar3: PassoDaFila[] = [{ tipo: "publicar" }, { tipo: "esperar", ms: 400 }, { tipo: "publicar" }, { tipo: "esperar", ms: 400 }, { tipo: "publicar" }];
  const consumir: PassoDaFila[] =
    opcoes.modo === "lote"
      ? [{ tipo: "esperar", ms: 2200 }, { tipo: "consumir" }]
      : [{ tipo: "esperar", ms: 2200 }, { tipo: "consumir" }, { tipo: "esperar", ms: 700 }, { tipo: "consumir" }, { tipo: "esperar", ms: 700 }, { tipo: "consumir" }];
  return [...publicar3, ...consumir];
}

export function rodarFila(opcoes: OpcoesDaFila = OPCOES_DA_FILA): { readonly passo: PassoDaFila; readonly estado: EstadoDaFila }[] {
  let e = novaFila(opcoes.injetar);
  return roteiroDaFila(opcoes).map((passo) => {
    e = passo.tipo === "publicar" ? publicar(e) : passo.tipo === "esperar" ? esperar(e, passo.ms) : opcoes.modo === "lote" ? consumirLote(e) : consumirUm(e);
    return { passo, estado: e };
  });
}
