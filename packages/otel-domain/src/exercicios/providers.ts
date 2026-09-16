import type { DefinicaoDeExercicio } from "./tipos.js";

const ARQUIVO = "labs/providers/app/src/main/java/checkout/Checkout.java";

/**
 * Os exercícios do lab dos provedores.
 *
 * Cada distrator é **um mal-entendido nomeado** — a mesma régua da tabela
 * `MAL_ENTENDIDOS`, e escrito para quem já acredita nele. Nenhum deles é um erro
 * bobo: os dois aparecem em código de produção.
 */
export const EXERCICIOS_DOS_PROVEDORES: readonly DefinicaoDeExercicio[] = [
  {
    id: "de-onde-vem-o-tracer",
    lab: "providers",
    arquivo: ARQUIVO,
    trecho: "de-onde-vem-o-tracer",
    cenario:
      "The checkout service already installs an SDK at start-up. This method handles one " +
      "request, and it needs a span.",
    pergunta: "Where does the Tracer come from?",
    porqueCerto:
      "A Tracer only ever comes from a provider. Asking the OpenTelemetry instance you " +
      "installed is what ties this span to that provider's resource, sampler and " +
      "processors — everything that decides whether it leaves the process.",
    fonteCerto: "https://opentelemetry.io/docs/specs/otel/trace/sdk/#tracer-creation",
    distratores: [
      {
        id: "de-onde-vem-o-tracer-novo-provider",
        codigo: 'Tracer tracer = SdkTracerProvider.builder().build().get("checkout.http");',
        porque:
          "This compiles, runs, and never raises — which is exactly why it is dangerous. " +
          "You just built a second provider with a default resource, so these spans go " +
          "out with a different service.name than the rest of the process, and the " +
          "backend quietly stops correlating them.",
        fonte: "https://opentelemetry.io/docs/specs/otel/resource/sdk/",
      },
      {
        id: "de-onde-vem-o-tracer-global",
        codigo: 'Tracer tracer = GlobalOpenTelemetry.getTracer("checkout.http");',
        porque:
          "Not wrong in general — it is how a library with no handle finds the SDK. It is " +
          "wrong HERE: this method already has the instance, and reaching for the global " +
          "hides which provider you are talking to, so the same code behaves differently " +
          "depending on whether anything registered one.",
        fonte:
          "https://opentelemetry.io/docs/specs/otel/trace/api/#behavior-of-the-api-in-the-absence-of-an-installed-sdk",
      },
    ],
  },
  {
    id: "onde-mora-o-service-name",
    lab: "providers",
    arquivo: ARQUIVO,
    trecho: "onde-mora-o-service-name",
    cenario:
      "The same service, at start-up. Everything it exports has to say which service it " +
      "came from.",
    pergunta: "Where does service.name belong?",
    porqueCerto:
      "It is a Resource attribute, and the Resource belongs to the provider. That is why " +
      "it sits one layer above the spans in the OTLP envelope — and why every span, " +
      "metric and log this process produces carries it without anyone setting it twice.",
    fonteCerto: "https://opentelemetry.io/docs/specs/otel/resource/sdk/",
    distratores: [
      {
        id: "onde-mora-o-service-name-no-span",
        codigo: 'Resource.getDefault()',
        porque:
          "The single most common way to get this wrong is to leave the resource at its " +
          "default and set the name on the span instead — span.setAttribute(\"service.name\", …). " +
          "It sets a span attribute that happens to be spelled service.name, and backends " +
          "read the one on the resource, one layer above. Your spans look annotated and " +
          "stay unattributed.",
        fonte: "https://opentelemetry.io/docs/specs/otel/trace/api/#set-attributes",
      },
      {
        id: "onde-mora-o-service-name-no-escopo",
        codigo: 'Resource.create(Attributes.of(SERVICE_NAME, "checkout.http"))',
        porque:
          "Close, and wrong in the other direction: checkout.http is the instrumentation " +
          "scope — the library that produced the telemetry — not the service that ran it. " +
          "The scope is the middle layer of the envelope, and naming the service after it " +
          "makes every backend group your traces by a library name.",
        fonte: "https://opentelemetry.io/docs/specs/otel/glossary/#instrumentation-scope",
      },
    ],
  },
];
