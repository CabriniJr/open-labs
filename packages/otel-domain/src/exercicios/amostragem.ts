import type { DefinicaoDeExercicio } from "./tipos.js";

const GATEWAY = "labs/head-vs-tail-sampling/gateway.yaml";
const TAIL = "labs/head-vs-tail-sampling/tail.yaml";
const APP = "labs/head-vs-tail-sampling/app/src/main/java/sampling/App.java";

/**
 * Os exercícios do lab da amostragem — e os três moram em arquivos diferentes.
 *
 * Isso não é variedade por variedade: a decisão de amostragem é tomada em
 * **três lugares** que pertencem a três pessoas diferentes, e é precisamente
 * por isso que ela dá errado. O amostrador do SDK é de quem escreve a
 * aplicação; o `routing_key` é de quem opera o cluster; as políticas são de
 * quem cuida da observabilidade. Nenhum dos três vê o arquivo dos outros dois,
 * e cada um dos três pode, sozinho, apagar o trace do erro.
 */
export const EXERCICIOS_DA_AMOSTRAGEM: readonly DefinicaoDeExercicio[] = [
  {
    id: "o-amostrador-do-sdk",
    lab: "head-vs-tail-sampling",
    arquivo: APP,
    trecho: "o-amostrador-do-sdk",
    cenario:
      "Your Collector runs tail sampling with a policy that keeps every trace containing an " +
      "error. This is the SDK in the application, and the line that decides what the " +
      "Collector gets to see.",
    pergunta: "What sampler belongs here?",
    porqueCerto:
      "Keep everything, and let the parent decide for the rest of the trace. Two samplers in " +
      "series multiply, and the SDK's is the one that cannot know anything yet — so any " +
      "fraction taken here is taken off the top of what every tail policy will later be " +
      "applied to. `parentBased` is what makes the root's decision hold for the whole trace " +
      "instead of each span deciding for itself and producing a trace with holes.",
    fonteCerto: "https://opentelemetry.io/docs/concepts/sampling/",
    distratores: [
      {
        id: "o-amostrador-do-sdk-dez-por-cento",
        codigo: ".setSampler(Sampler.parentBased(Sampler.traceIdRatioBased(0.1)))",
        porque:
          "It is the most common configuration in the wild, and it reads as prudent: thin the " +
          "traffic at the source, then let the Collector pick what matters out of what " +
          "arrives. The two decisions compose by multiplication, not by replacement — the " +
          "tail policy keeps every error inside the 10% that survived, and the other 90% of " +
          "your errors were deleted in the process, before any of them had failed.",
        fonte: "https://opentelemetry.io/docs/concepts/sampling/",
      },
      {
        id: "o-amostrador-do-sdk-sem-pai",
        codigo: ".setSampler(Sampler.traceIdRatioBased(1.0))",
        porque:
          "At a ratio of 1.0 this keeps everything too, so it looks equivalent — and in this " +
          "lab it behaves identically. The defect appears the moment the ratio is not 1.0: " +
          "without `parentBased`, each span consults the sampler on its own, so a service " +
          "can keep a child whose parent was dropped. The result is a trace that exists in " +
          "fragments, which is the shape this lab's third experiment produces by another " +
          "route.",
        fonte: "https://www.w3.org/TR/trace-context/",
      },
    ],
  },
  {
    id: "a-chave-de-roteamento",
    lab: "head-vs-tail-sampling",
    arquivo: GATEWAY,
    trecho: "a-chave-de-roteamento",
    cenario:
      "The Collector in front of two tail-sampling gateways. It samples nothing — it only " +
      "decides which instance each span goes to.",
    pergunta: "What goes in the exporter's routing key?",
    porqueCerto:
      "The trace id, because the processor on the other side can only decide correctly if it " +
      "has the whole trace: its own documentation states that all spans of a trace must " +
      "reach the same Collector instance. Routing on the trace id is what makes that true " +
      "while still using both instances — each trace lands on one of them, consistently, " +
      "and the two share the traffic because trace ids are spread out.",
    fonteCerto:
      "https://opentelemetry.io/docs/collector/deploy/other/agent-to-gateway/",
    distratores: [
      {
        id: "a-chave-de-roteamento-servico",
        codigo: "routing_key: service",
        porque:
          "It is a real option and the right one for a different job — spanmetrics, where " +
          "each instance must see a whole service and not a whole trace. Here it splits by " +
          "the wrong axis: a trace crosses services, so its spans go to different gateways, " +
          "and each one then decides on the fragment it received. Nothing fails, both " +
          "instances report healthy, and the traces in your backend are missing spans.",
        fonte:
          "https://opentelemetry.io/docs/collector/deploy/other/agent-to-gateway/",
      },
      {
        id: "a-chave-de-roteamento-sem-chave",
        codigo: "routing_key: randomness",
        porque:
          "It is a documented option and it reads like the honest way to balance load, which " +
          "it is — for spans. That is the problem: it distributes spans evenly and therefore " +
          "scatters each trace across both gateways, which is the one thing tail sampling " +
          "cannot survive. Even load and correct decisions are in direct conflict here, and " +
          "the trace id is the key that buys both.",
        fonte:
          "https://opentelemetry.io/docs/collector/deploy/other/agent-to-gateway/",
      },
    ],
  },
  {
    id: "as-politicas-da-cauda",
    lab: "head-vs-tail-sampling",
    arquivo: TAIL,
    trecho: "as-politicas-da-cauda",
    cenario:
      "The tail sampling processor on both gateways. You are paying for the decision window " +
      "already — this block is what you get for it.",
    pergunta: "What goes in `policies:`?",
    porqueCerto:
      "Two policies, because one of them alone answers half a question. Policies are OR'd: a " +
      "trace is kept if any of them matches, so the first keeps everything that failed — the " +
      "reason for deciding late at all — and the second keeps a sample of ordinary traffic. " +
      "Without the baseline you have every failure and nothing to compare it against, which " +
      "is a dashboard where the error rate is 100%.",
    fonteCerto: "https://opentelemetry.io/docs/concepts/sampling/",
    distratores: [
      {
        id: "as-politicas-da-cauda-so-probabilistica",
        codigo:
          "policies:\n" +
          "  - name: linha-de-base\n" +
          "    type: probabilistic\n" +
          "    probabilistic: { sampling_percentage: 10 }",
        porque:
          "Valid, boots, and samples 10% of traces — which is head sampling, paid for at tail " +
          "sampling prices. Every span of every trace was held in memory for the decision " +
          "window so that a hash of the trace id could be consulted at the end, and a hash " +
          "of the trace id was available at the beginning, in the SDK, for free. The only " +
          "thing that justifies the window is a policy that needs the finished trace.",
        fonte: "https://opentelemetry.io/docs/concepts/sampling/",
      },
      {
        id: "as-politicas-da-cauda-sempre",
        codigo: "policies:\n  - name: tudo\n    type: always_sample",
        porque:
          "It is the configuration people arrive at after being burned by missing traces, and " +
          "it is honest about what it does. What it is not is sampling: the processor now " +
          "holds every span for the decision window in order to decide yes. You have bought " +
          "the memory and the latency of tail sampling and kept the bill of keeping " +
          "everything, which is the one combination that has no argument for it.",
        fonte: "https://opentelemetry.io/docs/concepts/sampling/",
      },
    ],
  },
];
