package checkout;

import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.exporter.otlp.trace.OtlpGrpcSpanExporter;
import io.opentelemetry.sdk.OpenTelemetrySdk;
import io.opentelemetry.sdk.resources.Resource;
import io.opentelemetry.sdk.trace.SdkTracerProvider;
import io.opentelemetry.sdk.trace.export.BatchSpanProcessor;
import io.opentelemetry.sdk.trace.export.SpanExporter;
import io.opentelemetry.sdk.trace.samplers.Sampler;

import java.time.Duration;

import static io.opentelemetry.semconv.ServiceAttributes.SERVICE_NAME;

/**
 * O checkout: uma rota, instrumentada à mão.
 *
 * <p><b>Comentário aqui tem duas línguas, e a fronteira é o marcador.</b> Tudo
 * que está entre um marcador `handbook:trecho` e o seu fechamento é extraído
 * verbatim para a página do site, então é texto que o leitor vê: vai em
 * <b>inglês</b>. Fora dos trechos vale a regra de sempre do repo, e o
 * comentário vai em português. Quem mover uma linha para dentro ou para fora de
 * um trecho move também a língua dela.
 *
 * <p>Este parágrafo escreve o nome do marcador sem os sinais de menor e maior
 * de propósito: a extração varre o arquivo atrás deles, e uma menção em prosa
 * viraria um trecho fantasma.
 */
public final class Checkout {

  /**
   * O ambiente lido à mão, porque quem monta o SDK à mão não ganha isso de
   * graça. Variável ausente e variável vazia são a mesma coisa aqui: as duas
   * caem no padrão, e nenhuma é erro — `FOO=` num compose é jeito comum de
   * desligar um override sem apagar a linha.
   */
  private static String variavel(String nome, String padrao) {
    String valor = System.getenv(nome);
    return valor == null || valor.isBlank() ? padrao : valor;
  }

  /**
   * Falhar alto está certo; falhar mudo é que não. O `parseInt` cru diz
   * `For input string: "5s"` sem dizer de qual variável — e `5s` é o engano
   * plausível, porque metade das configurações de OTel aceita sufixo de
   * duração e esta não aceita.
   */
  private static int inteiro(String nome, int padrao) {
    String valor = variavel(nome, String.valueOf(padrao));
    try {
      return Integer.parseInt(valor.trim());
    } catch (NumberFormatException e) {
      throw new IllegalArgumentException(
          nome + "=\"" + valor + "\": esperava um número inteiro em milissegundos ou unidades,"
              + " sem sufixo (\"5000\", não \"5s\")",
          e);
    }
  }

  /** O irmão do `inteiro` para a razão de amostragem, e pelo mesmo motivo. */
  private static double decimal(String nome, double padrao) {
    String valor = variavel(nome, String.valueOf(padrao));
    try {
      return Double.parseDouble(valor.trim());
    } catch (NumberFormatException e) {
      throw new IllegalArgumentException(
          nome + "=\"" + valor + "\": esperava um número entre 0 e 1 (\"1.0\", \"0.25\")", e);
    }
  }

  private static OpenTelemetrySdk instalarSdk() {
    // Sem o `sdk-extension-autoconfigure` ninguém lê `OTEL_*` por nós: o
    // exportador construído à mão vai para `localhost:4317` e o span some sem
    // erro visível do lado de quem instrumentou. Custou o primeiro `up` deste
    // lab inteiro, e é a diferença entre o compose funcionar e parecer funcionar.
    SpanExporter exportador =
        OtlpGrpcSpanExporter.builder()
            .setEndpoint(variavel("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4317"))
            .build();

    // Controles lidos de verdade: um botão que não muda nada ensina menos que
    // botão nenhum. Mas o `maxQueueSize` é um botão honesto que não revela o
    // que se esperaria dele — neste ritmo de um span por segundo a fila não
    // transborda nem com capacidade 2 (medido: 10 spans criados, 10 entregues).
    // Por que não transborda, e o que seria preciso para ver, está no README.
    BatchSpanProcessor lote =
        BatchSpanProcessor.builder(exportador)
            .setScheduleDelay(Duration.ofMillis(inteiro("OTEL_BSP_SCHEDULE_DELAY", 5000)))
            .setMaxQueueSize(inteiro("OTEL_BSP_MAX_QUEUE_SIZE", 2048))
            .build();

    Sampler amostrador = Sampler.traceIdRatioBased(decimal("OTEL_TRACES_SAMPLER_ARG", 1.0));

    // <handbook:trecho id="onde-mora-o-service-name">
    // <handbook:lacuna>
    Resource recurso =
        Resource.getDefault().merge(Resource.create(Attributes.of(SERVICE_NAME, "checkout")));
    // </handbook:lacuna>

    SdkTracerProvider provider =
        SdkTracerProvider.builder()
            .setResource(recurso)
            .setSampler(amostrador)
            .addSpanProcessor(lote)
            .build();
    // </handbook:trecho>

    // `build()`, e não `buildAndRegisterGlobal()`: nada neste arquivo lê o
    // `GlobalOpenTelemetry`, e o SDK chega em `atender` por parâmetro. Registrar
    // um global que ninguém consulta ensinaria, por presença, que é assim que se
    // acha um tracer — enquanto o código ao lado demonstra injeção.
    //
    // O que se ganha em troca é um fenômeno de verdade: sem global registrado,
    // `GlobalOpenTelemetry.getTracer(...)` devolve um tracer no-op. Os spans
    // continuam sendo criados, o código não muda, nada estoura — e nada é
    // exportado. É o "sem SDK, silêncio" que o lab da tela ensina, e agora vale
    // literalmente aqui. Se você chegou a este arquivo depois de errar o
    // exercício que usa essa chamada como distrator: era isto.
    return OpenTelemetrySdk.builder().setTracerProvider(provider).build();
  }

  private static void atender(OpenTelemetry otel) {
    // <handbook:trecho id="de-onde-vem-o-tracer">
    // <handbook:lacuna>
    Tracer tracer = otel.getTracer("checkout.http");
    // </handbook:lacuna>

    Span span = tracer.spanBuilder("GET /checkout").startSpan();
    // `makeCurrent()` changes nothing you can observe in this method: there is
    // no child span to pick up the parent, nobody reads the Context, and
    // `end()` runs in the `finally`, outside the scope. It is here because it
    // is the gesture real instrumentation cannot skip — the moment a library
    // downstream starts its own span, this is what makes it a child instead of
    // a second root. Attributes and `end()` work through the `span` reference
    // and would work identically without it.
    try (var escopo = span.makeCurrent()) {
      span.setAttribute("http.route", "/checkout");
    } finally {
      span.end();
    }
    // </handbook:trecho>
  }

  public static void main(String[] args) throws InterruptedException {
    OpenTelemetrySdk otel = instalarSdk();
    try {
      // 63, e não 60, para que o fim não seja uma corrida: com o prazo padrão
      // de 5 s o último tique do lote cai perto de 60 e sobra um lote parcial
      // para o `close()` despachar. Em 60 iterações o encerramento e o tique
      // chegavam juntos, e quem ganhava dependia da deriva do `sleep` — que é
      // a mesma deriva que faz o tamanho desse último lote variar de um entre
      // execuções.
      for (int i = 0; i < 63; i++) {
        atender(otel);
        Thread.sleep(1000);
      }
    } finally {
      // Não é higiene de fim de programa: é o `ForceFlush` que o lab da tela
      // ensina, visto do outro lado. O worker do lote é thread daemon, então
      // sair da `main` mata a fila com o que ela tiver — até cinco segundos de
      // spans sumindo sem uma linha de log, que é exatamente o descarte
      // silencioso que este lab existe para tornar visível. O `close()` faz o
      // shutdown em cascata e o último lote parte antes da JVM.
      otel.close();
    }
  }
}
