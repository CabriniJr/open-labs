export { formatTraceparent, parseTraceparent } from "./traceparent.js";
export type { TraceContext } from "./traceparent.js";
export { attribute, toOtlpJson } from "./otlp.js";
export type {
  AnyValue,
  ExportTraceServiceRequest,
  KeyValue,
  OtelResource,
  OtelSpan,
  ResourceSpans,
  ScopeSpans,
  SpanKind,
} from "./otlp.js";

// O lab dos provedores.
export { otelWorld, PARAMS_PADRAO } from "./providers/world.js";
export type { EstadoCollector, OpcoesDoMundo } from "./providers/world.js";
export { estadoOtel } from "./providers/estado.js";
export type { EstadoOtel, PontoDeMetrica } from "./providers/estado.js";
export { envelopesDe, envelopeUnico } from "./providers/envelope.js";
export type { EnvelopeEmVoo } from "./providers/envelope.js";
export { especieDaCarga, leituraDaCarga } from "./providers/carga.js";
export type { AtributoDeRecurso, PlacaDeRecurso, RegistroDeSpan } from "./providers/carga.js";
export {
  DESCRICOES,
  MAL_ENTENDIDOS,
  RECURSO_DO_PROCESSO,
  RECURSO_DO_SEGUNDO,
  ROTULOS,
} from "./providers/labels.js";
export type { MalEntendido } from "./providers/labels.js";
export {
  OTEL_VIEWS,
  VIEWS_DE_PROVIDER,
  VIEWS_SEM_SDK,
  VIEW_BATCH_PROCESSOR,
  VIEW_HOST,
  VIEW_LOGGER_PROVIDER,
  VIEW_METER_PROVIDER,
  VIEW_PROCESS,
  VIEW_PROCESS_SEM_SDK,
  VIEW_TRACER_PROVIDER,
} from "./providers/views.js";
export {
  MAX_EXPORT_BATCH_SIZE_PADRAO,
  MAX_QUEUE_SIZE_PADRAO,
  SCHEDULED_DELAY_MS_PADRAO,
} from "./providers/batch.js";
export {
  ATRIBUTO_DE_OVERFLOW,
  EXPORT_INTERVAL_MS_PADRAO,
  LIMITE_DE_CARDINALIDADE_PADRAO,
} from "./providers/metrics.js";
export { decidir, PORTA_DA_DECISAO } from "./providers/sampler.js";
export type { Amostrador, Decisao } from "./providers/sampler.js";
