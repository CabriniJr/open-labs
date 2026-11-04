import { film, pt, type Box, type Film } from "@ovh/motion";
import { ICONES_OTEL as I } from "../icones/icones.js";
import { investigar, JANELA_S, MINUTOS_PARA_DETECTAR, MINUTOS_POR_CANDIDATO, OPCOES_DO_INCIDENTE, type OpcoesDoIncidente, type RequisicaoDoIncidente } from "./modelo.js";

/**
 * O filme do lab "The cost of disconnected signals", derivado de `investigar`.
 *
 * As requisições são faixas numa linha do tempo, empacotadas em raias como
 * requisições concorrentes de verdade. Uma falha; o log guarda o segundo. Sem
 * contexto, todo mundo que estava ativo naquele segundo acende, e o relógio do
 * MTTR sobe a cada candidato descartado. Com `trace_id`, acende uma.
 */
export interface DetalheDoIncidente {
  readonly nivel: number;
  readonly linhas: readonly (readonly [string, string])[];
}

const B = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });
const min = (m: number) => `${m.toFixed(m % 1 === 0 ? 0 : 1)} min`;

export const LARGURA_DO_INCIDENTE = 1280;
export const ALTURA_DO_INCIDENTE = 720;

/** Empacota as requisições em raias: a primeira raia livre quando cada uma começa. */
export function raias(reqs: readonly RequisicaoDoIncidente[]): Map<number, number> {
  const fimDaRaia: number[] = [];
  const raiaDe = new Map<number, number>();
  for (const r of [...reqs].sort((a, b) => a.inicio - b.inicio)) {
    let k = fimDaRaia.findIndex((fim) => fim <= r.inicio);
    if (k === -1) k = fimDaRaia.push(0) - 1;
    fimDaRaia[k] = r.fim;
    raiaDe.set(r.n, k);
  }
  return raiaDe;
}

export function filmeDoIncidente(opcoes: OpcoesDoIncidente = OPCOES_DO_INCIDENTE): Film<DetalheDoIncidente> {
  const inc = investigar(opcoes);
  const f = film<DetalheDoIncidente>({ width: LARGURA_DO_INCIDENTE, height: ALTURA_DO_INCIDENTE, maxZoom: 1.9 });
  const raiaDe = raias(inc.requisicoes);
  const nRaias = Math.max(...raiaDe.values()) + 1;
  const X = (ms: number) => 80 + (ms / (JANELA_S * 1000 + 900)) * 1140;
  const ALTO = Math.min(22, 380 / nRaias);
  const Y = (k: number) => 150 + k * ALTO;
  const candidatos = new Set(inc.busca.candidatos.map((r) => r.n));

  f.add({ type: "region", id: "linha", box: B(40, 120, 1220, 420), label: `${opcoes.rps} requests a second · ${nRaias} at once at the peak`, tone: "processor" });
  for (let s = 0; s <= JANELA_S; s += 1) f.add({ type: "note", id: `seg:${s}`, at: pt(X(s * 1000), 132), label: `12:00:0${s}`, tone: "muted", align: "middle" });
  f.add({ type: "region", id: "banda", box: B(X(inc.log.segundo * 1000), 140, X((inc.log.segundo + 1) * 1000) - X(inc.log.segundo * 1000), 390), label: "", tone: "live", hidden: true });
  for (const r of inc.requisicoes) {
    f.add({ type: "bar", id: `r:${r.n}`, box: B(X(r.inicio), Y(raiaDe.get(r.n)!), Math.max(2, X(r.fim) - X(r.inicio)), ALTO * 0.72), grow: "right", label: "", tone: r.erro ? "live" : "kind-1", hidden: true, elevation: raiaDe.get(r.n)! * 2 });
  }
  f.add({ type: "node", id: "log", box: B(40, 30, 520, 70), label: `ERROR 12:00:0${inc.log.segundo} payment declined`, sublabel: inc.log.traceId === undefined ? "no trace_id on the line" : `trace_id ${inc.log.traceId}`, tone: "live", hidden: true, icon: I.log });
  f.add({ type: "node", id: "relogio", box: B(960, 30, 300, 70), label: "MTTR 0 min", sublabel: `assumes ${MINUTOS_PARA_DETECTAR} min to detect + ${MINUTOS_POR_CANDIDATO} min per candidate`, tone: "container" });
  f.add({ type: "node", id: "resultado", box: B(40, 570, 1220, 110), label: "", sublabel: "", tone: inc.busca.modo === "trace_id" ? "kind-1" : "live", hidden: true, icon: I.trace });

  const n = inc.busca.candidatos.length;
  f.chapter(
    {
      id: "traffic",
      title: `${opcoes.rps} requests a second`,
      body: "Requests arrive and overlap: each one is a lane in time, and at any moment many are running at once. One of them is about to fail.",
      detail: { nivel: 0, linhas: [["requests", String(inc.requisicoes.length)], ["at once, at the peak", String(nRaias)]] },
    },
    (d) => {
      d.camera({ at: { zoom: 1 } }, { dur: 1 });
      d.stagger(inc.requisicoes, Math.max(8, 1600 / inc.requisicoes.length), (x, r) => {
        x.draw(`r:${r.n}`, { dur: 250 });
      });
      d.wait(500);
    },
  );
  f.chapter(
    {
      id: "error",
      title: "One fails; the log keeps the second",
      body: inc.log.traceId === undefined ? `The error line says 12:00:0${inc.log.segundo}, to the second, and nothing else that links it to a request.` : `The error line says 12:00:0${inc.log.segundo} — and carries the trace_id of the request that failed.`,
      detail: { nivel: 1, linhas: [["log time", `12:00:0${inc.log.segundo}`], ["trace_id", inc.log.traceId === undefined ? "—" : `${inc.log.traceId.slice(0, 8)}…`]] },
    },
    (d) => {
      d.show("log", { dur: 400 }).ping("log");
      d.show("banda", { dur: 400 });
      d.wait(1200);
    },
  );
  f.chapter(
    {
      id: "search",
      title: inc.busca.modo === "trace_id" ? "Search by trace_id: one" : `Search by time: ${n} candidates`,
      body:
        inc.busca.modo === "trace_id"
          ? "The trace_id on the log line opens exactly one trace. The clock stops at the first look."
          : `Every request that was running at some point in that second is a suspect: ${n} of them. Each one has to be opened and ruled out, and the clock runs while you do.`,
      detail: { nivel: 2, linhas: [["search by", inc.busca.modo === "trace_id" ? "trace_id" : "time"], ["candidates", String(n)], ["MTTR (model)", min(inc.busca.minutos)]] },
    },
    (d) => {
      d.set("relogio", { label: `MTTR ${min(MINUTOS_PARA_DETECTAR)}` });
      d.dim(inc.requisicoes.filter((r) => !candidatos.has(r.n)).map((r) => `r:${r.n}`), 0.85);
      inc.busca.candidatos.forEach((r, i) => {
        d.glow(`r:${r.n}`, 1, { dur: 80 });
        d.set("relogio", { label: `MTTR ${min(MINUTOS_PARA_DETECTAR + (i + 1) * MINUTOS_POR_CANDIDATO)}`, tone: i > 4 ? "live" : "container" });
        d.wait(Math.max(40, 1800 / n));
      });
      d.wait(600);
    },
  );
  f.chapter(
    {
      id: "cost",
      title: "Down: the price of the missing id",
      body: `With the timestamp as the only link, this incident costs ${min(inc.busca.minutos)} on this model, and the number grows with traffic — not with how bad the error is. With trace_id on the log line, it costs ${min(MINUTOS_PARA_DETECTAR + MINUTOS_POR_CANDIDATO)} at any traffic.`,
      detail: { nivel: 3, linhas: [["candidates", String(n)], ["MTTR (model)", min(inc.busca.minutos)], ["with trace_id", min(MINUTOS_PARA_DETECTAR + MINUTOS_POR_CANDIDATO)]] },
    },
    (d) => {
      d.camera({ box: B(30, 540, 1240, 170) }, { dur: 1200 });
      d.set("resultado", { label: inc.busca.modo === "trace_id" ? "search by trace_id → 1 trace" : `search by time → ${n} candidate traces`, sublabel: `MTTR on this model: ${min(inc.busca.minutos)}` });
      d.show("resultado", { dur: 400 }).ping("resultado").wait(2000);
    },
  );
  return f.build();
}
