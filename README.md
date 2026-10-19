# OpenLabs

Handbooks that run. Flow scenarios use a compositional engine and a canonical
Mermaid contract; stateful experiments and direct manipulation use the model
that fits the subject. You experiment with the mechanism instead of only
reading about it.

O **OpenTelemetry Visual Handbook** (`otel.model`) vai do grafo de
serviços até os bytes no fio, e o **CPU Visual Handbook** (`cpu.model`) vai do
diagrama de blocos até o transistor. Há também **Algorithms** (a máquina RPN) e
o **Kubernetes Visual Handbook**, com a POC de Pod lifecycle a partir de manifesto,
em um modelo de estado independente do motor de fluxos. O motor não sabe qual é o assunto — é isso
que faz o segundo handbook custar menos que o primeiro.

Todo handbook tem a mesma anatomia: **roadmap** (a ordem em que os conceitos se
sustentam), **artigos** e **labs**.

**https://cabrinijr.github.io/open-labs/** — o site canônico, publicado pelo
GitHub Pages a partir de `main`.

## Why

Most material on a technical subject shows a diagram and a config file. In a
compositional flow lab, the diagram **is** the running mechanism: the same state seen from more than
one depth: only the leaves have behaviour, and everything above is the result of
running what is inside it. What you read at the bottom is what produced the picture
at the top.

That is why the engine knows nothing about the subject. `otel.model` goes from the
service graph down to the OTLP payload, with a `docker compose` beside each lab so you
can check the model against a real Collector. `cpu.model` goes from the block diagram
down to the transistor, and takes assembly as its input. Same engine — and the second
handbook is where we find out whether the first one leaked domain into it.

## Layout

| Path | What lives there |
|---|---|
| `apps/site` | The Astro site: content, pages, one scenario per lab |
| `apps/runner` | Portable compiled host for runnable handbook deliveries |
| `packages/handbook-format` | Versioned content, lab and delivery contracts; standalone authoring SDK |
| `packages/handbook-catalog` | Reviewed adapters and runtime capabilities installed in the static host |
| `packages/depth-core` | The deterministic engine. Knows no domain at all — two guard lists prove it |
| `packages/depth-ui` | Visual primitives. Also domain-neutral |
| `packages/interactive-core` | Domain-neutral event/snapshot runtime for experiments outside the flow engine |
| `packages/kubernetes-domain` | Manifest-driven Pod lifecycle, reconciliation and resource reservations |
| `packages/otel-domain` | The only place OpenTelemetry exists: OTLP types, `traceparent` |
| `packages/cpu-domain` | The only place a register exists: the RV32I subset, the assembler, the datapath |
| `labs/<slug>` | The real counterpart: compose, native manifests and verification steps |
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

For authoring outside this checkout, `pnpm sdk:pack` builds installable alpha
tarballs for the authoring SDK and the independent state runtime;
`pnpm sdk:smoke` proves they work in a separate project. See
[Independent handbook authoring](docs/standalone-authoring.md). Content bundles
carry articles and lab requirements; lab implementations are supplied by the host.

The alpha **Handbook Studio** at `/studio/` provides local curriculum and article
editing, learner preview, contract diagnostics, source ZIPs and bundle export.
It also prepares an authoring brief for use with your assistant. See the
[Studio guide](docs/studio.md).

The Studio's **Delivery** panel downloads a runnable release with validated
content, pinned labs and integrity checks. You can also build one locally:

```sh
pnpm delivery:build --handbook kubernetes --version 0.1.0
cd dist/deliveries/kubernetes-0.1.0
node serve.mjs
```

Recipients only need Node.js 24; an existing HTTPS static host also works.
See [Runnable handbook deliveries](docs/delivery.md) for private hosting and
the current three-adapter host.

## Deploy

O caminho-base não é constante: quem chama o build declara onde o site vai servir.

| Destino | Comando | Onde serve |
|---|---|---|
| GitHub Pages (canônico) | `PUBLIC_BASE_PATH=/open-labs/ PUBLIC_SITE_URL=https://cabrinijr.github.io pnpm build` | `/open-labs/` |
| Local / domínio próprio | `pnpm build` | raiz |

O deploy sai de `.github/workflows/deploy.yml`, que roda em cada push em `main` e
publica `apps/site/dist` no ambiente `github-pages`. A alavanca do caminho-base
continua porque a decisão de onde servir é de quem chama o build; toda URL interna
do site precisa passar por `import.meta.env.BASE_URL`, e caminho absoluto cravado
funciona local e quebra em qualquer subdiretório.

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
