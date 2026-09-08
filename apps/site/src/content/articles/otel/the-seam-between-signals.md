---
title: "The seam between the signals"
dek: "Traces, metrics and logs are each easy to explain on their own. The work of an incident happens in the joins between them — and a join is not a diagram, it is a field that has to be carried, spelled the same way, on both sides."
handbook: otel
phase: 1
sources:
  - id: otel-metrics-data-model
    author: "OpenTelemetry Authors"
    year: "current"
    title: "Metrics Data Model"
    where: "OpenTelemetry specification"
    url: "https://opentelemetry.io/docs/specs/otel/metrics/data-model/"
    note: "Read the Exemplars section. It is the only mechanical join between an aggregate and an individual request in the whole system, and it is barely two pages long."
  - id: otel-logs-data-model
    author: "OpenTelemetry Authors"
    year: "current"
    title: "Logs Data Model"
    where: "OpenTelemetry specification"
    url: "https://opentelemetry.io/docs/specs/otel/logs/data-model/"
    note: "Look at the field list, not the prose: TraceId, SpanId and TraceFlags sit in the record itself. The correlation between a log line and a trace is a field, not a convention, and that is the whole difference."
  - id: w3c-trace-context
    author: "W3C"
    year: "2021"
    title: "Trace Context"
    where: "W3C Recommendation"
    url: "https://www.w3.org/TR/trace-context/"
    note: "Fifty lines of grammar that decide whether two companies' telemetry can be joined at all. The traceparent header is the seam that crosses a process boundary, and it is deliberately tiny."
  - id: otel-context
    author: "OpenTelemetry Authors"
    year: "current"
    title: "Context"
    where: "OpenTelemetry specification"
    url: "https://opentelemetry.io/docs/specs/otel/context/"
    note: "The in-process half of the same seam. Note that Context is defined as an immutable carrier with no telemetry vocabulary in it at all — it does not know what a span is."
  - id: otel-semconv
    author: "OpenTelemetry Authors"
    year: "current"
    title: "Semantic Conventions"
    where: "OpenTelemetry specification"
    url: "https://opentelemetry.io/docs/specs/semconv/"
    note: "The shared vocabulary. Read one page — HTTP, say — with the question 'what would break if two teams spelled this differently?' and the reason this exists as a specification becomes obvious."
  - id: otel-resource-sdk
    author: "OpenTelemetry Authors"
    year: "current"
    title: "Resource SDK"
    where: "OpenTelemetry specification"
    url: "https://opentelemetry.io/docs/specs/otel/resource/sdk/"
    note: "The resource is attached once, by the provider, to everything the process emits. It is the join that costs nothing and the one people most often break by hand."
---

Every introduction to observability presents three signals and explains each one
well. Traces show a request's path. Metrics show aggregates over time. Logs show
what the code decided to say. Nothing in that description is wrong, and after
reading it you still cannot work an incident.

The reason is that no real question lives inside one signal. "Checkout latency
doubled at 14:05" is a metric. "Which requests were slow" is a trace. "What did
the code do while it was slow" is a log. The work is not in any of the three — it
is in getting from one to the next, and that crossing has a name in this handbook:
the **seam**.

A seam is not a picture on an architecture diagram. It is a concrete field, in
concrete data, that has to be present on both sides and spelled identically for
the crossing to be possible at all. There are only a few of them, they are all
small, and every one of them fails quietly.

## What a seam is made of

To move from one signal to another you need something that is *the same* on both
sides. There are only four candidates, and they are not equally good.

**An identifier** is the strong one. If the metric point and the span both carry
the same trace id, the crossing is exact: this aggregate, that request, no
inference.

**A name** is the common one. If both sides say `service.name: checkout` and
`http.route: /checkout`, you can query across them — as long as both sides spell
it the same way.

**A time window** is the weak one, and it is what most people fall back on. A
metric point covers an interval; a span covers a different interval; the two
clocks are not the same clock. Overlap is not identity.

**A human** is the last one, and it is what you are doing when you keep two tabs
open and compare them by eye. It works, it does not scale, and it is invisible to
everyone who was not in the incident.

The specification's design is essentially an effort to move as much as possible
from the bottom of that list to the top.

## The three joins that actually exist

### Log to trace: a field, not a convention

A log record in the OpenTelemetry data model carries `TraceId`, `SpanId` and
`TraceFlags` as first-class fields of the record itself
([source](#src-otel-logs-data-model)). This is the single most important
difference between OpenTelemetry logs and the log line you have been writing for
twenty years.

It means the join is not a string you formatted into the message and later parse
back out with a regular expression. It is structure. A record either belongs to a
span or it does not, and the answer is in a field rather than in a convention that
half your services follow.

It also means the join is only as good as the context that was active when the
record was emitted — which is the in-process seam ([source](#src-otel-context)),
and the reason a log emitted from a thread pool, a callback or a background job so
often arrives with those fields empty while the same line from the request path
arrives correlated.

### Metric to trace: the exemplar, and it is the only one

The other direction is harder, and it is the one people assume works and then
discover does not. A metric is an aggregate: by construction it has forgotten
which individual events produced it. You cannot ask a counter which requests
incremented it, because the counter never knew.

The specification's answer is the **exemplar** — a sample of a raw measurement
kept alongside the aggregated point, carrying its attributes, its timestamp and,
when it was recorded inside a span, the trace and span ids
([source](#src-otel-metrics-data-model)).

That single mechanism is the whole bridge from "the p99 moved" to "here is one
request that was in it". It is worth knowing three things about it: it is a
*sample*, so absence of an exemplar is not absence of a slow request; it must be
enabled and it is not free; and it is the only mechanical path in that direction.
Everything else is time-window matching, which is a guess wearing a chart.

> [!deeper] Why the aggregate cannot be un-aggregated
>
> It is tempting to think a backend could reconstruct the individual requests from
> a histogram if it tried hard enough. It cannot, and the reason is the same one
> the previous article gives for signals in general: the discarding happened at
> write time, in the process, before anything was exported.
>
> When a value lands in a histogram bucket, what is stored is a count. The bucket
> that goes from 100 ms to 250 ms holding the number 412 says that 412 requests
> fell in there. Their identities were never written down. No amount of storage,
> retention or query cleverness recovers them, because they were not compressed —
> they were dropped.
>
> An exemplar is not a workaround for that. It is an admission of it: since the
> individual is unrecoverable, keep *one* of them, deliberately, with the pointer
> back to its trace.

### Everything to the process: the resource

The quietest seam is the one you get for free. The resource is attached once, by
the provider, to every span, metric and log the process emits
([source](#src-otel-resource-sdk)). It is what makes `service.name` mean the same
thing in all three signals, which is what makes "show me everything from checkout"
a question with an answer.

It costs nothing and it is broken by hand more often than any other join — by a
second provider built somewhere in the code with a default resource, by a service
that renames itself between deployments, by an environment variable set in one
manifest and not the other. When that happens nothing fails. You get two services
in the backend, both real, and neither one complete.

## Time is not a seam

The fallback everyone reaches for is timestamps: the spike is at 14:05, so look at
traces from 14:05. It is not nothing, and it is not a join.

A metric point is a statement about an *interval*, and which interval it is has to
travel with it — that is why temporality (delta or cumulative) is part of the data
model rather than a display option ([source](#src-otel-metrics-data-model)). A
span is a statement about a different interval, produced by a different clock, on a
different host, exported on a different schedule. Traces are pushed as they finish;
metrics are collected on their own cadence, typically an order of magnitude apart.

So "at 14:05" on a dashboard and "at 14:05" in a trace list are two different
sentences that happen to share a number. Sometimes matching them works. When it
does not, nothing tells you — you simply look at the wrong requests and conclude
the wrong thing, which is worse than having no chart.

## The seam that crosses a company

Between processes the seam is even smaller: a single HTTP header, defined by the
W3C rather than by OpenTelemetry ([source](#src-w3c-trace-context)). Version,
trace id, parent span id, flags. That is the entire crossing.

The size is the point. A join that has to be agreed between two organisations, two
languages, two vendors and two release cycles can only survive if it is trivial to
implement and impossible to interpret differently. Anything richer would not have
been adopted, and a seam nobody adopts is not a seam.

The corollary is what the header does *not* carry: no service name, no attributes,
no business identifiers. Those live in a separate mechanism precisely because they
are not required for the join, and requiring them would have made the join
negotiable.

> [!deeper] A join is only as strong as the spelling on both sides
>
> Identifiers join exactly. Names join only if two independent teams wrote the same
> string, which is why the semantic conventions exist as a specification rather
> than as advice ([source](#src-otel-semconv)).
>
> Consider one service recording `http.route` and another recording `endpoint`.
> Both are informative. Both are queryable. Neither joins to the other, and no
> error is ever produced — the query simply returns fewer rows than it should, and
> the person reading it has no way to tell the difference between "that did not
> happen" and "that is called something else here".
>
> This is the same failure mode as every other seam in this article, and it is the
> reason the phase-four labs treat conventions as infrastructure rather than as
> style. A vocabulary is a join. An unenforced vocabulary is a join that silently
> stops working as the organisation grows.

## Why seams fail quietly

Notice what all of these have in common.

A missing trace id on a log record does not fail: you get a log line. An unlinked
metric does not fail: you get a chart. A resource with the wrong service name does
not fail: you get a service. A broken header at a boundary does not fail: you get
two traces instead of one, and both look complete.

Every individual signal keeps working. What stops working is the *crossing*, and
nothing on either side is in a position to notice, because neither side knows the
other was supposed to exist. This is why a system can look perfectly instrumented
on every dashboard and still be unable to answer the only question anyone asks
during an incident.

It is also why this handbook models the joins instead of listing them. A table of
correlation fields is easy to read and does not change how you look at your own
system; watching a record leave without its trace id, and then watching the query
that would have found it come back empty, does.

## The question this phase leaves you with

Pick a service you own and ask it in this order:

1. If a metric moves, what gets you to one request that was in it? If the answer
   is not "an exemplar", the answer is "a time window and a guess".
2. If you are inside a trace, what gets you to the code's own account of what
   happened? If it is not the trace id on the record, it is a text search.
3. If a request crosses into another team's service, does the header survive? Not
   "do we support it" — does it survive, on the path that matters, including the
   queue in the middle.

Three questions, three seams. The signals themselves are the easy part.

Where to go next: [What a signal is](../what-a-signal-is/) for why the discarding
that makes seams necessary is irreversible, or
[The envelope is the object graph](../the-envelope-is-the-object-graph/) for where
the resource — the cheapest seam of the three — actually sits in the bytes. The
full path is on the [handbook page](../../).
