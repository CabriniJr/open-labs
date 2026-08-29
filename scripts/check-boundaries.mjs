#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { glob } from "node:fs/promises";

/**
 * Pacotes que não podem conhecer domínio nenhum.
 *
 * `model-format` entra porque ele conhece `kind`, porta, fio e parâmetro —
 * vocabulário do motor — e nada além disso. É o formato em que um handbook de
 * outra tecnologia seria escrito; no dia em que ele souber o que é um exportador
 * de telemetria, deixa de servir para o segundo alvo.
 */
const AGNOSTIC = [
  "packages/depth-core/",
  "packages/depth-ui/",
  "packages/model-format/",
];

/** Pacotes de domínio que eles não podem importar. */
const DOMAIN_PACKAGES = ["@ovh/otel-domain"];

/**
 * Termos inequívocos de domínio. `span` e `trace` sozinhos ficam de fora de
 * propósito: `<span>` é HTML legítimo e "trace" aparece em "traceability".
 *
 * Protocolo também é domínio: o motor não pode saber que gRPC existe.
 */
const DOMAIN_WORDS = [
  "otlp",
  "opentelemetry",
  "otel",
  "traceparent",
  "tracestate",
  "resourcespans",
  "scopespans",
  "spanid",
  "traceid",
  "collector",
  "tracerprovider",
  "spanprocessor",
  "batchspanprocessor",
  "spanexporter",
  "sampler",
  "grpc",
  "http2",
  "protobuf",
  "hpack",
  "w3c",
];

export function findViolations(filePath, source) {
  if (!AGNOSTIC.some((prefix) => filePath.startsWith(prefix))) return [];

  const violations = [];

  for (const pkg of DOMAIN_PACKAGES) {
    if (source.includes(pkg)) {
      violations.push({ filePath, reason: `importa o pacote de domínio ${pkg}` });
    }
  }

  // Máscara os imports de pacotes de domínio já acusados acima, para não contar
  // duas vezes (ex.: "@ovh/otel-domain" também contém a palavra "otel").
  let maskedSource = source;
  for (const pkg of DOMAIN_PACKAGES) {
    maskedSource = maskedSource.split(pkg).join(" ".repeat(pkg.length));
  }

  const lowered = maskedSource.toLowerCase();
  for (const word of DOMAIN_WORDS) {
    if (new RegExp(`\\b${word}\\b`).test(lowered)) {
      violations.push({ filePath, reason: `usa vocabulário de domínio "${word}"` });
    }
  }

  return violations;
}

/**
 * O veredito, separado de `main` para poder ser testado.
 *
 * Zero arquivo varrido é FALHA, não sucesso: os padrões são relativos à raiz do
 * repositório, então rodar de outro diretório casava com nada e a guarda dava
 * verde tendo lido zero arquivo — justamente na peça que existe para dar
 * significado ao verde de todas as outras.
 */
export function verdict(scanned, violations) {
  if (violations.length > 0) {
    const linhas = violations.map((v) => `  ${v.filePath}: ${v.reason}`).join("\n");
    return {
      code: 1,
      report:
        `Fronteira motor↔domínio violada (spec §8):\n\n${linhas}\n\n` +
        "O motor não pode conhecer OpenTelemetry. Mova isso para packages/otel-domain.",
    };
  }

  if (scanned === 0) {
    return {
      code: 1,
      report:
        "Guarda de fronteira: nenhum arquivo casou com os padrões de varredura.\n" +
        "Um verde sem arquivo lido não prova nada. Os padrões partem da raiz do " +
        "repositório — provavelmente o comando rodou do diretório errado. Rode " +
        "`pnpm boundaries` na raiz.",
    };
  }

  return { code: 0, report: `Fronteira motor↔domínio intacta (${scanned} arquivos).` };
}

async function main() {
  const all = [];
  let scanned = 0;
  for (const prefix of AGNOSTIC) {
    for await (const file of glob(`${prefix}src/**/*.{ts,tsx}`)) {
      scanned += 1;
      all.push(...findViolations(file, readFileSync(file, "utf8")));
    }
  }

  const { code, report } = verdict(scanned, all);
  if (code === 0) console.log(report);
  else console.error(report);
  process.exit(code);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
