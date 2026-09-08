---
title: "Context is the product"
dek: "Spans, metric points and log records are three shapes of output. The one thing that is the same in all three — and the only piece the specification refuses to let any signal own — is Context: an immutable carrier that does not know what telemetry is, and without which none of the three can be joined."
handbook: otel
phase: 2
sources:
  - id: otel-context
    author: "OpenTelemetry Authors"
    year: "current"
    title: "Context"
    where: "OpenTelemetry specification"
    url: "https://opentelemetry.io/docs/specs/otel/context/"
    note: "Short, and worth reading in full. The striking part is the vocabulary: there is no span, no metric and no log in it. Context is defined as a plain immutable carrier, and everything telemetric is a value stored inside it by someone else."
  - id: otel-propagators
    author: "OpenTelemetry Authors"
    year: "current"
    title: "Propagators API"
    where: "OpenTelemetry specification"
    url: "https://opentelemetry.io/docs/specs/otel/context/api-propagators/"
    note: "Inject and extract, defined against a carrier the propagator does not own. This is the seam between an in-process concept and a wire format, and it is deliberately the only place the two meet."
  - id: otel-baggage-api
    author: "OpenTelemetry Authors"
    year: "current"
    title: "Baggage API"
    where: "OpenTelemetry specification"
    url: "https://opentelemetry.io/docs/specs/otel/baggage/api/"
    note: "Read it for one sentence in particular: baggage is not added to telemetry automatically. The reason that had to be written down is the subject of this article's warning section."
  - id: w3c-baggage
    author: "W3C"
    year: "2024"
    title: "Propagation format for distributed context: Baggage"
    where: "W3C Candidate Recommendation Snapshot, 30 May 2024"
    url: "https://www.w3.org/TR/baggage/"
    note: "The wire format for the values you choose to carry. Note the size limits — they are the specification admitting that this header is paid for on every request in the system."
  - id: w3c-trace-context
    author: "W3C"
    year: "2021"
    title: "Trace Context"
    where: "W3C Recommendation"
    url: "https://www.w3.org/TR/trace-context/"
    note: "The other half of what gets propagated, and the one that is mandatory rather than chosen. Compare its fixed grammar with baggage's open key-value shape: one is a join, the other is cargo."
  - id: otel-trace-api
    author: "OpenTelemetry Authors"
    year: "current"
    title: "Tracing API"
    where: "OpenTelemetry specification"
    url: "https://opentelemetry.io/docs/specs/otel/trace/api/"
    note: "Look at how a span becomes 'current': it is stored in a context, not in a tracer. The tracer is stateless about which span you are in, and that is what allows the same mechanism to serve logs and metrics."
---

Ask what OpenTelemetry gives you and the honest answer is not "traces, metrics and
logs". Those are output formats, and every observability vendor that came before
had versions of all three. What is new is smaller and much less discussed: a single
carrier that travels with your program's work, holds whatever is true about *this*
unit of work, and is the same object for all three signals.

The specification calls it **Context**, and the argument of this article is that it
is the product. The signals are what you get *because* it exists.

## The definition is conspicuously empty

Read the Context specification and notice what is not in it
([source](#src-otel-context)). There is no span. There is no metric, no log, no
exporter, no sampler. Context is defined as an immutable object holding key-value
entries, where writing produces a new context rather than modifying the old one,
plus a notion of a "current" context for languages that can carry one implicitly.

That emptiness is the design. Because Context knows nothing about telemetry, it can
carry telemetry — and anything else — without any of those things having to know
about each other. The tracing API stores the active span *in* a context
([source](#src-otel-trace-api)); the baggage API stores user values *in* a context
([source](#src-otel-baggage-api)); a log record picks up the trace ids by reading
whatever span is in the context at the moment it is emitted.

Three subsystems, no coupling between them, one carrier. If Context had been
defined as "the thing that holds the current span", logs and metrics would each
have needed their own version of it, and the correlation between them would have
been a convention rather than a mechanism.

Immutability matters for the same reason. Concurrent work — a request handler and
the three parallel calls it makes — needs each branch to add to the context without
disturbing the others. A mutable ambient object would have made that a race; a new
context per write makes each branch's view naturally its own.

## Implicit and explicit, and the trouble is always the same

Context can be carried in two ways, and the specification supports both because
languages differ ([source](#src-otel-context)). Implicitly, in ambient storage the
runtime associates with the current execution — a thread local, an async local — so
that code deep in the stack can find the current span without every function
signature mentioning it. Or explicitly, passed as an argument, which is what Go
does and what every language does at boundaries where the ambient trick does not
survive.

Practically every "my telemetry is not correlated" bug is the ambient version
failing at exactly those boundaries: a task handed to a thread pool, a callback
invoked later by a client library, a job pushed to a queue, a stream resumed on
another thread. The work continues; the ambient context does not follow, because
nothing copied it. The span you expected to be the parent is still open somewhere
else, and the new work starts with an empty context and no error.

Which is worth stating as a rule, because it covers all of those cases at once:
**context follows execution only where something carries it.** Inside one
synchronous call stack the runtime carries it for you. Everywhere else — across a
thread, across a process, across a queue — carrying it is code someone wrote, and
if nobody wrote it, the crossing is silent.

> [!deeper] Why the specification separates Context from propagation
>
> There are two distinct problems here, and the specification keeps them in
> separate documents on purpose.
>
> Context is about *this process*: what is true right now, how it is stored, how it
> is passed down a call stack. Propagation is about the *boundary*: turning some of
> what is in the context into something that survives a wire and rebuilding it on
> the other side ([source](#src-otel-propagators)).
>
> Keeping them apart is what allows a propagator to be swapped without touching
> instrumentation. The code that starts a span never mentions a header. The
> propagator never mentions a span — it works against a carrier it does not own,
> injecting and extracting whatever formats are configured. That is why a service
> can speak W3C trace context on one side and a legacy format on the other by
> changing configuration, and why "we use a different header" is a deployment
> question rather than a rewrite.
>
> It is also the cleanest example in the whole specification of a boundary drawn so
> that neither side has to know the other exists.

## Baggage: the part you choose

Trace context is the join, and it is mandatory: the identifiers and the sampling
flag, in a fixed grammar, because the whole system depends on them meaning the same
thing everywhere ([source](#src-w3c-trace-context)).

Baggage is the other kind of cargo — key-value pairs you decide to carry with the
request, propagated alongside the trace context in a header of their own
([source](#src-w3c-baggage)). A tenant id, a region, a feature-flag cohort: facts
known at the edge that services deeper in the system have no other way to learn,
short of asking someone.

Two things about it are easy to get wrong, and both are written down.

**Baggage is not automatically attached to your telemetry**
([source](#src-otel-baggage-api)). Carrying a value and recording it are separate
acts; if you want a baggage entry to appear as a span attribute, something has to
put it there. That looks like an inconvenience until you consider that baggage
travels to every downstream service, including ones you do not operate.
Auto-attaching it would mean any value anyone puts in baggage ends up recorded, in
telemetry, everywhere — which is how a customer identifier becomes a permanent
resident of three vendors' storage.

**Baggage is paid for on every request.** It is a header on every hop, so its cost
is bytes multiplied by your request volume, which is why the format specifies size
limits rather than trusting good sense. Baggage is for the handful of facts that
change how downstream services behave or how their telemetry is grouped — not for
context in the everyday sense of "useful background".

> [!deeper] The failure that comes from thinking of baggage as a variable
>
> Baggage looks like a global variable scoped to a request, and that mental model
> produces one specific, expensive mistake: putting something in baggage and then
> relying on it being there.
>
> It travels only as far as propagation works. A service that does not extract it
> drops it for everything downstream of that point — silently, and permanently for
> that request. A proxy that strips unknown headers does the same. So a value can
> be present in the first four services and absent in the fifth, with no error
> anywhere, and the fifth service's behaviour quietly differs.
>
> The safe use is one where absence is acceptable: enriching telemetry, choosing a
> sampling hint, tagging a cohort. The unsafe use is anything where the value is
> required for correctness — authorization decisions above all. Baggage is
> untrusted input that crossed a boundary you may not control, and it should be
> treated exactly like any other header from outside.

## What this buys, stated plainly

Once Context exists, several things that look like separate features turn out to be
the same feature.

A log line knows its trace because the record is emitted while a context holding a
span is current. An exemplar knows its trace for the same reason: the measurement
was recorded inside one. A downstream service continues your trace because a
propagator wrote the context into a header and another one read it back
([source](#src-otel-propagators)). A sampling decision holds for the whole trace
because it rode along in the same place.

None of those are three signals cooperating. They are three signals independently
reading one carrier, which is why they can be developed, versioned and deployed
separately and still agree.

And it explains the shape of the phase-four labs. Instrumenting a library is mostly
not about producing spans — it is about not losing the context: extracting it at
the entry point, keeping it across the async hop, injecting it before the outgoing
call. Get that right and the telemetry follows. Get it wrong and you produce
perfectly good spans that belong to nothing.

Where to go next:
[A trace is a tree nobody owns](../a-trace-is-a-tree-nobody-owns/) for what those
carried identifiers assemble into, or
[The seam between the signals](../the-seam-between-signals/) for the other joins
this one makes possible. The full path is on the [handbook page](../../).
