import { connect, film, pt, type Box, type Film, type Tone } from "@ovh/motion";
import { ICONES_OTEL as I } from "../icones/icones.js";
import { formatTraceparent, parseTraceparent } from "../traceparent.js";
import { idHex, type SpanExportado } from "./carga.js";
import { montar, type NoDaArvore } from "./estado.js";
import { SERVICOS, type Servico } from "./labels.js";

/**
 * O showcase da anatomia: uma requisição, quatro spans, e a árvore que só
 * existe quando o backend a monta.
 *
 * O modelo é o mesmo raciocínio do mundo da simulação, para UMA requisição e com
 * o tempo de cada span: cada serviço lê o `traceparent` que chegou, cria o span
 * com aquele pai, e escreve o próprio id no header que vai adiante. O span sai
 * quando termina — e o de baixo termina primeiro, então o backend recebe a
 * árvore de baixo para cima, e monta com `montar`, a mesma regra da simulação.
 *
 * As duas escolhas do leitor são os dois erros do roteiro: o header que um proxy
 * derruba antes do payments (duas árvores inteiras, nenhuma sabe da outra) e o
 * payments sem instrumentação (ele repassa o header, não exporta nada, e o
 * ledger se pendura no checkout — o salto some sem deixar buraco).
 */

export interface OpcoesDaVitrineDaAnatomia {
  /** Um proxy entre checkout e payments descarta o `traceparent`. */
  readonly derrubarCabecalho: boolean;
  /** O payments roda sem SDK: repassa o header e não exporta span. */
  readonly paymentsSemInstrumentacao: boolean;
}

export const OPCOES_DA_VITRINE_DA_ANATOMIA: OpcoesDaVitrineDaAnatomia = { derrubarCabecalho: false, paymentsSemInstrumentacao: false };

export interface SpanDaVitrine extends SpanExportado {
  readonly servico: Servico;
  /** Em ms desde a entrada no gateway. */
  readonly inicio: number;
  readonly fim: number;
}

export interface ChamadaDaVitrine {
  readonly de: Servico | "client";
  readonly para: Servico;
  readonly traceparent?: string;
}

/** Uma linha do waterfall: o span, a profundidade na árvore e se ele é órfão. */
export interface LinhaDoWaterfall {
  readonly span: SpanDaVitrine;
  readonly profundidade: number;
  readonly traco: number;
}

export interface RequisicaoDaVitrine {
  readonly chamadas: readonly ChamadaDaVitrine[];
  /** Na ordem dos serviços: quem existiu. */
  readonly spans: readonly SpanDaVitrine[];
  /** Na ordem em que chegaram ao backend: quem termina primeiro chega primeiro. */
  readonly chegada: readonly SpanDaVitrine[];
  /** As árvores que o backend montou, uma por `traceId`, na ordem da primeira raiz. */
  readonly arvores: readonly { readonly traceId: string; readonly raizes: readonly NoDaArvore[] }[];
  /** O waterfall: profundidade primeiro, como um backend desenha. */
  readonly waterfall: readonly LinhaDoWaterfall[];
  /** Serviços que atenderam e não exportaram. */
  readonly semSpan: readonly Servico[];
}

/** Quando cada serviço começa e termina, em ms. Aninhados: o de baixo cabe no de cima. */
const TEMPO: Readonly<Record<Servico, readonly [number, number]>> = {
  gateway: [0, 148],
  checkout: [12, 136],
  payments: [30, 118],
  ledger: [46, 94],
};

const N = 1;

export function umaRequisicao(opcoes: OpcoesDaVitrineDaAnatomia = OPCOES_DA_VITRINE_DA_ANATOMIA): RequisicaoDaVitrine {
  const chamadas: ChamadaDaVitrine[] = [];
  const spans: SpanDaVitrine[] = [];
  const semSpan: Servico[] = [];
  let header: string | undefined;
  let de: Servico | "client" = "client";
  for (const servico of SERVICOS) {
    chamadas.push({ de, para: servico, ...(header === undefined ? {} : { traceparent: header }) });
    const recebido = header === undefined ? null : parseTraceparent(header);
    const instrumentado = !(servico === "payments" && opcoes.paymentsSemInstrumentacao);
    let adiante = header;
    if (instrumentado) {
      const traceId = recebido?.traceId ?? idHex(32, `vitrine:trace:${servico}:${N}`);
      const spanId = idHex(16, `vitrine:span:${servico}:${N}`);
      const [inicio, fim] = TEMPO[servico];
      spans.push({ servico, traceId, spanId, ...(recebido === null ? {} : { parentId: recebido.spanId }), n: N, amostrado: true, inicio, fim });
      adiante = formatTraceparent({ traceId, spanId, sampled: true });
    } else semSpan.push(servico);
    // O proxy mora entre checkout e payments: o header que sai do checkout não chega.
    header = servico === "checkout" && opcoes.derrubarCabecalho ? undefined : adiante;
    de = servico;
  }

  const chegada = [...spans].sort((a, b) => a.fim - b.fim);
  const ids = [...new Set(spans.map((s) => s.traceId))];
  const arvores = ids.map((traceId) => ({ traceId, raizes: montar(chegada.filter((s) => s.traceId === traceId)) }));
  const porId = new Map(spans.map((s) => [s.spanId, s]));
  const waterfall: LinhaDoWaterfall[] = [];
  const descer = (no: NoDaArvore, profundidade: number, traco: number) => {
    waterfall.push({ span: porId.get(no.span.spanId)!, profundidade, traco });
    [...no.filhos].sort((a, b) => porId.get(a.span.spanId)!.inicio - porId.get(b.span.spanId)!.inicio).forEach((f) => descer(f, profundidade + 1, traco));
  };
  arvores.forEach((a, i) => a.raizes.forEach((r) => descer(r, 0, i)));
  return { chamadas, spans, chegada, arvores, waterfall, semSpan };
}

export interface DetalheDaVitrineDaAnatomia {
  readonly nivel: number;
  readonly linhas: readonly (readonly [string, string])[];
}

const curto = (id: string) => `${id.slice(0, 4)}…`;
const B = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });
/** O tom de cada trace: o primeiro no tom da casa, um segundo trace em outro — outra árvore. */
const TOM_DO_TRACE: readonly Tone[] = ["kind-1", "kind-3", "kind-5"];
const ROTULO: Readonly<Record<Servico, string>> = { gateway: "gateway", checkout: "checkout", payments: "payments", ledger: "ledger" };

export const LARGURA_DA_ANATOMIA = 1280;
export const ALTURA_DA_ANATOMIA = 720;

/** Altura de um degrau no 3D: um nível na árvore. */
const DEGRAU = 14;
/** ms → px no waterfall. */
const ESCALA = 5.2;

export function filmeDaVitrineDaAnatomia(opcoes: OpcoesDaVitrineDaAnatomia = OPCOES_DA_VITRINE_DA_ANATOMIA): Film<DetalheDaVitrineDaAnatomia> {
  const r = umaRequisicao(opcoes);
  const f = film<DetalheDaVitrineDaAnatomia>({ width: LARGURA_DA_ANATOMIA, height: ALTURA_DA_ANATOMIA, maxZoom: 1.8 });
  const tomDe = (traceId: string): Tone => TOM_DO_TRACE[r.arvores.findIndex((a) => a.traceId === traceId)] ?? "ink";
  const spanDe = (s: Servico) => r.spans.find((x) => x.servico === s);

  // ── os processos ──
  const CLIENT = B(40, 70, 130, 76);
  const SVC: Record<Servico, Box> = Object.fromEntries(SERVICOS.map((s, i) => [s, B(240 + i * 250, 70, 180, 76)])) as Record<Servico, Box>;
  const CARD: Record<Servico, Box> = Object.fromEntries(SERVICOS.map((s) => [s, B(SVC[s].x + 5, 196, 170, 58)])) as Record<Servico, Box>;
  f.add({ type: "node", id: "client", box: CLIENT, label: "client", sublabel: "POST /checkout", tone: "muted", icon: I.browser });
  for (const s of SERVICOS) {
    const sem = r.semSpan.includes(s);
    f.add({ type: "node", id: `svc:${s}`, box: SVC[s], label: ROTULO[s], sublabel: sem ? "no SDK" : "app + SDK", tone: sem ? "muted" : "processor", icon: I.service, height: 34 });
    const sp = spanDe(s);
    f.add({
      type: "node",
      id: `card:${s}`,
      box: CARD[s],
      label: sp === undefined ? "no span" : `span ${curto(sp.spanId)}`,
      sublabel: sp === undefined ? "passes the header on" : sp.parentId === undefined ? "root · no parent" : `parent ${curto(sp.parentId)}`,
      tone: sp === undefined ? "muted" : tomDe(sp.traceId),
      shape: "pill",
      hidden: true,
      elevation: 6,
      height: 10,
      icon: I.trace,
    });
  }

  // ── as chamadas, para frente, levando o header ──
  const caminhoDe = (c: ChamadaDaVitrine) => connect(c.de === "client" ? CLIENT : SVC[c.de], SVC[c.para], 6);
  r.chamadas.forEach((c, i) => {
    f.add({ type: "link", id: `call:${i}`, path: caminhoDe(c), tone: c.traceparent === undefined && c.de !== "client" ? "live" : "ink", arrow: true, hidden: true });
    const tp = c.traceparent === undefined ? null : parseTraceparent(c.traceparent);
    f.add({
      type: "token",
      id: `hdr:${i}`,
      path: caminhoDe(c),
      label: tp === null ? "HTTP" : "traceparent",
      sublabel: tp === null ? (c.de === "client" ? "no context yet" : "header dropped") : `${curto(tp.traceId)} · ${curto(tp.spanId)}`,
      tone: tp === null ? (c.de === "client" ? "muted" : "live") : tomDe(tp.traceId),
      hidden: true,
      size: 5.5,
      ...(tp === null ? {} : { icon: I.context }),
    });
  });
  // O proxy, quando existe, é uma peça no caminho — quem derruba tem cara.
  if (opcoes.derrubarCabecalho) {
    const meio = (SVC.checkout.x + SVC.checkout.w + SVC.payments.x) / 2;
    f.add({ type: "node", id: "proxy", box: B(meio - 34, 22, 68, 30), label: "proxy", sublabel: "strips headers", tone: "live", shape: "pill", hidden: true, icon: I.proxy });
  }

  // ── o backend e o waterfall ──
  const BACK = B(40, 440, 140, 120);
  const AREA = B(230, 320, 1010, 380);
  f.add({ type: "node", id: "backend", box: BACK, label: "backend", sublabel: "trace store", tone: "container", shape: "cylinder", icon: I.backend });
  f.add({ type: "region", id: "waterfall", box: AREA, label: "what the backend concluded", tone: "container" });
  const X0 = AREA.x + 150;
  const linhaY = (i: number, traco: number) => AREA.y + 50 + i * 54 + traco * 22;
  r.waterfall.forEach((l, i) => {
    const s = l.span;
    const y = linhaY(i, l.traco);
    f.add({
      type: "bar",
      id: `bar:${s.servico}`,
      box: B(X0 + s.inicio * ESCALA, y, (s.fim - s.inicio) * ESCALA, 30),
      grow: "right",
      label: `${ROTULO[s.servico]} · ${s.fim - s.inicio} ms`,
      tone: tomDe(s.traceId),
      hidden: true,
      elevation: l.profundidade * DEGRAU,
    });
    f.add({ type: "note", id: `nota:${s.servico}`, at: pt(AREA.x + 18 + l.profundidade * 14, y + 15), label: `${"  ".repeat(l.profundidade)}${l.profundidade === 0 ? "root" : "child"} · depth ${l.profundidade}`, tone: "muted", align: "start", hidden: true });
  });
  r.arvores.slice(1).forEach((a, i) => {
    const primeira = r.waterfall.findIndex((l) => l.traco === i + 1);
    f.add({ type: "note", id: `nota:trace:${i + 1}`, at: pt(AREA.x + AREA.w - 20, linhaY(primeira, i + 1) - 12), label: `a second trace · ${curto(a.traceId)}\nnothing links it to the first`, tone: "live", align: "end", hidden: true });
  });
  for (const p of r.semSpan) {
    f.add({ type: "note", id: `nota:sem:${p}`, at: pt(AREA.x + AREA.w - 20, AREA.y + AREA.h - 36), label: `${p} answered and sent nothing:\nits time now reads as ${SERVICOS[SERVICOS.indexOf(p) - 1]}'s`, tone: "live", align: "end", hidden: true });
  }

  // ── a exportação: cada um por conta própria, de lado, quando termina ──
  r.chegada.forEach((s) => {
    f.add({ type: "token", id: `exp:${s.servico}`, path: connect(CARD[s.servico], BACK, 6), label: "OTLP", sublabel: `span ${curto(s.spanId)}`, tone: tomDe(s.traceId), hidden: true, size: 4.5, trail: 4, icon: I.trace });
  });

  // ── os capítulos ──
  const traces = r.arvores.length;
  const raizes = r.arvores.reduce((n, a) => n + a.raizes.length, 0);
  f.chapter(
    {
      id: "request",
      title: "One request, four processes",
      body: "The click reaches the gateway with no context, so the gateway starts the trace. Every call after that carries a traceparent header — the trace id, and the id of the span that made the call.",
      detail: { nivel: 0, linhas: [["services", String(SERVICOS.length)], ["header", "traceparent"]] },
    },
    (d) => {
      d.camera({ at: { zoom: 1 } }, { dur: 1 });
      r.chamadas.forEach((c, i) => {
        if (opcoes.derrubarCabecalho && c.para === "payments") d.show("proxy", { dur: 300 }).glow("proxy", 1).ping("proxy");
        d.together(
          (x) => x.draw(`call:${i}`, { dur: 500 }),
          (x) => x.send(`hdr:${i}`, { dur: 800 }),
        );
        d.glow(`svc:${c.para}`, 1).ping(`svc:${c.para}`).show(`card:${c.para}`, { dur: 350 });
        d.packet({
          tag: c.traceparent === undefined ? "HTTP" : "CTX",
          tone: c.traceparent === undefined ? (c.de === "client" ? "muted" : "live") : tomDe(parseTraceparent(c.traceparent)!.traceId),
          from: c.de,
          to: c.para,
          protocol: "HTTP",
          payload: c.traceparent === undefined ? (c.de === "client" ? "POST /checkout · no traceparent" : "traceparent dropped by the proxy") : `traceparent ${c.traceparent}`,
        });
        d.wait(150);
      });
      d.wait(500);
    },
  );
  f.chapter(
    {
      id: "spans",
      title: "Each span knows one thing: its parent",
      body:
        r.semSpan.length > 0
          ? "Three spans, each holding its own id and the id of whoever called it. Payments has no SDK: it passes the header along untouched, so ledger names checkout as its parent."
          : traces > 1
            ? "Payments got no header, so it did what it must: it started a new trace and named no parent. Nobody told it a trace was already running."
            : "Four spans, each holding its own id and the id of whoever called it. No span knows its grandchildren, its siblings, or how many spans the trace will have.",
      detail: { nivel: 1, linhas: r.spans.map((s) => [ROTULO[s.servico], s.parentId === undefined ? "root" : `parent ${curto(s.parentId)}`] as const) },
    },
    (d) => {
      d.camera({ box: B(200, 170, 1060, 110) }, { dur: 1400 });
      d.stagger([...SERVICOS], 220, (x, s) => {
        x.glow(`card:${s}`, 1).ping(`card:${s}`);
      });
      d.wait(1600);
      d.glow(SERVICOS.map((s) => `card:${s}`), 0);
    },
  );
  f.chapter(
    {
      id: "export",
      title: "They leave on their own",
      body: "Each process exports its span when the span ends — and the innermost call ends first. The backend receives the tree from the bottom up, one edge at a time, from four different connections.",
      detail: { nivel: 2, linhas: r.chegada.map((s, i) => [`#${i + 1} to arrive`, ROTULO[s.servico]] as const) },
    },
    (d) => {
      d.camera({ at: { zoom: 1 } }, { dur: 1400 });
      d.stagger(r.chegada, 420, (x, s) => {
        x.send(`exp:${s.servico}`, { dur: 1000 });
      });
      for (const s of r.chegada) d.packet({ tag: "OTLP", tone: tomDe(s.traceId), from: s.servico, to: "backend", protocol: "OTLP/gRPC", payload: `span ${s.spanId}${s.parentId === undefined ? " · root" : ` · parent ${s.parentId}`}` });
      d.glow("backend", 1).ping("backend").wait(600);
    },
  );
  f.chapter(
    {
      id: "tree",
      title: "The backend builds the tree",
      body:
        traces > 1
          ? "The backend groups by trace id and follows parent ids. Two trace ids arrived, so it draws two complete-looking trees. Nothing errored; the evidence is just split in two."
          : r.semSpan.length > 0
            ? "Every parent id points to a span that arrived, so the tree closes with no hole. The hop that sent nothing is not missing from the picture — it is folded into checkout."
            : "The backend groups by trace id and follows each parent id up. Depth in the tree is the step in the waterfall — in the isometric view, it is height.",
      detail: { nivel: 3, linhas: [["traces", String(traces)], ["roots", String(raizes)], ["spans", String(r.spans.length)], ["no span", r.semSpan.length === 0 ? "—" : r.semSpan.join(", ")]] },
    },
    (d) => {
      d.camera({ box: AREA }, { dur: 1600 });
      d.stagger(r.waterfall, 380, (x, l) => {
        x.draw(`bar:${l.span.servico}`, { dur: 600 });
        x.show(`nota:${l.span.servico}`, { dur: 300 });
      });
      r.arvores.slice(1).forEach((_, i) => d.show(`nota:trace:${i + 1}`, { dur: 400 }));
      for (const p of r.semSpan) d.show(`nota:sem:${p}`, { dur: 400 });
      d.wait(2200);
    },
  );
  f.chapter(
    {
      id: "nobody",
      title: "Back up: nobody sent a tree",
      body: "Four processes each sent one edge. The waterfall is a conclusion the backend drew from what arrived — and it can only notice a missing piece when a child names a parent that never came.",
      detail: { nivel: 0, linhas: [["sent a tree", "nobody"], ["traces concluded", String(traces)]] },
    },
    (d) => {
      d.camera({ at: { zoom: 1 } }, { dur: 1600 });
      d.glow("backend", 0).wait(1600);
    },
  );
  return f.build();
}
