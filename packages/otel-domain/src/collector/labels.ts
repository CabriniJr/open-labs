import type { MalEntendido } from "../providers/labels.js";

export const ROTULOS_COLLECTOR = {
  collector: "One receiver, two pipelines",
  app: "app · one process, one exporter",
  receiver: "otlp receiver",
  limiter: "memory_limiter",
  lote: "batch",
  exportador: "otlp exporter",
  filtro: "filter",
  depuracao: "debug exporter",
  backend: "backend · what arrived",
  console: "stdout · what the operator sees",
  descartes: "dropped · counted, not silent",
} as const;

/**
 * As rotas que a aplicação atende, e uma delas é o assunto.
 *
 * `/health` entra porque é a rota que todo mundo quer filtrar e é a que mais
 * aparece: um liveness probe de um segundo gera mais span que o tráfego real.
 * Uma lista só, porque duas divergem.
 */
export const ROTAS_DO_COLLECTOR = ["/checkout", "/health", "/cart", "/health"] as const;

export const ROTA_FILTRADA = "/health";

export const MAL_ENTENDIDOS_DO_COLLECTOR: readonly MalEntendido[] = [
  {
    crenca: "I added a filter processor, so that data stops leaving the Collector.",
    spec:
      "A processor belongs to ONE pipeline. A receiver that feeds two pipelines hands each " +
      "of them its own copy, so a filter in one changes nothing in the other — and the " +
      "exporter you were not looking at keeps exporting everything.",
    fonte: "https://opentelemetry.io/docs/collector/configuration/#pipelines",
    onde: "filtro",
  },
  {
    crenca: "`processors:` is the set of processors the pipeline uses.",
    spec:
      "It is an ordered list, and the order is the behaviour: data goes through it top to " +
      "bottom. `memory_limiter` first and `batch` after it is not style — it decides " +
      "whether the limiter sees single items or whole batches.",
    fonte: "https://opentelemetry.io/docs/collector/configuration/#processors",
    onde: "limiter",
  },
  {
    crenca: "The batch processor sends when it is full.",
    spec:
      "It sends when it is full **or** when the timeout expires, whichever comes first. " +
      "Without the timeout, a service with low traffic would hold its telemetry until the " +
      "batch filled up — which can be never.",
    fonte: "https://opentelemetry.io/docs/collector/configuration/#processors",
    onde: "lote",
  },
  {
    crenca:
      "A processor that drops data hides it — the number only shows up in the backend that " +
      "stopped receiving.",
    spec:
      "The Collector counts what it refuses. `otelcol_processor_refused_spans` and the " +
      "dropped counters exist precisely so that loss inside the Collector is readable " +
      "where it happened, instead of being inferred from an absence downstream.",
    fonte: "https://opentelemetry.io/docs/collector/internal-telemetry/",
    onde: "descartes",
  },
];
