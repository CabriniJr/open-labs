---
title: "Who owns the pipeline"
dek: "API, SDK, Collector. Three owners, and one rule that decides almost every argument: information can be removed downstream and never restored. Most telemetry incidents are a change made at the wrong owner."
handbook: otel
phase: 3
sources:
  - id: otel-trace-api
    author: "OpenTelemetry Authors"
    year: "current"
    title: "Tracing API"
    where: "OpenTelemetry specification"
    url: "https://opentelemetry.io/docs/specs/otel/trace/api/"
    note: "Read the section on the behaviour of the API in the absence of an installed SDK. It is short, and it is the single most useful paragraph in the specification for anyone debugging missing telemetry."
  - id: otel-trace-sdk
    author: "OpenTelemetry Authors"
    year: "current"
    title: "Tracing SDK"
    where: "OpenTelemetry specification"
    url: "https://opentelemetry.io/docs/specs/otel/trace/sdk/"
    note: "The whole document is a list of what the provider owns: sampler, processors, limits, id generator, shutdown, flush. Notice what is not in the list — anything belonging to the tracer."
  - id: otel-metrics-sdk
    author: "OpenTelemetry Authors"
    year: "current"
    title: "Metrics SDK"
    where: "OpenTelemetry specification"
    url: "https://opentelemetry.io/docs/specs/otel/metrics/sdk/"
    note: "The Configuration section states outright that readers, exporters and views must be owned by the provider. The MetricReader section is where the pull model is defined, and it is the asymmetry this article's fourth section is about."
  - id: otel-logs-sdk
    author: "OpenTelemetry Authors"
    year: "current"
    title: "Logs SDK"
    where: "OpenTelemetry specification"
    url: "https://opentelemetry.io/docs/specs/otel/logs/sdk/"
    note: "Same shape as the tracing SDK with one component conspicuously missing, and one parameter — trace_based on the logger config — that borrows a decision made somewhere else entirely."
  - id: otel-library-guidelines
    author: "OpenTelemetry Authors"
    year: "current"
    title: "Client Design Principles"
    where: "OpenTelemetry specification"
    url: "https://opentelemetry.io/docs/specs/otel/library-guidelines/"
    note: "Why the API and the SDK are separate artefacts rather than one library with a configuration flag. The argument is about dependencies, and it is the reason the boundary is drawn where it is."
  - id: otel-collector
    author: "OpenTelemetry Authors"
    year: "current"
    title: "Collector"
    where: "OpenTelemetry documentation"
    url: "https://opentelemetry.io/docs/collector/"
    note: "Receivers, processors, exporters, and the two deployment shapes. Read it with the question 'what can this change that the SDK already sent' in mind, and the limits of the component become obvious."
---

There are three places a piece of telemetry can be shaped, and they are owned by
three different people, on three different release cycles, with three different
blast radii. Almost every argument about OpenTelemetry configuration is really an
argument about which of the three you should be touching.

The three are the **API**, the **SDK** and the **Collector**. Getting the division
right is worth more than knowing any individual setting, because the settings are
searchable and the division is not.

## The API owns a promise, and a no-op

The API is the surface that instrumentation writes against: start a span, record a
measurement, emit a record. What it deliberately does **not** contain is any
machinery for doing anything with the result.

That sounds like an incomplete library until you look at who calls it. A database
driver, an HTTP client, a web framework — these want to emit telemetry, and they
absolutely must not choose an exporter, a sampling rate or a destination on behalf
of the application that depends on them. So the API is designed to be a
dependency a library can take without imposing anything
([source](#src-otel-library-guidelines)), and the application separately installs
an SDK that gives those calls an effect.

Which produces the most consequential default in the whole system. If no SDK is
installed, the API still works: it returns a no-op implementation, the calls
succeed, and nothing happens ([source](#src-otel-trace-api)). No exception, no
warning, no log line. Instrumented code runs at essentially no cost and produces
nothing at all.

That is the correct design — a library that crashed because the host application
had not configured telemetry would be a library nobody could safely depend on —
and it is also, by a wide margin, the most common reason for the sentence "my
spans are not showing up". The system is not failing. It is doing precisely what
it promises when nobody has installed the part that does the work.

> [!deeper] Why silence is harder to debug than an error
>
> An error tells you three things: that something went wrong, roughly where, and
> often what to do. Silence tells you nothing, and worse, it is indistinguishable
> from several completely different situations.
>
> No SDK installed produces silence. An SDK installed but pointed at the wrong
> endpoint produces silence at the backend. A sampler set to always-off produces
> silence. A process that exits before its batch is flushed produces silence. A
> propagator mismatch produces the *appearance* of silence, because the spans are
> there but attached to traces you are not looking at.
>
> Five different causes, one symptom, and no error message in any of them. This is
> why the lab for this phase spends its effort on making the silence
> **countable** rather than on making it loud: a no-op provider that reports how
> many spans ended inside it turns "nothing is happening" into "thirty-seven things
> happened here and stopped", and those are different problems with different
> fixes.

## The SDK owns every decision

The SDK is where the decisions live, and the specification is close to being a
list of them: which sampler, which processors and in what order, what limits, how
identifiers are generated, what the resource is, when a flush happens
([source](#src-otel-trace-sdk)). The metrics side is explicit that configuration
**must** be owned by the provider ([source](#src-otel-metrics-sdk)), and the logs
side says the same about its processors ([source](#src-otel-logs-sdk)).

What is striking is the other half of that list — the part that is empty. A tracer
has no configuration. You obtain one by name, it remembers that name, and it holds
nothing else you can set. There is no per-tracer sampler, no per-tracer exporter,
no per-tracer resource. If you want to change what happens to telemetry, there is
exactly one object to change it on, and it is the provider.

That is not an omission. It is what makes the previous article's claim about the
envelope true: the resource sits above the spans in the payload because there is
only one place it could have been configured. A per-tracer resource would make the
nesting a lie.

It also fixes where the process boundary falls. Shutdown and flush are provider
operations, and they cascade to the processors the provider owns
([source](#src-otel-trace-sdk)). So the answer to "what happens to telemetry when
the process dies" is decided entirely inside the SDK, by whether anything asked the
provider to flush. Nothing downstream can help: a Collector cannot receive a batch
that was still in a queue in a process that no longer exists.

## The Collector owns what has already left

The Collector runs out of process. It receives, it transforms, and it exports
([source](#src-otel-collector)), and its power is real: it can add attributes,
redact them, drop whole streams, route to several destinations, convert between
formats, batch, retry, and buffer to disk. All of that without touching the
application, which is why platform teams like it so much and why it is usually the
right place to put policy.

Its limits are equally real, and they all come from one fact: it only sees what was
sent to it.

A span dropped by the sampler at creation never existed on the wire. A batch lost
because a process exited without flushing was never transmitted. An attribute the
instrumentation did not record cannot be added, only invented. The Collector is
extremely good at reshaping telemetry and completely unable to recover telemetry,
and no amount of configuration changes that.

Which gives the rule that decides most of these arguments, and it is the same one
this handbook's first article arrives at from the other direction:

> Detail can be removed downstream. It can never be restored downstream.

So the decision about what to *keep* has to be taken as early as you can afford to
take it, and the Collector is where you decide what to do with what you kept. Head
sampling in the SDK and tail sampling in the Collector are not two implementations
of one feature — they are decisions at two positions on a one-way street, and the
second one can only choose among what the first one let through.

> [!deeper] The three deployment questions, in order
>
> Once the ownership is clear, the practical sequence falls out, and it is worth
> having in this order because doing it backwards is expensive.
>
> First: what must never be discarded? That answer belongs in the SDK, because it is
> the only place that can still keep something. It is a code and configuration
> change in every application, so it is slow — which is exactly why it should be a
> short list.
>
> Second: what shape should the data have when it reaches storage? That belongs in
> the Collector, because it is policy, it changes often, and one deployment covers
> every application.
>
> Third: where does the Collector run? Next to each workload, as a gateway in front
> of the backend, or both. That question is last because it is about blast radius
> and failure modes rather than about data, and it has its own lab in this phase.

## The asymmetry nobody expects

A last observation, because it undoes a reasonable assumption early.

The three providers are not three instances of one pattern. Traces and logs are
**pushed**: the instrumentation hands a finished item to a processor, the processor
queues it, and a timer or a full queue sends the batch on. Metrics are **pulled**:
the SDK keeps aggregated state in memory, and a reader asks for it on its own
schedule ([source](#src-otel-metrics-sdk)).

That difference is not cosmetic, and it shows up in three places you will meet in
practice. The default intervals differ by more than an order of magnitude, so a
metric and a trace describing the same second arrive at very different times. The
flush semantics differ: forcing a flush is meaningful for a push exporter and close
to meaningless for a pull one, since a pull exporter can only respond when
something scrapes it. And the failure mode under pressure differs — a trace queue
that fills up **drops** spans, while metric state that exceeds its cardinality
limit **collapses** the excess into a single overflow series. Both are data loss,
they look nothing alike, and the second one keeps the totals correct while making
the breakdown useless.

The logs side has its own asymmetry: it has no sampler at all
([source](#src-otel-logs-sdk)). What it has instead is a switch on the logger
config that drops records belonging to traces that were not sampled — which means
turning your trace sampling down can silently delete logs, through a decision made
in a different provider. That is the kind of coupling that is obvious once drawn
and nearly invisible in configuration files, and it is the reason this phase has a
model instead of a table.

Where to go next: [What a signal is](../what-a-signal-is/) if you want the
first-principles version of the one-way street, or
[The envelope is the object graph](../the-envelope-is-the-object-graph/) for what
ownership looks like in the bytes. The full path is on the
[handbook page](../../).
