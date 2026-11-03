import { film, sequence, type Box, type Director, type Film, type Tone } from "@ovh/motion";
import { propagar, type Chamada, type OpcoesDePropagacao, type Propagacao, type Servico, type SpanGerado } from "./propagacao.js";

/**
 * O filme do lab "Hard context and baggage", escrito sobre o palco animado.
 *
 * Nada aqui é roteiro solto: cada ficha, cada barra e cada cor vêm de
 * `propagar()`. O proxy descarta os headers? A ficha que sai dele fica sem
 * contexto e a barra de pagamentos nasce na cor de OUTRO trace — porque o
 * modelo criou outra raiz, não porque o filme mandou pintar.
 */
export type Foco = "version" | "trace-id" | "parent-id" | "flags" | "baggage";

export interface DetalheDoContexto {
  /** O salto em evidência: os headers como chegaram. */
  readonly chamada: Chamada | null;
  readonly foco: Foco | null;
  /** Os spans que já existem neste ponto da história. */
  readonly spans: readonly SpanGerado[];
  /** Os spans já chegaram ao backend? */
  readonly exportados: boolean;
}

const LANES = ["browser", "gateway", "checkout", "inventory", "proxy", "payments", "collector"] as const;
type Lane = (typeof LANES)[number];

const ROTULO: Record<Lane, [string, string]> = {
  browser: ["Browser", "web SDK"],
  gateway: ["API gateway", "instrumented"],
  checkout: ["checkout", "instrumented"],
  inventory: ["inventory", "instrumented"],
  proxy: ["legacy proxy", "no SDK"],
  payments: ["payments", "instrumented"],
  collector: ["Collector", "→ backend"],
};

const TOM_DO_SERVICO: Record<Lane, Tone> = {
  browser: "processor",
  gateway: "processor",
  checkout: "processor",
  inventory: "processor",
  proxy: "container",
  payments: "processor",
  collector: "conduit",
};

/** A linha do diagrama em que cada salto acontece. */
const LINHA_DA_CHAMADA = [0, 1, 2, 3, 4] as const;
const FIM_DOS_SPANS = 5.1;
const LINHA_DO_EXPORT = 5.75;

export const LARGURA = 1280;
export const ALTURA = 720;

const curto = (hex: string) => `${hex.slice(0, 4)}…`;

export function rotuloDoContexto(headers: Readonly<Record<string, string>>): string {
  const tp = headers.traceparent;
  if (tp === undefined) return "no context";
  const [, trace = "", span = "", flags = ""] = tp.split("-");
  return `${curto(trace)} ${curto(span)} ${flags}`;
}

export function filmeDoContexto(opcoes: OpcoesDePropagacao): { filme: Film<DetalheDoContexto>; propagacao: Propagacao } {
  const p = propagar(opcoes);
  const seq = sequence({ lanes: LANES, width: LARGURA, top: 60, headWidth: 136, headHeight: 58, firstRow: 186, rowHeight: 70 });
  const f = film<DetalheDoContexto>({ width: LARGURA, height: ALTURA, gap: 450, maxZoom: 1.75 });

  // Cada trace ganha uma espécie de carga; não amostrado fica apagado.
  const tomDoTrace = new Map<string, Tone>();
  p.traces.forEach((t, i) => tomDoTrace.set(t.traceId, (["kind-1", "kind-3", "kind-4"] as const)[i] ?? "kind-5"));
  const tomDoSpan = (s: SpanGerado): Tone => (s.amostrado ? tomDoTrace.get(s.traceId) ?? "kind-5" : "muted");

  const bottom = seq.bottom(7.4);
  for (const lane of LANES) {
    const [label, sub] = ROTULO[lane];
    f.add({ type: "lane", id: `lane:${lane}`, head: seq.head(lane), bottom, label, sublabel: sub, tone: TOM_DO_SERVICO[lane], hidden: lane === "collector", sticky: true });
  }

  // As barras de span: uma por span, do salto que o criou até o fim da história.
  const linhaDeEntrada = (servico: Servico): number => {
    if (servico === "browser") return -0.35;
    const i = p.chamadas.findIndex((c) => c.para === servico);
    return LINHA_DA_CHAMADA[i] ?? 0;
  };
  for (const s of p.spans) {
    f.add({
      type: "bar",
      id: `span:${s.servico}`,
      box: seq.activation(s.servico, linhaDeEntrada(s.servico), FIM_DOS_SPANS, 14),
      tone: tomDoSpan(s),
      label: curto(s.spanId),
      hidden: true,
      layer: 1,
    });
  }

  // Os saltos: a seta e a ficha que a percorre carregando o contexto.
  p.chamadas.forEach((c, i) => {
    const row = LINHA_DA_CHAMADA[i]!;
    const semContexto = c.headers.traceparent === undefined;
    const pai = p.spans.find((s) => s.servico === c.de) ?? null;
    const tone: Tone = semContexto ? "live" : pai !== null ? tomDoSpan(pai) : c.extraido?.sampled === false ? "muted" : tomDoTrace.get(c.extraido?.traceId ?? "") ?? "ink";
    f.add({ type: "link", id: `call:${i}`, layer: 2, path: seq.message(c.de, c.para, row), arrow: true, label: c.rota, sublabel: semContexto ? "headers dropped" : "", tone: semContexto ? "live" : "ink", hidden: true, labelAt: 0.5 });
    f.add({ type: "token", id: `ctx:${i}`, path: seq.message(c.de, c.para, row), tone, label: rotuloDoContexto(c.headers), hidden: true, layer: 3, size: 6 });
  });

  // A exportação: um span por ficha, de cada serviço até o Collector.
  const exportaveis = p.spans.filter((s) => s.amostrado);
  exportaveis.forEach((s, i) => {
    const row = LINHA_DO_EXPORT + i * 0.32;
    f.add({ type: "link", id: `export-line:${s.servico}`, path: seq.message(s.servico, "collector", row), dashed: true, tone: "muted", hidden: true });
    f.add({ type: "token", id: `export:${s.servico}`, path: seq.message(s.servico, "collector", row), tone: tomDoSpan(s), hidden: true, layer: 3, size: 4.5, trail: 4 });
  });

  // As notas: o que o leitor precisa ler perto de onde aconteceu.
  /** Uma nota ao lado da raia: `"end"` à esquerda dela, `"start"` à direita — nunca em cima do fio. */
  const nota = (id: string, lane: Lane, row: number, text: string, tone: Tone, align: "start" | "end") =>
    f.add({ type: "note", id, at: { x: seq.x(lane) + (align === "start" ? 18 : -18), y: seq.row(row) }, align, label: text, tone, hidden: true, layer: 4 });

  const raiz = p.raiz;
  nota("n:root", "browser", -0.78, `trace ${curto(raiz.traceId)} · ${raiz.amostrado ? "sampled" : "not sampled"}`, tomDoSpan(raiz), "start");
  const pagamentos = p.chamadas[4]!;
  const proxyEntrada = p.chamadas[3]!;
  const orfao = pagamentos.span !== null && pagamentos.span.traceId !== raiz.traceId;
  nota("n:proxy", "proxy", 3.4, opcoes.proxyRepassa ? "no span here —\nheaders pass through" : "no span here —\nheaders dropped", opcoes.proxyRepassa ? "ink" : "live", "end");
  nota(
    "n:payments",
    "payments",
    4.45,
    orfao ? `new root: trace ${curto(pagamentos.span!.traceId)}\nbaggage lost` : `parent ${curto(pagamentos.span?.parentId ?? "")}\n= checkout's span`,
    orfao ? "live" : tomDoSpan(pagamentos.span ?? raiz),
    "end",
  );
  nota("n:baggage", "inventory", 2.45, `baggage: ${Object.entries(p.chamadas[2]!.span?.baggage ?? {}).map(([k, v]) => `${k}=${v}`).join(", ") || "∅"}`, "kind-2", "end");
  nota("n:collector", "collector", LINHA_DO_EXPORT - 0.6, exportaveis.length > 0 ? `${exportaveis.length} spans · ${new Set(exportaveis.map((s) => s.traceId)).size} trace(s)` : "nothing to export", exportaveis.length > 0 ? "conduit" : "live", "end");

  const caixa = (de: Lane, ate: Lane, r0: number, r1: number): Box => {
    const x0 = seq.x(de) - 90;
    const x1 = seq.x(ate) + 90;
    const y0 = r0 < 0 ? 40 : seq.row(r0) - 110;
    return { x: x0, y: y0, w: x1 - x0, h: seq.row(r1) - y0 + 30 };
  };

  const conhecidos = (n: number) => p.spans.slice(0, n);
  const detalhe = (chamada: Chamada | null, foco: Foco | null, n: number, exportados = false): DetalheDoContexto => ({ chamada, foco, spans: conhecidos(n), exportados });
  const indiceDoSpan = (servico: Servico) => p.spans.findIndex((s) => s.servico === servico) + 1;

  f.chapter(
    {
      id: "born",
      title: "A trace is born",
      body: "The click has no parent context, so the browser's SDK starts a root span. The sampler decides once, here, and that decision travels with every hop that follows.",
      detail: detalhe(null, null, 1),
    },
    (d) => {
      d.camera({ box: caixa("browser", "checkout", -1, 1.4) }, { dur: 10 });
      d.show(LANES.filter((l) => l !== "collector").map((l) => `lane:${l}`), { dur: 500 });
      d.draw("span:browser", { dur: 700 }).glow("lane:browser", 1).ping("lane:browser");
      d.show("n:root", { dur: 400 });
      d.wait(900);
    },
  );

  const salto = (i: number, foco: Foco | null) => (d: Director<DetalheDoContexto>) => {
    const c = p.chamadas[i]!;
    d.together(
      (x) => x.draw(`call:${i}`, { dur: 1000 }),
      (x) => x.send(`ctx:${i}`, { dur: 1000 }),
    );
    d.glow(`lane:${c.de}`, 0).glow(`lane:${c.para}`, 1).ping(`lane:${c.para}`);
    if (c.span !== null) d.draw(`span:${c.para}`, { dur: 600 }).beat({ detail: detalhe(c, foco, indiceDoSpan(c.para)) });
    else d.beat({ detail: detalhe(c, foco, p.spans.length > 0 ? indiceDoSpan(c.de) : 0) });
  };

  f.chapter(
    {
      id: "inject",
      title: "Inject: context becomes a header",
      body: "Before the request leaves, the propagator writes the active span context into the traceparent header. Four fields, dash-separated, fixed width.",
    },
    (d) => {
      salto(0, null)(d);
      const c = p.chamadas[0]!;
      const n = indiceDoSpan("gateway");
      d.beat({ title: "version", body: "00 — the only version defined today. A parser that sees anything else must not guess.", detail: detalhe(c, "version", n) }).wait(1500);
      d.beat({ title: "trace-id", body: "32 hex digits that every span of this request will share. It is the only thing that makes them one trace.", detail: detalhe(c, "trace-id", n) }).wait(1700);
      d.beat({ title: "parent-id", body: "The span id of the caller — here, the browser's root span. The receiver uses it as its parent.", detail: detalhe(c, "parent-id", n) }).wait(1700);
      d.beat({ title: "trace-flags", body: "01 means sampled. Downstream, a parent-based sampler obeys it instead of rolling its own dice.", detail: detalhe(c, "flags", n) }).wait(1700);
    },
  );

  f.chapter(
    {
      id: "extract",
      title: "Extract, then continue",
      body: "The gateway extracts the header, creates a child span with the browser's span as its parent, and injects its own span id into the next request. The trace-id never changes; the parent-id changes on every hop.",
    },
    (d) => {
      d.camera({ box: caixa("gateway", "inventory", 0, 2) });
      salto(1, "parent-id")(d);
      d.wait(1400);
    },
  );

  f.chapter(
    {
      id: "fanout",
      title: "Fan-out, and the baggage rides along",
      body: "Checkout calls two services at once. Both requests carry the same trace-id and the same parent — checkout's span — so both become siblings. The baggage header travels beside traceparent: application data, propagated, never sampled.",
    },
    (d) => {
      d.camera({ box: caixa("checkout", "payments", 1.2, 4.2) });
      d.together(salto(2, "baggage"), (x) =>
        x.wait(260).together(
          (y) => y.draw("call:3", { dur: 1000 }),
          (y) => y.send("ctx:3", { dur: 1000 }),
        ),
      );
      d.glow("lane:proxy", 1).ping("lane:proxy");
      d.show("n:baggage");
      d.wait(1600);
    },
  );

  f.chapter(
    {
      id: "proxy",
      title: "The hop nobody instrumented",
      body: opcoes.proxyRepassa
        ? "The proxy has no SDK, so it creates no span — it is invisible in the trace. But it forwards the headers untouched, so payments extracts checkout's context and the trace stays whole."
        : "The proxy rebuilds the request and drops headers it does not know. Payments receives no traceparent, finds no parent, and starts a root span: a second trace, disconnected from the first. The baggage is gone too.",
    },
    (d) => {
      d.camera({ box: caixa("checkout", "payments", 2.6, 5.2) });
      d.show("n:proxy");
      salto(4, opcoes.proxyRepassa ? "parent-id" : null)(d);
      d.show("n:payments");
      if (orfao) d.ping("lane:payments", { dur: 900 });
      d.wait(1800);
    },
  );

  f.chapter(
    {
      id: "export",
      title: "Export: spans meet in the backend",
      body:
        exportaveis.length === 0
          ? "Every span here inherited sampled = 0. They existed in memory, carried context to the next hop, and were never exported. Propagation still worked; recording did not."
          : orfao
            ? "Each service exports its own spans. The backend groups them by trace-id — and finds two traces where there was one request."
            : "Each service exports its own spans, separately and in any order. The backend reassembles one tree, because every span carries the same trace-id and a parent-id that points to a span it has.",
    },
    (d) => {
      d.camera({ at: { zoom: 1 } }, { dur: 1100 });
      d.glow(LANES.map((l) => `lane:${l}`), 0, { wait: false });
      d.show("lane:collector");
      d.stagger(exportaveis, 220, (x, s) => {
        x.draw(`export-line:${s.servico}`, { dur: 500, wait: false });
        x.send(`export:${s.servico}`, { dur: 900 });
        x.hide(`export-line:${s.servico}`, { dur: 400, wait: false });
      });
      d.glow("lane:collector", 1).ping("lane:collector");
      d.show("n:collector");
      d.beat({ detail: detalhe(null, null, p.spans.length, true) });
      d.wait(2200);
    },
  );

  return { filme: f.build(), propagacao: p };
}
