#!/usr/bin/env node
// Copia a base da entrega de Data Science para o pacote do site, em colunas:
//   data-science/dados/sessoes_telecentro.csv  (a base, gerada por gerar_dados.py)
//   data-science/dados/referencia_openlabs.json (a divisão e os coeficientes do scikit-learn)
// → packages/ds-domain/src/retorno/dados.json
//
// Uso: node packages/ds-domain/gerar.mjs [--check]
// Um teste (`dados.test.ts`) falha se o JSON ficar para trás do CSV.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const ds = join(aqui, "..", "..", "data-science", "dados");
const destino = join(aqui, "src", "retorno", "dados.json");

export function montar() {
  const [cabeca, ...linhas] = readFileSync(join(ds, "sessoes_telecentro.csv"), "utf8").trim().split("\n");
  const nomes = cabeca.split(",");
  const texto = new Set(["telecentro", "periodo", "lab", "handbook"]);
  const colunas = Object.fromEntries(nomes.map((n) => [n, []]));
  for (const linha of linhas) {
    linha.split(",").forEach((v, k) => colunas[nomes[k]].push(texto.has(nomes[k]) ? v : v === "" ? null : Number(v)));
  }
  const ref = JSON.parse(readFileSync(join(ds, "referencia_openlabs.json"), "utf8"));
  return JSON.stringify({ fonte: "data-science/dados/sessoes_telecentro.csv (simulada; distâncias a pé reais do OpenStreetMap, ODbL)", colunas, referencia: ref }) + "\n";
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const novo = montar();
  if (process.argv.includes("--check")) {
    const atual = readFileSync(destino, "utf8");
    if (atual !== novo) { console.error("dados.json está para trás: rode node packages/ds-domain/gerar.mjs"); process.exit(1); }
    console.log("dados.json em dia.");
  } else {
    writeFileSync(destino, novo);
    console.log(`escrito ${destino} (${(novo.length / 1024).toFixed(0)} KB)`);
  }
}
