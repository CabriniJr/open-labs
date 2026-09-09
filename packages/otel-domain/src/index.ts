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
  VIEW_APPLICATION,
  VIEW_BATCH_PROCESSOR,
  VIEW_HOST,
  VIEW_LOGGER_PROVIDER,
  VIEW_METER_PROVIDER,
  VIEW_PROCESS,
  VIEW_PROCESS_SEM_SDK,
  VIEW_SDK,
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

// Os exercícios de instrumentação: definição, sem a resposta certa.
export { EXERCICIOS_DOS_PROVEDORES } from "./exercicios/providers.js";
export type { DefinicaoDeExercicio, Distrator } from "./exercicios/tipos.js";

// O lab dos três pilares: as mesmas requisições, três gravadores.
export { pilaresWorld, PARAMS_DOS_PILARES, latenciaDe } from "./pilares/world.js";
export type {
  EstadoMedidor,
  EstadoRegistrador,
  EstadoServico,
  EstadoTracer,
} from "./pilares/world.js";
export { estadoDosPilares, LEITOR_DA_REQUISICAO } from "./pilares/estado.js";
export type { EstadoDosPilares, RespostaDoSinal } from "./pilares/estado.js";
export { baldeDe, BALDES, chaveDaSerie } from "./pilares/carga.js";
export type { Requisicao } from "./pilares/carga.js";
export { ROTULOS_PILARES, MAL_ENTENDIDOS_DOS_PILARES } from "./pilares/labels.js";
export { VIEW_PILARES, VIEWS_DOS_PILARES } from "./pilares/views.js";

// O lab da anatomia de um trace: a árvore que ninguém possui.
export { anatomiaWorld, PARAMS_DA_ANATOMIA } from "./anatomia/world.js";
export type { EstadoBackend, EstadoServico as EstadoServicoDaAnatomia } from "./anatomia/world.js";
export { estadoDaAnatomia, LEITOR_DA_CHAMADA } from "./anatomia/estado.js";
export type { ArvoreMontada, EstadoDaAnatomia, NoDaArvore } from "./anatomia/estado.js";
export type { Chamada, SpanExportado } from "./anatomia/carga.js";
export { MAL_ENTENDIDOS_DA_ANATOMIA, ROTULOS_ANATOMIA, SERVICOS } from "./anatomia/labels.js";
export { VIEW_ANATOMIA, VIEWS_DA_ANATOMIA } from "./anatomia/views.js";
