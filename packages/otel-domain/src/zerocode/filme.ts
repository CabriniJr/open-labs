import { film, pt, type Box, type Film, type Tone } from "@ovh/motion";
import { ICONES_OTEL as I } from "../icones/icones.js";
import { DURACAO_DA_REQUISICAO, PASSOS, SPAN_RAIZ, traceDaRequisicao, type Camada } from "./modelo.js";

/**
 * O filme do lab "Zero-code instrumentation", derivado de `traceDaRequisicao`.
 *
 * Em cima, a pilha da aplicação em andares — framework, o seu código,
 * bibliotecas —, com o tempo na horizontal. O agente acende as bibliotecas; o
 * andar do meio fica escuro. Embaixo, o waterfall no mesmo eixo de tempo, e o
 * trecho do span raiz sem filho nenhum, marcado: o que o trace não explica.
 */
export interface OpcoesZeroCode {
  /** Um span manual em volta das regras de desconto. */
  readonly manual: boolean;
}

export const OPCOES_ZERO_CODE: OpcoesZeroCode = { manual: false };

export interface DetalheZeroCode {
  readonly nivel: number;
  readonly linhas: readonly (readonly [string, string])[];
}

const B = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });

export const LARGURA_ZERO_CODE = 1280;
export const ALTURA_ZERO_CODE = 720;

/** O andar de cada camada: no 3D, a pilha de pé. */
const ANDAR: Record<Camada, { y: number; elev: number; rotulo: string }> = {
  framework: { y: 70, elev: 40, rotulo: "HTTP framework" },
  proprio: { y: 180, elev: 20, rotulo: "your code" },
  db: { y: 290, elev: 0, rotulo: "libraries" },
  cliente: { y: 290, elev: 0, rotulo: "libraries" },
};

export function filmeZeroCode(opcoes: OpcoesZeroCode = OPCOES_ZERO_CODE): Film<DetalheZeroCode> {
  const manuais = new Set(opcoes.manual ? ["regras"] : []);
  const t = traceDaRequisicao(manuais);
  const f = film<DetalheZeroCode>({ width: LARGURA_ZERO_CODE, height: ALTURA_ZERO_CODE, maxZoom: 1.9 });
  const X = (ms: number) => 180 + ms * 2.75;

  f.add({ type: "region", id: "app", box: B(20, 30, 880, 380), label: "checkout service · one POST /checkout", tone: "processor" });
  for (const [c, a] of [["framework", ANDAR.framework], ["proprio", ANDAR.proprio], ["libs", ANDAR.db]] as const) {
    f.add({ type: "note", id: `andar:${c}`, at: pt(40, a.y + 38), label: a.rotulo, tone: "muted", align: "start" });
  }
  f.add({ type: "node", id: "p:framework", box: B(X(0), ANDAR.framework.y, X(DURACAO_DA_REQUISICAO) - X(0), 76), label: "express · receives, routes, responds", sublabel: "", tone: "muted", elevation: ANDAR.framework.elev, icon: I.service });
  for (const p of PASSOS) {
    const a = ANDAR[p.camada];
    f.add({ type: "node", id: `p:${p.id}`, box: B(X(p.inicio) + 2, a.y, Math.max(70, X(p.fim) - X(p.inicio) - 4), 76), label: p.nome, sublabel: p.camada === "proprio" ? "your code" : "library", tone: "muted", elevation: a.elev });
  }
  f.add({ type: "node", id: "agente", box: B(940, 60, 300, 100), label: "auto-instrumentation agent", sublabel: "patches libraries at load time", tone: "kind-1", icon: I.sdk });
  f.add({ type: "note", id: "n:agente", at: pt(940, 190), label: "it knows express, pg, fetch —\nnot what your functions do", tone: "muted", align: "start", hidden: true });

  // O waterfall, no mesmo eixo de tempo.
  const WF = B(20, 440, 1240, 260);
  f.add({ type: "region", id: "wf", box: WF, label: "the trace the backend receives", tone: "container" });
  t.spans.forEach((s, i) => {
    f.add({ type: "bar", id: `sp:${i}`, box: B(X(s.inicio), 480 + i * 38, X(s.fim) - X(s.inicio), 26), grow: "right", label: `${s.nome} · ${s.fim - s.inicio} ms${s.origem === "manual" ? " · manual" : ""}`, tone: s.origem === "manual" ? "kind-2" : "kind-1", hidden: true });
  });
  const yEscuro = 480 + t.spans.length * 38 + 10;
  t.escuro.forEach((e, i) => f.add({ type: "bar", id: `esc:${i}`, box: B(X(e.inicio), yEscuro, X(e.fim) - X(e.inicio), 22), grow: "right", label: e.fim - e.inicio >= 20 ? `${e.fim - e.inicio} ms` : "", tone: "live", hidden: true }));
  f.add({ type: "note", id: "n:escuro", at: pt(40, yEscuro + 11), label: "no child span", tone: "live", align: "start", hidden: true });

  const tomDoPasso = (camada: Camada, id: string): Tone => (camada === "proprio" ? (manuais.has(id) ? "kind-2" : "muted") : "kind-1");
  f.chapter(
    {
      id: "agent",
      title: "The agent patches the libraries",
      body: "Zero-code instrumentation hooks the libraries your service already uses — the HTTP framework, the database driver, the HTTP client — and gives each a span with the semantic conventions filled in. No line of your code changed.",
      detail: { nivel: 0, linhas: [["instrumented", "express, pg, fetch"], ["your code", opcoes.manual ? "one manual span" : "untouched"]] },
    },
    (d) => {
      d.camera({ box: B(20, 20, 1240, 400) }, { dur: 1 });
      d.glow("agente", 1).ping("agente");
      d.set("p:framework", { tone: "kind-1", sublabel: `span · ${SPAN_RAIZ}` }).ping("p:framework");
      for (const p of PASSOS) if (p.camada !== "proprio") d.set(`p:${p.id}`, { tone: "kind-1", sublabel: `span · ${p.spanAuto}` }).ping(`p:${p.id}`);
      if (opcoes.manual) d.set("p:regras", { tone: "kind-2", sublabel: "span · manual" }).ping("p:regras");
      d.show("n:agente", { dur: 300 }).glow("agente", 0).wait(900);
    },
  );
  f.chapter(
    {
      id: "request",
      title: "One request goes down the stack",
      body: "The request enters the framework, runs through your code, calls the database, runs more of your code, calls payments and returns. The lit floors record spans as it passes; the dark one records nothing.",
      detail: { nivel: 0, linhas: PASSOS.map((p) => [p.nome, `${p.fim - p.inicio} ms · ${p.spanAuto !== undefined || manuais.has(p.id) ? "span" : "no span"}`] as const) },
    },
    (d) => {
      d.glow("p:framework", 1, { dur: 200 });
      for (const p of PASSOS) {
        d.glow(`p:${p.id}`, 1, { dur: 200 }).ping(`p:${p.id}`).wait(380);
        d.set(`p:${p.id}`, { tone: tomDoPasso(p.camada, p.id) }).glow(`p:${p.id}`, 0, { dur: 200 });
      }
      d.glow("p:framework", 0).wait(400);
    },
  );
  f.chapter(
    {
      id: "trace",
      title: "Down: the edges are lit, the middle is dark",
      body: `The trace has ${t.spans.length} spans. ${t.msEscuros} of ${DURACAO_DA_REQUISICAO} ms are the root span's own time — inside your code, with no child to say where. ${opcoes.manual ? "The one manual span lights its 70 ms; the rest stays dark." : "Pricing and discount rules are the slow part, and the trace cannot tell you that."}`,
      detail: { nivel: 1, linhas: [["spans", String(t.spans.length)], ["unexplained", `${t.msEscuros} ms`], ["covered by children", `${Math.round(t.cobertura * 100)}%`]] },
    },
    (d) => {
      d.camera({ box: WF }, { dur: 1400 });
      d.stagger(t.spans.map((_, i) => i), 220, (x, i) => {
        x.draw(`sp:${i}`, { dur: 500 });
      });
      d.show("n:escuro", { dur: 300 });
      d.stagger(t.escuro.map((_, i) => i), 160, (x, i) => {
        x.draw(`esc:${i}`, { dur: 400 });
      });
      d.wait(2000);
    },
  );
  return f.build();
}
