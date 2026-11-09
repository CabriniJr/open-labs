#!/usr/bin/env node
// Conserta defeitos mecânicos do catálogo pt-BR gerado por tradução assistida.
//
// A tradução em lote juntava frases com quebra de linha, e às vezes a resposta
// vinha com um pedaço da frase seguinte grudado ("Predict before you look" →
// "Preveja antes de olhar\nPrefixo"). Pior: padrões curtos com lacuna também
// foram traduzidos, e um padrão vale para qualquer texto que case com ele —
// `"s{0}" → "{0}"` apagava o "s" inicial de todo texto do site que começasse
// com "s", e `"t{0}"` grudava "tabela" em todo texto começado por "t".
//
// Três regras, todas verificáveis:
// 1. a tradução não pode ter mais quebras de linha que a origem: o excedente é
//    o pedaço vazado e sai;
// 2. um padrão cujo texto fixo não tem espaço é código (id, chave, caminho) e
//    fica idêntico à origem;
// 3. uma origem que o inventário classificou como português fica idêntica.
//
// Uso: node scripts/repair-locales.mjs   (depois de `pnpm locale:inventory`)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const arquivo = resolve(root, "apps/site/locales/pt-BR.json");
const catalogo = JSON.parse(readFileSync(arquivo, "utf8"));
const inventario = resolve(root, "dist/locale-inventory.json");
const emPortugues = new Set(existsSync(inventario) ? JSON.parse(readFileSync(inventario, "utf8")).messages.filter((m) => m.language === "pt-BR").map((m) => m.source) : []);

const linhas = (s) => (s.match(/\n/gu) ?? []).length;
const mudancas = { vazamento: 0, codigo: 0, portugues: 0 };
for (const [origem, traducao] of Object.entries(catalogo)) {
  let nova = traducao;
  if (emPortugues.has(origem)) {
    nova = origem;
    if (nova !== traducao) mudancas.portugues += 1;
  } else if (/\{\d+\}/u.test(origem) && !/\s/u.test(origem.replace(/\{\d+\}/gu, ""))) {
    nova = origem;
    if (nova !== traducao) mudancas.codigo += 1;
  } else if (linhas(traducao) > linhas(origem)) {
    const partes = traducao.split("\n");
    nova = partes.slice(0, linhas(origem) + 1).join("\n");
    mudancas.vazamento += 1;
  }
  catalogo[origem] = nova;
}
writeFileSync(arquivo, JSON.stringify(catalogo, null, 2) + "\n");
console.log(JSON.stringify(mudancas));
