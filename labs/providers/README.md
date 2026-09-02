# providers — the real counterpart

The running version of the [`/labs/providers/`](../../apps/site/src/pages/labs/providers.astro) lab. The lab
on screen draws the provider, the batch and the queue; this compose is where you check the
drawing against a real SDK and a real Collector.

## What the compose brings up

| Service | What it is |
|---|---|
| `collector` | `otel/opentelemetry-collector-contrib:0.159.0` — an OTLP/gRPC receiver on `:4317` wired straight to the `debug` exporter. Nothing else: what happens *inside* a Collector is the `collector-pipeline` lab, not this one. |
| `checkout` | A Java 21 app that installs the SDK by hand — no agent, no autoconfigure — and emits one span named `GET /checkout` every second for a minute. There is no HTTP server and no published port: the route is simulated, so there is nothing to `curl`. |

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
exits on its own after sixty spans; `Ctrl+C`, then `docker compose down`.

Four environment variables in `compose.yaml` are the same knobs the lab on screen has, and
the app reads all four for real — nothing here is set up by autoconfigure, so each one is
wired by hand in `Checkout.java`:

| Variable | Default here | What it changes |
|---|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://collector:4317` | Where the exporter sends. |
| `OTEL_BSP_SCHEDULE_DELAY` | `5000` | How long the batch processor waits before flushing. |
| `OTEL_BSP_MAX_QUEUE_SIZE` | `2048` | How many finished spans the queue holds before it starts dropping them. |
| `OTEL_TRACES_SAMPLER_ARG` | `1.0` | The trace-ID ratio the sampler keeps. |

Verified with rootless podman driven through the Docker CLI. The compose file uses nothing
Docker Engine-specific, but that path has not been exercised here.

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
inside the batch processor. The terminal shows a batch only once it has already left — you
never see the queue at depth 3, or 4, or full. `OTEL_BSP_MAX_QUEUE_SIZE` is a real knob
here, but turning it down does not reveal the queue either: at `2` this app still loses
nothing, because one span per second never outruns the exporter, and a queue that never
fills never drops. That was measured, not assumed: with the queue at `2`, ten spans created
came out as ten spans printed. To make an overflow happen you would have to produce spans
faster than gRPC can drain them, and then the only evidence would be spans that never
arrive — from the terminal, indistinguishable from spans that were never created. Either
way you are reading absence.
The lab draws the queue itself, with a depth you can watch move and an overflow you can
watch happen.

**Why the batch left.** A batch flushes on whichever comes first: the timer, or the queue
reaching the export batch size. Nothing in the printed batch records which condition tripped
it. Here you can still guess — five spans against a batch size of 512 means it was the
timer — but the guess is arithmetic you did outside the tool, and it stops working the
moment both conditions are plausible, which is every production system. On screen the two
exits are drawn as two different paths, and you can starve one to watch the other take over.

One thing you *can* see here, and it is worth staying for the last two seconds: the app
closes the SDK before it exits, so the final partial batch leaves on shutdown rather than
on the timer. Watch the last two `ResourceSpans` timestamps — the gap is shorter than five
seconds. Remove that `close()` and the batch worker, which is a daemon thread, dies with the
JVM and takes the queue with it. That contrast is `ForceFlush`, one of the five phenomena
the lab teaches, seen from the other side.

Everything else the terminal shows, it shows *after the fact*. That is the whole argument.
