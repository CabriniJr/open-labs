import type { DefinicaoDeExercicio } from "./tipos.js";

const ARQUIVO = "labs/anatomy-of-a-trace/app/src/main/java/anatomy/Service.java";

/**
 * Os exercícios da anatomia de um trace.
 *
 * Os dois são sobre a **mesma** peça — qual contexto o serviço passa adiante —
 * vista das duas pontas: uma vez quando ele decide o que vira corrente, outra
 * quando ele decide o que vai no cabeçalho. A escolha é deliberada: o defeito
 * que o lab existe para ensinar não é um erro de API, é **a árvore fechar
 * parecendo completa com um salto a menos**, e esse resultado sai de qualquer
 * uma das duas pontas errada.
 *
 * É por isso que um dos distratores de cada um produz exatamente o cenário
 * `sem-instrumentacao` do lab, e o outro produz o cenário
 * `derrubar-cabecalho-em`. Quem errar aqui não vê um erro: vê o painel do lab
 * com o parâmetro ligado — e nenhum dos dois levanta exceção, nem aparece em
 * log, nem falha em teste de integração que só conte requisições.
 */
export const EXERCICIOS_DA_ANATOMIA: readonly DefinicaoDeExercicio[] = [
  {
    id: "qual-contexto-segue-adiante",
    lab: "anatomy-of-a-trace",
    arquivo: ARQUIVO,
    trecho: "qual-contexto-segue-adiante",
    cenario:
      "One service in the chain. The header that arrived is already extracted into " +
      "`recebido`, and the SERVER span for this hop is already open in `span` — unless this " +
      "instance is running uninstrumented, in which case `span` is null.",
    pergunta: "Which context becomes current for the rest of this request?",
    porqueCerto:
      "A Context is immutable, so `recebido.with(span)` is a NEW context: the one that " +
      "arrived, plus the span this service just opened. That is the one the outgoing call " +
      "has to see, because the next hop must become a child of THIS span and not of " +
      "whatever was above it. The null branch is the honest case and not a special case — " +
      "an uninstrumented hop has no span to add, so it passes along exactly what it got.",
    fonteCerto: "https://opentelemetry.io/docs/specs/otel/context/",
    distratores: [
      {
        id: "qual-contexto-segue-adiante-recebido",
        codigo: "Context atual = recebido;",
        porque:
          "It reads as the careful choice — propagate the context that arrived, do not " +
          "invent anything. And it works: the request succeeds, this span is still " +
          "exported, and the backend still draws a tree. What it loses is one level. The " +
          "next hop hangs off THIS service's parent, so the grandchild becomes a child of " +
          "the grandparent and the tree closes looking complete, with a span missing from " +
          "the middle and its time silently attributed to whoever is above. It is the " +
          "`sem-instrumentacao` panel of the lab, reached by a line of code instead of a " +
          "flag.",
        fonte:
          "https://opentelemetry.io/docs/specs/otel/trace/api/#span-creation",
      },
      {
        id: "qual-contexto-segue-adiante-current",
        codigo: "Context atual = Context.current();",
        porque:
          "The ambient context is the right answer in most of a codebase — it is how a " +
          "library deep in the stack finds the active span without being handed one. It is " +
          "wrong HERE, and the reason is timing: nothing has made the extracted context " +
          "current yet; `makeCurrent()` is the line below this one. So this reads an empty " +
          "context, the next hop gets no traceparent, and it starts a brand-new trace — " +
          "the same outcome as a proxy stripping the header.",
        fonte: "https://opentelemetry.io/docs/specs/otel/context/#context",
      },
    ],
  },
  {
    id: "o-que-entra-no-cabecalho",
    lab: "anatomy-of-a-trace",
    arquivo: ARQUIVO,
    trecho: "o-que-entra-no-cabecalho",
    cenario:
      "The same service, one step later. `atual` holds the context with this hop's span in " +
      "it, and `pedido` is the outgoing request being built for the next service.",
    pergunta: "What gets written into the outgoing request's headers?",
    porqueCerto:
      "Injection is the only thing that turns context into a header, and the propagator is " +
      "the only thing that knows how to write it — W3C `traceparent` has a version, a " +
      "trace id, a span id and flags, and all four are the propagator's business. Handing " +
      "it `atual` is what makes the next hop a child of this span: the span id that leaves " +
      "in the header is the one the backend will read as the parent.",
    fonteCerto: "https://www.w3.org/TR/trace-context/#traceparent-header",
    distratores: [
      {
        id: "o-que-entra-no-cabecalho-recebido",
        codigo:
          "otel.getPropagators()\n" +
          "    .getTextMapPropagator()\n" +
          "    .inject(recebido, pedido, (TextMapSetter<HttpRequest.Builder>) (b, k, v) -> b.header(k, v));",
        porque:
          "Same call, same propagator, one word different — and the trace still arrives, " +
          "which is what makes it survive review. `recebido` does not contain this hop's " +
          "span, so what goes out names this service's PARENT as the parent. The next hop " +
          "becomes a sibling of this span instead of its child, and the tree is flatter " +
          "than the call chain that produced it.",
        fonte: "https://www.w3.org/TR/trace-context/#parent-id",
      },
      {
        id: "o-que-entra-no-cabecalho-root",
        codigo:
          "otel.getPropagators()\n" +
          "    .getTextMapPropagator()\n" +
          "    .inject(Context.root(), pedido, (TextMapSetter<HttpRequest.Builder>) (b, k, v) -> b.header(k, v));",
        porque:
          "`Context.root()` looks like the safe, explicit, side-effect-free choice, and in " +
          "a test it is: everything downstream still works. It is empty by definition, so " +
          "the propagator has nothing to write, no traceparent leaves, and the next service " +
          "starts a second trace for the same request. Two plausible trees, neither wrong " +
          "on its own, and nothing to tell you they were one request.",
        fonte: "https://opentelemetry.io/docs/specs/otel/context/#root-context",
      },
    ],
  },
];
