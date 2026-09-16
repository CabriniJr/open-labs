---
title: "The envelope is the object graph"
dek: "ResourceSpans, ScopeSpans, Span. Three layers of nesting that are not a transport detail — they are provider, tracer and span, serialised. Where a field sits tells you which object owns it, and which object owns it tells you where to go and change it."
handbook: otel
phase: 2
sources:
  - id: otel-proto-trace
    author: "OpenTelemetry Authors"
    year: "current"
    title: "opentelemetry/proto/trace/v1/trace.proto"
    where: "opentelemetry-proto"
    url: "https://github.com/open-telemetry/opentelemetry-proto/blob/main/opentelemetry/proto/trace/v1/trace.proto"
    note: "The three nested messages, in about forty lines. Worth opening even if you never read protobuf: the nesting is the argument, and it is visible at a glance."
  - id: otel-otlp
    author: "OpenTelemetry Authors"
    year: "current"
    title: "OpenTelemetry Protocol Specification"
    where: "OpenTelemetry specification"
    url: "https://opentelemetry.io/docs/specs/otlp/"
    note: "The request and response shapes, and the rules about partial success. Read it after the proto file, not before — the proto tells you what the data is and this tells you what happens to it."
  - id: otel-trace-sdk
    author: "OpenTelemetry Authors"
    year: "current"
    title: "Tracing SDK"
    where: "OpenTelemetry specification"
    url: "https://opentelemetry.io/docs/specs/otel/trace/sdk/"
    note: "The section on Tracer Creation is the load-bearing one here: the name and version you pass in become an InstrumentationScope that is stored on the tracer. That storage is the middle layer of the envelope."
  - id: otel-resource-sdk
    author: "OpenTelemetry Authors"
    year: "current"
    title: "Resource SDK"
    where: "OpenTelemetry specification"
    url: "https://opentelemetry.io/docs/specs/otel/resource/sdk/"
    note: "What a resource is, how it is built from detectors and environment, and the merge rules. The merge rules matter more than they look: they are why two libraries can both contribute to the same resource without a conflict."
  - id: otel-instrumentation-scope
    author: "OpenTelemetry Authors"
    year: "current"
    title: "Instrumentation Scope"
    where: "OpenTelemetry specification"
    url: "https://opentelemetry.io/docs/specs/otel/common/instrumentation-scope/"
    note: "Short, and it answers the question people ask about the middle layer: what is the scope for. It identifies the instrumentation that produced the data, which is how you tell your spans from your HTTP client library's spans."
  - id: w3c-trace-context
    author: "World Wide Web Consortium"
    year: "current"
    title: "Trace Context"
    where: "W3C Recommendation"
    url: "https://www.w3.org/TR/trace-context/"
    note: "The header, its four fields, and the flags byte. The last section of this article is about a bit that lives here and deliberately does not live in the envelope."
---

Start with a puzzle that almost everybody hits in the first week.

You have spans arriving in a backend. You know the service is called
`checkout`, because you configured `service.name`. You open a span, look through
its attributes for `service.name`, and it is not there.

Nothing is broken. The field exists, and it is not on the span, because it does
not belong to the span. Understanding **why** is worth more than the answer,
because the same reasoning tells you where every other field lives, and where you
have to go to change it.

## Three layers, three owners

An OTLP export request for traces has exactly three levels of nesting
([source](#src-otel-proto-trace)). Outermost is a list of `ResourceSpans`. Each
one contains a `resource` and a list of `ScopeSpans`. Each of those contains a
`scope` and a list of `Span`.

Those three levels are not packaging. They are the three objects that participated
in producing the data, in the order in which they own things:

The **resource** describes the entity that is emitting — the service, the process,
the host, the container ([source](#src-otel-resource-sdk)). It is configured once,
on the provider, and it applies to everything that provider produces. So it sits
one level above the spans, because it is true of all of them at once.

The **scope** identifies the instrumentation that produced these particular spans:
a name, usually a version ([source](#src-otel-instrumentation-scope)). You do not
attach it. It is created from the arguments you pass when you ask the provider for
a tracer, and it is stored on that tracer ([source](#src-otel-trace-sdk)). Every
span that tracer makes carries it, which is why it sits above the spans and below
the resource.

The **span** holds what the instrumentation actually observed: the name, the
timing, the status, the attributes of this one operation.

Read the nesting from the outside in and it says: *this entity, using this
instrumentation, observed these operations.* Which is the sentence
`provider → tracer → span` written in a different notation.

> [!deeper] The same shape appears for metrics and logs
>
> If the nesting were about compression, you would expect the three signals to
> package their data differently — the shapes of a metric point and a span have
> almost nothing in common.
>
> They do not differ. The metrics protocol has `ResourceMetrics` containing
> `ScopeMetrics` containing metrics; the logs protocol has `ResourceLogs`
> containing `ScopeLogs` containing records. Same three layers, same order, same
> two outer objects.
>
> That repetition is the strongest available evidence that the envelope encodes
> **ownership** rather than convenience. Resource and scope are not properties of
> traces; they are properties of the thing that emits and the thing that
> instruments, and both of those exist regardless of which signal you happen to be
> producing. The provider changes name between the three — a tracer provider, a
> meter provider, a logger provider — and the shape of what it owns does not
> change at all.

## What the nesting buys

Two things, and the second one is the reason this article exists.

The first is size. A batch of five hundred spans from one process carries **one**
resource, not five hundred copies of it. A resource is typically a dozen or more
attributes — service name and version, deployment environment, host, container,
Kubernetes pod and namespace, SDK language and version. Repeating that on every
span would frequently make the metadata larger than the data. The nesting
deduplicates by ownership, which is the only kind of deduplication that is
guaranteed to be correct, because the shared value is shared *by definition*
rather than by coincidence.

The second is that the envelope tells you where to make a change.

If you want to change `service.name`, you are changing the resource, which means
you are changing configuration on the provider, which means a deployment of the
application — and it changes for every signal that application emits, at once. If
you want to add an attribute to one operation, you are changing the span, which is
a line of instrumentation code at the call site. If the spans you are looking at
are attributed to the wrong library, you are looking at a scope problem, and the
fix is at the point where somebody asked for a tracer with that name.

Three different fields, three different objects, three completely different
changes with three different blast radii. The envelope is where you read that off,
and it is faster than reading the SDK's configuration API.

> [!deeper] Two resources in one process, and how you find out
>
> Nothing in the SDK prevents a process from having two providers with two
> different resources. It happens by accident more often than by design — a
> framework auto-configures one, application code creates another, and both are
> alive.
>
> Nothing fails. There is no error, no warning, and both sets of spans arrive. What
> you get is an export request with **two** `ResourceSpans` entries carrying
> different `service.name` values, and a backend that treats them as two services,
> because from the outside they *are* two services. Traces split across them, and
> correlation between the two halves quietly stops working.
>
> The reason this is worth knowing at the payload level is that the payload is the
> only place it is visible. In the code you see two initialisation calls in two
> files that nobody reads together. In the envelope you see two resources, side by
> side, in one request. It is a one-glance diagnosis, and it is the kind of thing
> this handbook builds models for: the failure mode is not that something errors,
> it is that something reasonable produces two of a thing that was supposed to be
> one.

## What the envelope deliberately leaves out

Two absences, and both are informative.

The **sampling decision** is not a field in the envelope. Whether a span was
sampled is carried in the trace flags — the byte at the end of the `traceparent`
header ([source](#src-w3c-trace-context)) — and mirrored into the span's own flags
field. It lives there and not in the envelope because it has to travel *with the
request*, to the next service, before any export happens. The decision is made
when the span is created, propagated inward to children, and only much later does
anything get serialised. By the time you are looking at an envelope, the decision
is history; what you are holding is the subset that survived it.

The **propagators** are not in the envelope at all, and not in the provider either.
Nothing in the exported data tells you which propagation format the process was
configured to read and write. That is because propagation is a property of the
process as a whole rather than of any provider — it is how context enters and
leaves, not how telemetry is described. Which makes for an unpleasant class of
incident: a misconfigured propagator produces perfectly valid envelopes, full of
perfectly valid spans, that happen to be roots when they should have been children.
The data is not corrupt. It is orphaned, and the envelope has no field in which to
say so.

> [!deeper] Partial success, and why it is in the response
>
> The protocol's response type has a field for partial success — a count of
> rejected records and a message ([source](#src-otel-otlp)). It exists because the
> envelope is a batch, and a batch can be partly unacceptable: some records
> malformed, some over a limit, some referring to something the receiver will not
> take.
>
> The design choice worth noticing is that a partial rejection is a **success** at
> the transport level, with detail in the body, rather than an error. If it were an
> error, the sender's only sensible move would be to retry the whole batch — which
> would resend the records that were already accepted, and duplicate them.
>
> This is the same reasoning as the nesting, applied to failure: the shape of the
> protocol follows the shape of the thing being described. A batch is a set of
> independent records, so the outcome of sending a batch has to be able to be
> independent per record.
