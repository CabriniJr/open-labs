import { film, line, pt, type Box, type Film, type Tone } from "@ovh/motion";
import { hashDoTrace } from "../amostragem/world.js";
import { ICONES_OTEL as I } from "../icones/icones.js";

/**
 * O showcase dos três providers: quem decide o que sai do processo.
 *
 * O código da aplicação só fala com a API — `tracer`, `meter`, `logger` — e a API
 * sozinha não faz nada. Quem decide é o provider que o SDK instala atrás dela, e
 * os três não são simétricos:
 *
 * - **TracerProvider** — o sampler decide na criação do span; o
 *   BatchSpanProcessor junta os que terminaram e **empurra** o lote;
 * - **MeterProvider** — o agregador soma na memória; o PeriodicMetricReader
 *   **puxa** um ponto por intervalo, e a medição individual não sai nunca;
 * - **LoggerProvider** — o BatchLogRecordProcessor junta e empurra, como o de
 *   spans, mas sem sampler.
 *
 * Sem SDK, os três são no-op: as chamadas voltam sem registrar nada.
 *
 * Fontes: [Tracing SDK](https://opentelemetry.io/docs/specs/otel/trace/sdk/),
 * [Metrics SDK · MetricReader](https://opentelemetry.io/docs/specs/otel/metrics/sdk/#metricreader)
 * e [Logs SDK](https://opentelemetry.io/docs/specs/otel/logs/sdk/).
 */

export interface OpcoesDaVitrineDosProviders {
  /** O SDK está instalado; sem ele a API é no-op. */
  readonly sdk: boolean;
  /** A taxa do sampler do TracerProvider, 0–1. */
  readonly taxa: number;
}

export const OPCOES_DA_VITRINE_DOS_PROVIDERS: OpcoesDaVitrineDosProviders = { sdk: true, taxa: 1 };

/** Requisições que o código atende, e o tamanho dos lotes dos processadores. */
export const REQUISICOES_DA_VITRINE = 4;
export const LOTE_DA_VITRINE = 4;

export interface ProcessoInstrumentado {
  readonly requisicoes: number;
  /** As requisições cujo span o sampler guardou. */
  readonly amostradas: readonly number[];
  /** Exportações, na ordem: o que saiu do processo, por sinal. */
  readonly exportacoes: readonly { readonly sinal: "traces" | "metrics" | "logs"; readonly itens: number; readonly modo: "push" | "pull" }[];
  /** O que o agregador de métricas somou. */
  readonly contagem: number;
}

export function rodarProviders(opcoes: OpcoesDaVitrineDosProviders = OPCOES_DA_VITRINE_DOS_PROVIDERS): ProcessoInstrumentado {
  const n = REQUISICOES_DA_VITRINE;
  if (!opcoes.sdk) return { requisicoes: n, amostradas: [], exportacoes: [], contagem: 0 };
  const amostradas = Array.from({ length: n }, (_, i) => i + 1).filter((r) => hashDoTrace(r) % 100 < opcoes.taxa * 100);
  const exportacoes: ProcessoInstrumentado["exportacoes"][number][] = [];
  // O lote de spans sai cheio ou no timeout; aqui, no fim, com o que tiver.
  if (amostradas.length > 0) exportacoes.push({ sinal: "traces", itens: amostradas.length, modo: "push" });
  exportacoes.push({ sinal: "metrics", itens: 1, modo: "pull" });
  exportacoes.push({ sinal: "logs", itens: Math.min(n, LOTE_DA_VITRINE), modo: "push" });
  return { requisicoes: n, amostradas, exportacoes, contagem: n };
}

export interface DetalheDaVitrineDosProviders {
  readonly nivel: number;
  readonly linhas: readonly (readonly [string, string])[];
}

const B = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });

export const LARGURA_DOS_PROVIDERS = 1280;
export const ALTURA_DOS_PROVIDERS = 720;

/** Os andares do processo no 3D: um por provider. */
const ANDAR = { traces: 56, metrics: 28, logs: 0 } as const;

export function filmeDaVitrineDosProviders(opcoes: OpcoesDaVitrineDosProviders = OPCOES_DA_VITRINE_DOS_PROVIDERS): Film<DetalheDaVitrineDosProviders> {
  const p = rodarProviders(opcoes);
  const f = film<DetalheDaVitrineDosProviders>({ width: LARGURA_DOS_PROVIDERS, height: ALTURA_DOS_PROVIDERS, maxZoom: 1.9 });
  const sdk = opcoes.sdk;
  const tom = (t: Tone): Tone => (sdk ? t : "muted");

  f.add({ type: "region", id: "proc", box: B(20, 20, 1000, 680), label: sdk ? "process · app + OpenTelemetry SDK" : "process · API only, no SDK", tone: "processor" });
  const ROW = { traces: B(40, 60, 960, 190), metrics: B(40, 280, 960, 190), logs: B(40, 500, 960, 190) } as const;
  f.add({ type: "region", id: "r:traces", box: ROW.traces, label: "TracerProvider", tone: tom("kind-1"), elevation: ANDAR.traces });
  f.add({ type: "region", id: "r:metrics", box: ROW.metrics, label: "MeterProvider", tone: tom("kind-4"), elevation: ANDAR.metrics });
  f.add({ type: "region", id: "r:logs", box: ROW.logs, label: "LoggerProvider", tone: tom("kind-2"), elevation: ANDAR.logs });
  const no = (id: string, row: keyof typeof ROW, x: number, label: string, sub: string, t: Tone, icon: (typeof I)[keyof typeof I], shape?: "register" | "memory" | "pill") =>
    f.add({ type: "node", id, box: B(x, ROW[row].y + 50, 170, 100), label, sublabel: sub, tone: tom(t), icon, elevation: ANDAR[row], ...(shape === undefined ? {} : { shape }) });

  no("api:tracer", "traces", 60, "tracer", sdk ? "API" : "API · no-op", "kind-1", I.trace);
  no("api:meter", "metrics", 60, "meter", sdk ? "API" : "API · no-op", "kind-4", I.metric);
  no("api:logger", "logs", 60, "logger", sdk ? "API" : "API · no-op", "kind-2", I.log);
  if (sdk) {
    no("sampler", "traces", 290, "sampler", `TraceIdRatioBased ${Math.round(opcoes.taxa * 100)}%`, "kind-1", I.sampler, "pill");
    no("bsp", "traces", 520, "BatchSpanProcessor", "queue 0", "kind-1", I.batch, "register");
    no("exp:traces", "traces", 760, "OTLP exporter", "push", "kind-1", I.exporter, "pill");
    no("agg", "metrics", 290, "aggregator", "count 0", "kind-4", I.metric, "memory");
    no("reader", "metrics", 520, "PeriodicReader", "pulls every 60 s", "controller", I.queue, "pill");
    no("exp:metrics", "metrics", 760, "OTLP exporter", "on the reader's call", "kind-4", I.exporter, "pill");
    no("blp", "logs", 520, "BatchLogRecordProcessor", "queue 0", "kind-2", I.batch, "register");
    no("exp:logs", "logs", 760, "OTLP exporter", "push", "kind-2", I.exporter, "pill");
  }
  const COL = B(1080, 290, 170, 120);
  f.add({ type: "node", id: "collector", box: COL, label: "Collector", sublabel: "OTLP receiver", tone: "conduit", shape: "stack", icon: I.collector });
  const centro = (row: keyof typeof ROW) => ROW[row].y + 100;

  // As chamadas do código: uma por sinal, por requisição.
  for (let r = 1; r <= p.requisicoes; r += 1) {
    for (const row of ["traces", "metrics", "logs"] as const) {
      f.add({ type: "token", id: `call:${row}:${r}`, path: line(pt(0, centro(row)), pt(60, centro(row))), label: row === "traces" ? "startSpan" : row === "metrics" ? "add(1)" : "emit", sublabel: `request ${r}`, tone: tom(row === "traces" ? "kind-1" : row === "metrics" ? "kind-4" : "kind-2"), hidden: true, size: 4 });
    }
    if (sdk) {
      f.add({ type: "token", id: `s:${r}`, path: line(pt(230, centro("traces")), pt(290, centro("traces"))), tone: "kind-1", hidden: true, size: 3.5 });
      if (p.amostradas.includes(r)) f.add({ type: "token", id: `sb:${r}`, path: line(pt(460, centro("traces")), pt(520, centro("traces"))), tone: "kind-1", hidden: true, size: 3.5 });
      f.add({ type: "token", id: `m:${r}`, path: line(pt(230, centro("metrics")), pt(290, centro("metrics"))), tone: "kind-4", hidden: true, size: 3.5 });
      f.add({ type: "token", id: `l:${r}`, path: line(pt(230, centro("logs")), pt(520, centro("logs"))), tone: "kind-2", hidden: true, size: 3.5 });
    }
  }
  if (sdk) {
    f.add({ type: "token", id: "pull", path: line(pt(520, centro("metrics") - 20), pt(460, centro("metrics") - 20)), label: "collect()", tone: "controller", hidden: true, size: 4 });
    for (const e of p.exportacoes) {
      const row = e.sinal;
      const de = row === "metrics" ? 460 : 690;
      f.add({ type: "token", id: `out:${row}`, path: line(pt(de, centro(row)), pt(COL.x, COL.y + 60)), label: e.modo === "push" ? "PUSH" : "PULLED", sublabel: `${e.itens} ${row === "traces" ? "spans" : row === "metrics" ? "point" : "records"}`, tone: row === "traces" ? "kind-1" : row === "metrics" ? "kind-4" : "kind-2", hidden: true, size: 5, icon: I.bytes });
    }
  } else {
    f.add({ type: "note", id: "noop", at: pt(300, 360), label: "no SDK: every call returns at once,\nand nothing is recorded or sent", tone: "live", align: "start", hidden: true });
  }

  const exp = (s: "traces" | "metrics" | "logs") => p.exportacoes.find((e) => e.sinal === s);
  f.chapter(
    {
      id: "api",
      title: "The code only talks to the API",
      body: sdk
        ? `Four requests, and for each one the code starts a span, adds 1 to a counter and emits a log. The tracer, the meter and the logger are handles; what happens next is the provider's business.`
        : "Four requests, and the code calls the same API — but no SDK is installed. The API's default providers are no-ops: each call returns immediately and nothing is kept.",
      detail: { nivel: 0, linhas: [["requests", String(p.requisicoes)], ["SDK", sdk ? "installed" : "none"]] },
    },
    (d) => {
      d.camera({ at: { zoom: 1 } }, { dur: 1 });
      for (let r = 1; r <= p.requisicoes; r += 1) {
        d.together(
          (x) => x.send(`call:traces:${r}`, { dur: 450 }),
          (x) => x.send(`call:metrics:${r}`, { dur: 450 }),
          (x) => x.send(`call:logs:${r}`, { dur: 450 }),
        );
        d.ping(["api:tracer", "api:meter", "api:logger"]);
      }
      if (!sdk) d.show("noop", { dur: 400 });
      d.wait(600);
    },
  );
  if (sdk) {
    f.chapter(
      {
        id: "traces",
        title: "Traces: sample, batch, push",
        body: `The sampler decides when each span starts: at ${Math.round(opcoes.taxa * 100)}%, ${p.amostradas.length} of ${p.requisicoes} are recorded. Ended spans wait in the BatchSpanProcessor's queue, and the processor pushes them as one export.`,
        detail: { nivel: 1, linhas: [["sampled", `${p.amostradas.length} / ${p.requisicoes}`], ["export", exp("traces") === undefined ? "nothing to send" : `${exp("traces")!.itens} spans, pushed`]] },
      },
      (d) => {
        d.camera({ box: ROW.traces }, { dur: 1300 });
        let fila = 0;
        for (let r = 1; r <= p.requisicoes; r += 1) {
          d.send(`s:${r}`, { dur: 350 }).ping("sampler");
          if (p.amostradas.includes(r)) {
            d.send(`sb:${r}`, { dur: 350 });
            fila += 1;
            d.set("bsp", { sublabel: `queue ${fila}` }).ping("bsp");
          }
        }
        if (exp("traces") !== undefined) {
          d.glow("bsp", 1).send("out:traces", { dur: 900 }).glow("bsp", 0).set("bsp", { sublabel: "queue 0" }).ping("collector");
          d.packet({ tag: "PUSH", tone: "kind-1", from: "BatchSpanProcessor", to: "Collector", protocol: "OTLP", payload: `${exp("traces")!.itens} spans` });
        }
        d.wait(500);
      },
    );
    f.chapter(
      {
        id: "metrics",
        title: "Metrics: aggregate, then get pulled",
        body: `Each add(1) folds into the aggregator: count ${p.contagem}. Nothing leaves until the PeriodicReader asks — the arrow points the other way — and what leaves is one point, not ${p.requisicoes} measurements.`,
        detail: { nivel: 2, linhas: [["measurements", String(p.requisicoes)], ["aggregated to", `count ${p.contagem}`], ["export", "1 point, pulled"]] },
      },
      (d) => {
        d.camera({ box: ROW.metrics }, { dur: 1300 });
        for (let r = 1; r <= p.requisicoes; r += 1) d.send(`m:${r}`, { dur: 300 }).set("agg", { sublabel: `count ${r}` }).ping("agg");
        d.glow("reader", 1).send("pull", { dur: 600 }).ping("agg");
        d.send("out:metrics", { dur: 900 }).glow("reader", 0).ping("collector");
        d.packet({ tag: "PULLED", tone: "kind-4", from: "PeriodicReader", to: "Collector", protocol: "OTLP", payload: `1 point · count ${p.contagem}` });
        d.wait(500);
      },
    );
    f.chapter(
      {
        id: "logs",
        title: "Logs: batch and push, no sampler",
        body: "Every emitted record goes into the BatchLogRecordProcessor — there is no sampler on this floor — and leaves in one pushed export, like spans.",
        detail: { nivel: 3, linhas: [["records", String(p.requisicoes)], ["export", `${exp("logs")!.itens} records, pushed`]] },
      },
      (d) => {
        d.camera({ box: ROW.logs }, { dur: 1300 });
        for (let r = 1; r <= p.requisicoes; r += 1) d.send(`l:${r}`, { dur: 350 }).set("blp", { sublabel: `queue ${r}` }).ping("blp");
        d.glow("blp", 1).send("out:logs", { dur: 900 }).glow("blp", 0).set("blp", { sublabel: "queue 0" }).ping("collector");
        d.packet({ tag: "PUSH", tone: "kind-2", from: "BatchLogRecordProcessor", to: "Collector", protocol: "OTLP", payload: `${exp("logs")!.itens} records` });
        d.wait(500);
      },
    );
  }
  f.chapter(
    {
      id: "summary",
      title: "Back up: the providers decided",
      body: sdk
        ? `The same four requests left as ${exp("traces")?.itens ?? 0} spans, 1 metric point and ${exp("logs")!.itens} log records. The code did not choose any of that; the providers' samplers, processors and reader did. In the isometric view, each provider is a floor of the process.`
        : "Nothing reached the Collector. The calls were made, the API answered, and without a provider behind it there was no one to decide anything.",
      detail: { nivel: 0, linhas: [["spans out", String(exp("traces")?.itens ?? 0)], ["metric points out", String(exp("metrics")?.itens ?? 0)], ["log records out", String(exp("logs")?.itens ?? 0)]] },
    },
    (d) => {
      d.camera({ at: { zoom: 1 } }, { dur: 1400 });
      d.glow("collector", 1).wait(1800).glow("collector", 0);
    },
  );
  return f.build();
}
