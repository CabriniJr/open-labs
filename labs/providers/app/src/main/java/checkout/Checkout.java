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

/** O checkout: uma rota, instrumentada à mão. */
public final class Checkout {

  /** O ambiente lido à mão, porque quem monta o SDK à mão não ganha isso de graça. */
  private static String variavel(String nome, String padrao) {
    String valor = System.getenv(nome);
    return valor == null || valor.isBlank() ? padrao : valor;
  }

  private static OpenTelemetry instalarSdk() {
    // Sem o `sdk-extension-autoconfigure` ninguém lê `OTEL_*` por nós: o
    // exportador construído à mão vai para `localhost:4317` e o span some sem
    // erro visível do lado de quem instrumentou. Custou o primeiro `up` deste
    // lab inteiro, e é a diferença entre o compose funcionar e parecer funcionar.
    SpanExporter exportador =
        OtlpGrpcSpanExporter.builder()
            .setEndpoint(variavel("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4317"))
            .build();

    // As duas variáveis que o lab da tela também tem. Elas são lidas de
    // verdade: um botão que não muda nada ensina menos que botão nenhum.
    BatchSpanProcessor lote =
        BatchSpanProcessor.builder(exportador)
            .setScheduleDelay(
                Duration.ofMillis(Long.parseLong(variavel("OTEL_BSP_SCHEDULE_DELAY", "5000"))))
            .build();

    Sampler amostrador =
        Sampler.traceIdRatioBased(Double.parseDouble(variavel("OTEL_TRACES_SAMPLER_ARG", "1.0")));

    // <handbook:trecho id="onde-mora-o-service-name">
    Resource recurso =
        Resource.getDefault().merge(
            // <handbook:lacuna>
            Resource.create(Attributes.of(SERVICE_NAME, "checkout"))
            // </handbook:lacuna>
        );

    SdkTracerProvider provider =
        SdkTracerProvider.builder()
            .setResource(recurso)
            .setSampler(amostrador)
            .addSpanProcessor(lote)
            .build();
    // </handbook:trecho>

    return OpenTelemetrySdk.builder().setTracerProvider(provider).buildAndRegisterGlobal();
  }

  private static void atender(OpenTelemetry otel) {
    // <handbook:trecho id="de-onde-vem-o-tracer">
    // <handbook:lacuna>
    Tracer tracer = otel.getTracer("checkout.http");
    // </handbook:lacuna>

    Span span = tracer.spanBuilder("GET /checkout").startSpan();
    try (var escopo = span.makeCurrent()) {
      span.setAttribute("http.route", "/checkout");
    } finally {
      span.end();
    }
    // </handbook:trecho>
  }

  public static void main(String[] args) throws InterruptedException {
    OpenTelemetry otel = instalarSdk();
    for (int i = 0; i < 60; i++) {
      atender(otel);
      Thread.sleep(1000);
    }
  }
}
