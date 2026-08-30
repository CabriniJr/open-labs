#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { glob } from "node:fs/promises";

/**
 * Cor e forma vivem no catálogo, e em nenhum outro lugar.
 *
 * A disciplina já funcionava: os três labs escolheram bem, cada um por sua
 * conta, e a auditoria de tela confirmou que eles combinam. Mas disciplina não
 * é sistema — nada impedia o quarto lab de escolher diferente, e o dia em que
 * ele escolhesse ninguém seria avisado. O que esta guarda faz é transformar
 * "escolheram bem" em "não dá para escolher em outro lugar".
 *
 * Ela é irmã da `check-boundaries.mjs`, e pela mesma razão: a regra que só vive
 * num comentário é a regra que se perde na terceira pessoa que mexe no arquivo.
 */

/** Onde a tinta pode ser escrita: o bloco de catálogo do palco, e só ele. */
const CATALOGO = "packages/depth-ui/src/stage.css";

/** Onde ela não pode: qualquer CSS que desenhe um lab ou o motor. */
const VIGIADOS = ["packages/*/src/**/*.css", "apps/site/src/components/*.css"];

/**
 * Literal de cor. `#fff`, `#ffd23f`, `rgb(...)`, `hsl(...)`, `oklch(...)`.
 *
 * `oklab(` fica de fora porque `color-mix(in oklab, ...)` é a forma de misturar
 * duas tintas do catálogo — misturar sentido é uso, não é escrever tinta nova.
 */
const TINTA = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/g;

/** Onde o catálogo começa e termina, dentro do arquivo que pode tê-lo. */
const ABRE = "═══════════════ O CATÁLOGO DA LINGUAGEM VISUAL";

function foraDoCatalogo(fonte) {
  const abre = fonte.indexOf(ABRE);
  if (abre === -1) return { erro: "o bloco do catálogo sumiu do stage.css" };
  // O catálogo vai do comentário até o fim do primeiro bloco `.dui-stage {`, e
  // os três estados de tema que a tinta viva precisa logo abaixo dele.
  const fim = fonte.indexOf("/* ---------- fios ---------- */");
  if (fim === -1) return { erro: "não achei o fim do catálogo no stage.css" };
  return { antes: fonte.slice(0, abre), depois: fonte.slice(fim) };
}

const faltas = [];
let lidos = 0;

for (const padrao of VIGIADOS) {
  for await (const caminho of glob(padrao)) {
    const fonte = readFileSync(caminho, "utf8");
    lidos += 1;

    if (caminho.endsWith(CATALOGO.split("/").at(-1)) && caminho.includes("depth-ui")) {
      const partes = foraDoCatalogo(fonte);
      if (partes.erro !== undefined) {
        faltas.push(`${caminho}: ${partes.erro}`);
        continue;
      }
      for (const trecho of [partes.antes, partes.depois]) {
        for (const achado of trecho.matchAll(TINTA)) {
          faltas.push(`${caminho}: tinta "${achado[0]}" escrita fora do catálogo`);
        }
      }
      continue;
    }

    for (const achado of fonte.matchAll(TINTA)) {
      faltas.push(`${caminho}: tinta "${achado[0]}" — use um sentido do catálogo`);
    }
  }
}

// Uma guarda que imprime "intacto" tendo lido zero arquivos é a mentira que
// esta suíte mais persegue. Ela precisa dizer quantos olhou.
if (lidos === 0) {
  console.error("Guarda do catálogo não leu arquivo nenhum — o padrão de busca quebrou.");
  process.exit(1);
}

if (faltas.length > 0) {
  console.error("Catálogo da linguagem visual violado:\n");
  for (const falta of faltas) console.error(`  ${falta}`);
  console.error(
    "\nCor e forma moram no catálogo, em packages/depth-ui/src/stage.css. Dê um NOME ao\n" +
      "sentido lá e leia por ele aqui — `var(--dui-alto)`, e nunca o hexadecimal. Misturar\n" +
      "dois sentidos com color-mix(in oklab, ...) é uso legítimo e não conta como tinta nova.",
  );
  process.exit(1);
}

console.log(`Catálogo da linguagem visual intacto (${lidos} arquivos).`);
