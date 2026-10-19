---
title: "Agent or gateway is a blast-radius question"
dek: "An agent knows where it runs. A gateway knows what else arrived. Neither can know the other's thing, so the deployment shape is not a taste in topology — it decides which facts your telemetry can carry and which failure takes it all away at once."
handbook: otel
phase: 3
lab: labs/collector-pipeline
sources:
  - id: otel-collector-deploy
    author: "OpenTelemetry Authors"
    year: "current"
    title: "Deploy the Collector"
    where: "OpenTelemetry documentation"
    url: "https://opentelemetry.io/docs/collector/deploy/"
    note: "The index of the three shapes — no collector, agent, gateway — and worth reading first because it frames them as trade-offs rather than as a progression. The pages it links are where the costs are written down."
  - id: otel-collector-agent
    author: "OpenTelemetry Authors"
    year: "current"
    title: "Agent deployment pattern"
    where: "OpenTelemetry documentation"
    url: "https://opentelemetry.io/docs/collector/deploy/agent/"
    note: "Read the drawbacks section rather than the benefits. The cost listed there is not CPU — it is that the shape stops scaling as an organisation grows, which is a different kind of limit than the one you look for in a diagram."
  - id: otel-collector-gateway
    author: "OpenTelemetry Authors"
    year: "current"
    title: "Gateway deployment pattern"
    where: "OpenTelemetry documentation"
    url: "https://opentelemetry.io/docs/collector/deploy/gateway/"
    note: "Centralised credentials and policy on one side; more components, more latency and more resource cost on the other. Note also what it says about a standard Kubernetes Service balancing connections rather than requests."
  - id: otel-collector-agent-to-gateway
    author: "OpenTelemetry Authors"
    year: "current"
    title: "Agent-to-gateway deployment pattern"
    where: "OpenTelemetry documentation"
    url: "https://opentelemetry.io/docs/collector/deploy/other/agent-to-gateway/"
    note: "The combination, and the three reasons the docs give for reaching for it: centralised processing, network isolation, and sampling that needs complete traces. That third one is the only one of the three that is a hard requirement rather than a preference."
  - id: otel-collector-architecture
    author: "OpenTelemetry Authors"
    year: "current"
    title: "Architecture"
    where: "OpenTelemetry documentation"
    url: "https://opentelemetry.io/docs/collector/architecture/"
    note: "What a pipeline is made of, and the sentence that explains most surprising Collector behaviour: a receiver named in several pipelines is one instance feeding a fan-out consumer, and the hand-off is a synchronous call."
  - id: otel-collector-resiliency
    author: "OpenTelemetry Authors"
    year: "current"
    title: "Resiliency"
    where: "OpenTelemetry documentation"
    url: "https://opentelemetry.io/docs/collector/resiliency/"
    note: "Where the data is when something is down, and for how long. The retry window and the queue are in memory by default, which is the detail that decides whether a restart is an interruption or a loss."
  - id: otel-collector-scaling
    author: "OpenTelemetry Authors"
    year: "current"
    title: "Scaling the Collector"
    where: "OpenTelemetry documentation"
    url: "https://opentelemetry.io/docs/collector/scaling/"
    note: "Which metrics tell you a Collector is the bottleneck, and why some components cannot simply be given more replicas. Read it as the operational half of the gateway page."
  - id: sigelman-2010
    author: "Benjamin H. Sigelman, Luiz André Barroso, Mike Burrows, Pat Stephenson, Manoj Plakal, Donald Beaver, Saul Jaspan and Chandan Shanbhag"
    year: "2010"
    title: "Dapper, a Large-Scale Distributed Systems Tracing Infrastructure"
    where: "Google Technical Report dapper-2010-1"
    note: "Section 3 describes a local daemon on every machine handing off to a central collector service — the agent-to-gateway shape, fifteen years early. The reason given is the one that still decides it: the thing a process knows about itself cannot be recovered anywhere else."
---

The Collector has three shapes, and the documentation lists them as patterns
rather than as levels: no collector at all, an agent next to the workload, or a
gateway the workloads send to ([source](#src-otel-collector-deploy)). Teams
usually choose between them by looking at a diagram, which is the wrong
instrument, because the diagrams differ in boxes and the shapes differ in
**what each one is able to know**.

Two facts set everything else:

- An agent runs where the workload runs, so it knows things about that place —
  the host, the pod, the node, the container — that nothing downstream can
  reconstruct afterwards.
- A gateway sees telemetry from everywhere, so it knows things about the
  *whole* that no single agent can see — above all, whether all the spans of a
  trace have arrived.

Neither fact is available to the other shape. That is the entire argument, and
everything below is a consequence of it.

## What only the agent can know

A span leaves a process with the attributes the SDK gave it. Which pod it came
from, which node that pod was scheduled on, which container image was running:
the process may not know any of that, and a gateway four hops away certainly
does not. Something standing in the same place as the workload can look it up.

This is why Dapper, in 2010, ran a daemon on every machine before shipping
anything centrally ([source](#src-sigelman-2010)). The argument was not
throughput. It was that locality is information, and information not captured
where it exists is not available later. The same reasoning is why the agent page
leads with "local collection" rather than with performance
([source](#src-otel-collector-agent)).

There is a cost, and the docs name one that is easy to miss: the agent shape
stops scaling for the *organisation* before it stops scaling for the traffic
([source](#src-otel-collector-agent)). Every team touching the same agent config
is a team that can break everyone else's telemetry, and a per-host agent is not
a place where one team can own one pipeline.

> [!deeper] Running k8sattributes in a gateway costs memory, and the reason is the point
>
> You can enrich with Kubernetes metadata in a gateway instead of in an agent,
> and it works. The cost is that each replica has to hold metadata for the
> **whole cluster**, because any pod's telemetry can arrive at any replica —
> whereas an agent only needs to know about the pods on its own node. The memory
> curve of that processor is therefore the shape of the deployment, written as
> resource usage. It is a good example of a question that looks like tuning and
> is actually topology.

## What only the gateway can know

Tail sampling is the clearest case, because it is not a preference. Deciding to
keep a trace *because it contained an error* requires having the whole trace,
and a trace is produced by many processes on many hosts. No agent can make that
decision, since every agent has one slice.

So the decision moves to a gateway, and the requirement that follows is strict:
all spans of a given trace must arrive at the **same** gateway instance
([source](#src-otel-collector-agent-to-gateway)). Add replicas naively and the
sampler stops being wrong occasionally — it starts being wrong systematically,
on every trace whose spans were split across two instances, and the output still
looks like sampling. The docs' advice is accordingly blunt: prefer one
well-resourced tail-sampling gateway unless you have a real sticky-routing
strategy.

The same "the gateway sees the whole" property is what makes the other benefits
possible — one place for credentials and policy, one egress point, one place to
change a routing rule ([source](#src-otel-collector-gateway)). And it is also
what the word *blast radius* is about: those are all the same single thing to
break.

> [!deeper] A Kubernetes Service load-balances connections, not requests
>
> The gateway page warns about this and it catches people who did everything
> else right. OTLP over gRPC is a long-lived HTTP/2 stream, and a standard
> Service balances at connection time — so an agent that opens one connection
> sends **all** of its telemetry to one gateway pod for as long as that
> connection lives ([source](#src-otel-collector-gateway)). Your four replicas
> are not four shares of the load; they are whatever the connection assignment
> happened to be. The fix is a load balancer that understands requests, or an
> exporter that routes on purpose — and noticing the problem at all requires the
> per-replica throughput metrics the scaling page points at
> ([source](#src-otel-collector-scaling)).

## Where the data is when something is down

Blast radius is not only about who is affected. It is also about *what is lost
while it happens*, and the answer lives in the exporter's queue.

By default that queue is in memory, with retries that have a maximum duration.
If the destination stays down past the retry window, the oldest data in the
queue is dropped; if the Collector crashes, the queue is simply gone
([source](#src-otel-collector-resiliency)). A queue written to disk through the
file-storage extension survives the crash — and comes with the honest caveat
that the guarantee is weaker than a real message queue's.

Now put that against the two shapes:

- **Agent.** A crash loses the queue of one host. Nobody else is affected, and
  the SDK-to-agent hop is a local one, so it is the least likely place for
  telemetry to be in flight when things go wrong.
- **Gateway.** A crash loses the queue of everything that was routed to it, and
  the agent-to-gateway hop crosses a network, so there is always something in
  flight.

That asymmetry is why the resiliency page recommends persistent storage
specifically for gateways and for agents collecting data you cannot afford to
lose ([source](#src-otel-collector-resiliency)) — the persistence is bought
where the loss is shared.

There is one more coupling, and it is the least intuitive thing in this phase. A
receiver named in several pipelines is **one** receiver instance, and it hands
the data to a fan-out consumer with a synchronous call
([source](#src-otel-collector-architecture)). If the first processor of one
pipeline blocks, the other pipelines do not receive the data either, and the
receiver stops taking in new data. A slow exporter in the pipeline you do not
care about is therefore back-pressure on the one you do — inside a single
Collector, with no network between them. The
[lab for this phase](../../../../labs/collector-pipeline/) is that receiver and
those two pipelines, drawn so that the copy is visible as two lines leaving one
port.

## So: which one

The answer the docs give, and the one Dapper arrived at, is **both** — agents
for what only locality knows, a gateway for what only the whole knows
([source](#src-otel-collector-agent-to-gateway)). But that is a destination and
not a starting point, and the same page says plainly that a simpler setup should
use one or the other.

What makes the question answerable is to stop asking which topology is correct
and ask the two questions the shapes actually differ on:

1. Is there a fact about *where* the telemetry was produced that is lost if
   nothing stands there? Then something has to stand there.
2. Is there a decision that needs the *whole* trace, or a policy that has to be
   identical everywhere? Then something has to see everything.

Answer those and the drawing follows. Answer the drawing first and you will be
tuning a sampler that cannot be right.

Where to go next: [Who owns the pipeline](../who-owns-the-pipeline/) for the
boundary between the SDK and the Collector, which decides what is even eligible
to be changed in one of these shapes, or
[What an attribute costs](../what-an-attribute-costs/) for the bill that a
gateway is usually bought to control. The full path is on the
[handbook page](../../).
