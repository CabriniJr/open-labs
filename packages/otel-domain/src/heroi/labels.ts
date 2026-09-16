/** O handbook é em inglês; o vocabulário do leitor mora aqui. */
export const ROTULOS_HEROI = {
  sistema: "One span, from the process to the backend",
  service: "service",
  collector: "collector",
  backend: "backend",
  /** O que se lê ao descer no collector — o título da vista de dentro. */
  dentroDoCollector: "Inside the collector: it appends, and passes it on",
  receiver: "otlp receiver",
  processor: "resource processor",
  exporter: "otlp exporter",
} as const;

/** O que o collector acrescenta ao recurso de tudo que passa por ele. */
export const ATRIBUTO_DO_COLLECTOR = "collector.name";
export const VALOR_DO_COLLECTOR = "otelcol";
