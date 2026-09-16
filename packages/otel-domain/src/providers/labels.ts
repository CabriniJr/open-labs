/**
 * Todo texto que o leitor vê, em inglês, num arquivo só.
 *
 * O handbook é em inglês por decisão do projeto; o código é em português. A
 * fronteira entre as duas línguas é este arquivo, e ela existe para que revisar
 * o texto não signifique ler o modelo.
 *
 * Os **ids** dos objetos são em inglês e usam o nome que a spec do OpenTelemetry
 * usa — desvio consciente do `cpu-domain`, que tem ids em português. `TracerProvider`
 * é substantivo próprio de um documento normativo, e traduzi-lo quebraria a
 * correspondência entre a árvore do SDK e o envelope do OTLP, que é a tese do lab.
 */

import type { AtributoDeRecurso, PlacaDeRecurso } from "./carga.js";

export type { AtributoDeRecurso, PlacaDeRecurso };

/**
 * O recurso do processo.
 *
 * Ele é UM, e os três provedores o estampam no que produzem — é literalmente o
 * mesmo objeto em `resourceSpans`, `resourceMetrics` e `resourceLogs`.
 */
export const RECURSO_DO_PROCESSO: readonly AtributoDeRecurso[] = [
  { chave: "service.name", valor: "checkout" },
  { chave: "service.version", valor: "2.4.1" },
  { chave: "deployment.environment.name", valor: "production" },
];

/** O recurso do segundo provider, quando ele existe. A diferença é o que ensina. */
export const RECURSO_DO_SEGUNDO: readonly AtributoDeRecurso[] = [
  { chave: "service.name", valor: "checkout-legacy" },
  { chave: "service.version", valor: "1.9.0" },
  { chave: "deployment.environment.name", valor: "production" },
];

export const ROTULOS = {
  host: "Host",
  process: "Instrumented process",
  application: "Application",
  app: "Your code and libraries",
  api: "OpenTelemetry API",
  sdk: "OpenTelemetry SDK",
  propagators: "Propagators",

  tracerProvider: "TracerProvider",
  tracerProviderB: "TracerProvider (second)",
  recursoDeTraces: {
    titulo: "Resource",
    attributes: RECURSO_DO_PROCESSO,
  } satisfies PlacaDeRecurso,
  recursoDoSegundo: {
    titulo: "Resource",
    attributes: RECURSO_DO_SEGUNDO,
  } satisfies PlacaDeRecurso,
  spanLimits: "SpanLimits",
  sampler: "Sampler",
  spanProcessors: "SpanProcessors",
  batchProcessor: "BatchSpanProcessor",
  queue: "Queue",
  batchTimer: "scheduledDelay",
  spanExporter: "SpanExporter",
  traceFlush: "ForceFlush / Shutdown",

  loggerProvider: "LoggerProvider",
  recursoDeLogs: {
    titulo: "Resource",
    attributes: RECURSO_DO_PROCESSO,
  } satisfies PlacaDeRecurso,
  traceGate: "trace_based",
  logProcessors: "LogRecordProcessors",
  batchLogProcessor: "BatchLogRecordProcessor",
  logQueue: "Queue",
  logTimer: "scheduledDelay",
  logExporter: "LogRecordExporter",
  logFlush: "ForceFlush / Shutdown",

  meterProvider: "MeterProvider",
  recursoDeMetricas: {
    titulo: "Resource",
    attributes: RECURSO_DO_PROCESSO,
  } satisfies PlacaDeRecurso,
  views: "Views",
  points: "Metric points",
  metricReader: "PeriodicExportingMetricReader",
  metricExporter: "MetricExporter",

  collector: "Collector",
  canal: "OTLP",

  noopTracerProvider: "no-op TracerProvider",

  /** O escopo de instrumentação que o `app` usa. É o `scope.name` do envelope. */
  escopo: "checkout.http",
} as const;

/**
 * O que cada peça é, no vocabulário do OpenTelemetry. Chave = id do objeto.
 *
 * A ficha é lida por quem clicou numa caixa, então cada linha responde *o que
 * isto decide*, e não *o que isto é*. "É um buffer" não ensina nada; "quando
 * enche, o span é descartado" ensina.
 */
export const DESCRICOES: Readonly<Record<string, string>> = {
  host: "The machine. The process runs here, and so does the Collector — which is the point: they are not the same program.",
  process:
    "One process, one SDK. Everything inside this frame shares a lifetime: when it ends, whatever has not left is gone.",
  application:
    "Your process, from the inside: the code that calls, and the API it calls. Everything in here depends on the API package only — and the API package knows nothing about exporters, batching or the wire.",
  app: "Your code and your instrumented libraries, calling startSpan, record and emit. It produces without receiving — the inner edge of the system.",
  api: "The OpenTelemetry API. It transports and never alters: it hands the call to whichever provider is registered, and if none is, to a no-op. This is the seam that lets a library be instrumented without choosing anyone's SDK — and it is why nothing raises when the SDK never came up.",
  sdk: "The SDK: the three providers, and everything they own. Swap it, configure it, remove it — the API above does not change, and neither does a single line of instrumented code.",
  propagators:
    "W3C Trace Context and Baggage. They hang on the PROCESS, not on any provider: the propagator API is global, and context is not provider configuration. This is why changing a TracerProvider never changes how context travels.",

  "tracer-provider":
    "Everything that decides whether a span leaves the process is configured here: the resource, the sampler, the span limits, the processors, and the moment of the flush. The Tracer itself has no configuration at all.",
  "resource-traces":
    "The Resource: attributes that describe the process, not the span. It is attached to the provider, and it is why service.name sits one layer ABOVE the spans in the OTLP envelope. Nothing wires to it — a plate is consulted, never traversed.",
  "span-limits":
    "SpanLimits: how many attributes, events and links a span may carry before the SDK starts dropping them. Configuration consulted at span creation.",
  sampler:
    "ShouldSample is consulted at span CREATION, before any processor. It returns three things, not two — and the middle one, RECORD_ONLY, is the one almost nobody knows exists.",
  "span-processors":
    "The registered SpanProcessors, invoked in the order they were registered. Order is contract here — that is what makes this a pipeline and not a bag.",
  "batch-processor":
    "The BatchSpanProcessor: a queue, a timer and an exporter. It has a real interior, and every default in it is a number from the spec.",
  queue: "maxQueueSize, 2048 by default. When it is full it REFUSES: the span is dropped, and the drop is a fact of the model — never a silence.",
  "batch-timer":
    "scheduledDelayMillis, 5000 by default. It wakes up on its own and speaks only on a control line — it PUSHES. Compare the arrow with the metric reader's.",
  "span-exporter":
    "The SpanExporter. It closes over the provider's Resource — which is how the resource reaches the envelope without a single wire touching the plate. The spec says the default SDK must NOT implement retry: that logic belongs to the protocol exporter.",
  "trace-flush":
    "ForceFlush and Shutdown. The spec: ForceFlush MUST invoke ForceFlush on all registered SpanProcessors — which is why this line descends to more than one place at once. It exists precisely for the process that gets suspended before the exporter exports.",

  "logger-provider":
    "The LoggerProvider configures LogRecordProcessors, and nothing else. There is no log sampler — the absence is the lesson.",
  "resource-logs":
    "The same Resource, on the log side. One process, one description of it — and that is what lets a backend join a log to a trace.",
  "trace-gate":
    "LoggerConfig.trace_based. When it is on, a log record attached to a non-sampled trace is dropped by the Logger. It is off by default in the spec — and when it is on, lowering trace sampling silently erases logs.",
  "log-processors": "The registered LogRecordProcessors, in registration order.",
  "batch-log-processor":
    "The BatchLogRecordProcessor: the same shape as the span one — queue, timer, exporter. It does NOT check the sampled bit, because the LoggerProvider has no sampler.",
  "log-queue": "The same buffer, the same refusal when it fills.",
  "log-timer": "scheduledDelayMillis on the log side. It pushes, like the trace one.",
  "log-exporter": "The LogRecordExporter, closing over the same Resource.",
  "log-flush": "ForceFlush and Shutdown for the LoggerProvider.",

  "meter-provider":
    "The MeterProvider. Readers, exporters and views MUST be configured here — and the shape underneath is not the shape of the other two.",
  "resource-metrics": "The same Resource again. Three providers, one description of the process.",
  views:
    "Views, or stream configuration: which instruments become which streams, with which attributes. Consulted, not traversed.",
  points:
    "The in-memory metric points: one row per attribute set. It answers when asked and emits nothing on its own. At the cardinality limit it does NOT refuse — it COLLAPSES, folding the excess into a single otel.metric.overflow row. Same problem as the queue, a different lie.",
  "metric-reader":
    "The PeriodicExportingMetricReader. exportIntervalMillis, 60000 by default — twelve times the trace delay. And the arrow points the other way: it PULLS.",
  "metric-exporter": "The metric exporter. It sends what the reader collected, and only that.",

  collector:
    "Out of process — not modelled in this lab. What happens inside it is the Collector pipeline lab. Here it is the edge: it counts, and it holds the last envelope that crossed.",
  "otlp-out":
    "The export channel. Opaque in this lab: what it looks like on the wire — HTTP/2 framing, length prefixes, stream ids — is the gRPC over HTTP/2 annex, and it says nothing about who decides what leaves the process.",
};

export interface MalEntendido {
  /** O que se acredita. Escrito para quem já tem a ideia errada. */
  readonly crenca: string;
  /** O que a spec diz. */
  readonly spec: string;
  readonly fonte: string;
  /** O id do objeto que desfaz o mal-entendido no desenho. */
  readonly onde: string;
}

/**
 * Os mal-entendidos que este lab desfaz.
 *
 * O `DECISIONS.md` §8.2 pede este campo, e este é o primeiro lab a tê-lo. O
 * texto é escrito **para quem já tem a ideia errada** — não para quem não tem
 * ideia —, porque desfazer uma crença é um trabalho diferente de introduzir um
 * conceito, e o segundo texto não faz o primeiro trabalho.
 */
export const MAL_ENTENDIDOS: readonly MalEntendido[] = [
  {
    crenca: "service.name is an attribute of the span.",
    spec: "It belongs to the Resource, which belongs to the provider — and in OTLP it sits one layer above the spans.",
    fonte: "https://opentelemetry.io/docs/specs/otel/resource/sdk/",
    onde: "resource-traces",
  },
  {
    crenca: "You configure the tracer.",
    spec: "A Tracer has no configuration. It holds an InstrumentationScope and nothing else; everything configurable lives on the provider.",
    fonte: "https://opentelemetry.io/docs/specs/otel/trace/sdk/#tracer-creation",
    onde: "tracer-provider",
  },
  {
    crenca: "Sampling happens on export.",
    spec: "It happens at span creation, before any processor sees the span.",
    fonte: "https://opentelemetry.io/docs/specs/otel/trace/sdk/#sdk-span-creation",
    onde: "sampler",
  },
  {
    crenca: "A dropped span and a non-sampled span are the same thing.",
    spec: "RECORD_ONLY exists: the span is created, recorded and readable in-process — and the exporter never sees it.",
    fonte: "https://opentelemetry.io/docs/specs/otel/trace/sdk/#recording-sampled-reaction-table",
    onde: "queue",
  },
  {
    crenca: "The provider propagates context.",
    spec: "Propagators are global and belong to no provider. Swapping a provider changes nothing about how context travels.",
    fonte: "https://opentelemetry.io/docs/specs/otel/context/api-propagators/",
    onde: "propagators",
  },
  {
    crenca: "If the SDK did not come up, something raises an error.",
    spec: "The API returns a no-op provider. No error, no warning — just a counter going up and nothing leaving.",
    fonte: "https://opentelemetry.io/docs/specs/otel/trace/api/#behavior-of-the-api-in-the-absence-of-an-installed-sdk",
    onde: "app",
  },
  {
    crenca: "Metrics work like traces.",
    spec: "One is pulled and the other is pushed, and the default intervals differ by twelve times — 60000 ms against 5000 ms.",
    fonte: "https://opentelemetry.io/docs/specs/otel/metrics/sdk/#periodic-exporting-metricreader",
    onde: "metric-reader",
  },
  {
    crenca: "The exporter retries when a send fails.",
    spec: "The spec says the default SDK must NOT implement retry — that logic depends on the protocol and belongs to the protocol exporter.",
    fonte: "https://opentelemetry.io/docs/specs/otel/trace/sdk/#exportbatch",
    onde: "span-exporter",
  },
  {
    crenca: "Running out of memory always means losing data.",
    spec: "It depends on who is holding it. The span queue refuses and the span dies; the metric store collapses the excess into one overflow row and the sum is preserved.",
    fonte: "https://opentelemetry.io/docs/specs/otel/metrics/sdk/#overflow-attribute",
    onde: "points",
  },
];
