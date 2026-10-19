package sampling;

import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanKind;
import io.opentelemetry.api.trace.StatusCode;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.exporter.otlp.trace.OtlpGrpcSpanExporter;
import io.opentelemetry.sdk.OpenTelemetrySdk;
import io.opentelemetry.sdk.resources.Resource;
import io.opentelemetry.sdk.trace.SdkTracerProvider;
import io.opentelemetry.sdk.trace.export.BatchSpanProcessor;
import io.opentelemetry.sdk.trace.samplers.Sampler;
import java.time.Duration;

import static io.opentelemetry.semconv.ServiceAttributes.SERVICE_NAME;

/**
 * A aplicação do lab da amostragem, e ela produz o trace que o lab discute.
 *
 * Cada iteração é um trace com dois spans: um `SERVER` de entrada e um filho
 * que chama o pagamento. O erro, quando acontece, está **no filho** — depois de
 * o span raiz já existir, e portanto depois de o head sampler já ter decidido.
 * Essa ordem não é detalhe de simulação: é o motivo de o head sampling não
 * poder guardar "os traces que falharam".
 *
 * `HEAD_SAMPLING_RATIO` é o amostrador do SDK, e ele é o experimento da tese 1.
 * Em 1.0 não há amostragem no SDK e o Collector recebe tudo; em 0.1, nove de
 * cada dez traces nunca saem daqui — e nenhuma política do `tail.yaml` pode
 * recuperá-los, porque o dado não existe do lado de lá.
 */
public final class App {

  private static String env(String nome, String padrao) {
    String valor = System.getenv(nome);
    return valor == null || valor.isBlank() ? padrao : valor;
  }

  public static void main(String[] args) throws InterruptedException {
    Resource recurso =
        Resource.getDefault().merge(Resource.create(Attributes.of(SERVICE_NAME, "shop")));

    double razao = Double.parseDouble(env("HEAD_SAMPLING_RATIO", "1.0"));

    SdkTracerProvider provider =
        SdkTracerProvider.builder()
            .setResource(recurso)
            // <handbook:trecho id="o-amostrador-do-sdk">
            // O amostrador do SDK quando o Collector amostra na cauda. Dois
            // amostradores em série se MULTIPLICAM, e o primeiro é o que ainda
            // não sabe nada — então o que se quer dele aqui é que ele não corte.
            // `parentBased` é o que faz a decisão da raiz valer para o trace
            // inteiro, em vez de cada span decidir por si e produzir trace
            // furado.
            // <handbook:lacuna>
            .setSampler(Sampler.parentBased(Sampler.traceIdRatioBased(razao)))
            // </handbook:lacuna>
            // </handbook:trecho>
            .addSpanProcessor(
                BatchSpanProcessor.builder(
                        OtlpGrpcSpanExporter.builder()
                            .setEndpoint(env("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4317"))
                            .build())
                    .setScheduleDelay(Duration.ofSeconds(1))
                    .build())
            .build();

    OpenTelemetry otel = OpenTelemetrySdk.builder().setTracerProvider(provider).build();
    Tracer tracer = otel.getTracer("shop.http");

    int quantos = Integer.parseInt(env("SAMPLING_TRACES", "120"));
    int erroACada = Integer.parseInt(env("ERROR_EVERY", "4"));

    for (int n = 1; n <= quantos; n++) {
      boolean falha = erroACada > 0 && n % erroACada == 0;

      Span entrada = tracer.spanBuilder("POST /checkout").setSpanKind(SpanKind.SERVER).startSpan();
      try (var escopo = entrada.makeCurrent()) {
        entrada.setAttribute("http.route", "/checkout");

        // O filho, e é nele que mora o erro: ele acontece DEPOIS da decisão de
        // amostragem, que foi tomada quando `entrada` nasceu.
        Span pagamento = tracer.spanBuilder("payments.charge").startSpan();
        try (var dentro = pagamento.makeCurrent()) {
          if (falha) {
            pagamento.setStatus(StatusCode.ERROR, "card declined");
            // O `status_code` do `tail.yaml` casa com ERROR em QUALQUER span do
            // trace, e é por isso que marcar o filho basta. Marcar também a
            // raiz seria mais parecido com um sistema real e esconderia a
            // pergunta: qual span o gateway precisa ter visto?
          }
        } finally {
          pagamento.end();
        }
      } finally {
        entrada.end();
      }

      Thread.sleep(250);
    }

    provider.shutdown();
  }
}
