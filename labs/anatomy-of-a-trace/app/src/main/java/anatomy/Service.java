package anatomy;

import com.sun.net.httpserver.HttpServer;
import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanKind;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.context.Context;
import io.opentelemetry.context.propagation.ContextPropagators;
import io.opentelemetry.context.propagation.TextMapGetter;
import io.opentelemetry.context.propagation.TextMapSetter;
import io.opentelemetry.api.trace.propagation.W3CTraceContextPropagator;
import io.opentelemetry.exporter.otlp.trace.OtlpGrpcSpanExporter;
import io.opentelemetry.sdk.OpenTelemetrySdk;
import io.opentelemetry.sdk.resources.Resource;
import io.opentelemetry.sdk.trace.SdkTracerProvider;
import io.opentelemetry.sdk.trace.export.BatchSpanProcessor;
import java.io.IOException;
import java.io.OutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;

import static io.opentelemetry.semconv.ServiceAttributes.SERVICE_NAME;

/**
 * Um serviço da cadeia. O MESMO programa roda quatro vezes, com nomes
 * diferentes — que é como a cadeia é na vida real: ninguém é especial.
 *
 * Cada instância: extrai o contexto do cabeçalho que chegou, cria um span
 * filho, injeta o contexto na chamada de saída e exporta **por conta própria**.
 * Nenhuma delas manda uma árvore para lugar nenhum; nenhuma delas tem uma.
 *
 * `ANATOMY_STRIP_HEADER=true` faz esta instância **não injetar** o cabeçalho na
 * saída — é o proxy que remove cabeçalho desconhecido, e o efeito é o do lab:
 * o próximo começa um trace novo, e nada dá erro.
 * `ANATOMY_UNINSTRUMENTED=true` faz ela não criar span nenhum e **repassar o
 * cabeçalho que recebeu**: o filho se pendura no avô e a árvore fecha com um
 * salto a menos.
 */
public final class Service {

  private static String env(String nome, String padrao) {
    String valor = System.getenv(nome);
    return valor == null || valor.isBlank() ? padrao : valor;
  }

  private static boolean ligado(String nome) {
    return "true".equalsIgnoreCase(env(nome, "false"));
  }


  public static void main(String[] args) throws IOException, InterruptedException {
    String nome = env("ANATOMY_SERVICE", "gateway");
    int porta = Integer.parseInt(env("ANATOMY_PORT", "8080"));
    String proximo = env("ANATOMY_NEXT", "");
    boolean semInstrumentacao = ligado("ANATOMY_UNINSTRUMENTED");
    boolean derrubaCabecalho = ligado("ANATOMY_STRIP_HEADER");

    Resource recurso = Resource.getDefault().merge(Resource.create(Attributes.of(SERVICE_NAME, nome)));
    SdkTracerProvider provider =
        SdkTracerProvider.builder()
            .setResource(recurso)
            .addSpanProcessor(
                BatchSpanProcessor.builder(
                        OtlpGrpcSpanExporter.builder()
                            .setEndpoint(env("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4317"))
                            .build())
                    .setScheduleDelay(Duration.ofSeconds(2))
                    .build())
            .build();

    // O propagador é o W3C, e é ele quem transforma contexto em cabeçalho e de
    // volta. Note que ele não sabe o que é um span: trabalha sobre um carregador
    // que não é dele.
    OpenTelemetry otel =
        OpenTelemetrySdk.builder()
            .setTracerProvider(provider)
            .setPropagators(ContextPropagators.create(W3CTraceContextPropagator.getInstance()))
            .build();
    Tracer tracer = otel.getTracer("anatomy." + nome);
    HttpClient cliente = HttpClient.newHttpClient();

    HttpServer servidor = HttpServer.create(new java.net.InetSocketAddress(porta), 0);
    servidor.createContext(
        "/",
        troca -> {
          // 1. EXTRAIR: o cabeçalho que chegou vira contexto. Sem cabeçalho, o
          //    contexto é vazio — e aí o span abaixo nasce raiz, sem erro nenhum.
          Context recebido =
              otel.getPropagators()
                  .getTextMapPropagator()
                  .extract(
                      Context.current(),
                      troca,
                      new TextMapGetter<com.sun.net.httpserver.HttpExchange>() {
                        @Override
                        public Iterable<String> keys(com.sun.net.httpserver.HttpExchange e) {
                          return e.getRequestHeaders().keySet();
                        }

                        @Override
                        public String get(com.sun.net.httpserver.HttpExchange e, String chave) {
                          if (e == null) return null;
                          List<String> valores = e.getRequestHeaders().get(chave);
                          return valores == null || valores.isEmpty() ? null : valores.get(0);
                        }
                      });

          Span span =
              semInstrumentacao
                  ? null
                  : tracer.spanBuilder("GET /" + nome).setSpanKind(SpanKind.SERVER).setParent(recebido).startSpan();
          Context atual = span == null ? recebido : recebido.with(span);

          try (var escopo = atual.makeCurrent()) {
            if (!proximo.isBlank()) {
              HttpRequest.Builder pedido = HttpRequest.newBuilder(URI.create(proximo));
              if (semInstrumentacao) {
                // Repassa o que recebeu, sem tocar: o filho vai se pendurar no avô.
                String veio = troca.getRequestHeaders().getFirst("traceparent");
                if (veio != null) pedido.header("traceparent", veio);
              } else if (!derrubaCabecalho) {
                // 2. INJETAR: o contexto vira cabeçalho de saída.
                otel.getPropagators()
                    .getTextMapPropagator()
                    .inject(atual, pedido, (TextMapSetter<HttpRequest.Builder>) (b, k, v) -> b.header(k, v));
              }
              try {
                cliente.send(pedido.GET().build(), HttpResponse.BodyHandlers.discarding());
              } catch (Exception erro) {
                // Um salto que falha não é o assunto deste lab.
              }
            }
          } finally {
            if (span != null) span.end();
          }

          byte[] corpo = ("ok from " + nome + "\n").getBytes();
          troca.sendResponseHeaders(200, corpo.length);
          try (OutputStream saida = troca.getResponseBody()) {
            saida.write(corpo);
          }
        });
    servidor.start();

    // O gateway é quem começa: ele se chama sozinho, uma vez por segundo.
    if (nome.equals("gateway")) {
      HttpClient interno = HttpClient.newHttpClient();
      for (int i = 0; i < 120; i++) {
        try {
          interno.send(
              HttpRequest.newBuilder(URI.create("http://localhost:" + porta + "/")).GET().build(),
              HttpResponse.BodyHandlers.discarding());
        } catch (Exception erro) {
          // idem
        }
        Thread.sleep(1000);
      }
      provider.shutdown();
      servidor.stop(0);
    }
  }
}
