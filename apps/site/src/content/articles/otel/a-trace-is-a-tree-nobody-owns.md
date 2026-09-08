---
title: "A trace is a tree nobody owns"
dek: "The waterfall you look at does not exist anywhere until you ask for it. Each span knows only its own parent, every process exports on its own schedule, and the tree is assembled after the fact — which is why traces degrade instead of failing, and why nobody can be asked to fix one."
handbook: otel
phase: 2
sources:
  - id: otel-trace-api
    author: "OpenTelemetry Authors"
    year: "current"
    title: "Tracing API"
    where: "OpenTelemetry specification"
    url: "https://opentelemetry.io/docs/specs/otel/trace/api/"
    note: "The SpanContext section is the one to read: what a span carries, and what it is allowed to know about the rest of the trace. The answer to the second is close to nothing, and that is the design."
  - id: otel-trace-sdk
    author: "OpenTelemetry Authors"
    year: "current"
    title: "Tracing SDK"
    where: "OpenTelemetry specification"
    url: "https://opentelemetry.io/docs/specs/otel/trace/sdk/"
    note: "The IdGenerator and the ParentBased sampler. Two small components that together explain why a trace can be assembled without any coordination between the processes that produced it."
  - id: w3c-trace-context
    author: "W3C"
    year: "2021"
    title: "Trace Context"
    where: "W3C Recommendation"
    url: "https://www.w3.org/TR/trace-context/"
    note: "The wire format for the parent link, including the sampled flag. Read the section on why the flag travels with the identifiers rather than being decided independently at each hop."
  - id: otlp
    author: "OpenTelemetry Authors"
    year: "current"
    title: "OTLP Specification"
    where: "OpenTelemetry specification"
    url: "https://opentelemetry.io/docs/specs/otlp/"
    note: "Notice what an export request is grouped by: resource and scope, never trace. Nothing in the protocol has a way to say 'this trace is finished', and that absence has consequences all the way up to sampling."
  - id: otel-glossary
    author: "OpenTelemetry Authors"
    year: "current"
    title: "Glossary"
    where: "OpenTelemetry specification"
    url: "https://opentelemetry.io/docs/specs/otel/glossary/"
    note: "Worth skimming for the definitions of span, trace and link, in that order — the third one is defined against the first two, and the difference is the subject of this article's last section."
---

The picture everyone has of a trace is the waterfall: one bar per span, nested,
with time running left to right. It is a good picture. It is also assembled at the
moment you ask for it, out of pieces that were written independently, by processes
that never spoke to each other about it, and it does not exist anywhere before
that.

That is not an implementation detail of some backend. It is the design, and almost
everything that surprises people about tracing follows from it.

## What a span actually knows

A span carries a span context: a trace id, its own span id, flags, and vendor
state ([source](#src-otel-trace-api)). When it is created inside another span, it
records that span's id as its parent. And that is the extent of its knowledge.

A span does not know how many siblings it has. It does not know how deep it is. It
does not know whether the request succeeded further down, whether the trace is
still running, or whether the process that started it is still alive. It knows one
edge — the one pointing up — and it carries that edge with it wherever it goes.

The tree is the *transitive closure* of those single edges, computed by whoever
collected them. Which means the tree is a conclusion, not an object. Nothing in
the running system holds it.

## Nobody allocates the identifiers

The next question is the obvious one: if nobody owns the tree, who hands out the
ids and makes sure they do not collide?

Nobody does. Identifiers are generated locally, at random, by an id generator in
the SDK ([source](#src-otel-trace-sdk)) — 128 bits for a trace and 64 for a span,
in the format the wire protocol fixes ([source](#src-w3c-trace-context)). There is
no registry, no allocator, no coordination round, and no service anyone has to be
able to reach in order to start a span.

This is the trade that makes distributed tracing possible at all. Coordinated
identifiers would mean a network call on the critical path of every request, a new
dependency that can be down, and a bottleneck exactly where you can least afford
one. Random identifiers cost a few nanoseconds and are wrong only with a
probability that rounds to never at any realistic volume.

The price is paid elsewhere, and it is worth naming plainly: because no one
allocates ids, no one has the list of them. There is no authority you can ask what
the complete set of spans in a trace should have been. There is only what arrived.

> [!deeper] Why there is no "trace complete" event
>
> Look at what an export request is grouped by in the protocol: resource, then
> scope, then spans ([source](#src-otlp)). Not by trace. A batch leaving a process
> routinely contains spans from a dozen unrelated traces, and the spans of one
> trace are spread across as many batches, from as many processes, as it touched.
>
> There is no message in the protocol that says "this trace is finished", and there
> could not be one — sending it would require a component that knows the whole
> tree, which is precisely what does not exist. The root span ending is not that
> message either: a child can outlive its parent, and a fire-and-forget branch can
> still be running long after the response went back.
>
> So a backend decides a trace is complete by waiting and then giving up. That is
> also why tail sampling — deciding after seeing the whole trace — needs a buffer,
> a timeout and a memory budget, and why its answer is "everything that arrived
> within the window" rather than "everything". A decision that waits for a fact
> nobody will ever state has to settle for a deadline.

## Which is why traces degrade instead of failing

Because the tree is reconstructed from independent edges, missing pieces do not
break it. They make it wrong in a specific, recognisable way.

If an intermediate service is not instrumented, its children still arrive, each
carrying a parent id that nothing in the collected set matches. The backend shows
you an orphan: a subtree hanging off nothing, or attached upward to the nearest
ancestor it can find, with the missing hop's time silently attributed to whoever is
above it. The trace renders. It looks complete. It is a lie of omission, and the
only visible symptom is a gap in the waterfall that is easy to read as "the network
was slow here".

If the propagation header is dropped at a boundary — a proxy that strips unknown
headers, a client library that rebuilds the request, a queue that carries only a
payload — the downstream service starts a *new* trace. Now you have two complete,
plausible traces of one request, and neither one contains the other. Nothing
errors. Both are valid.

This is the failure mode to keep in mind for the whole rest of the handbook: in a
system where the tree is a conclusion, incomplete input does not produce an error,
it produces a *different conclusion*.

## The sampling decision has to travel

There is one thing the tree-nobody-owns design cannot tolerate, and the
specification is unusually rigid about it: the decision to keep or drop must be the
same for the whole trace.

If each service decided independently, a trace would arrive as fragments — kept
here, dropped there, with the branches in between missing for no reason anyone can
reconstruct. Half a tree is not half as useful as a whole one; it is often worse
than nothing, because it looks like evidence.

So the decision is made once, at the root, and carried down: the sampled flag rides
in the same header as the identifiers ([source](#src-w3c-trace-context)), and the
default sampler in the SDK respects the incoming decision rather than making its
own ([source](#src-otel-trace-sdk)). "Parent based" is a dull name for a strong
rule — the trace is atomic with respect to sampling, and the only place with the
standing to decide is the place where the trace begins.

Two practical consequences fall out of that sentence. Changing a sampling rate on a
downstream service does much less than people expect, because most of its spans are
following a decision taken elsewhere. And a service that ignores the incoming flag
does not just over-collect: it manufactures fragments, which is a more expensive
mistake than either keeping everything or keeping nothing.

## Parent, or link

The last thing the model needs is an answer for the case where "my parent" is not
the truth.

A consumer reading a message from a queue was caused by a producer that finished
long ago. A batch job processing a thousand records was caused by a thousand
different requests. In both cases there is a real causal relationship and it is not
the parent-child one: the consumer is not *inside* the producer's operation, and
the batch has no single ancestor.

That is what links are for ([source](#src-otel-glossary)). A link points at another
span context without claiming containment — it records "this is related to that",
where parenthood records "this happened during that".

Choosing between them is a semantic decision, not a technical one, and it is worth
making deliberately because the two produce different pictures for the same code.
Parenthood gives you one tree, with the consumer's time nested under the producer's
— which is a useful view of a queue when the queue is fast, and an absurd one when
the message sat for six hours. Links give you two traces that know about each
other, which is honest about the discontinuity and harder to read at a glance.

The reason this decision belongs here, in the phase about the model, is that
neither option is a workaround for the other. A tree assembled from single upward
edges can only say "inside". Everything that is real, causal and *not* inside needs
a second kind of edge, or it does not get said at all.

> [!deeper] Why the tree shape is worth defending
>
> Given all of the above — reconstructed after the fact, no completeness signal,
> degrades quietly — it is fair to ask why a tree, rather than a general graph with
> arbitrary relationships.
>
> Because the tree is what makes the local rule sufficient. One upward edge per
> span, carried by the span itself, is the smallest thing each participant can
> record without knowing anything about the rest of the system. Any richer
> structure would need a participant that sees more than its own hop, and the
> moment that exists, you are back to coordination — the thing the random
> identifiers were bought to avoid.
>
> Links are the deliberate exception, and note their shape: a link is still recorded
> locally, still by one span, still about a context it already had in its hands. The
> exception was designed to preserve the property, not to break it.

## What this changes when you read a trace

Three habits follow from taking "nobody owns the tree" seriously.

Read gaps as claims, not as measurements. A blank stretch in a waterfall says "no
span arrived for this interval", which is a statement about instrumentation and
export, and only sometimes about the system being slow.

Ask what is missing before asking what is slow. The most expensive tracing mistakes
come from optimising the slowest bar in a trace whose real cost was in a hop that
never emitted a span at all.

And when two things ought to be one trace and are not, look for the seam, not for
the bug. Somewhere a header did not survive a boundary, and everything on both
sides is working exactly as designed.

Where to go next:
[The seam between the signals](../the-seam-between-signals/) for what carries the
join across those boundaries, or
[Who owns the pipeline](../who-owns-the-pipeline/) for who decides whether any of
these spans leave the process in the first place. The full path is on the
[handbook page](../../).
