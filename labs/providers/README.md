# `providers` — the real counterpart

The lab on the site shows a model of an SDK exporting spans. This is the same story with
the real thing: a Java service instrumented by hand, an OpenTelemetry Collector printing
what arrives.

Every technical claim the lab makes has to survive here. If the two disagree, the lab is
wrong.

## Run it

```bash
docker compose up --build   # or: podman compose up --build
```

No JDK and no Maven needed on your machine — the app builds inside the image. Give it about
ten seconds after the app starts: the batch processor leaves on a five-second schedule, so
nothing appears before the first batch closes.

Stop with `Ctrl-C`, then `docker compose down`.

## What to watch

- **Spans arrive in batches, not one by one.** The Collector prints a block every five
  seconds (`OTEL_BSP_SCHEDULE_DELAY`), each carrying the spans produced since the last one.
  One request does not equal one export.
- **`service.name` arrives one layer above the spans.** In the printed envelope the
  `Resource attributes` block comes first, then `ScopeSpans`, then the spans themselves. The
  service is a property of the process that exported them — not of any span. That is the
  whole point of the `Resource`, and it is what the exercise on the lab page asks about.
- **The instrumentation scope is its own layer.** `checkout.http` shows up as the scope
  name, between the resource and the spans: it names the code that produced the telemetry,
  not the service that ran it.

## What you cannot see here

Two things the lab on the site shows and this terminal cannot:

- **The queue filling up.** The batch processor holds spans in a bounded queue and drops
  them when it overflows. From out here a dropped span is simply a span that never appears —
  indistinguishable from one that was never created.
- **A batch leaving because of time rather than size.** Both look identical in the output:
  a block of spans. Which of the two limits fired — the schedule delay or the maximum batch
  size — is a decision taken inside the processor, and the printed envelope does not record
  it.

That gap is the argument for the whole project: the terminal shows you what came out, the
lab shows you why.

## The version is pinned

`app/pom.xml` pins the OpenTelemetry Java BOM, and the lab page reads that number from this
file — so the version shown next to the code is never written twice. The semantic
conventions artifact (`opentelemetry-semconv`) is **not** part of the BOM and carries its
own version; that is the one exception.
