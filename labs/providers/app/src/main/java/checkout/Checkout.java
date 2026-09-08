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

import static io.opentelemetry.semconv.ServiceAttributes.SERVICE_NAME;

/** O checkout: uma rota, instrumentada à mão. */
public final class Checkout {

  private static OpenTelemetry instalarSdk() {
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
            .addSpanProcessor(
                BatchSpanProcessor.builder(OtlpGrpcSpanExporter.builder().build()).build())
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
