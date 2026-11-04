import { film, line, pt, type Box, type Film } from "@ovh/motion";
import { ICONES_OTEL as I } from "../icones/icones.js";
import { ETAPAS, ORDEM_CODIGO_PRIMEIRO, ORDEM_RECOMENDADA, planejar, riscos } from "./modelo.js";

/**
 * O filme do lab "The rollout", derivado de `planejar`.
 *
 * As etapas sobem uma escada (no 3D, a altura é a maturidade); cada uma cita o
 * lab que a explica e acende as perguntas que passam a ter resposta. Feita fora
 * de ordem, a etapa ganha um aviso no palco e a consequência no painel.
 */
export interface OpcoesDoRollout {
  readonly ordem: "recomendada" | "codigo-primeiro";
}

export const OPCOES_DO_ROLLOUT: OpcoesDoRollout = { ordem: "recomendada" };

export interface DetalheDoRollout {
  readonly nivel: number;
  readonly linhas: readonly (readonly [string, string])[];
}

const B = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });
const nomeDe = (id: string) => ETAPAS.find((e) => e.id === id)!.titulo;

export const LARGURA_DO_ROLLOUT = 1280;
export const ALTURA_DO_ROLLOUT = 720;

export function filmeDoRollout(opcoes: OpcoesDoRollout = OPCOES_DO_ROLLOUT): Film<DetalheDoRollout> {
  const ordem = opcoes.ordem === "recomendada" ? ORDEM_RECOMENDADA : ORDEM_CODIGO_PRIMEIRO;
  const plano = planejar(ordem);
  const f = film<DetalheDoRollout>({ width: LARGURA_DO_ROLLOUT, height: ALTURA_DO_ROLLOUT, maxZoom: 1.9 });
  const DEGRAU = (k: number) => B(40 + k * 205, 360 - k * 52, 190, 100);

  plano.forEach((p, k) => {
    const b = DEGRAU(k);
    f.add({ type: "node", id: `e:${p.etapa.id}`, box: b, label: `${k + 1}. ${p.etapa.titulo}`, sublabel: `→ ${p.etapa.labTitulo} · ${p.etapa.custo} effort`, tone: "muted", elevation: k * 12, height: 10, icon: p.etapa.id === "collector" ? I.collector : p.etapa.id === "amostragem" ? I.sampler : p.etapa.id === "logs" ? I.log : p.etapa.id === "contexto" ? I.context : p.etapa.id === "auto" ? I.sdk : I.trace });
    if (k > 0) f.add({ type: "link", id: `l:${k}`, path: line(pt(DEGRAU(k - 1).x + 190, DEGRAU(k - 1).y + 50), pt(b.x, b.y + 50)), tone: "muted", arrow: true, hidden: true });
    if (p.faltando.length > 0) f.add({ type: "note", id: `risco:${p.etapa.id}`, at: pt(b.x + 6, b.y + b.h + 16), label: `before: ${p.faltando.map((x) => nomeDe(x.de).split(" ").slice(0, 3).join(" ")).join(", ")}`, tone: "live", align: "start", hidden: true });
  });
  const PERG = B(40, 520, 1200, 180);
  f.add({ type: "region", id: "perguntas", box: PERG, label: "questions you can now answer", tone: "container" });
  const todas = plano.at(-1)!.respondidas;
  todas.forEach((q, i) => f.add({ type: "note", id: `q:${i}`, at: pt(PERG.x + 24 + (i % 2) * 600, PERG.y + 44 + Math.floor(i / 2) * 34), label: `✓ ${q}`, tone: "kind-1", align: "start", hidden: true }));

  let mostradas = 0;
  plano.forEach((p, k) => {
    const novas = p.respondidas.length - mostradas;
    const de = mostradas;
    mostradas = p.respondidas.length;
    f.chapter(
      {
        id: p.etapa.id,
        title: `${k + 1}. ${p.etapa.titulo}`,
        body: p.faltando.length === 0 ? `${p.etapa.acao} ${p.etapa.labTitulo} is the lab for it.` : `${p.etapa.acao} Done this early, ${p.faltando.map((x) => x.sem).join("; and ")}.`,
        detail: {
          nivel: Math.min(3, Math.floor((k * 4) / plano.length)),
          linhas: [["effort", p.etapa.custo], ["lab", p.etapa.labTitulo], ...p.faltando.map((x) => [`missing: ${nomeDe(x.de)}`, x.sem] as const), ["new answers", String(novas)]],
        },
      },
      (d) => {
        if (k === 0) d.camera({ at: { zoom: 1 } }, { dur: 1 });
        if (k > 0) d.draw(`l:${k}`, { dur: 400 });
        d.set(`e:${p.etapa.id}`, { tone: p.faltando.length === 0 ? "kind-1" : "live" }).glow(`e:${p.etapa.id}`, 1).ping(`e:${p.etapa.id}`);
        if (p.faltando.length > 0) d.show(`risco:${p.etapa.id}`, { dur: 300 });
        for (let i = de; i < p.respondidas.length; i += 1) d.show(`q:${todas.indexOf(p.respondidas[i]!)}`, { dur: 250 });
        d.wait(1300).glow(`e:${p.etapa.id}`, 0);
      },
    );
  });
  const n = riscos(plano);
  f.chapter(
    {
      id: "plan",
      title: "Back up: the order is the plan",
      body:
        n === 0
          ? "Each step stands on the ones before it: the Collector makes the backend swappable, the agent gives the edges, propagation makes one request one trace, and only then are logs, manual spans and sampling worth their effort."
          : `The same six steps, done code-first, hit ${n} missing prerequisites. Each one is rework or a blind spot — the steps were right, the order was not.`,
      detail: { nivel: 0, linhas: [["steps", String(plano.length)], ["done before their prerequisites", String(n)], ["questions answered", String(todas.length)]] },
    },
    (d) => {
      d.glow(plano.map((p) => `e:${p.etapa.id}`), 0.6).wait(2200);
    },
  );
  return f.build();
}
