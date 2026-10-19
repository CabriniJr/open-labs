# `collector-pipeline` — the real counterpart

One receiver, two pipelines — against the real Collector. The lab on the site models this;
here it happens.

The three-pillars counterpart says, in its own `collector.yaml`, that *what happens inside
the Collector is another lab*. This is that lab.

## Run it

```bash
docker compose up --build   # or: podman compose up --build
```

No JDK or Maven needed on your machine. The app exports on a one-second schedule and the
`batch` processor holds for up to three seconds, so give it about ten seconds before reading
the output.

Three processes: `shop` produces spans, `collector` is the config under study, and `backend`
is a second Collector that only receives and prints — so the first pipeline has a real
destination and the thing you count is what actually arrived.

## What to watch, with a question in your head

> I turned on a `filter` to stop sending `/health`. Did we stop?

Half the app's traffic is `/health`, which is the realistic ratio: a one-second liveness
probe produces more spans than the traffic you care about.

```bash
docker compose logs backend   | grep -c 'GET /health'   # the pipeline WITHOUT the filter
docker compose logs collector | grep -c 'GET /health'   # the pipeline WITH the filter
```

The second count is zero. The first is not — and the filter is in the same file, filtering
real spans, working exactly as configured. It is simply in the other pipeline.

## The two lines that are the whole lab

In `collector.yaml`:

```yaml
    traces:
      receivers: [otlp]            # <- this one
      processors: [memory_limiter, batch]
      exporters: [otlp/backend]

    traces/audit:
      receivers: [otlp]            # <- and this one are the SAME receiver
      processors: [filter/health]
      exporters: [debug]
```

`otlp` is instantiated once. Each pipeline gets its own copy of every span, so a processor
only ever sees the copy that entered its own pipeline. Nothing is split between them and
nothing is shared — which is also why adding the second pipeline does not double the
receiver's work, but does double your egress.

## What this file is the counterpart of

`packages/otel-domain/src/collector/collector.mmd` is the same topology as a drawing: one
receiver, two rows of nodes, the filter on one row. The claim the lab makes on screen is
checkable here, against the binary, and that is the point — a lab that asserts something
about the world owes a way to confirm it.

## Known gap

**This YAML is not machine-verified in CI.** The Java app is: `mvn compile` runs against the
same pinned SDK as the other labs. The Collector config is checked by reading it, and the
honest check would be `otelcol-contrib validate --config` in the pipeline — which needs the
Collector image, and the repository has no job that pulls it yet.

So if you are the first person to run this and the config is rejected, that is a real defect
and not your setup. The syntax here deliberately avoids the parts that moved between
versions: `service.telemetry` is left out entirely, and the internal counters it would expose
(`otelcol_processor_refused_spans`, which is the real counterpart of the `dropped` box on
screen) are not wired up for that reason. Adding them is a good first contribution; pin the
reader syntax to the image tag in `compose.yaml` when you do.
