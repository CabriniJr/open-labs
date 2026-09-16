# `anatomy-of-a-trace` — the real counterpart

Four processes, one request, four independent exports — against the real SDK, the real W3C
propagator, and a real Collector. The lab on the site models this; here it happens over HTTP.

The same program runs four times with different names. In a real chain nobody is special.

## Run it

```bash
docker compose up --build   # or: podman compose up --build
```

Spans leave on a two-second schedule. Give it about ten seconds, then read the Collector
output.

## What to watch

- **four `ResourceSpans`, one per service.** They arrive separately, each with its own
  `service.name`, each on its own schedule. Nobody sends a tree: the Collector is the first
  place in the whole system where the four meet;
- **one `Trace ID`, four `Span ID`s**, and each span carrying a `Parent ID` that belongs to
  the service before it. That single upward edge is everything a span knows about the shape
  it is part of;
- the `traceparent` on the wire — `00-<trace id>-<parent span id>-01`. It is the entire
  crossing: no service name, no attributes, no business identifiers.

## Break it, the same two ways the lab does

**Drop the header.** Set `ANATOMY_STRIP_HEADER: "true"` on `checkout` and restart. Now
`payments` finds no context to extract, so it starts a new trace — and you get **two Trace
IDs for one request**, both complete, neither aware of the other. Nothing errors, nothing
warns, and both look like perfectly good traces.

**Take the instrumentation out of the middle.** Set `ANATOMY_UNINSTRUMENTED: "true"` on
`payments`. It still forwards the header it received, so `ledger`'s span points at
`checkout`'s — its grandparent. Three spans instead of four, one trace, and it still closes:
the missing hop is invisible, and its latency is silently attributed to whoever is above.

## What you cannot see here

- **that a span is missing.** Nobody allocates identifiers, so nothing holds a list of the
  spans a trace should have had. The Collector shows what arrived; a tree built from less
  still looks like a tree;
- **when the trace is finished.** There is no end-of-trace event, and there could not be —
  emitting it would need a component that knows the whole tree, which is exactly what does
  not exist. The lab decides by waiting and giving up, and so does every backend.

## The version is pinned

Same OpenTelemetry Java BOM as the other labs. `opentelemetry-semconv` is outside the BOM and
carries its own version; that is the one exception.
