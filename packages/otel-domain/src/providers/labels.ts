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
  app: "Instrumentation",
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
