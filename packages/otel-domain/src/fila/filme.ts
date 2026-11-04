import { film, line, pt, type Box, type Film, type Tone } from "@ovh/motion";
import { ICONES_OTEL as I } from "../icones/icones.js";
import { parseTraceparent } from "../traceparent.js";
import { OPCOES_DA_FILA, rodarFila, tracesDaFila, type OpcoesDaFila, type SpanDaFila } from "./modelo.js";

/**
 * O filme do lab "Propagating through a queue", derivado de `rodarFila`.
 *
 * Em cima: o checkout publica três pedidos (três requisições, três traces), a
 * fila guarda cada mensagem com os headers que ela trouxe, e o fulfillment
 * consome — uma por vez, ou o lote. Embaixo: o que o backend montou. No 3D, a
 * fila é um silo: a altura de cada mensagem é quanto tempo ela esperou.
 */
export interface DetalheDaFila {
  readonly nivel: number;
  readonly linhas: readonly (readonly [string, string])[];
}

const B = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });
const curto = (id: string) => `${id.slice(0, 4)}…`;
const seg = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
const TOM_DO_PEDIDO: readonly Tone[] = ["kind-1", "kind-3", "kind-5"];

export const LARGURA_DA_FILA = 1280;
export const ALTURA_DA_FILA = 720;

export function filmeDaFila(opcoes: OpcoesDaFila = OPCOES_DA_FILA): Film<DetalheDaFila> {
  const corrida = rodarFila(opcoes);
  const fim = corrida.at(-1)!.estado;
  const traces = tracesDaFila(fim);
  const f = film<DetalheDaFila>({ width: LARGURA_DA_FILA, height: ALTURA_DA_FILA, maxZoom: 1.9 });
  const tomDoTrace = (traceId: string): Tone => {
    const i = fim.spans.findIndex((s) => s.traceId === traceId && s.tipo === "SERVER");
    if (i !== -1) return TOM_DO_PEDIDO[fim.spans.filter((s) => s.tipo === "SERVER").findIndex((s) => s.traceId === traceId)] ?? "ink";
    const t = traces.find((x) => x.traceId === traceId);
    return t?.orfao === true ? "live" : "kind-4";
  };

  // ── o produtor, a fila e o consumidor ──
  const PROD = B(40, 140, 190, 90);
  const FILA = B(370, 50, 320, 300);
  const CONS = B(810, 140, 190, 90);
  const BACK = B(1080, 130, 170, 110);
  f.add({ type: "node", id: "prod", box: PROD, label: "checkout", sublabel: "producer", tone: "processor", icon: I.service });
  f.add({ type: "region", id: "fila", box: FILA, label: "orders · broker", tone: "conduit" });
  f.add({ type: "node", id: "fila:topo", box: B(FILA.x + 20, FILA.y + 26, FILA.w - 40, 34), label: "orders", sublabel: opcoes.injetar ? "body + headers" : "body only", tone: "conduit", shape: "pill", icon: I.queue });
  f.add({ type: "node", id: "cons", box: CONS, label: "fulfillment", sublabel: opcoes.modo === "lote" ? "consumes a batch" : "one message at a time", tone: "processor", icon: I.service });
  f.add({ type: "node", id: "backend", box: BACK, label: "backend", sublabel: "traces", tone: "container", shape: "cylinder", icon: I.backend });

  const SLOT = (k: number) => B(FILA.x + 30, FILA.y + 84 + k * 70, FILA.w - 60, 54);
  const esperas = new Map(fim.consumos.flatMap((c) => c.mensagens.map((m) => [m.id, m.esperou] as const)));
  fim.consumos
    .flatMap((c) => c.mensagens)
    .forEach((m, k) => {
      const tp = m.headers.traceparent === undefined ? null : parseTraceparent(m.headers.traceparent);
      f.add({
        type: "node",
        id: `slot:${m.id}`,
        box: SLOT(k),
        label: `order #${m.pedido}`,
        sublabel: tp === null ? "headers: {}" : `traceparent ${curto(tp.traceId)}-${curto(tp.spanId)}`,
        tone: TOM_DO_PEDIDO[k] ?? "ink",
        hidden: true,
        // O silo: a altura da mensagem é o tempo que ela ficou guardada.
        height: 4 + (esperas.get(m.id) ?? 0) / 60,
        ...(tp === null ? {} : { icon: I.context }),
      });
      f.add({ type: "token", id: `pub:${m.id}`, path: line(pt(PROD.x + PROD.w, PROD.y + 45), pt(SLOT(k).x, SLOT(k).y + 27)), label: tp === null ? "PUBLISH" : "PUBLISH", sublabel: tp === null ? "no headers" : `traceparent ${curto(tp.spanId)}`, tone: TOM_DO_PEDIDO[k] ?? "ink", hidden: true, size: 5, ...(tp === null ? {} : { icon: I.context }) });
      f.add({ type: "token", id: `con:${m.id}`, path: line(pt(SLOT(k).x + SLOT(k).w, SLOT(k).y + 27), pt(CONS.x, CONS.y + 45)), label: "RECEIVE", sublabel: `order #${m.pedido}`, tone: TOM_DO_PEDIDO[k] ?? "ink", hidden: true, size: 5 });
    });

  // ── o backend: um trace por linha ──
  const TR = B(40, 380, 1200, 330);
  f.add({ type: "region", id: "traces", box: TR, label: "backend · what the traces became", tone: "container" });
  const COLUNA: Record<SpanDaFila["tipo"], number> = { SERVER: 210, PRODUCER: 470, CONSUMER: 790 };
  const linhaDe = new Map(traces.map((t, r) => [t.traceId, r] as const));
  const caixaDoSpan = (s: SpanDaFila) => B(TR.x + COLUNA[s.tipo], TR.y + 40 + linhaDe.get(s.traceId)! * 46, 230, 34);
  traces.forEach((t, r) => {
    f.add({ type: "note", id: `tr:${r}`, at: pt(TR.x + 20, TR.y + 57 + r * 46), label: `trace ${curto(t.traceId)}`, tone: tomDoTrace(t.traceId), align: "start", hidden: true });
    for (const s of t.spans) f.add({ type: "node", id: `sp:${s.spanId}`, box: caixaDoSpan(s), label: s.nome, sublabel: `${s.tipo} · ${s.parentId === undefined ? (s.links.length > 0 ? `${s.links.length} links` : "root") : `parent ${curto(s.parentId)}`}`, tone: tomDoTrace(s.traceId), shape: "pill", hidden: true, icon: I.trace });
    if (t.orfao) f.add({ type: "note", id: `orf:${r}`, at: pt(TR.x + TR.w - 24, TR.y + 57 + r * 46), label: "orphan: no parent, no link", tone: "live", align: "end", hidden: true });
  });
  const links = fim.spans.flatMap((s) => s.links.map((l, i) => ({ de: s, para: fim.spans.find((x) => x.spanId === l.spanId)!, i })));
  links.forEach(({ de, para, i }) => {
    const a = caixaDoSpan(de);
    const b = caixaDoSpan(para);
    f.add({ type: "link", id: `lk:${i}`, path: line(pt(a.x, a.y + 17), pt(b.x + b.w, b.y + 17)), tone: "kind-4", dashed: true, arrow: true, hidden: true, label: i === 0 ? "link" : "" });
  });

  // ── os capítulos ──
  const publicacoes = corrida.filter((x) => x.passo.tipo === "publicar");
  const consumos = corrida.filter((x) => x.passo.tipo === "consumir");
  const orfaos = traces.filter((t) => t.orfao).length;
  f.chapter(
    {
      id: "publish",
      title: "Three orders, three traces",
      body: opcoes.injetar
        ? "Three requests reach checkout, each its own trace. Each publishes an order, and the SDK injects the publish span's traceparent into the message headers — the same header a call would carry, riding inside the message."
        : "Three requests reach checkout, each its own trace. Each publishes an order — but nothing injects the context, so the message carries a body and no headers.",
      detail: { nivel: 0, linhas: [["orders", String(publicacoes.length)], ["traces so far", String(publicacoes.length)], ["headers", opcoes.injetar ? "traceparent" : "none"]] },
    },
    (d) => {
      d.camera({ at: { zoom: 1 } }, { dur: 1 });
      publicacoes.forEach(({ estado }) => {
        const m = estado.fila.at(-1)!;
        const raiz = estado.spans.at(-2)!;
        d.set("prod", { sublabel: `trace ${curto(raiz.traceId)}` }).glow("prod", 1).ping("prod");
        d.send(`pub:${m.id}`, { dur: 700 });
        d.show(`slot:${m.id}`, { dur: 300 }).ping(`slot:${m.id}`);
        d.packet({ tag: "PUBLISH", tone: TOM_DO_PEDIDO[m.pedido - 1] ?? "ink", from: "checkout", to: "orders", protocol: "AMQP", payload: m.headers.traceparent === undefined ? `order #${m.pedido} · headers {}` : `order #${m.pedido} · traceparent ${m.headers.traceparent}` });
        d.glow("prod", 0);
      });
      d.set("prod", { sublabel: "producer" });
      d.wait(500);
    },
  );
  f.chapter(
    {
      id: "wait",
      title: "The queue keeps the headers",
      body: "The broker stores the message as it came: body and headers together. Nothing runs while it waits — no span is open, and nobody holds the trace. In the isometric view, each message is as tall as the time it waited.",
      detail: { nivel: 1, linhas: fim.consumos.flatMap((c) => c.mensagens).map((m) => [`order #${m.pedido}`, `waited ${seg(m.esperou)}`] as const) },
    },
    (d) => {
      d.camera({ box: FILA }, { dur: 1400 });
      d.glow("fila:topo", 1).wait(1600).glow("fila:topo", 0);
      d.camera({ at: { zoom: 1 } }, { dur: 1200 });
    },
  );
  f.chapter(
    {
      id: "extract",
      title: !opcoes.injetar ? "Nothing to extract" : opcoes.modo === "lote" ? "Extract: one batch, three links" : "Extract: a parent",
      body: !opcoes.injetar
        ? "The consumer looks for a traceparent and finds none. Its process span becomes the root of a brand-new trace, and the producer's trace ends at publish. Nothing errored."
        : opcoes.modo === "lote"
          ? "Three messages from three traces arrive together. One span cannot have three parents, so the batch span starts its own trace and records a link to each publish span."
          : "The consumer extracts the traceparent and starts its process span as a child of publish. The trace continues on the far side of the queue, as if it were one call.",
      detail: { nivel: 2, linhas: [["consumed as", opcoes.modo === "lote" ? "one batch" : "one by one"], ["process spans", String(fim.spans.filter((s) => s.tipo === "CONSUMER").length)], ["links", String(links.length)], ["orphans", String(orfaos)]] },
    },
    (d) => {
      consumos.forEach(({ estado }) => {
        const c = estado.consumos.at(-1)!;
        d.glow("cons", 1).ping("cons");
        d.together(...c.mensagens.map((m) => (x: typeof d) => x.send(`con:${m.id}`, { dur: 800 })));
        d.hide(c.mensagens.map((m) => `slot:${m.id}`), { dur: 250 });
        d.packet({ tag: c.modo === "lote" ? "BATCH" : "RECEIVE", tone: tomDoTrace(c.span.traceId), from: "orders", to: "fulfillment", protocol: "AMQP", payload: `${c.mensagens.map((m) => `#${m.pedido}`).join(" ")} · span ${c.span.parentId === undefined ? (c.span.links.length > 0 ? `root + ${c.span.links.length} links` : "root, no context") : `child of ${curto(c.span.parentId)}`}` });
        d.glow("cons", 0).wait(300);
      });
      d.wait(500);
    },
  );
  f.chapter(
    {
      id: "backend",
      title: "Down: what the backend shows",
      body: !opcoes.injetar
        ? `Six traces for three orders: three that stop at publish, and ${orfaos} that start from nowhere on the consumer side. The queue cut every one in half.`
        : opcoes.modo === "lote"
          ? "Three producer traces, and one batch trace pointing at each of them. Following a link jumps from the batch to the request that produced the message — that is how a backend joins them."
          : "Three traces, each running through the queue: request, publish, process. The wait shows up as the gap between publish and process.",
      detail: { nivel: 3, linhas: [["traces", String(traces.length)], ["joined through the queue", String(traces.filter((t) => t.spans.some((s) => s.tipo === "CONSUMER") && t.spans.some((s) => s.tipo === "PRODUCER")).length + traces.filter((t) => t.apontadoPor.length > 0).length)], ["orphans", String(orfaos)]] },
    },
    (d) => {
      d.camera({ box: TR }, { dur: 1500 });
      d.stagger(traces, 260, (x, t, r) => {
        x.show(`tr:${r}`, { dur: 250 });
        x.stagger(t.spans, 120, (y, s) => {
          y.show(`sp:${s.spanId}`, { dur: 300 });
        });
        if (t.orfao) x.show(`orf:${r}`, { dur: 300 });
      });
      d.stagger(links, 200, (x, l) => {
        x.draw(`lk:${l.i}`, { dur: 600 });
      });
      d.wait(2200);
    },
  );
  return f.build();
}
