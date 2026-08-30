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
const DOMAIN_PACKAGES = ["@ovh/otel-domain", "@ovh/cpu-domain"];

/**
 * Termos inequívocos de domínio. `span` e `trace` sozinhos ficam de fora de
 * propósito: `<span>` é HTML legítimo e "trace" aparece em "traceability".
 *
 * Protocolo também é domínio: o motor não pode saber que gRPC existe.
 */
const OTEL = [
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

/**
 * O segundo domínio. Duas listas, **um** mecanismo de busca: o motor existe para
 * servir mais de um assunto, e agora há dois provando isso — vigiar só o
 * primeiro faria a fronteira valer contra um domínio e não contra o outro.
 *
 * `register` sozinho fica de fora: aparece em `registerX` de biblioteca. Por
 * isso "register file", que só significa uma coisa.
 */
const CPU = [
  "registrador",
  "register file",
  "opcode",
  "riscv",
  "risc-v",
  "assembly",
  "transistor",
  "instruction set",
];

const DOMAIN_WORDS = [...OTEL, ...CPU];

export function findViolations(filePath, source) {
  if (!AGNOSTIC.some((prefix) => filePath.startsWith(prefix))) return [];

  const violations = [];

  /*
   * Regra sobre o substantivo, e não sobre uma lista de palavras.
   *
   * O `kind` de uma mensagem é, por definição do próprio motor, "uma string
   * escolhida pelo domínio" (`model.ts`). Então o palco selecionar por ele é
   * violação **qualquer que seja a palavra** — e era assim que `instrucao`,
   * `escrita` e `guardar` moravam no CSS do motor sem acusar nada: nenhuma
   * delas estava na lista, e nenhuma lista teria todas. Quem quiser desenhar
   * diferente por espécie de carga pergunta ao domínio qual é a espécie.
   */
  if (/\[data-kind/.test(source)) {
    violations.push({
      filePath,
      reason:
        'seleciona por `data-kind` — o kind de uma mensagem é palavra do domínio. ' +
        "Peça a espécie ao domínio (`especieDaCarga`) e selecione por ela",
    });
  }

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
        "O motor não pode conhecer domínio nenhum — nem OpenTelemetry, nem CPU. Mova\n" +
          "isso para o pacote de domínio correspondente.",
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
    // CSS entra na varredura, e entrou tarde: o palco tinha seletores
    // `data-kind="instrucao"`, `"escrita"` e `"guardar"` — vocabulário de CPU
    // dentro do motor, invisível para uma guarda que só olhava TypeScript. Uma
    // fronteira que vigia meia linguagem vigia meia fronteira.
    for await (const file of glob(`${prefix}src/**/*.{ts,tsx,css}`)) {
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
