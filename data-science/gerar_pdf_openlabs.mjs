#!/usr/bin/env node
// Gera o anexo "a análise no OpenLabs" (GS-Data-Science-OpenLabs.pdf) a partir da
// página /labs/who-comes-back/entrega/, que é montada pelo mesmo pacote que roda o lab.
//
// Uso, com o site no ar (`pnpm dev`, ou `pnpm --filter @ovh/site preview` depois do build):
//   node data-science/gerar_pdf_openlabs.mjs [endereço-do-site] [--capturas]
//
// --capturas refaz as figuras em apps/site/public/data-science/: os capítulos do
// showcase vêm das fotos do `pnpm qa:labs --only=labs/who-comes-back/` e a da
// simulação é tirada aqui, do site no ar. Depois de refazê-las, rode o build de novo.
//
// Nomes e RMs vêm do equipe.json local (data-science/entrega/ ou database/entrega/,
// fora do git). Sem ele, o campo fica em amarelo e o arquivo sai como rascunho.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, "..");
const require = createRequire(join(raiz, "apps", "site", "package.json"));
const { chromium } = require("@playwright/test");

const args = process.argv.slice(2);
const site = (args.find((a) => !a.startsWith("--")) ?? "http://localhost:4321/").replace(/\/?$/u, "/");
const arquivoDaEquipe = [join(aqui, "entrega", "equipe.json"), join(raiz, "database", "entrega", "equipe.json")].find((f) => existsSync(f));
const equipe = arquivoDaEquipe ? JSON.parse(readFileSync(arquivoDaEquipe, "utf8")) : undefined;
mkdirSync(join(aqui, "entrega"), { recursive: true });
const destino = join(aqui, "entrega", equipe ? "GS-Data-Science-OpenLabs.pdf" : "GS-Data-Science-OpenLabs-rascunho.pdf");
const figuras = join(raiz, "apps", "site", "public", "data-science");

const browser = await chromium.launch();
try {
  if (args.includes("--capturas")) {
    mkdirSync(figuras, { recursive: true });
    const shots = join(raiz, "apps", "site", "qa-report", "shots");
    for (const [cap, nome] of [["01", "dados"], ["03", "reta"], ["04", "curva"], ["05", "matriz"]]) {
      const de = join(shots, `who-comes-back-desktop-player0-flat-cap${cap}.png`);
      if (!existsSync(de)) throw new Error(`falta ${de}: rode pnpm qa:labs --only=labs/who-comes-back/ antes`);
      copyFileSync(de, join(figuras, `showcase-${nome}.png`));
    }
    const p = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: "en-US" });
    await p.goto(`${site}labs/who-comes-back/`, { waitUntil: "networkidle" });
    await p.getByRole("tab", { name: /Simulation|Simulação/ }).click();
    const sim = p.getByTestId("return-sim");
    await sim.getByTestId("return-linear").waitFor();
    await sim.screenshot({ path: join(figuras, "simulacao.png") });
    console.log(`✓ figuras em ${figuras}`);
  }

  const page = await browser.newPage();
  const resposta = await page.goto(`${site}labs/who-comes-back/entrega/`, { waitUntil: "networkidle" });
  if (!resposta?.ok()) throw new Error(`a página respondeu ${resposta?.status()} — o site está no ar em ${site}?`);
  if (equipe) {
    await page.evaluate(({ nome, integrantes }) => {
      const dd = document.querySelector("[data-equipe-integrantes]");
      if (dd) dd.innerHTML = [...integrantes].sort((a, b) => a[0].localeCompare(b[0], "pt-BR")).map(([n, rm]) => `${n} — RM ${rm}`).join("<br>");
      const eq = document.querySelector("[data-equipe-nome]");
      if (eq && nome) eq.textContent = nome;
    }, { nome: equipe.equipe, integrantes: equipe.integrantes });
  }
  await page.evaluate(async () => {
    for (const img of document.querySelectorAll("img")) img.loading = "eager";
    await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((ok) => { img.onload = img.onerror = ok; }))));
  });
  await page.emulateMedia({ media: "print" });
  await page.pdf({
    path: destino,
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    margin: { top: "14mm", bottom: "16mm", left: "12mm", right: "12mm" },
    headerTemplate: "<span></span>",
    footerTemplate: `<div style="width:100%;font-size:8px;color:#777;text-align:center;font-family:sans-serif">Data Science &amp; Statistical Computing · OpenLabs no Telecentro · página <span class="pageNumber"></span> de <span class="totalPages"></span></div>`,
  });
  console.log(`✓ ${destino}${equipe ? ` (equipe de ${arquivoDaEquipe})` : " (sem equipe.json: integrantes em amarelo)"}`);
} finally {
  await browser.close();
}
