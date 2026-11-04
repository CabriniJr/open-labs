import { film, line, pt, type Box, type Film, type Tone } from "@ovh/motion";
import { idHex } from "../anatomia/carga.js";
import { ICONES_OTEL as I } from "../icones/icones.js";
import { BALDES, baldeDe, type Requisicao } from "./carga.js";

/**
 * O showcase dos três pilares: um incidente, três gravadores, e a pergunta de
 * qual deles responde o quê.
 *
 * Seis requisições ao checkout; a última falha no payments. Cada gravador fica
 * com a parte dele da MESMA requisição: o log, a frase; a métrica, um balde a
 * mais (a requisição some na contagem); o trace, o caminho. Sem correlação, só
 * o horário liga os três — e no mesmo segundo houve quatro requisições. Com
 * `trace_id` no log e um exemplar no balde, os três apontam para o mesmo trace.
 *
 * Fontes: [Logs · TraceId](https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-traceid)
 * e [Exemplars](https://opentelemetry.io/docs/specs/otel/metrics/data-model/#exemplars).
 */

export interface OpcoesDosPilares {
  /** `trace_id` nos logs e exemplares nos baldes do histograma. */
  readonly correlacao: boolean;
}

export const OPCOES_DOS_PILARES: OpcoesDosPilares = { correlacao: false };

export interface LinhaDeLog {
  readonly n: number;
  readonly nivel: "INFO" | "ERROR";
  readonly texto: string;
  readonly segundo: number;
  readonly traceId?: string;
}

export interface BaldeDoIncidente {
  readonly rotulo: string;
  readonly contagem: number;
  /** Uma medição de verdade guardada junto, com o trace em que aconteceu. */
  readonly exemplar?: { readonly valor: number; readonly traceId: string };
}

export interface TraceDoIncidente {
  readonly n: number;
  readonly traceId: string;
  readonly spans: readonly { readonly servico: string; readonly duracao: number; readonly erro: boolean }[];
}

export interface Incidente {
  readonly requisicoes: readonly Requisicao[];
  readonly logs: readonly LinhaDeLog[];
  readonly baldes: readonly BaldeDoIncidente[];
  readonly traces: readonly TraceDoIncidente[];
  /** Quantas requisições aconteceram no segundo do erro: os candidatos de quem só tem o horário. */
  readonly candidatosPorHorario: number;
  /** A requisição que falhou. */
  readonly falha: Requisicao;
}

const LATENCIAS = [42, 61, 190, 1100, 320, 1800] as const;
const SEGUNDOS = [0, 0, 1, 1, 1, 1] as const;

export function incidente(opcoes: OpcoesDosPilares = OPCOES_DOS_PILARES): Incidente {
  const requisicoes: Requisicao[] = LATENCIAS.map((latencia, i) => ({ n: i + 1, rota: "/checkout", latencia, erro: i === LATENCIAS.length - 1, usuario: `u-${(i * 37) % 9}`, tick: SEGUNDOS[i]! }));
  const traces: TraceDoIncidente[] = requisicoes.map((r) => ({
    n: r.n,
    traceId: idHex(32, `pilares:vitrine:${r.n}`),
    spans: [
      { servico: "checkout", duracao: r.latencia, erro: r.erro },
      { servico: "payments", duracao: Math.round(r.latencia * 0.8), erro: r.erro },
    ],
  }));
  const logs: LinhaDeLog[] = requisicoes.map((r, i) => ({
    n: r.n,
    nivel: r.erro ? "ERROR" : "INFO",
    texto: r.erro ? "payment declined: upstream timeout" : `POST /checkout 200 ${r.latencia}ms`,
    segundo: r.tick,
    ...(opcoes.correlacao ? { traceId: traces[i]!.traceId } : {}),
  }));
  const rotulos = [...BALDES.map((b) => `≤ ${b} ms`), `> ${BALDES[BALDES.length - 1]} ms`];
  const baldes: BaldeDoIncidente[] = rotulos.map((rotulo) => {
    const dentro = requisicoes.filter((r) => baldeDe(r.latencia) === rotulo);
    // O reservatório guarda a última medição do intervalo que tinha trace amostrado.
    const ultima = dentro.at(-1);
    const trace = ultima === undefined ? undefined : traces.find((t) => t.n === ultima.n);
    return { rotulo, contagem: dentro.length, ...(opcoes.correlacao && ultima !== undefined && trace !== undefined ? { exemplar: { valor: ultima.latencia, traceId: trace.traceId } } : {}) };
  });
  const falha = requisicoes.find((r) => r.erro)!;
  return { requisicoes, logs, baldes, traces, candidatosPorHorario: requisicoes.filter((r) => r.tick === falha.tick).length, falha };
}

export interface DetalheDosPilares {
  readonly nivel: number;
  readonly linhas: readonly (readonly [string, string])[];
}

const B = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });
const curto = (id: string) => `${id.slice(0, 4)}…`;

export const LARGURA_DOS_PILARES = 1280;
export const ALTURA_DOS_PILARES = 720;

/** A altura de cada sinal no 3D: três planos, um por gravador. */
const ALTURA_DO_SINAL = { log: 0, metric: 28, trace: 56 } as const;

export function filmeDosPilares(opcoes: OpcoesDosPilares = OPCOES_DOS_PILARES): Film<DetalheDosPilares> {
  const inc = incidente(opcoes);
  const f = film<DetalheDosPilares>({ width: LARGURA_DOS_PILARES, height: ALTURA_DOS_PILARES, maxZoom: 1.9 });
  const k = inc.requisicoes.length;
  const COL = (i: number) => 300 + i * 158;
  const kFalha = inc.requisicoes.indexOf(inc.falha);

  const APP = B(40, 300, 190, 110);
  f.add({ type: "node", id: "app", box: APP, label: "checkout", sublabel: "app + SDK", tone: "processor", icon: I.service });
  const LOG = B(270, 30, 980, 190);
  const MET = B(270, 260, 980, 190);
  const TRC = B(270, 490, 980, 200);
  f.add({ type: "region", id: "r:log", box: LOG, label: "logs · what happened, in words", tone: "kind-2", elevation: ALTURA_DO_SINAL.log });
  f.add({ type: "region", id: "r:met", box: MET, label: "metrics · how many, how slow", tone: "kind-4", elevation: ALTURA_DO_SINAL.metric });
  f.add({ type: "region", id: "r:trc", box: TRC, label: "traces · where the time went", tone: "kind-1", elevation: ALTURA_DO_SINAL.trace });

  inc.logs.forEach((l, i) =>
    f.add({ type: "node", id: `log:${l.n}`, box: B(COL(i), 80, 146, 74), label: `${l.nivel} · 12:00:0${l.segundo}`, sublabel: l.traceId === undefined ? l.texto : `${l.texto.slice(0, 18)}… trace_id ${curto(l.traceId)}`, tone: l.nivel === "ERROR" ? "live" : "kind-2", hidden: true, icon: I.log, elevation: ALTURA_DO_SINAL.log }),
  );
  inc.baldes.forEach((b, i) =>
    f.add({ type: "node", id: `bal:${i}`, box: B(COL(i), 310, 146, 90), label: "0", sublabel: b.rotulo, tone: "kind-4", shape: "memory", elevation: ALTURA_DO_SINAL.metric, height: 4 }),
  );
  inc.baldes.forEach((b, i) => {
    if (b.exemplar !== undefined) f.add({ type: "note", id: `ex:${i}`, at: pt(COL(i) + 73, 425), label: `exemplar ${b.exemplar.valor} ms · trace ${curto(b.exemplar.traceId)}`, tone: "kind-1", align: "middle", hidden: true });
  });
  inc.traces.forEach((t, i) => {
    const erro = t.spans.some((s) => s.erro);
    f.add({ type: "node", id: `trc:${t.n}`, box: B(COL(i), 540, 146, 90), label: `trace ${curto(t.traceId)}`, sublabel: erro ? `payments · ${(t.spans[1]!.duracao / 1000).toFixed(1)} s · error` : `${t.spans.length} spans · ${t.spans[0]!.duracao} ms`, tone: erro ? "live" : "kind-1", hidden: true, icon: I.trace, elevation: ALTURA_DO_SINAL.trace });
  });
  inc.requisicoes.forEach((r, i) => {
    f.add({ type: "token", id: `req:${r.n}`, path: line(pt(0, APP.y + 55), pt(APP.x, APP.y + 55)), label: "POST", sublabel: `/checkout · ${r.latencia} ms`, tone: r.erro ? "live" : "ink", hidden: true, size: 5 });
    f.add({ type: "token", id: `w:log:${r.n}`, path: line(pt(APP.x + APP.w, APP.y + 30), pt(COL(i) + 73, 154)), tone: "kind-2", hidden: true, size: 3.5, trail: 2 });
    f.add({ type: "token", id: `w:met:${r.n}`, path: line(pt(APP.x + APP.w, APP.y + 55), pt(COL(inc.baldes.findIndex((b) => b.rotulo === baldeDe(r.latencia))) + 73, 310)), tone: "kind-4", hidden: true, size: 3.5, trail: 2 });
    f.add({ type: "token", id: `w:trc:${r.n}`, path: line(pt(APP.x + APP.w, APP.y + 80), pt(COL(i) + 73, 540)), tone: "kind-1", hidden: true, size: 3.5, trail: 2 });
  });
  // A coluna da requisição que falhou: atravessa os três planos.
  const x = COL(kFalha) + 73;
  f.add({ type: "link", id: "coluna", path: line(pt(x, 154), pt(x, 540)), tone: opcoes.correlacao ? "kind-1" : "muted", dashed: !opcoes.correlacao, hidden: true, label: opcoes.correlacao ? "trace_id" : `same second: ${inc.candidatosPorHorario} candidates`, labelAt: 0.18 });

  const contagens = inc.baldes.map(() => 0);
  const balde = (r: Requisicao) => inc.baldes.findIndex((b) => b.rotulo === baldeDe(r.latencia));
  const errosNoIntervalo = inc.requisicoes.filter((r) => r.erro).length;
  f.chapter(
    {
      id: "incident",
      title: "One incident, three recorders",
      body: "Six requests reach checkout; the last one fails in payments. The same request is handed to three recorders at once: the logger writes a line, the meter adds to a bucket, the tracer records the path.",
      detail: { nivel: 0, linhas: [["requests", String(k)], ["failed", "1"], ["recorders", "log · metric · trace"]] },
    },
    (d) => {
      d.camera({ at: { zoom: 1 } }, { dur: 1 });
      inc.requisicoes.forEach((r) => {
        d.send(`req:${r.n}`, { dur: 450 });
        d.glow("app", 1).ping("app");
        d.together(
          (y) => y.send(`w:log:${r.n}`, { dur: 500 }),
          (y) => y.send(`w:met:${r.n}`, { dur: 500 }),
          (y) => y.send(`w:trc:${r.n}`, { dur: 500 }),
        );
        contagens[balde(r)]! += 1;
        d.show([`log:${r.n}`, `trc:${r.n}`], { dur: 250 });
        d.set(`bal:${balde(r)}`, { label: String(contagens[balde(r)]) }).ping(`bal:${balde(r)}`);
        d.glow("app", 0);
      });
      d.wait(500);
    },
  );
  const linhaDoErro = inc.logs.find((l) => l.nivel === "ERROR")!;
  f.chapter(
    {
      id: "log",
      title: "The log knows what",
      body: opcoes.correlacao
        ? "The error line says what happened — and, because the log bridge stamped it, which trace it belongs to."
        : "The error line says what happened, and when, to the second. It does not say which request: in that second, four requests came in.",
      detail: { nivel: 1, linhas: [["line", `${linhaDoErro.nivel} ${linhaDoErro.texto}`], ["trace_id", linhaDoErro.traceId === undefined ? "—" : curto(linhaDoErro.traceId)], ["same second", `${inc.candidatosPorHorario} requests`]] },
    },
    (d) => {
      d.camera({ box: LOG }, { dur: 1300 });
      d.glow(`log:${linhaDoErro.n}`, 1).ping(`log:${linhaDoErro.n}`).wait(1500);
    },
  );
  const bFalha = balde(inc.falha);
  f.chapter(
    {
      id: "metric",
      title: "The metric knows how many",
      body: opcoes.correlacao
        ? `The slowest bucket holds ${inc.baldes[bFalha]!.contagem} requests and one exemplar: a real measurement, kept with the trace it happened in.`
        : `The slowest bucket holds ${inc.baldes[bFalha]!.contagem} requests. The metric kept the count and threw the requests away — which of the two failed is not in it.`,
      detail: { nivel: 2, linhas: [["bucket", inc.baldes[bFalha]!.rotulo], ["count", String(inc.baldes[bFalha]!.contagem)], ["errors this interval", String(errosNoIntervalo)], ["exemplar", inc.baldes[bFalha]!.exemplar === undefined ? "—" : `${inc.baldes[bFalha]!.exemplar!.valor} ms`]] },
    },
    (d) => {
      d.camera({ box: MET }, { dur: 1300 });
      d.glow(`bal:${bFalha}`, 1).ping(`bal:${bFalha}`);
      inc.baldes.forEach((b, i) => {
        if (b.exemplar !== undefined) d.show(`ex:${i}`, { dur: 300 });
      });
      d.wait(1500);
    },
  );
  const tFalha = inc.traces.find((t) => t.n === inc.falha.n)!;
  f.chapter(
    {
      id: "trace",
      title: "The trace knows where",
      body: `The failing trace has the path: checkout called payments, payments took ${(tFalha.spans[1]!.duracao / 1000).toFixed(1)} s and returned an error. It does not say how often this happens — that is the metric's job.`,
      detail: { nivel: 3, linhas: tFalha.spans.map((s) => [s.servico, `${s.duracao} ms${s.erro ? " · error" : ""}`] as const) },
    },
    (d) => {
      d.camera({ box: TRC }, { dur: 1300 });
      d.glow(`trc:${tFalha.n}`, 1).ping(`trc:${tFalha.n}`).wait(1500);
    },
  );
  f.chapter(
    {
      id: "join",
      title: opcoes.correlacao ? "One id through all three" : "Joined by the clock",
      body: opcoes.correlacao
        ? "The log line, the exemplar and the trace carry the same trace_id. From the error line you open the trace; from the slow bucket you open the request that made it slow."
        : `Without a shared id, the only join is the timestamp — and ${inc.candidatosPorHorario} requests share that second. Three signals, one blind spot: which request.`,
      detail: { nivel: 0, linhas: [["log → trace", opcoes.correlacao ? "trace_id" : "by time only"], ["metric → trace", opcoes.correlacao ? "exemplar" : "none"], ["candidates", opcoes.correlacao ? "1" : String(inc.candidatosPorHorario)]] },
    },
    (d) => {
      d.camera({ at: { zoom: 1 } }, { dur: 1400 });
      d.draw("coluna", { dur: 900 });
      d.glow([`log:${linhaDoErro.n}`, `bal:${bFalha}`, `trc:${tFalha.n}`], 1);
      if (!opcoes.correlacao) d.glow(inc.logs.filter((l) => l.segundo === linhaDoErro.segundo).map((l) => `log:${l.n}`), 0.5);
      d.wait(2400);
    },
  );
  return f.build();
}
