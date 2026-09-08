# `three-pillars` — the real counterpart

One event, three recorders — against the real SDK and a real Collector. The lab on the site
models this; here it happens.

## Run it

```bash
docker compose up --build   # or: podman compose up --build
```

No JDK or Maven needed on your machine. Traces and logs leave on a five-second schedule,
metrics on a ten-second one, so give it about fifteen seconds before reading the output.

Two environment variables in `compose.yaml` are the same two decisions the lab offers:

- `PILLARS_LOG_EVERYTHING` — does the code log every request, or only the failures?
- `PILLARS_USER_ATTRIBUTE` — is `user.id` one of the metric attributes?

## What to watch, with a question in your head

Read the Collector's output asking: **which requests took longer than 250 ms?**

- in `Span`, the answer is there: one entry per request, each with its own duration and its
  own identity. You can list them;
- in `Histogram`, you get `bucket_counts` — how many landed in each range. The values that
  produced those counts are not in the payload, not in the SDK, and not in the process. They
  were dropped when the measurement was recorded;
- in `LogRecord`, you get whatever this program chose to say. With `PILLARS_LOG_EVERYTHING`
  off, the successful requests leave no line at all — and nothing anywhere counts them.

Then set `PILLARS_USER_ATTRIBUTE=true` and count the `data_points` in the histogram. That is
what one more attribute costs: one series per distinct value, not one more column.

## What you cannot see here

- **the moment the identity is discarded.** The terminal shows the aggregate after the fact;
  it cannot show you the measurement being folded into a bucket, which is where the loss
  happens;
- **how many requests the log said nothing about.** The absence of a line is not printed. The
  lab counts it, and that counter has no equivalent out here — which is precisely why it is
  worth seeing once.

## The version is pinned

`app/pom.xml` pins the same OpenTelemetry Java BOM as `labs/providers/` — two labs quoting
different numbers for the same SDK are two labs disagreeing. `opentelemetry-semconv` is not
part of the BOM and carries its own version; that is the one exception.
