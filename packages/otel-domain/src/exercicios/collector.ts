import type { DefinicaoDeExercicio } from "./tipos.js";

const ARQUIVO = "labs/collector-pipeline/collector.yaml";

/**
 * Os exercícios do lab do Collector — e os primeiros que não são sobre código.
 *
 * O arquivo que roda aqui é uma **configuração**, e isso não é um detalhe de
 * formato: no Collector, quase toda decisão cara é tomada em YAML por alguém
 * que não está escrevendo código, não compila nada, e não tem tipo nenhum
 * avisando. Um `processors:` na ordem errada passa pelo `validate`, sobe, roda,
 * e exporta telemetria — só que de outro jeito.
 *
 * O primeiro deles é a tese que o lab da tela **não consegue simular**: a ordem
 * de `processors:` é o comportamento, e trocar a ordem é trocar o desenho — que
 * num `.mmd` é estático. O limite do formato está registrado na §7.1 da spec, e
 * o exercício é onde a tese cabe: aqui ela é uma escolha, não uma animação.
 */
export const EXERCICIOS_DO_COLLECTOR: readonly DefinicaoDeExercicio[] = [
  {
    id: "a-ordem-dos-processors",
    lab: "collector-pipeline",
    arquivo: ARQUIVO,
    trecho: "a-ordem-dos-processors",
    cenario:
      "The pipeline that feeds your backend. `memory_limiter` and `batch` are both declared " +
      "above, with the settings you want — this line decides only which runs first.",
    pergunta: "What goes in `processors:`?",
    porqueCerto:
      "`processors:` is an ordered list, and data goes through it top to bottom. The limiter " +
      "first means it decides about individual spans, before anything has been grouped or " +
      "copied — which is the only point where refusing one costs the memory of one. Putting " +
      "it ahead of `batch` is the documented recommendation, and it is a recommendation " +
      "about order rather than about either processor.",
    fonteCerto: "https://opentelemetry.io/docs/collector/configuration/#processors",
    distratores: [
      {
        id: "a-ordem-dos-processors-invertida",
        codigo: "processors: [batch, memory_limiter]",
        porque:
          "Both processors are present, both are configured correctly, and the config is " +
          "valid — which is why this survives review. The limiter now sees batches instead " +
          "of spans, so two things change and neither is visible in the config: the memory " +
          "it is trying to protect has already been allocated by the batcher, and refusing " +
          "under pressure throws away a whole batch rather than one span. Your loss becomes " +
          "lumpy, and it starts later than it should.",
        fonte: "https://opentelemetry.io/docs/collector/configuration/#processors",
      },
      {
        id: "a-ordem-dos-processors-sem-limiter",
        codigo: "processors: [batch]",
        porque:
          "The reasoning is real: the exporter already has a sending queue, so why add a " +
          "second place that drops things? Because the queue protects the exporter and the " +
          "limiter protects the process. With no limiter, back-pressure from a slow backend " +
          "fills the queue, then the batcher, then the heap — and the Collector that was " +
          "supposed to absorb the incident becomes the second one.",
        fonte: "https://opentelemetry.io/docs/collector/configuration/#basic-configuration",
      },
    ],
  },
  {
    id: "o-que-fecha-o-lote",
    lab: "collector-pipeline",
    arquivo: ARQUIVO,
    trecho: "o-que-fecha-o-lote",
    cenario:
      "The batch processor for a service whose traffic varies: busy at midday, nearly idle " +
      "at night. Spans still have to reach the backend at night.",
    pergunta: "What closes a batch?",
    porqueCerto:
      "Both, and whichever comes first. Size is the one everybody knows — it is what makes " +
      "batching worth doing. The timeout is what makes it safe: without it, a batch that " +
      "never fills is a batch that never leaves, so the quieter a service gets the longer " +
      "its telemetry is held. The two together mean throughput at noon and latency at " +
      "three in the morning.",
    fonteCerto: "https://opentelemetry.io/docs/collector/configuration/#processors",
    distratores: [
      {
        id: "o-que-fecha-o-lote-so-tamanho",
        codigo: "send_batch_size: 4",
        porque:
          "It reads as the honest minimum — set the size, leave the rest at defaults. The " +
          "trap is that it looks like a complete sentence: 'send batches of four'. At " +
          "midday it is, and the lab's own low-traffic scenario is the counterexample: one " +
          "span per second into a batch of six, and the spans sit there. You find this " +
          "during an incident, when the last thing you see is three minutes old.",
        fonte: "https://opentelemetry.io/docs/collector/configuration/#processors",
      },
      {
        id: "o-que-fecha-o-lote-timeout-zero",
        codigo: "send_batch_size: 4\ntimeout: 0s",
        porque:
          "Explicit, and the opposite of what it looks like. Zero does not mean 'no delay, " +
          "send immediately' — it disables the timer, so size becomes the only thing that " +
          "can close a batch and you are back to the case above, having written a line that " +
          "reads as though you thought about latency.",
        fonte: "https://opentelemetry.io/docs/collector/configuration/#processors",
      },
    ],
  },
];
