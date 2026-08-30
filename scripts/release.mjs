#!/usr/bin/env node
// scripts/release.mjs
//
// Promove `dev` para `main`. `main` é o que a Vercel serve, então isto é a
// única porta entre o que roda na máquina e o que o mundo vê.
//
// A regra do projeto vale aqui como vale no motor: **mover a validação para
// onde a violação vira impossível.** Não adianta "lembrar de rodar os testes
// antes de promover" — o script recusa promover se qualquer portão falhar, e
// recusa antes de tocar em `main`.
//
// Uso:  node scripts/release.mjs "o que esta release entrega"
//       node scripts/release.mjs --dry-run "..."   (roda os portões e para)

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const nota = args.filter((a) => !a.startsWith("--")).join(" ").trim();

const DEV = "dev";
const PROD = "main";

/** Roda e devolve a saída. Falhou, aborta com a saída inteira à vista. */
function sh(cmd, cmdArgs, { silencioso = false } = {}) {
  try {
    return execFileSync(cmd, cmdArgs, {
      encoding: "utf8",
      stdio: silencioso ? ["ignore", "pipe", "pipe"] : ["ignore", "pipe", "inherit"],
    }).trim();
  } catch (erro) {
    if (silencioso && erro.stdout !== undefined) process.stdout.write(erro.stdout);
    throw erro;
  }
}

const git = (...a) => sh("git", a, { silencioso: true });

function recusar(porque, comoResolver) {
  console.error(`\n✗ release recusada: ${porque}`);
  console.error(`  ${comoResolver}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------- pré-checagem
//
// Tudo o que se pode saber sem gastar minutos de teste vem primeiro: descobrir
// que a árvore está suja depois de rodar a suíte inteira é desperdiçar o tempo
// de quem espera.

if (nota === "") {
  recusar(
    "falta a nota da release",
    'Diga em uma linha o que ela entrega: node scripts/release.mjs "o mapa do RISC-V"',
  );
}

const branch = git("rev-parse", "--abbrev-ref", "HEAD");
if (branch !== DEV) {
  recusar(
    `você está em "${branch}", e a release sai de "${DEV}"`,
    `Rode: git checkout ${DEV}`,
  );
}

if (git("status", "--porcelain") !== "") {
  recusar(
    "há mudança não commitada",
    "Uma release tem que ser exatamente um commit que existe. Commite ou guarde antes.",
  );
}

git("fetch", "origin", "--quiet");

const naFrente = git("rev-list", "--count", `origin/${DEV}..${DEV}`);
const atras = git("rev-list", "--count", `${DEV}..origin/${DEV}`);
if (atras !== "0") {
  recusar(
    `"${DEV}" está ${atras} commit(s) atrás do remoto`,
    `Rode: git pull --ff-only origin ${DEV}`,
  );
}

// `main` não pode ter nada que `dev` não tenha: senão a promoção não é
// fast-forward e alguém escreveu direto em produção.
const soEmProd = git("rev-list", "--count", `${DEV}..origin/${PROD}`);
if (soEmProd !== "0") {
  recusar(
    `"${PROD}" tem ${soEmProd} commit(s) que "${DEV}" não tem`,
    `Alguém escreveu direto em produção. Traga para o ${DEV} primeiro: ` +
      `git merge origin/${PROD}`,
  );
}

const novos = git("rev-list", "--count", `origin/${PROD}..${DEV}`);
if (novos === "0") {
  recusar(
    `"${PROD}" já está igual a "${DEV}"`,
    "Não há o que promover.",
  );
}

console.log(`\n▸ release de ${DEV} → ${PROD}: ${novos} commit(s), ${naFrente} ainda não publicado(s)`);
console.log(`  nota: ${nota}\n`);

// ------------------------------------------------------------------- portões
//
// Os mesmos que o CI roda, na mesma ordem, e nesta máquina. O e2e vem por
// último porque é o mais caro e o que menos falha sozinho.

const PORTOES = [
  ["fronteira motor↔domínio", "pnpm", ["boundaries"]],
  ["typecheck", "pnpm", ["typecheck"]],
  ["testes unitários", "pnpm", ["test"]],
  ["build", "pnpm", ["build"]],
  ["e2e", "pnpm", ["--filter", "@ovh/site", "test:e2e"]],
];

for (const [nome, cmd, cmdArgs] of PORTOES) {
  console.log(`▸ ${nome}`);
  try {
    sh(cmd, cmdArgs);
  } catch {
    recusar(
      `o portão "${nome}" falhou`,
      `Conserte na ${DEV} e rode de novo. Nada foi tocado em ${PROD}.`,
    );
  }
}

if (dryRun) {
  console.log("\n✓ todos os portões passaram. --dry-run: nada foi promovido.\n");
  process.exit(0);
}

// ------------------------------------------------------------------ promoção
//
// Fast-forward de propósito: `main` é sempre um ponto da história da `dev`, e
// não uma linha paralela. Se o fast-forward não for possível, a pré-checagem
// acima já teria recusado — e se ainda assim falhar, é melhor parar aqui.

const versao = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const tag = `v${versao}-${new Date().toISOString().slice(0, 10)}-${git("rev-parse", "--short", DEV)}`;

console.log(`\n▸ promovendo, e marcando ${tag}`);
git("push", "origin", `${DEV}:${DEV}`);
git("push", "origin", `${DEV}:${PROD}`);
git("tag", "-a", tag, "-m", nota);
git("push", "origin", tag);

console.log(`\n✓ ${PROD} agora é ${git("rev-parse", "--short", DEV)} — a Vercel publica sozinha.`);
console.log(`  ${tag}: ${nota}\n`);
