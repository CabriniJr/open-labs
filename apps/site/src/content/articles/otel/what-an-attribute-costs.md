---
title: "What an attribute costs"
dek: "A metric is a pre-aggregation: it throws the individual away and keeps the count. An attribute is a decision not to throw away one dimension — and because identity is the whole attribute set, dimensions multiply. Cardinality is the price of refusing to aggregate."
handbook: otel
phase: 5
lab: labs/cardinality-and-the-bill
sources:
  - id: otel-metrics-data-model
    author: "OpenTelemetry Authors"
    year: "current"
    title: "Metrics Data Model"
    where: "OpenTelemetry specification"
    url: "https://opentelemetry.io/docs/specs/otel/metrics/data-model/"
    note: "Read the timeseries model section. One sentence there — that a stream is identified by its metric name and its attribute set — is the entire economics of this article, stated as a data structure."
  - id: otel-metrics-sdk
    author: "OpenTelemetry Authors"
    year: "current"
    title: "Metrics SDK"
    where: "OpenTelemetry specification"
    url: "https://opentelemetry.io/docs/specs/otel/metrics/sdk/"
    note: "The cardinality limits section is short and worth reading in full, because it says exactly what the limit does and — more usefully — what it does not do. The overflow attribute set is defined here."
  - id: otel-semconv-http
    author: "OpenTelemetry Authors"
    year: "current"
    title: "Semantic conventions for HTTP metrics"
    where: "OpenTelemetry semantic conventions"
    url: "https://opentelemetry.io/docs/specs/semconv/http/http-metrics/"
    note: "Look at which attributes are required and which are opt-in, and at the notes on why. That split is a cardinality budget written down by people who had to defend it."
  - id: prometheus-instrumentation
    author: "Prometheus Authors"
    year: "current"
    title: "Instrumentation"
    where: "Prometheus documentation, best practices"
    url: "https://prometheus.io/docs/practices/instrumentation/"
    note: "Predates OpenTelemetry and says the same thing more bluntly. The advice to keep label cardinality low is old, and it is old because the failure mode is old."
  - id: pelkonen-2015
    author: "Tuomas Pelkonen, Scott Franklin, Justin Teller, Paul Cavallaro, Qi Huang, Justin Meza and Kaushik Veeraraghavan"
    year: "2015"
    title: "Gorilla: A Fast, Scalable, In-Memory Time Series Database"
    where: "Proceedings of the VLDB Endowment, vol. 8, no. 12"
    note: "Read it for the shape of the problem rather than the compression tricks. Gorilla exists because the number of streams, not the number of samples, is what makes a monitoring system expensive — which is why an attribute decision is a capacity decision."
---

The first article in this handbook argued that a signal is a decision about what
to throw away. A metric is the most aggressive version of that decision: it
throws away the individual event and keeps a number. Ten thousand requests
become one count, and the ten thousand are not recoverable, because they were
never written down.

An attribute is how you take part of that decision back. Putting `http.route` on
a measurement says: do not aggregate across routes — keep them apart. That is a
genuinely useful thing to ask for, and it is the reason metrics are usable at
all. But asking for it has a shape, and the shape is not the one most people
assume.

## Identity is the whole set, not the name

A metric stream is identified by its name **and its complete attribute set**
([source](#src-otel-metrics-data-model)). Not by its name plus a list of columns
— by the set. Two measurements belong to the same stream only when every
attribute matches.

That single sentence is the whole economics. If a metric carries route (12
values), status (6) and method (4), the number of streams is not 12 + 6 + 4 = 22.
It is every combination that actually occurs: 12 × 6 × 4 = 288. Attributes are
not columns in a table. They are **dimensions**, and dimensions multiply.

So when someone asks to break latency down by customer and you add
`enduser.id`, you have not added 8 000 streams to a metric that had 288. You
have 288 × 8 000 = 2 304 000, and the change was one line.

> [!deeper] Why the product is over values *seen*, not values possible
>
> The streams that exist are the combinations that have occurred, not the
> cartesian product of everything possible — a route that never returns 500
> never creates that stream. This sounds like relief and is mostly not, for two
> reasons. First, in a system under real traffic the combinations that matter
> fill in quickly. Second, and worse: a stream exists from the first measurement
> that carries it until retention rolls it off. A `k8s.pod.name` attribute mints
> a new set of streams on every deploy and keeps the old ones for the whole
> retention window, so the cost of a cardinality mistake outlives the deploy
> that caused it by days. It is why these incidents are confusing to debug:
> the change that caused the bill is no longer in the running configuration.

## The instrument multiplies again

Streams are one factor. What each stream publishes is another, and here the
default choice is the expensive one.

A counter publishes one point per stream per export: a number. A histogram
publishes one point per bucket, plus the sum and the count
([source](#src-otel-metrics-data-model)) — so with a bucket set of eleven
boundaries it is thirteen points where a counter had one. Before any attribute
enters the conversation, choosing a histogram has multiplied your volume by an
order of magnitude.

This is not an argument against histograms. A histogram answers *how slow*,
which a counter cannot, and that is usually worth paying for. It is an argument
for knowing that you paid, because the two decisions compound: a histogram with
a high-cardinality attribute is the product of both multiplications, and teams
usually make the two choices weeks apart without connecting them.

The semantic conventions are the record of other people having had this
argument. The HTTP metric conventions split attributes into required and opt-in
([source](#src-otel-semconv-http)), and the split is not alphabetical — it is a
cardinality budget that someone had to defend.

## The limit protects the bill, not the question

OpenTelemetry's SDK has a cardinality limit, and it does exactly what it says:
once a metric stream reaches the limit, further attribute sets are folded into a
single overflow stream marked `otel.metric.overflow`
([source](#src-otel-metrics-sdk)).

It is a good mechanism and it is routinely misread as a safety net that makes
high-cardinality attributes safe. It is not, and the reason is worth stating
plainly:

- Nothing is lost and nothing is double-counted. The measurements still land;
  the totals are still right.
- **The breakdown is gone.** Everything past the limit shares one stream, so the
  question "which customer?" — the question the attribute was added to answer —
  has no answer.

You are paying the instrumentation cost and receiving none of the benefit. That
is a worse position than not having added the attribute, because the cost is
visible on the invoice and the missing answer is not visible anywhere. The limit
is a circuit breaker for your bill, and a circuit breaker is not a feature of
the appliance it protects.

> [!deeper] Why a per-customer breakdown is usually the wrong instrument
>
> If the question is genuinely "which customer is affected", a metric is the
> wrong place to ask it, and the limit is the specification telling you so. The
> mechanical path from an aggregate to an individual is an exemplar — a sample
> kept on purpose, carrying the trace id of one measurement that landed in that
> bucket. It answers "show me one of these" rather than "break this down by all
> of them", and that is the question you can afford. The per-customer breakdown
> belongs to a system built for high-cardinality lookups, which is what traces
> and logs are. Reaching for an attribute is reaching for the pillar you already
> have, and that is why it feels free.

## Why this is a capacity problem and not a billing problem

It is tempting to treat cardinality as a procurement detail — a line item to
negotiate. The literature on how these systems are built says otherwise.

Gorilla ([source](#src-pelkonen-2015)) exists because the number of streams, not
the number of samples, is what makes a monitoring system hard: every stream is
an index entry, a chunk to keep resident, a thing to scan at query time. The
engineering in that paper is aimed at the count of streams. Prometheus has been
saying the same thing in plainer words for years, in a document about
instrumentation rather than about storage
([source](#src-prometheus-instrumentation)) — because the decision is taken in
instrumentation code, by one developer, in one line, and paid for by everyone
later.

That gap between where the decision is taken and where it is paid is the real
subject. Nothing fails when you add the attribute. Nothing warns you. The code
is correct, the metric is correct, the dashboard is better than it was. The bill
arrives next month, and by then the line is in production and the old streams
are still inside the retention window.

Which is why the right place to do the arithmetic is before the pull request.
It is one multiplication, and the
[lab for this phase](../../../../labs/cardinality-and-the-bill/) is that
multiplication with your own numbers in it.
