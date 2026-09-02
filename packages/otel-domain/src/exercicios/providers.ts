import type { DefinicaoDeExercicio } from "./tipos.js";

const ARQUIVO = "labs/providers/app/src/main/java/checkout/Checkout.java";

/**
 * Os exercícios do lab dos provedores.
 *
 * Cada distrator é **um mal-entendido nomeado** — a mesma régua da tabela
 * `MAL_ENTENDIDOS`, e escrito para quem já acredita nele. Nenhum deles é um erro
 * bobo: os dois aparecem em código de produção.
 *
 * <p><b>O alcance desta mecânica, e por que ela divide o trabalho com a tabela
 * de mal-entendidos.</b> Um distrator ocupa a lacuna, e a lacuna é um lugar
 * concreto num arquivo que compila. Então esta mecânica só alcança mal-entendido
 * que seja <i>expressável como código válido naquele lugar</i>. O
 * `span.setAttribute("service.name", …)` — o mal-entendido nº 1 da tabela — não
 * é: não existe `span` no escopo onde o recurso é montado, e o bloco nem
 * compilaria ali. Forçá-lo para dentro do exercício entregaria a resposta pelo
 * formato, que é justamente o que a regra da mesma forma existe para impedir.
 * Ele fica com `MAL_ENTENDIDOS`, que aparece na mesma página e não precisa
 * caber em lugar nenhum. As duas peças se dividem por isso, e não por acaso: a
 * lacuna cobre o que o compilador aceita, a tabela cobre o resto.
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
        // A explicação mudou quando o app trocou `buildAndRegisterGlobal()` por
        // `build()`: o distrator deixou de ser "certo em outro lugar, errado
        // aqui" e passou a produzir silêncio de verdade neste arquivo.
        codigo: 'Tracer tracer = GlobalOpenTelemetry.getTracer("checkout.http");',
        porque:
          "This is how a library with no handle finds the SDK — but nothing in this file " +
          "ever registers a global: start-up calls build(), not buildAndRegisterGlobal(). " +
          "With no SDK installed behind it, the API hands you a no-op Tracer. The spans " +
          "are still created, the code still runs, no error and no warning appear — and " +
          "nothing is ever exported. That is the same \"no SDK, silence\" you saw in the " +
          "lab, reaching you through a line that looks like instrumentation.",
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
    pergunta: "What does the provider's Resource have to carry?",
    porqueCerto:
      "service.name is a Resource attribute, and the Resource belongs to the provider — " +
      "which is why it sits one layer above the spans in the OTLP envelope, and why " +
      "every span, metric and log this process produces carries it without anyone " +
      "setting it twice. The merge is the other half: getDefault() is what the SDK " +
      "fills in about itself (telemetry.sdk.name, .language, .version), and yours goes " +
      "on top of it rather than in place of it.",
    fonteCerto: "https://opentelemetry.io/docs/specs/otel/resource/sdk/",
    distratores: [
      {
        id: "onde-mora-o-service-name-sem-o-padrao",
        codigo:
          "Resource recurso =\n" +
          '    Resource.create(Attributes.of(SERVICE_NAME, "checkout"));',
        porque:
          "Right layer, and it compiles and runs — the spans do go out named checkout. " +
          "What left with them is the default Resource: telemetry.sdk.name, " +
          "telemetry.sdk.language and telemetry.sdk.version are gone, because this " +
          "replaces the default instead of merging over it. Nothing fails; the backend " +
          "just no longer knows what produced the data, and that is the question you ask " +
          "on the day one SDK version starts dropping spans.",
        fonte: "https://opentelemetry.io/docs/specs/otel/resource/sdk/",
      },
      {
        id: "onde-mora-o-service-name-so-o-padrao",
        codigo: "Resource recurso =\n    Resource.getDefault();",
        porque:
          "The merge that merges nothing. If you have ever opened a backend and found a " +
          "service called unknown_service:java without knowing where it came from: this " +
          "is where it comes from. The default Resource already carries a service.name, " +
          "and that is the value. Leaving yours out does not leave the field empty — it " +
          "leaves the SDK's placeholder in it.",
        fonte: "https://opentelemetry.io/docs/specs/otel/resource/sdk/",
      },
    ],
  },
];
