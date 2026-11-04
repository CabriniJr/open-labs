# Head and tail sampling, against the real Collector

This directory is the counterpart of
[`labs/head-vs-tail-sampling/`](../../apps/site/src/pages/labs/head-vs-tail-sampling.astro)
on the site: one app, one routing Collector, and **two** tail-sampling
Collectors. The lab on screen makes three claims, and they are claims about
these files rather than about a simulator.

```
docker compose up --build
```

## The three experiments

**1. Head sampling decides before the error exists.**

```
HEAD_SAMPLING_RATIO=0.1 docker compose up --build
```

The app's error is in the *child* span (`payments.charge`), and the sampling
decision was taken when the root span was created — so it could not depend on
the error. At `0.1`, nine of ten traces never leave the process, errors
included, and no policy in `tail.yaml` can recover them: the data does not
exist on the other side. This is why the recommendation when you run tail
sampling is to leave the SDK sampler keeping everything. Two samplers in series
multiply.

**2. Tail sampling keeps every error — and holds memory to do it.**

With `HEAD_SAMPLING_RATIO=1.0` (the default here), `tail.yaml` keeps every
trace whose status is `ERROR`, plus 10% of the rest as a baseline. The cost is
`decision_wait`: for five seconds, every span of every trace is in the
gateway's memory, including the traces that are about to be discarded.

**3. Without `routing_key: traceID`, the trace arrives in pieces.**

Edit `gateway.yaml` and change `routing_key` to `service`. Everything still
boots, every component still reports healthy, and both tail samplers keep
deciding — each one on a fragment. The contrib README states the condition in
these words:

> All spans for a given trace MUST be received by the same collector instance
> for effective sampling decisions.

With one service name, `service` routing sends everything to one instance,
which is wrong in the other direction: one gateway does all the work and the
second is idle. With several services it is worse, because the spans of one
trace then split by the service that produced them — which is exactly the shape
the lab draws as *arrived broken*.

## What each file is

| file | what it is in the drawing |
| --- | --- |
| `app/` | the `app` node: two spans per trace, the error in the second |
| `gateway.yaml` | the `load balancer` node — it samples nothing, it only routes |
| `tail.yaml` | both `tail sampler` nodes: the same config on two instances |
| `compose.yaml` | the wiring, and the three environment knobs |

## Known gap

**These YAML files are not machine-verified in CI**, same as
`labs/collector-pipeline/`. The Java app is: `mvn compile` runs against the same
pinned OpenTelemetry BOM as every other lab here. The configs were written
against the contrib READMEs for
[`tailsamplingprocessor`](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/tailsamplingprocessor)
and
[`loadbalancingexporter`](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/exporter/loadbalancingexporter),
and read carefully, which is not the same as `otelcol-contrib validate
--config` having accepted them.

Two version details worth knowing if yours is rejected:

- the exporter was renamed from `loadbalancing` to `load_balancing`. The old
  name survives as a deprecated alias, so on an older image either works; this
  file uses the new one;
- `tail_sampling` ships only in `otelcol-contrib`, never in the core
  distribution. The image in `compose.yaml` is pinned for that reason.

`service.telemetry` is deliberately left out, so the Collector's own counters
(`otelcol_processor_tail_sampling_*`) are not exposed here. Wiring them up is a
good first contribution — they are the real counterpart of the *holding* number
on screen — and the reader syntax should be pinned to the image tag in
`compose.yaml` when you do.
