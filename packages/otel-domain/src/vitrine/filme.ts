import { film, line, pt, type Box, type Film, type Glyph, type Point, type Shape, type Tone } from "@ovh/motion";
import { ICONES_OTEL as I } from "../icones/icones.js";
import { attribute, toOtlpJson, type ExportTraceServiceRequest, type OtelSpan } from "../otlp.js";

/**
 * A vitrine do Collector: dos serviços até o envelope que vai no fio.
 *
 * O modo showcase do lab do pipeline. Quatro níveis aninhados no mesmo mundo:
 * os serviços e o Collector; o pipeline de traces lá dentro; o batch processor
 * enchendo a fila; e a requisição que o exporter manda, aberta campo a campo.
 * O envelope é montado por `toOtlpJson` — os mesmos tipos do resto do
 * handbook — e o tamanho que o filme mostra é o do JSON serializado, contado.
 */
export interface DetalheDaVitrineOtel {
  readonly nivel: number;
  readonly linhas: readonly (readonly [string, string])[];
}

/** Ids determinísticos: a mesma vitrine a cada visita. */
function hex(semente: number, digitos: number): string {
  let s = semente >>> 0 || 1;
  let out = "";
  while (out.length < digitos) {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    out += (s & 0xf).toString(16);
  }
  return out;
}

const SERVICOS = [
  { nome: "checkout", spans: ["POST /checkout", "PlaceOrder", "ReserveStock", "SELECT orders"], tom: "kind-1" as Tone },
  { nome: "payments", spans: ["POST /charge", "Authorize", "Capture", "INSERT ledger"], tom: "kind-3" as Tone },
];
const TAMANHO_DO_LOTE = 8;

export function envelopeDaVitrine(): { requisicao: ExportTraceServiceRequest; bytes: number; spans: { servico: string; nome: string; tom: Tone }[] } {
  const traceId = hex(7, 32);
  const resourceSpans = SERVICOS.flatMap((s, i) => {
    const spans: OtelSpan[] = s.spans.map((nome, j) => ({
      traceId,
      spanId: hex(100 + i * 10 + j, 16),
      ...(j > 0 ? { parentSpanId: hex(100 + i * 10, 16) } : {}),
      name: nome,
      kind: j === 0 ? 2 : 1,
      startTimeUnixNano: String(1_700_000_000_000_000_000 + j * 1_000_000),
      endTimeUnixNano: String(1_700_000_000_000_000_000 + j * 1_000_000 + 400_000),
      attributes: [attribute("service.name", s.nome)],
    }));
    return toOtlpJson({ attributes: [attribute("service.name", s.nome)] }, spans, "io.opentelemetry.handbook").resourceSpans;
  });
  const requisicao: ExportTraceServiceRequest = { resourceSpans };
  return {
    requisicao,
    bytes: new TextEncoder().encode(JSON.stringify(requisicao)).length,
    spans: SERVICOS.flatMap((s) => s.spans.map((nome) => ({ servico: s.nome, nome, tom: s.tom }))),
  };
}

const NIVEL = [
  { lod: { vanish: 1.25 }, k: 1 },
  { lod: { appear: 1.8, vanish: 7 }, k: 0.43 },
  { lod: { appear: 7, vanish: 19 }, k: 0.099 },
  { lod: { appear: 19 }, k: 0.0357 },
] as const;

const B = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });
const dir = (b: Box, f = 0.5): Point => pt(b.x + b.w, b.y + b.h * f);
const esq = (b: Box, f = 0.5): Point => pt(b.x, b.y + b.h * f);

export function filmeDaVitrineOtel(): Film<DetalheDaVitrineOtel> {
  const env = envelopeDaVitrine();
  const f = film<DetalheDaVitrineOtel>({ width: 1280, height: 720, gap: 500, maxZoom: 60 });
  const no = (n: number, id: string, box: Box, label: string, opt: { sub?: string; tone?: Tone; shape?: Shape; hidden?: boolean; icon?: Glyph } = {}) =>
    f.add({ type: "node", id, box, label, ...(opt.icon === undefined ? {} : { icon: opt.icon }), sublabel: opt.sub ?? "", tone: opt.tone ?? "processor", shape: opt.shape ?? "box", textScale: NIVEL[n]!.k, lod: NIVEL[n]!.lod, hidden: opt.hidden === true, layer: n });
  const fio = (n: number, id: string, a: Point, b: Point, tone: Tone = "ink") =>
    f.add({ type: "link", id, path: line(a, b), tone, arrow: true, textScale: NIVEL[n]!.k, lod: NIVEL[n]!.lod, hidden: true, layer: n });
  const ficha = (n: number, id: string, path: ReturnType<typeof line>, label: string, sub: string, tone: Tone) =>
    f.add({ type: "token", id, path, label, sublabel: sub, tone, size: 5 * NIVEL[n]!.k, trail: 4, textScale: NIVEL[n]!.k, lod: NIVEL[n]!.lod, hidden: true, layer: 10 + n });
  const regiao = (n: number, id: string, box: Box, label: string, tone: Tone) =>
    f.add({ type: "region", id, box, label, tone, textScale: NIVEL[n]!.k, lod: NIVEL[n]!.lod, layer: -1 });
  const nota = (n: number, id: string, at: Point, label: string, tone: Tone = "ink", align: "start" | "middle" | "end" = "start") =>
    f.add({ type: "note", id, at, label, tone, align, textScale: NIVEL[n]!.k, lod: NIVEL[n]!.lod, hidden: true, layer: 20 + n });

  // ── nível 0 ──
  const S1 = B(80, 150, 210, 90);
  const S2 = B(80, 470, 210, 90);
  const COL = B(500, 230, 300, 260);
  const BACK = B(1010, 300, 200, 120);
  no(0, "svc:checkout", S1, "checkout", { sub: "app + SDK", tone: "kind-1", icon: I.service });
  no(0, "svc:payments", S2, "payments", { sub: "app + SDK", tone: "kind-3", icon: I.service });
  no(0, "collector", COL, "Collector", { sub: "traces pipeline", tone: "conduit", shape: "stack", icon: I.collector });
  no(0, "backend", BACK, "backend", { sub: "trace storage", tone: "container", shape: "cylinder", icon: I.backend });
  fio(0, "f:s1", dir(S1), esq(COL, 0.3), "kind-1");
  fio(0, "f:s2", dir(S2), esq(COL, 0.7), "kind-3");
  fio(0, "f:exp", dir(COL), esq(BACK), "conduit");
  env.spans.forEach((s, i) => ficha(0, `t0:${i}`, s.servico === "checkout" ? line(dir(S1), esq(COL, 0.3)) : line(dir(S2), esq(COL, 0.7)), "OTLP", s.nome, s.tom));
  ficha(0, "t0:exp", line(dir(COL), esq(BACK)), "EXPORT", `${env.bytes} B · ${TAMANHO_DO_LOTE} spans`, "conduit");

  // ── nível 1: o pipeline ──
  const o = { x: COL.x, y: COL.y };
  const L1 = (x: number, y: number, w: number, h: number) => B(o.x + x, o.y + y, w, h);
  const RCV = L1(14, 110, 62, 40);
  const MEM = L1(90, 110, 58, 40);
  const BAT = L1(160, 100, 70, 60);
  const EXP = L1(244, 110, 46, 40);
  regiao(1, "pipeline", COL, "service.pipelines.traces", "conduit");
  no(1, "rcv", RCV, "otlp", { sub: "receiver", tone: "conduit", shape: "pill", icon: I.receiver });
  no(1, "mem", MEM, "memory_limiter", { sub: "processor", tone: "processor", icon: I.limiter });
  no(1, "bat", BAT, "batch", { sub: "processor", tone: "processor", shape: "register", icon: I.batch });
  no(1, "exp", EXP, "otlphttp", { sub: "exporter", tone: "conduit", shape: "pill", icon: I.exporter });
  fio(1, "f1:a", dir(RCV), esq(MEM));
  fio(1, "f1:b", dir(MEM), esq(BAT));
  fio(1, "f1:c", dir(BAT), esq(EXP));
  for (const [i, s] of env.spans.slice(0, 3).entries()) {
    ficha(1, `t1:${i}:a`, line(dir(RCV), esq(MEM)), "SPAN", s.nome, s.tom);
    ficha(1, `t1:${i}:b`, line(dir(MEM), esq(BAT)), "SPAN", s.nome, s.tom);
  }

  // ── nível 2: o batch processor ──
  const bx = BAT.x;
  const by = BAT.y;
  const CELULAS = Array.from({ length: TAMANHO_DO_LOTE }, (_, i) => B(bx + 5 + (i % 4) * 10.5, by + 14 + Math.floor(i / 4) * 13, 9, 10));
  const REQ = B(bx + 50, by + 19, 16, 22);
  regiao(2, "dentro-batch", BAT, "batch · send_batch_size 8", "processor");
  CELULAS.forEach((c, i) => no(2, `cel:${i}`, c, `#${i + 1}`, { sub: "", tone: "muted" }));
  no(2, "req", REQ, "request", { sub: "→ exporter", tone: "conduit", shape: "memory", hidden: true });
  nota(2, "n:fila", pt(bx + 5, by + 46), "the batch fills by size\nor flushes on timeout", "muted");
  const entrada = pt(bx + 1, by + 30);
  env.spans.forEach((s, i) => ficha(2, `t2:${i}`, line(entrada, pt(CELULAS[i]!.x + 4.5, CELULAS[i]!.y + 5)), "SPAN", s.nome, s.tom));

  // ── nível 3: o envelope ──
  const rx = REQ.x;
  const ry = REQ.y;
  regiao(3, "env", REQ, "ExportTraceServiceRequest", "conduit");
  env.requisicao.resourceSpans.forEach((rs, i) => {
    const caixa = B(rx + 0.9, ry + 2.6 + i * 9.6, 14.2, 8.6);
    const servico = rs.resource.attributes[0]?.value.stringValue ?? "?";
    const tom = SERVICOS.find((s) => s.nome === servico)!.tom;
    regiao(3, `rs:${i}`, caixa, `ResourceSpans · service.name=${servico}`, tom);
    const escopo = B(caixa.x + 0.7, caixa.y + 2.0, caixa.w - 1.4, caixa.h - 2.6);
    regiao(3, `ss:${i}`, escopo, `ScopeSpans · ${rs.scopeSpans[0]!.scope.name}`, tom);
    rs.scopeSpans[0]!.spans.forEach((sp, j) => {
      const b = B(escopo.x + 0.5 + (j % 2) * 6.2, escopo.y + 1.5 + Math.floor(j / 2) * 2.3, 5.6, 1.9);
      no(3, `sp:${i}:${j}`, b, sp.name, { sub: `span ${sp.spanId.slice(0, 8)}…`, tone: tom, hidden: true });
    });
  });

  const base: (readonly [string, string])[] = [["spans", String(env.spans.length)], ["services", SERVICOS.map((s) => s.nome).join(", ")]];
  f.chapter(
    { id: "services", title: "Spans leave the services", body: "Two services end eight spans between them. Each SDK exports over OTLP to the Collector — one connection per service, spans as they finish.", detail: { nivel: 0, linhas: base } },
    (d) => {
      d.camera({ at: { zoom: 1 } }, { dur: 1 });
      d.draw(["f:s1", "f:s2"], { dur: 600 });
      d.stagger(env.spans, 170, (x, s, i) => {
        x.send(`t0:${i}`, { dur: 800 });
      });
      d.packet({ tag: "OTLP", tone: "kind-1", from: "checkout", to: "collector", protocol: "OTLP/gRPC", payload: "4 spans as they end" });
      d.packet({ tag: "OTLP", tone: "kind-3", from: "payments", to: "collector", protocol: "OTLP/gRPC", payload: "4 spans as they end" });
      d.glow("collector", 1).ping("collector").wait(700);
    },
  );
  f.chapter(
    { id: "pipeline", title: "Down: the traces pipeline", body: "Inside the Collector, a pipeline is the order the config lists: a receiver accepts OTLP, memory_limiter protects the process, batch groups the spans, and an exporter sends them on.", detail: { nivel: 1, linhas: [...base, ["receivers", "[otlp]"], ["processors", "[memory_limiter, batch]"], ["exporters", "[otlphttp]"]] } },
    (d) => {
      d.camera({ box: COL }, { dur: 2200 });
      d.draw(["f1:a", "f1:b", "f1:c"], { dur: 600 });
      d.stagger([0, 1, 2], 260, (x, i) => {
        x.send(`t1:${i}:a`, { dur: 600 }).send(`t1:${i}:b`, { dur: 600 });
      });
      d.glow("bat", 1).ping("bat").wait(600);
    },
  );
  f.chapter(
    { id: "batch", title: "Down: the batch fills", body: `The batch processor holds spans until it has ${TAMANHO_DO_LOTE} or the timeout fires, then hands one request to the exporter. Fewer, larger requests — at the price of a little latency.`, detail: { nivel: 2, linhas: [["send_batch_size", String(TAMANHO_DO_LOTE)], ["timeout", "200ms (default)"], ["queued", `${TAMANHO_DO_LOTE} / ${TAMANHO_DO_LOTE}`]] } },
    (d) => {
      d.camera({ box: BAT }, { dur: 2400 });
      d.stagger(env.spans, 260, (x, s, i) => {
        x.send(`t2:${i}`, { dur: 500 });
        x.set(`cel:${i}`, { tone: s.tom, sublabel: s.servico }).glow(`cel:${i}`, 1, { dur: 200 }).ping(`cel:${i}`);
      });
      d.show("n:fila", { dur: 300 });
      d.show("req", { dur: 500 }).glow("req", 1).ping("req");
      d.packet({ tag: "BATCH", tone: "conduit", from: "batch", to: "otlphttp", protocol: "pipeline", payload: `${TAMANHO_DO_LOTE} spans · ${SERVICOS.length} resources` });
      d.wait(700);
    },
  );
  f.chapter(
    { id: "envelope", title: "Down: what goes on the wire", body: "The request groups spans by the resource that produced them, then by instrumentation scope. Resource attributes are written once per group, not once per span — that is why batching also shrinks the payload.", detail: { nivel: 3, linhas: [["ResourceSpans", String(env.requisicao.resourceSpans.length)], ["ScopeSpans", String(env.requisicao.resourceSpans.length)], ["spans", String(env.spans.length)], ["OTLP/JSON size", `${env.bytes} B`]] } },
    (d) => {
      d.camera({ box: REQ }, { dur: 2400 });
      d.stagger(env.requisicao.resourceSpans.flatMap((rs, i) => rs.scopeSpans[0]!.spans.map((_, j) => `sp:${i}:${j}`)), 160, (x, id) => {
        x.show(id, { dur: 350 });
      });
      d.packet({ tag: "OTLP", tone: "conduit", from: "otlphttp", to: "backend", protocol: "OTLP/HTTP JSON", payload: `ExportTraceServiceRequest · ${env.requisicao.resourceSpans.length} ResourceSpans · ${env.spans.length} spans`, bytes: env.bytes });
      d.wait(1400);
    },
  );
  f.chapter(
    { id: "export", title: "Back up: one request out", body: `Eight spans arrived as eight messages; one request of ${env.bytes} bytes leaves. The backend stores the spans and rebuilds the trace from their ids.`, detail: { nivel: 0, linhas: [...base, ["requests out", "1"], ["bytes", String(env.bytes)]] } },
    (d) => {
      d.camera({ at: { zoom: 1 } }, { dur: 2600 });
      d.together((x) => x.draw("f:exp", { dur: 700 }), (x) => x.send("t0:exp", { dur: 1000 }));
      d.glow("backend", 1).ping("backend").wait(1200);
    },
  );
  return f.build();
}

