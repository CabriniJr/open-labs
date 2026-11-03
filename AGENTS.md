# Agentes neste repositório

Para criar, estender ou revisar um lab, siga `.claude/skills/openlabs-lab/SKILL.md`
— a escolha de mídia, a anatomia, a linguagem visual, as regras de desempenho e o
QA (`pnpm qa:labs`) estão lá.

Antes de entregar qualquer mudança: `pnpm test`, `pnpm typecheck`,
`pnpm boundaries`, `pnpm catalogo` e, se tocou em lab, `pnpm build && pnpm qa:labs`.

Estado conhecido de desempenho e a fila de correções: `docs/qa/2026-11-03-performance.md`.
