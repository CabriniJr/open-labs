#!/usr/bin/env node
// Exporta os resultados dos labs do handbook de algoritmos do OpenLabs para
// dados/referencia_openlabs.json. Os testes em Python conferem que o código
// desta entrega dá exatamente o que o lab mostra no site.
//
//     node programacao-dinamica/exportar_referencia.mjs
//
// A conta mora em packages/algo-domain/src/referencia-pd.ts (o mesmo código
// dos labs) e roda pelo vitest, que lê TypeScript. Sem a variável de ambiente,
// o mesmo teste só confere que o arquivo está em dia — é o que o CI faz.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const r = spawnSync("pnpm", ["exec", "vitest", "run", "packages/algo-domain/src/referencia-pd.test.ts"], {
  cwd: RAIZ,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, ATUALIZAR_REFERENCIA_PD: "1" },
});
process.exit(r.status ?? 1);
