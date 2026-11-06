import { film, line, pt, type Box, type Film, type Tone } from "@ovh/motion";
import { ICONES_OTEL as I } from "../icones/icones.js";
import { hashDoTrace } from "./world.js";

/**
 * O showcase da amostragem: head decide cedo e não sabe do erro; tail espera e
 * sabe — se o trace inteiro estiver no mesmo lugar.
 *
 * Oito traces de dois spans (checkout chama payments); um deles falha no
 * payments. A taxa probabilística é a mesma nos três modos, decidida pelo mesmo
 * hash do trace — o que muda é QUANDO e COM O QUÊ se decide:
 *
 * - **head** — na raiz, no primeiro span, antes de o erro existir;
 * - **tail, roteado por trace** — no gateway, depois da janela de decisão, com o
 *   trace inteiro: a política "guarde os erros" funciona;
 * - **tail, espalhado** — o balanceador manda span a span, e cada gateway vê
 *   metade de cada trace. Quem tem o checkout não vê o erro; quem tem o payments
 *   guarda só ele: um fragmento, órfão no backend.
 *
 * Fontes: [TraceIdRatioBased](https://opentelemetry.io/docs/specs/otel/trace/sdk/#traceidratiobased),
 * [Tail sampling](https://opentelemetry.io/docs/concepts/sampling/#tail-sampling)
 * e o [loadbalancing exporter](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/exporter/loadbalancingexporter).
 */

export type ModoDaAmostragem = "head" | "tail-roteado" | "tail-espalhado";

export interface OpcoesDaVitrineDaAmostragem {
  readonly modo: ModoDaAmostragem;
}

export const OPCOES_DA_VITRINE_DA_AMOSTRAGEM: OpcoesDaVitrineDaAmostragem = { modo: "head" };

export const TAXA_DA_VITRINE = 0.25;
const TRACES = 8;
export const SERVICOS_DA_VITRINE = ["checkout", "payments"] as const;

export interface SpanDaVitrineDeAmostragem {
  readonly trace: number;
  readonly servico: (typeof SERVICOS_DA_VITRINE)[number];
  readonly erro: boolean;
  /** Para qual gateway o balanceador mandou (0 ou 1); `null` no head, que não precisa. */
  readonly gateway: 0 | 1 | null;
}

export interface DecisaoDeTrace {
  readonly trace: number;
  readonly erro: boolean;
  /** Os spans deste trace que chegaram ao backend. */
  readonly guardados: readonly (typeof SERVICOS_DA_VITRINE)[number][];
}

export interface Amostragem {
  readonly modo: ModoDaAmostragem;
  readonly spans: readonly SpanDaVitrineDeAmostragem[];
  readonly decisoes: readonly DecisaoDeTrace[];
  readonly traceComErro: number;
  /** Quantos spans cada gateway segura durante a janela de decisão. */
  readonly retidos: readonly [number, number];
}

const sorteado = (trace: number) => hashDoTrace(trace) % 100 < TAXA_DA_VITRINE * 100;

/** O trace que falha é o primeiro que o head NÃO amostraria: é o caso que ensina. */
export function traceQueFalha(): number {
  for (let t = 1; t <= TRACES; t += 1) if (!sorteado(t)) return t;
  return 1;
}

export function amostrar(opcoes: OpcoesDaVitrineDaAmostragem = OPCOES_DA_VITRINE_DA_AMOSTRAGEM): Amostragem {
  const falha = traceQueFalha();
  const spans: SpanDaVitrineDeAmostragem[] = [];
  let rr = 0;
  for (let t = 1; t <= TRACES; t += 1) {
    for (const servico of SERVICOS_DA_VITRINE) {
      const gateway: 0 | 1 | null = opcoes.modo === "head" ? null : opcoes.modo === "tail-roteado" ? ((hashDoTrace(t) % 2) as 0 | 1) : ((rr++ % 2) as 0 | 1);
      spans.push({ trace: t, servico, erro: t === falha && servico === "payments", gateway });
    }
  }
  const decisoes: DecisaoDeTrace[] = [];
  for (let t = 1; t <= TRACES; t += 1) {
    const doTrace = spans.filter((s) => s.trace === t);
    const erro = doTrace.some((s) => s.erro);
    let guardados: (typeof SERVICOS_DA_VITRINE)[number][];
    if (opcoes.modo === "head") {
      // A raiz decide antes de o erro existir, e a decisão viaja no flag.
      guardados = sorteado(t) ? doTrace.map((s) => s.servico) : [];
    } else {
      // Cada gateway decide sobre o que ELE viu do trace: erro ou sorteio.
      guardados = doTrace
        .filter((s) => {
          const visto = doTrace.filter((x) => x.gateway === s.gateway);
          return visto.some((x) => x.erro) || sorteado(t);
        })
        .map((s) => s.servico);
    }
    decisoes.push({ trace: t, erro, guardados });
  }
  const retidos: [number, number] = [spans.filter((s) => s.gateway === 0).length, spans.filter((s) => s.gateway === 1).length];
  return { modo: opcoes.modo, spans, decisoes, traceComErro: falha, retidos };
}

export interface DetalheDaVitrineDaAmostragem {
  readonly nivel: number;
  readonly linhas: readonly (readonly [string, string])[];
}

const B = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });

export const LARGURA_DA_AMOSTRAGEM = 1280;
export const ALTURA_DA_AMOSTRAGEM = 720;

const ROTULO_DO_MODO: Record<ModoDaAmostragem, string> = { head: "head sampling", "tail-roteado": "tail · routed by trace id", "tail-espalhado": "tail · spans spread round-robin" };

export function filmeDaVitrineDaAmostragem(opcoes: OpcoesDaVitrineDaAmostragem = OPCOES_DA_VITRINE_DA_AMOSTRAGEM): Film<DetalheDaVitrineDaAmostragem> {
  const a = amostrar(opcoes);
  const head = a.modo === "head";
  const f = film<DetalheDaVitrineDaAmostragem>({ width: LARGURA_DA_AMOSTRAGEM, height: ALTURA_DA_AMOSTRAGEM, maxZoom: 1.9 });
  const tomDoTrace = (t: number): Tone => (t === a.traceComErro ? "live" : "kind-1");

  const SVC = { checkout: B(40, 100, 190, 84), payments: B(40, 270, 190, 84) } as const;
  f.add({ type: "node", id: "svc:checkout", box: SVC.checkout, label: "checkout", sublabel: head ? `head sampler · ${TAXA_DA_VITRINE * 100}%` : "always on", tone: "processor", icon: head ? I.sampler : I.service });
  f.add({ type: "node", id: "svc:payments", box: SVC.payments, label: "payments", sublabel: head ? "follows the parent's flag" : "always on", tone: "processor", icon: I.service });
  const LB = B(300, 190, 150, 70);
  f.add({ type: "node", id: "lb", box: LB, label: head ? "agent" : "load balancer", sublabel: head ? "forwards" : a.modo === "tail-roteado" ? "routing_key: traceID" : "round-robin per span", tone: "conduit", shape: "pill", icon: head ? I.agent : I.gateway });
  const GW = [B(560, 70, 270, 150), B(560, 290, 270, 150)] as const;
  GW.forEach((g, i) =>
    f.add({ type: "node", id: `gw:${i}`, box: g, label: `gateway ${i + 1}`, sublabel: head ? "no decision to make" : `tail_sampling · errors + ${TAXA_DA_VITRINE * 100}%`, tone: "conduit", shape: "stack", icon: I.collector, hidden: head && i === 1 }),
  );
  // A janela de decisão: no 3D, um volume — a altura é quantos spans o gateway segura esperando.
  GW.forEach((g, i) => {
    if (head) return;
    f.add({ type: "node", id: `janela:${i}`, box: B(g.x + 290, g.y + 20, 110, 110), label: `${a.retidos[i]} spans`, sublabel: "held · decision_wait", tone: "kind-4", shape: "memory", hidden: true, height: 4 + a.retidos[i]! * 4, icon: I.queue });
  });
  const BACK = B(1060, 190, 190, 110);
  f.add({ type: "node", id: "backend", box: BACK, label: "backend", sublabel: "traces", tone: "container", shape: "cylinder", icon: I.backend });

  // As fichas: cada span sai do serviço, passa pelo balanceador e chega a um gateway.
  a.spans.forEach((s, k) => {
    const origem = SVC[s.servico];
    const destino = head ? GW[0] : GW[s.gateway!];
    f.add({ type: "token", id: `ida:${k}`, path: line(pt(origem.x + origem.w, origem.y + 42), pt(LB.x, LB.y + 35)), label: s.erro ? "ERROR" : "SPAN", sublabel: `t${s.trace} · ${s.servico}`, tone: tomDoTrace(s.trace), hidden: true, size: 4, trail: 2 });
    f.add({ type: "token", id: `lb:${k}`, path: line(pt(LB.x + LB.w, LB.y + 35), pt(destino.x, destino.y + 75)), label: "", tone: tomDoTrace(s.trace), hidden: true, size: 3.5, trail: 2 });
  });

  // O que chegou: um cartão por trace.
  const BK = B(40, 480, 1200, 220);
  f.add({ type: "region", id: "bk", box: BK, label: "backend · what was kept", tone: "container" });
  a.decisoes.forEach((d, i) => {
    const inteiro = d.guardados.length === SERVICOS_DA_VITRINE.length;
    const nada = d.guardados.length === 0;
    f.add({
      type: "node",
      id: `kept:${d.trace}`,
      box: B(60 + i * 147, 540, 136, 100),
      label: `t${d.trace}${d.erro ? " · error" : ""}`,
      sublabel: nada ? "dropped" : inteiro ? "whole trace" : `only ${d.guardados.join(", ")} · orphan`,
      tone: nada ? "muted" : d.erro ? "live" : inteiro ? "kind-1" : "live",
      hidden: true,
      icon: I.trace,
    });
  });

  const erro = a.decisoes.find((d) => d.erro)!;
  const guardadosInteiros = a.decisoes.filter((d) => d.guardados.length === SERVICOS_DA_VITRINE.length).length;
  const fragmentos = a.decisoes.filter((d) => d.guardados.length > 0 && d.guardados.length < SERVICOS_DA_VITRINE.length).length;
  f.chapter(
    {
      id: "decide-early",
      title: head ? "The head decides at the root" : "Every span leaves the app",
      body: head
        ? `The sampler runs when checkout starts each trace — ${TAXA_DA_VITRINE * 100}% by trace id. Trace ${a.traceComErro} is not picked. Its error happens later, in payments, inside a trace already marked "drop".`
        : "With tail sampling the apps keep everything and send every span on. Nothing has been decided yet; nobody knows which trace will fail.",
      detail: { nivel: 0, linhas: [["mode", ROTULO_DO_MODO[a.modo]], ["traces", String(TRACES)], ["ratio", `${TAXA_DA_VITRINE * 100}%`], ["error in", `t${a.traceComErro} · payments`]] },
    },
    (d) => {
      d.camera({ at: { zoom: 1 } }, { dur: 1 });
      d.stagger(a.spans.map((s, k) => ({ s, k })), 110, (x, { s, k }) => {
        if (head && !a.decisoes.find((dd) => dd.trace === s.trace)!.guardados.includes(s.servico)) {
          x.ping(`svc:${s.servico}`);
          return;
        }
        x.send(`ida:${k}`, { dur: 600 });
      });
      d.ping(`svc:payments`).wait(400);
    },
  );
  f.chapter(
    {
      id: "route",
      title: head ? "The Collector only forwards" : a.modo === "tail-roteado" ? "Routed by trace id" : "Spread span by span",
      body: head
        ? "Whatever the root sampled arrives whole; whatever it dropped never left the app. The Collector has nothing to decide."
        : a.modo === "tail-roteado"
          ? "The load balancer hashes the trace id, so both spans of a trace land on the same gateway. Each gateway sees whole traces."
          : "The load balancer alternates span by span. checkout's spans go to gateway 1, payments' to gateway 2 — every gateway holds half of every trace.",
      detail: { nivel: 1, linhas: head ? [["spans forwarded", String(a.decisoes.reduce((n, x) => n + x.guardados.length, 0))]] : [["gateway 1", `${a.retidos[0]} spans`], ["gateway 2", `${a.retidos[1]} spans`]] },
    },
    (d) => {
      d.stagger(a.spans.map((s, k) => ({ s, k })), 90, (x, { s, k }) => {
        if (head && !a.decisoes.find((dd) => dd.trace === s.trace)!.guardados.includes(s.servico)) return;
        x.send(`lb:${k}`, { dur: 500 });
      });
      d.glow(head ? ["gw:0"] : ["gw:0", "gw:1"], 1).wait(500).glow(["gw:0", "gw:1"], 0);
    },
  );
  if (!head) {
    f.chapter(
      {
        id: "window",
        title: "The decision window",
        body: "A tail sampler cannot decide on a span: it waits decision_wait for the rest of the trace, holding every span in memory. In the isometric view, the held spans are a volume — the price of deciding late.",
        detail: { nivel: 2, linhas: [["gateway 1 holds", `${a.retidos[0]} spans`], ["gateway 2 holds", `${a.retidos[1]} spans`], ["decision_wait", "2 s (example)"]] },
      },
      (d) => {
        d.camera({ box: B(540, 50, 560, 410) }, { dur: 1300 });
        d.show(["janela:0", "janela:1"], { dur: 500 }).ping(["janela:0", "janela:1"]).wait(1600);
      },
    );
  }
  f.chapter(
    {
      id: "verdict",
      title: head ? "Down: the error was never recorded" : a.modo === "tail-roteado" ? "Down: the error is kept, whole" : "Down: the error is kept, in half",
      body: head
        ? `${guardadosInteiros} whole traces arrived, by chance. Trace ${a.traceComErro}, the one you need, was dropped before it failed.`
        : a.modo === "tail-roteado"
          ? `The policy kept every error and ${TAXA_DA_VITRINE * 100}% of the rest. Trace ${a.traceComErro} arrives whole, with checkout and payments.`
          : `Gateway 2 saw the error and kept payments; gateway 1 never saw it and dropped checkout. Trace ${a.traceComErro} arrives as a payments span whose parent never comes.`,
      detail: { nivel: 3, linhas: [["whole traces", String(guardadosInteiros)], ["fragments", String(fragmentos)], [`t${a.traceComErro} (error)`, erro.guardados.length === 0 ? "dropped" : erro.guardados.length === 2 ? "whole" : `only ${erro.guardados.join(", ")}`]] },
    },
    (d) => {
      d.camera({ box: BK }, { dur: 1400 });
      d.stagger(a.decisoes, 140, (x, dd) => {
        x.show(`kept:${dd.trace}`, { dur: 300 });
      });
      d.glow(`kept:${a.traceComErro}`, 1).ping(`kept:${a.traceComErro}`).wait(2000);
    },
  );
  return f.build();
}
