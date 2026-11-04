import type { DefinicaoDeExercicio } from "./tipos.js";

const ARQUIVO = "labs/three-pillars/app/src/main/java/pillars/Pillars.java";

/**
 * Os exercícios dos três pilares.
 *
 * O lab mostra que os três gravadores guardam **coisas diferentes da mesma
 * requisição**, e que o medidor é o único que não guarda identidade. Os dois
 * exercícios atacam as duas consequências práticas disso, e nenhuma delas é
 * sobre API:
 *
 * - **o que se pode perguntar depois** depende de quais atributos entraram, e
 *   atributo de métrica custa dinheiro por série;
 * - **quem consegue ler o que saiu** depende de o nome e a unidade serem os da
 *   convenção, porque o backend não conhece este serviço.
 *
 * Os dois erram para o lado que parece mais cuidadoso — mais atributos, nome
 * mais claro —, que é como eles acontecem.
 */
export const EXERCICIOS_DOS_PILARES: readonly DefinicaoDeExercicio[] = [
  {
    id: "quais-atributos-no-medidor",
    lab: "three-pillars",
    arquivo: ARQUIVO,
    trecho: "quais-atributos-no-medidor",
    cenario:
      "One request has just been handled. The span for it is open and already carries the " +
      "route and the duration. Now the same request has to reach the histogram, and a " +
      "histogram records a number against a set of attributes.",
    pergunta: "Which attributes belong on the measurement?",
    porqueCerto:
      "Route and status are both small, closed sets: a handful of routes times a handful " +
      "of status codes is a bounded number of series, and together they are enough to " +
      "answer the two questions anyone asks of this metric — how slow, and how often it " +
      "failed. That second one is why status is not dropped: without it the error rate is " +
      "not computable from this metric at all, at any price.",
    fonteCerto:
      "https://opentelemetry.io/docs/specs/semconv/http/http-metrics/#metric-httpserverrequestduration",
    distratores: [
      {
        id: "quais-atributos-no-medidor-trace-id",
        codigo:
          'var atributos = Attributes.builder().put(ROUTE, rota).put(STATUS, erro ? "500" : "200")\n' +
          '    .put("trace_id", span.getSpanContext().getTraceId());',
        porque:
          "The intention is exactly right and the mechanism is exactly wrong. Wanting to " +
          "jump from a slow bucket to the trace that caused it is the correct instinct — it " +
          "is what exemplars are FOR, and they attach the trace id to the data point " +
          "without making it part of the identity. As an attribute it becomes part of the " +
          "series key: every request creates a brand-new time series, which never repeats, " +
          "never aggregates, and bills forever. It is the `PILLARS_USER_ATTRIBUTE` panel of " +
          "this lab with a worse attribute.",
        fonte: "https://opentelemetry.io/docs/specs/otel/metrics/data-model/#exemplars",
      },
      {
        id: "quais-atributos-no-medidor-so-rota",
        codigo: "var atributos = Attributes.builder().put(ROUTE, rota);",
        porque:
          "This is the cost-conscious answer, and cost-consciousness is right: fewer " +
          "attributes, fewer series, smaller bill. It cuts the wrong one. Route alone " +
          "cannot distinguish a fast failure from a fast success, so the error rate stops " +
          "being a metric question and becomes a log question — and logs are the pillar " +
          "that only knows what the code chose to say. You traded a bounded, cheap " +
          "attribute for a query you can no longer run.",
        fonte: "https://opentelemetry.io/docs/specs/semconv/general/attributes/",
      },
    ],
  },
  {
    id: "o-nome-e-a-unidade-do-medidor",
    lab: "three-pillars",
    arquivo: ARQUIVO,
    trecho: "o-nome-e-a-unidade-do-medidor",
    cenario:
      "Start-up, where the instrument is built once. The backend that will read this has " +
      "never seen this service, and nobody will tell it what the numbers mean.",
    pergunta: "What makes this histogram readable by something that does not know your code?",
    porqueCerto:
      "`http.server.request.duration` is not a pretty name, it is a CONTRACT: the semantic " +
      "convention defines that metric, so dashboards, alerts and auto-generated service " +
      "maps find it without anyone configuring them. `ms` is the UCUM code the spec " +
      "requires, which is what lets a backend convert and compare it against every other " +
      "service's latency. Both halves are what make the data portable instead of local.",
    fonteCerto:
      "https://opentelemetry.io/docs/specs/semconv/http/http-metrics/#metric-httpserverrequestduration",
    distratores: [
      {
        id: "o-nome-e-a-unidade-do-medidor-nome-proprio",
        codigo:
          '.histogramBuilder("checkout_latency")\n' + '            .setUnit("ms")',
        porque:
          "Clearer to the team that wrote it, and that is the trap: it reads better in your " +
          "own dashboard and disappears from everyone else's. Nothing built on semantic " +
          "conventions will match it — not the backend's HTTP view, not a shared alert, not " +
          "the next team's service map — so the metric exists and still cannot be found. " +
          "Convention is the price of being read by something you did not configure.",
        fonte: "https://opentelemetry.io/docs/specs/semconv/general/metrics/",
      },
      {
        id: "o-nome-e-a-unidade-do-medidor-unidade-escrita",
        codigo:
          '.histogramBuilder("http.server.request.duration")\n' +
          '            .setUnit("milliseconds")',
        porque:
          "More readable to a human, and the unit field is not read by humans. The spec " +
          "requires UCUM, where the code is `ms`; a backend that converts units — to put " +
          "your latency on the same axis as another service's seconds — matches on the " +
          "code and silently fails to recognise this one. The name is right, so the metric " +
          "is found; the unit is prose, so the comparison is wrong.",
        fonte: "https://opentelemetry.io/docs/specs/semconv/general/metrics/#instrument-units",
      },
    ],
  },
];
