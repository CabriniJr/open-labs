---
title: "Sampling is a statement about what you will not know"
dek: "Every sampling configuration is a sentence of the form: these questions will be answerable, and those will not. Head sampling writes that sentence before the request has done anything, which is why it cannot promise you the failures. The useful question is not what percentage to keep — it is when the decision is taken, and what is knowable at that moment."
handbook: otel
phase: 5
lab: labs/head-vs-tail-sampling
sources:
  - id: otel-sampling
    author: "OpenTelemetry Authors"
    year: "current"
    title: "Sampling"
    where: "OpenTelemetry documentation"
    url: "https://opentelemetry.io/docs/concepts/sampling/"
    note: "The two families, defined by when the decision happens. One sentence there is the whole article: the primary downside of head sampling is that it is not possible to make a sampling decision based on data in the entire trace."
  - id: otel-trace-sdk
    author: "OpenTelemetry Authors"
    year: "current"
    title: "Tracing SDK"
    where: "OpenTelemetry specification"
    url: "https://opentelemetry.io/docs/specs/otel/trace/sdk/"
    note: "Read the sampler section and the built-in samplers. `ParentBased` is the default for a reason that is easy to miss: without it, each span consults the sampler on its own and a trace can survive in fragments."
  - id: w3c-trace-context
    author: "W3C Distributed Tracing Working Group"
    year: "2020"
    title: "Trace Context"
    where: "W3C Recommendation"
    url: "https://www.w3.org/TR/trace-context/"
    note: "The sampled flag is one bit of `traceparent`, and the spec is careful to call it a recommendation from the caller rather than an instruction. That nuance is why a downstream service can, in principle, disagree — and why in practice everyone inherits."
  - id: otel-tracestate-probability
    author: "OpenTelemetry Authors"
    year: "current"
    title: "TraceState: Probability Sampling"
    where: "OpenTelemetry specification"
    url: "https://opentelemetry.io/docs/specs/otel/trace/tracestate-probability-sampling/"
    note: "What it takes to count correctly after sampling: the kept span has to carry the probability that kept it. Read it if you have ever multiplied a sampled count by ten and wondered what you were allowed to claim."
  - id: otel-tail-sampling-blog
    author: "OpenTelemetry Authors"
    year: "2022"
    title: "Tail Sampling with OpenTelemetry: Why it's useful, how to do it, and what to consider"
    where: "OpenTelemetry blog"
    url: "https://opentelemetry.io/blog/2022/tail-sampling/"
    note: "The operational half, including the advice that surprises people: leave the SDK sampler keeping everything when the Collector samples on the tail. Two samplers in series multiply."
  - id: sigelman-2010
    author: "Benjamin H. Sigelman, Luiz André Barroso, Mike Burrows, Pat Stephenson, Manoj Plakal, Donald Beaver, Saul Jaspan and Chandan Shanbhag"
    year: "2010"
    title: "Dapper, a Large-Scale Distributed Systems Tracing Infrastructure"
    where: "Google Technical Report dapper-2010-1"
    note: "Section 4.4 is on sampling, and it is honest in a way marketing material never is: at high throughput they sampled aggressively, and the interesting events are rare enough that uniform sampling loses them. The adaptive scheme in that section exists because of exactly that problem."
---

A sampling rate looks like a budget decision, and it is one. But a budget is not
the thing you have to defend in a review six months later. What you have to
defend is the sentence your configuration writes, which always has this shape:

> These questions will be answerable. Those will not.

Nothing about a percentage tells you which clause a given question falls into.
What decides that is **when** the decision is taken.

## Two families, divided by an instant

The documentation splits sampling into head and tail, and the split is defined
by timing rather than by policy ([source](#src-otel-sampling)). A head sampler
decides when the trace starts. A tail sampler decides once the spans are in
hand.

From that one difference everything else follows, including the sentence the
docs put plainly: the primary downside of head sampling is that it is not
possible to make a sampling decision based on data in the entire trace
([source](#src-otel-sampling)). It is not that head sampling is badly
implemented or poorly configured. At the moment it runs, the information you
want to decide on does not exist yet.

So "sample at 10% and we will still catch the errors" is not a trade-off that
was priced wrong. It is a sentence about something that cannot happen. A failure
in 1 in 500 requests, sampled uniformly at 10%, is a failure you meet once in
5 000 — and the ones you meet are not the ones someone complained about.

## The decision is one decision, and it travels

A trace spans processes, so a sampling decision taken at the root has to reach
the rest of them. It does: the `sampled` flag is one bit of the `traceparent`
header ([source](#src-w3c-trace-context)), and the default sampler is
`ParentBased`, which means a service that receives a sampled parent keeps its
spans and one that receives an unsampled parent does not
([source](#src-otel-trace-sdk)).

Two consequences, and both show up as support tickets.

The first: **turning the rate up in one service changes nothing**. The decision
was taken upstream, possibly in a service owned by another team, and your
service is obeying it. The knob you turned is consulted only for traces that
start in your process.

The second is the reason `ParentBased` is the default. Without it, each span
consults the sampler independently, and a trace can keep a child whose parent
was dropped. What arrives then is a trace with holes — and a trace with holes is
worse than a missing trace, because it renders. Nothing downstream knows how
many spans there should have been.

> [!deeper] A sampled count is not a count, and the fix has to travel too
>
> If you keep one trace in ten and then count the kept ones, your count is off
> by a factor you believe you know. You often do not: samplers can be
> reconfigured per service, rates can differ across a path, and a trace that
> crossed three services may have been subject to three different decisions.
> This is the problem the probability-sampling tracestate specification exists
> to solve ([source](#src-otel-tracestate-probability)): the kept span carries
> the probability that kept it, so a downstream consumer can weight it instead
> of guessing. The general shape is worth keeping even where you do not use that
> mechanism — **a sampled measurement that does not carry its own sampling
> probability cannot be turned back into a population estimate**, and
> multiplying by ten anyway is the most common way an observability platform
> reports a number nobody can defend.

## What tail sampling buys, and what it costs

Deciding late means deciding on facts: this trace contains an error, this one
took four seconds, this one touched the checkout path. That is what people want
from sampling, and it is only available after the trace exists.

The cost is not subtle, and it is not CPU. Every span of every trace has to be
held until the decision window closes, including all the spans about to be
discarded. The processor is stateful, and its own documentation leads with the
condition that makes it work at all: all spans of a trace must reach the same
Collector instance.

That condition is the one that breaks real installations, because violating it
is invisible. Put two tail-sampling gateways behind an ordinary load balancer
and both of them keep working — each decides correctly about the fragment it
received, and a fragment is not a trace. What lands in your backend is traces
with spans missing, which looks exactly like traces that succeeded. The
[lab for this phase](../../../../labs/head-vs-tail-sampling/) is that failure as
two counters: the error traces that arrived whole, and the ones that arrived
broken.

> [!deeper] Two samplers in series multiply
>
> The configuration people arrive at naturally is head sampling in the SDK *and*
> tail sampling in the Collector: thin the traffic at the source, then let the
> Collector pick what matters out of what arrives. It does not compose that way.
> The tail policy is applied to what reached it, so with a 10% head sampler your
> "keep every error" policy keeps every error *inside that 10%*, and the other
> 90% were deleted before any of them had failed. This is why the advice is to
> leave the SDK sampler keeping everything when the Collector samples on the
> tail ([source](#src-otel-tail-sampling-blog)) — and it is a case where two
> individually reasonable decisions, made by two teams who never read each
> other's config, produce a system that is worse than either one alone.

## The oldest version of this argument

Dapper sampled, and sampled hard — at Google's request volumes, uniform
sampling at a low rate was the only affordable option
([source](#src-sigelman-2010)). The paper is unusually candid about what that
cost them: the events worth looking at are rare, and uniform sampling is exactly
the procedure that loses rare things. The adaptive scheme described there exists
because the first, simple answer did not hold.

Fifteen years later the mechanisms are better and the shape is unchanged. You
are choosing what not to know. The only real question is whether you are
choosing it on purpose, at a moment when the thing you care about is knowable —
or by percentage, at a moment when nothing has happened yet.

Where to go next: [What an attribute costs](../what-an-attribute-costs/) for the
other half of the bill, where the decision is also taken in one line and paid
for by everyone, or
[Agent or gateway is a blast-radius question](../agent-or-gateway-is-a-blast-radius/)
for why the tail sampler has to live in a gateway and what that costs. The full
path is on the [handbook page](../../).
