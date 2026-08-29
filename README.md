# OpenLabs

Handbooks that run. Every subject is a `.model` on the same compositional
engine — you take the model apart instead of reading about it.

Hoje são dois: o **OpenTelemetry Visual Handbook** (`otel.model`), do grafo de
serviços até os bytes no fio, e o **RISC-V Visual Handbook** (`cpu.model`), do
diagrama de blocos até o transistor. O motor não sabe qual é o assunto — é isso
que faz o segundo handbook custar menos que o primeiro.

Todo handbook tem a mesma anatomia: **roadmap** (a ordem em que os conceitos se
sustentam), **artigos** e **labs**.

**https://otel-visual-handbook.vercel.app** — o site canônico, servido na raiz.
Espelho no GitHub Pages: **https://cabrinijr.github.io/otel-visual-handbook**

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
pnpm dev          # http://localhost:4321
pnpm test         # unit tests
pnpm boundaries   # engine/domain boundary check
pnpm typecheck
pnpm build
```

## Deploy

O caminho-base não é constante: quem chama o build declara onde o site vai servir.

| Destino | Comando | Onde serve |
|---|---|---|
| Vercel (canônico) | `pnpm build` | raiz do domínio |
| GitHub Pages (espelho) | `PUBLIC_BASE_PATH=/otel-visual-handbook/ PUBLIC_SITE_URL=https://cabrinijr.github.io pnpm build` | `/otel-visual-handbook/` |

A Vercel usa o `vercel.json` da raiz (`framework: null`, porque o autodetect erra o
diretório num monorepo pnpm). O Pages sai de `.github/workflows/deploy.yml`, que passa as
duas variáveis acima. Toda URL interna do site precisa passar por `import.meta.env.BASE_URL`
— caminho absoluto cravado funciona local e quebra no espelho.

Writing a lab: see [`docs/authoring.md`](docs/authoring.md).

## Sources

Technical claims come from the [OpenTelemetry specification](https://opentelemetry.io/docs/specs/)
and the official documentation, linked inline. The teaching order follows
*Learning OpenTelemetry* by Ted Young and Austin Parker (O'Reilly, 2024); no text
from the book is reproduced here.

Built with Claude.

## License

Code is [Apache-2.0](LICENSE). Editorial content — everything under `docs/`, plus lab
prose, labels and `teaches` fields — is [CC BY-SA 4.0](LICENSE-content). Two licences
because the engine is meant to be reused as a library and the teaching material is meant
to be reused as teaching material.
