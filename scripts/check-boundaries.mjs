#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { glob } from "node:fs/promises";

/** Pacotes que não podem conhecer domínio nenhum. */
const AGNOSTIC = ["packages/depth-core/", "packages/depth-ui/"];

/** Pacotes de domínio que eles não podem importar. */
const DOMAIN_PACKAGES = ["@ovh/otel-domain"];

/**
 * Termos inequívocos de OpenTelemetry. `span` e `trace` sozinhos ficam de fora
 * de propósito: `<span>` é HTML legítimo e "trace" aparece em "traceability".
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

async function main() {
  const all = [];
  for (const prefix of AGNOSTIC) {
    for await (const file of glob(`${prefix}src/**/*.{ts,tsx}`)) {
      all.push(...findViolations(file, readFileSync(file, "utf8")));
    }
  }

  if (all.length > 0) {
    console.error("Fronteira motor↔domínio violada (spec §8):\n");
    for (const v of all) console.error(`  ${v.filePath}: ${v.reason}`);
    console.error(
      "\nO motor não pode conhecer OpenTelemetry. Mova isso para packages/otel-domain.",
    );
    process.exit(1);
  }

  console.log("Fronteira motor↔domínio intacta.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
