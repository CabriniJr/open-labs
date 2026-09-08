package pillars;

import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.logs.Logger;
import io.opentelemetry.api.logs.Severity;
import io.opentelemetry.api.metrics.DoubleHistogram;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.exporter.otlp.logs.OtlpGrpcLogRecordExporter;
import io.opentelemetry.exporter.otlp.metrics.OtlpGrpcMetricExporter;
import io.opentelemetry.exporter.otlp.trace.OtlpGrpcSpanExporter;
import io.opentelemetry.sdk.OpenTelemetrySdk;
import io.opentelemetry.sdk.logs.SdkLoggerProvider;
import io.opentelemetry.sdk.logs.export.BatchLogRecordProcessor;
import io.opentelemetry.sdk.metrics.SdkMeterProvider;
import io.opentelemetry.sdk.metrics.export.PeriodicMetricReader;
import io.opentelemetry.sdk.resources.Resource;
import io.opentelemetry.sdk.trace.SdkTracerProvider;
import io.opentelemetry.sdk.trace.export.BatchSpanProcessor;
import java.time.Duration;

import static io.opentelemetry.semconv.ServiceAttributes.SERVICE_NAME;

/**
 * Um evento, três gravadores.
 *
 * Cada requisição é registrada nos três de uma vez, com os mesmos dados — e o
 * que sai do outro lado é a demonstração: o span leva a duração e a identidade,
 * o histograma leva a contagem por balde, e o registro leva a frase que este
 * código escolheu dizer.
 *
 * Rode e leia a saída do Collector com uma pergunta na cabeça: *quais
 * requisições passaram de 250 ms?* Você vai achar a resposta em `Span` e não vai
 * achá-la em `Histogram`, por mais que procure.
 */
public final class Pillars {

  private static final AttributeKey<String> ROUTE = AttributeKey.stringKey("http.route");
  private static final AttributeKey<String> STATUS = AttributeKey.stringKey("http.status");
  private static final AttributeKey<String> USER = AttributeKey.stringKey("user.id");

  private static final String[] ROTAS = {"/checkout", "/cart", "/search"};
  private static final String[] USUARIOS = {"u-1042", "u-2071", "u-3319", "u-4560", "u-5127"};

  private static boolean ligado(String nome) {
    return "true".equalsIgnoreCase(System.getenv().getOrDefault(nome, "false"));
  }

  private static String endpoint() {
    String valor = System.getenv("OTEL_EXPORTER_OTLP_ENDPOINT");
    return valor == null || valor.isBlank() ? "http://localhost:4317" : valor;
  }

  /**
   * A latência é a mesma função do lab da tela.
   *
   * Determinística de propósito: os dois lados precisam contar a mesma história,
   * senão a contraparte real não é contraparte de nada.
   */
  static int latencia(int n) {
    int passo = n % 17;
    if (passo == 3) return 820;
    if (passo == 9) return 1400;
    if (passo % 4 == 0) return 40 + passo * 6;
    if (passo % 3 == 0) return 180 + passo * 9;
    return 60 + passo * 11;
  }

  public static void main(String[] args) throws InterruptedException {
    Resource recurso =
        Resource.getDefault().merge(Resource.create(Attributes.of(SERVICE_NAME, "checkout")));

    SdkTracerProvider tracer =
        SdkTracerProvider.builder()
            .setResource(recurso)
            .addSpanProcessor(
                BatchSpanProcessor.builder(
                        OtlpGrpcSpanExporter.builder().setEndpoint(endpoint()).build())
                    .setScheduleDelay(Duration.ofSeconds(5))
                    .build())
            .build();

    SdkMeterProvider meter =
        SdkMeterProvider.builder()
            .setResource(recurso)
            .registerMetricReader(
                PeriodicMetricReader.builder(
                        OtlpGrpcMetricExporter.builder().setEndpoint(endpoint()).build())
                    .setInterval(Duration.ofSeconds(10))
                    .build())
            .build();

    SdkLoggerProvider logger =
        SdkLoggerProvider.builder()
            .setResource(recurso)
            .addLogRecordProcessor(
                BatchLogRecordProcessor.builder(
                        OtlpGrpcLogRecordExporter.builder().setEndpoint(endpoint()).build())
                    .setScheduleDelay(Duration.ofSeconds(5))
                    .build())
            .build();

    OpenTelemetry otel =
        OpenTelemetrySdk.builder()
            .setTracerProvider(tracer)
            .setMeterProvider(meter)
            .setLoggerProvider(logger)
            .build();

    Tracer rastro = otel.getTracer("checkout.http");
    Logger registro = otel.getLogsBridge().get("checkout.http");
    DoubleHistogram duracao =
        otel.getMeter("checkout.http")
            .histogramBuilder("http.server.request.duration")
            .setUnit("ms")
            .build();

    boolean registrarTudo = ligado("PILLARS_LOG_EVERYTHING");
    boolean comUsuario = ligado("PILLARS_USER_ATTRIBUTE");

    for (int n = 1; n <= 180; n++) {
      String rota = ROTAS[n % ROTAS.length];
      String usuario = USUARIOS[n % USUARIOS.length];
      int latencia = latencia(n);
      boolean erro = n % 7 == 0;

      // 1. O tracer guarda o INDIVÍDUO.
      Span span = rastro.spanBuilder("GET " + rota).startSpan();
      try (var escopo = span.makeCurrent()) {
        span.setAttribute(ROUTE, rota);
        span.setAttribute("http.request.duration_ms", latencia);

        // 2. O medidor guarda a CONTAGEM. Os baldes já existiam antes desta
        //    medição, e é por isso que a identidade não volta.
        var atributos = Attributes.builder().put(ROUTE, rota).put(STATUS, erro ? "500" : "200");
        if (comUsuario) atributos.put(USER, usuario);
        duracao.record(latencia, atributos.build());

        // 3. O registrador guarda o que este código escolheu dizer — e o que
        //    ele não disser não existe para ninguém depois.
        if (erro) {
          registro
              .logRecordBuilder()
              .setSeverity(Severity.ERROR)
              .setBody("checkout failed for " + rota)
              .emit();
        } else if (registrarTudo) {
          registro.logRecordBuilder().setSeverity(Severity.INFO).setBody("handled " + rota).emit();
        }
      } finally {
        span.end();
      }
      Thread.sleep(300);
    }

    tracer.shutdown();
    meter.shutdown();
    logger.shutdown();
  }
}
