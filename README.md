# OTel Visual Handbook

Every OpenTelemetry concept as a model you can take apart — from the service
graph down to the bytes on the wire.

**https://cabrinijr.github.io/otel-visual-handbook**

## Why

Most OpenTelemetry material shows a diagram and a config file. This one shows the
running mechanism at four depths — flow, component, wire, payload — where each
depth is a projection of the same state. What you read at the bottom is what
produced the picture at the top. Every lab has a `docker compose` beside it so
you can check the model against a real Collector.

## Layout

| Path | What lives there |
|---|---|
| `apps/site` | The Astro site: content, pages, one scenario per lab |
| `packages/depth-core` | The deterministic engine. Knows nothing about OpenTelemetry |
| `packages/depth-ui` | Visual primitives. Also domain-neutral |
| `packages/otel-domain` | The only place OpenTelemetry exists: OTLP types, `traceparent` |
| `labs/<slug>` | The compose that runs for real |
| `docs/` | Specs, ADRs, the design canvas, and the authoring guide |

The boundary between engine and domain is enforced by `pnpm boundaries` in CI,
not by discipline — the engine is meant to outlive this one subject.

## Development

```bash
pnpm install
pnpm dev          # http://localhost:4321/otel-visual-handbook
pnpm test         # unit tests
pnpm boundaries   # engine/domain boundary check
pnpm typecheck
pnpm build
```

Writing a lab: see [`docs/authoring.md`](docs/authoring.md).

## Sources

Technical claims come from the [OpenTelemetry specification](https://opentelemetry.io/docs/specs/)
and the official documentation, linked inline. The teaching order follows
*Learning OpenTelemetry* by Ted Young and Austin Parker (O'Reilly, 2024); no text
from the book is reproduced here.

Built with Claude.
