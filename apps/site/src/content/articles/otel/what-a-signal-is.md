---
title: "What a signal is"
dek: "A signal is not a data type. It is a decision about what to throw away at write time — and what you throw away then is exactly what you cannot ask for later."
handbook: otel
phase: 1
sources:
  - id: sigelman-2010
    author: "Benjamin H. Sigelman, Luiz André Barroso, Mike Burrows, Pat Stephenson, Manoj Plakal, Donald Beaver, Saul Jaspan and Chandan Shanbhag"
    year: "2010"
    title: "Dapper, a Large-Scale Distributed Systems Tracing Infrastructure"
    where: "Google Technical Report dapper-2010-1"
    note: "Read it for the unit of observation. Dapper's argument is that the individual request is the thing worth following, and that following it requires every participant to cooperate — the two claims this article's third section is built on."
  - id: fonseca-2007
    author: "Rodrigo Fonseca, George Porter, Randy H. Katz, Scott Shenker and Ion Stoica"
    year: "2007"
    title: "X-Trace: A Pervasive Network Tracing Framework"
    where: "4th USENIX Symposium on Networked Systems Design and Implementation (NSDI '07)"
    note: "Three years before Dapper, and more explicit about the mechanism: a small piece of metadata carried along the request, propagated by every layer that touches it. The word 'propagation' in OpenTelemetry descends from here."
  - id: lamport-1978
    author: "Leslie Lamport"
    year: "1978"
    title: "Time, Clocks, and the Ordering of Events in a Distributed System"
    where: "Communications of the ACM, vol. 21, no. 7"
    url: "https://lamport.azurewebsites.net/pubs/time-clocks.pdf"
    note: "The paper that explains why 'and then' cannot be recovered from timestamps. If you only read one thing here, read the first two pages — they are the reason a trace carries a parent identifier instead of trusting the clock."
  - id: otel-metrics-data-model
    author: "OpenTelemetry Authors"
    year: "current"
    title: "Metrics Data Model"
    where: "OpenTelemetry specification"
    url: "https://opentelemetry.io/docs/specs/otel/metrics/data-model/"
    note: "The temporality section is the one that matters here: a metric point is a statement about an interval, and which interval it is has to be carried with it or the number means nothing."
  - id: otel-logs-data-model
    author: "OpenTelemetry Authors"
    year: "current"
    title: "Logs Data Model"
    where: "OpenTelemetry specification"
    url: "https://opentelemetry.io/docs/specs/otel/logs/data-model/"
    note: "Look at the fields for trace and span identifiers. They are part of the record, not an add-on — which is the whole of this article's fourth section stated as a schema."
---

The usual introduction says there are three signals — metrics, logs and traces —
and then describes them as three kinds of data. That description is not wrong,
but it explains nothing, because it makes the choice between them look like a
matter of taste or of tooling.

It is neither. A signal is a **decision about what to discard**, taken at the
moment the event happens. Every one of the three keeps something and throws
something away, the throwing away is what makes it affordable, and it is
irreversible. Everything difficult about operating telemetry follows from that
one sentence.

## What each one refuses to remember

A **metric** refuses to remember the individual. When a request takes 412 ms and
you record it into a histogram, the 412 survives only as a contribution to a
bucket. Which request it was, what it asked for, who called it — gone, at write
time, on purpose. What survives is the shape of the population over an interval,
and it survives cheaply enough that you can keep it for a year.

A **log** refuses to remember the relation. It keeps the individual event in full
— the message, the fields, the moment — and knows nothing about what caused it or
what it caused. Two log lines from two services, describing two halves of one
user action, have no fact in common that connects them. They are adjacent in
time and unrelated in the data.

A **trace** refuses to remember almost nothing, and pays for it differently: it
requires **cooperation**. A trace exists only if every component that handles the
request agrees to carry an identifier and to hand it on. One participant that
does not, and the trace does not degrade gracefully — it splits into two
unrelated fragments, and neither one announces that it is a fragment.

So the three are not three views of the same thing at three price points. They
are three different sacrifices, and you are choosing which question you will be
unable to answer.

> [!deeper] Cardinality is the name of the metric's refusal
>
> Everyone eventually asks the obvious question: if a metric is cheap because it
> forgets the individual, can I just attach the individual as a label? Add the
> user id, the request id, the full URL, and you get the cheapness of a metric
> with the detail of a log.
>
> You do not. A metric's cost is not driven by how many measurements you take —
> it is driven by how many **distinct combinations of attributes** you take them
> under, because each distinct combination is a separate series that has to be
> stored, indexed and kept alive over time. Attaching a request id creates one
> series per request, which is a log with a much worse storage engine and a much
> larger bill.
>
> This is not a vendor limitation. It falls straight out of the data model
> ([source](#src-otel-metrics-data-model)): a point is identified by its
> attributes, so a unique attribute makes a unique identity. Phase 5 of this
> handbook is largely about living with that fact. It is worth knowing in phase 1
> that the fact is structural, not a pricing decision.

## Aggregation only runs one way

Here is the part that turns the taxonomy into an engineering constraint.

You can derive a metric from traces. Count the spans, bucket their durations by
route, and you have request rate and latency distribution — computed from the
individual events, after the fact. Plenty of production pipelines do exactly
this.

You cannot derive traces from a metric. Not with more compute, not with a better
query engine, not ever. The information was destroyed at write time, and no
downstream component can restore it.

That asymmetry is the single most useful thing to hold on to, because it converts
a taxonomy into a rule: **detail can be removed later, never added later.** Which
means the decision about what to keep has to be taken as early in the path as you
can afford to take it — and it means that a component further down the pipeline,
however powerful, is a reshaping tool and not a recovery tool. Phase 3 of this
handbook is that rule applied to the Collector.

## Why the relation cannot be reconstructed from timestamps

It is tempting to think the trace is unnecessary. If every service logs with a
precise timestamp, surely the order can be recovered by sorting.

It cannot, and the reason is older than distributed tracing. Lamport showed in
1978 ([source](#src-lamport-1978)) that in a system of independent processes there
is no total ordering of events available from local clocks; what exists is a
partial order defined by causality — this event *happened before* that one because
information flowed from one to the other. Clocks on separate machines disagree,
and the disagreement is routinely larger than the durations you care about. Two
events 3 ms apart on two hosts can be recorded in either order, and the record
will look perfectly plausible both ways.

So causality has to be **carried**, not inferred. That is what X-Trace proposed in
2007 ([source](#src-fonseca-2007)): a small piece of metadata that travels with
the request and that every layer propagates, so the relation is a fact in the data
rather than a guess about the clock. Dapper made the same argument at Google scale
in 2010 ([source](#src-sigelman-2010)) and added the observation that made it
practical — the instrumentation has to be in the shared infrastructure, because
asking thousands of application teams to each thread a context through by hand
does not converge.

A span's parent identifier is that carried metadata. It is not a convenience for
the UI. It is the only thing in the entire system that knows what caused what.

> [!deeper] What a clock is still good for
>
> None of this makes timestamps useless — it makes them the wrong tool for
> ordering. Duration is a local measurement: one process, one clock, subtracting
> two readings taken microseconds apart, and it is accurate. That is why a span
> can be trusted about how long *it* took and cannot be trusted about whether it
> started before a span on another host.
>
> The practical version of the rule: read durations off individual spans, read
> order off the parent relationship, and be suspicious of any view that infers one
> from the other. A waterfall chart drawn by sorting start times across hosts will
> occasionally show a child beginning before its parent, and the chart is not
> broken — the clocks are.

## The seam, and why the three have to know about each other

If the three signals discard different things, then the interesting failures live
in the gaps between them. You have a latency graph that shows a spike and no way
to get from the spike to a request. You have an exception in a log and no way to
find out what the caller was doing. Each signal answers its own question
competently and hands you nothing when the question crosses a boundary.

The response is not a fourth signal. It is to make the three carry the **same
identifiers**, so a crossing is a lookup instead of a reconstruction. A log record
in this model has fields for the trace and span it happened inside
([source](#src-otel-logs-data-model)) — they are part of the record, at the same
level as the severity and the body. A metric can carry exemplars, which are
pointers from an aggregate back to a few of the individual measurements that fed
it. Neither of these undoes the discarding. What they do is make the discarding
survivable: the aggregate no longer forgets *that* an individual existed, only
what it was.

This is why the word *context* comes up so early and so often, and why the next
phase of this handbook is mostly about it rather than about any of the three
signals in isolation. Context is the thing that is the same across all three.
Nothing else is.

> [!deeper] Why "three pillars" is the wrong picture
>
> Three pillars hold a roof up independently. Remove one and the structure sags
> but stands; the pillars do not need to know about each other, and that
> independence is the whole point of the metaphor.
>
> Telemetry is the opposite shape. The three signals are only useful together, the
> value is concentrated at the joins, and a system with excellent metrics,
> excellent logs and excellent traces that share no identifiers is a system where
> every incident becomes manual correlation by a human reading two screens.
>
> The metaphor is worth retiring rather than repairing, because it quietly
> licenses the exact architecture that produces the problem: three independent
> pipelines, three independent vendors, three independent conventions, and a
> permanent seam. The first lab of this handbook is about that seam, and the
> reason it comes before any lab about a span is that the seam is the actual
> problem — a span is part of the answer.

## What this handbook does with the definition

One consequence shapes every lab here, and it is worth stating before you see the
first one.

Each lab holds a **single running state** and every view is a projection of it.
When a lab shows you a service graph on top and an OTLP payload underneath, those
are not two drawings kept in sync — the payload is the state, and the graph is
computed from it. That design exists because of this article: if the three signals
come from one event, then a teaching tool that draws them from three separate
scripts is teaching the wrong shape, however nice the drawing looks.

So the model in each lab is a model, not an animation. You change an input and the
consequence propagates because the parts are wired together, and when something
disappears, it disappears for a reason you can find. That is a harder thing to
build than an illustration, and the reason it is worth building is in the section
above: the seam is where the difficulty lives, and a seam is not something a
diagram can show you. It is something you have to watch fail.

Next: [The envelope is the object graph](../the-envelope-is-the-object-graph/),
which takes the identifiers this article ends on and shows where they actually
sit in the bytes — and what their position tells you about who owns them. The
rest of the path is on the [handbook page](../../).
