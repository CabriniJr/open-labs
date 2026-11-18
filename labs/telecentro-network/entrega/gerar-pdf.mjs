#!/usr/bin/env node
// Gera o PDF de entrega da disciplina de Network a partir da página
// /labs/telecentro-network/entrega/, que é montada pelo mesmo modelo do lab e
// traz os prints e as running-configs reais do telecentro-equipe-10.pkt.
//
// Uso (com o site rodando em outro terminal: `pnpm dev`):
//   node labs/telecentro-network/entrega/gerar-pdf.mjs [endereço-do-site] [--sem-equipe]
//
// Nomes e RMs não ficam no repositório. Se existir um equipe.json local
// (nesta pasta ou em database/entrega/, ambos fora do git) com
//   { "equipe": "...", "integrantes": [["Nome", "RM"], ...] }
// o PDF sai com a capa preenchida (GS-Network.pdf). Sem ele, o campo fica em
// amarelo e o arquivo se chama GS-Network-rascunho.pdf (--sem-equipe gera essa
// versão mesmo com o equipe.json presente). Nenhum dos dois PDFs vai para o git.
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, "..", "..", "..");
const require = createRequire(join(raiz, "apps", "site", "package.json"));
const { chromium } = require("@playwright/test");

const args = process.argv.slice(2);
const site = (args.find((a) => !a.startsWith("--")) ?? "http://localhost:4321/").replace(/\/?$/u, "/");
const arquivoDaEquipe = args.includes("--sem-equipe") ? undefined : [join(aqui, "equipe.json"), join(raiz, "database", "entrega", "equipe.json")].find((f) => existsSync(f));
const equipe = arquivoDaEquipe ? JSON.parse(readFileSync(arquivoDaEquipe, "utf8")) : undefined;
const destino = join(aqui, equipe ? "GS-Network.pdf" : "GS-Network-rascunho.pdf");

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const resposta = await page.goto(`${site}labs/telecentro-network/entrega/`, { waitUntil: "networkidle" });
  if (!resposta?.ok()) throw new Error(`a página respondeu ${resposta?.status()} — o site está no ar em ${site}?`);
  if (equipe) {
    await page.evaluate(({ nome, integrantes }) => {
      const dd = document.querySelector("[data-equipe-integrantes]");
      if (dd) dd.innerHTML = integrantes.map(([n, rm]) => `${n} — RM ${rm}`).join("<br>");
      const span = document.querySelector("[data-equipe-nome]");
      if (span && nome) span.textContent = `${nome} · `;
    }, { nome: equipe.equipe, integrantes: equipe.integrantes });
  }
  // As imagens dos testes carregam sob demanda: rola até o fim para que todas entrem no PDF.
  await page.evaluate(async () => {
    for (const img of document.querySelectorAll("img")) img.loading = "eager";
    await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((ok) => { img.onload = img.onerror = ok; }))));
  });
  await page.emulateMedia({ media: "print" });
  await page.pdf({
    path: destino,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: `<div style="width:100%;font-size:8px;color:#777;text-align:center;font-family:sans-serif">Network Architect Solutions · página <span class="pageNumber"></span> de <span class="totalPages"></span></div>`,
  });
  console.log(`✓ ${destino}${equipe ? ` (equipe de ${arquivoDaEquipe})` : " (sem equipe.json: integrantes em amarelo)"}`);
} finally {
  await browser.close();
}
