# providers — the real counterpart

The running version of the [`/labs/providers/`](../../apps/site/src/pages/labs/providers.astro) lab. The lab
on screen draws the provider, the batch and the queue; this compose is where you check the
drawing against a real SDK and a real Collector.

## What the compose brings up

| Service | What it is |
|---|---|
| `collector` | `otel/opentelemetry-collector-contrib:0.159.0` — an OTLP/gRPC receiver on `:4317` wired straight to the `debug` exporter. Nothing else: what happens *inside* a Collector is the `collector-pipeline` lab, not this one. |
| `checkout` | A Java 21 app that installs the SDK by hand — no agent, no autoconfigure — and serves one route, `GET /checkout`, once a second for a minute. |

The SDK version is pinned by `io.opentelemetry:opentelemetry-bom` **1.65.0**. One dependency
sits outside that BOM and carries its own version: `io.opentelemetry.semconv:opentelemetry-semconv`
**1.43.0**, which is where the `service.name` constant lives. It releases on its own cadence,
so bumping the BOM does not bump it.

## How to run it

```bash
cd labs/providers
docker compose up --build
```

The first build downloads Maven and the JDK layers, so it takes a couple of minutes. The app
exits on its own after sixty requests; `Ctrl+C`, then `docker compose down`.

Three environment variables in `compose.yaml` are the same knobs the lab on screen has, and
the app reads all three for real:

| Variable | Default here | What it changes |
|---|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://collector:4317` | Where the exporter sends. |
| `OTEL_BSP_SCHEDULE_DELAY` | `5000` | How long the batch processor waits before flushing. |
| `OTEL_TRACES_SAMPLER_ARG` | `1.0` | The trace-ID ratio the sampler keeps. |

## What to watch for

**The batch leaves every five seconds.** The app produces one span per second, but the
Collector prints nothing for five, then prints five spans at once, then goes quiet again.
Watch the timestamps on consecutive `ResourceSpans #0` lines: five seconds apart, every
time. That gap is `OTEL_BSP_SCHEDULE_DELAY`. Set it to `1000` and the output turns into a
steady drip; the spans are identical either way — only their travel changed.

**The resource sits one layer above the spans.** In the printed envelope the order is
`ResourceSpans` → `Resource attributes` → `ScopeSpans` → `Span #0`. `service.name: checkout`
is stated *once*, at the top, for the whole batch — not on each span:

```
ResourceSpans #0
Resource attributes:
     -> service.name: Str(checkout)
     -> telemetry.sdk.language: Str(java)
ScopeSpans #0
InstrumentationScope checkout.http
Span #0
    Name           : GET /checkout
```

That is the shape of the wire format, and it is why the resource is built once, at the
provider, and never at the span. `telemetry.sdk.*` arrives beside it because
`Resource.getDefault()` put it there before your merge did.

## What you cannot see here

Two things, and they are the reason the lab on screen exists at all.

**The queue filling.** Between `span.end()` and the flush, spans sit in a bounded queue
inside the batch processor. The terminal shows the batch only once it has already left —
you never see the queue at depth 3, or 4, or full. Drop the queue's capacity below the
arrival rate and the SDK drops spans silently; the only evidence here would be spans that
never print, which is indistinguishable from spans that were never created. The lab draws
that queue, with a depth you can watch move.

**Why the batch left.** A batch flushes on whichever comes first: the timer, or the queue
reaching the export batch size. Nothing in the printed batch records which condition tripped
it. Here you can still guess — five spans against a batch size of 512 means it was the
timer — but the guess is arithmetic you did outside the tool, and it stops working the
moment both conditions are plausible, which is every production system. On screen the two
exits are drawn as two different paths, and you can starve one to watch the other take over.

Everything the terminal shows, it shows *after the fact*. That is the whole argument.
