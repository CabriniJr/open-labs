package pipeline;

import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanKind;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.exporter.otlp.trace.OtlpGrpcSpanExporter;
import io.opentelemetry.sdk.OpenTelemetrySdk;
import io.opentelemetry.sdk.resources.Resource;
import io.opentelemetry.sdk.trace.SdkTracerProvider;
import io.opentelemetry.sdk.trace.export.BatchSpanProcessor;
import java.time.Duration;

import static io.opentelemetry.semconv.ServiceAttributes.SERVICE_NAME;

/**
 * A aplicação do lab da pipeline. Ela é deliberadamente burra.
 *
 * Um processo, um exportador, e **nenhuma opinião sobre o Collector** — que é o
 * começo da tese do lab: quem decide quantas pipelines existem é o
 * `collector.yaml`, e esta aplicação não tem como saber nem precisa.
 *
 * O que ela faz de propósito é alternar as rotas, e uma delas é `/health`. É a
 * rota que todo mundo quer filtrar e a que mais aparece: um liveness probe de um
 * segundo gera mais span que o tráfego real. É sobre ela que o `filter` do
 * `collector.yaml` age — numa pipeline só.
 */
public final class App {

  private static String env(String nome, String padrao) {
    String valor = System.getenv(nome);
    return valor == null || valor.isBlank() ? padrao : valor;
  }

  /**
   * As mesmas rotas do lab da tela, na mesma ordem.
   *
   * Duas de quatro são `/health`: metade do tráfego é probe, que é o número que
   * faz alguém abrir o `config.yaml` para filtrar.
   */
  private static final String[] ROTAS = {"/checkout", "/health", "/cart", "/health"};

  public static void main(String[] args) throws InterruptedException {
    Resource recurso =
        Resource.getDefault().merge(Resource.create(Attributes.of(SERVICE_NAME, "shop")));

    SdkTracerProvider provider =
        SdkTracerProvider.builder()
            .setResource(recurso)
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

    int quantos = Integer.parseInt(env("PIPELINE_SPANS", "240"));
    for (int n = 1; n <= quantos; n++) {
      String rota = ROTAS[n % ROTAS.length];
      // O nome do span é o que o `filter` do collector.yaml casa: a condição
      // lá é `name == "GET /health"`, e é por isso que o nome importa aqui.
      Span span = tracer.spanBuilder("GET " + rota).setSpanKind(SpanKind.SERVER).startSpan();
      try (var escopo = span.makeCurrent()) {
        span.setAttribute("http.route", rota);
      } finally {
        span.end();
      }
      Thread.sleep(250);
    }

    provider.shutdown();
  }
}
