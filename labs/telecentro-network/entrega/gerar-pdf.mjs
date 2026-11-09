#!/usr/bin/env node
// Gera o PDF de entrega da disciplina de Network a partir da página
// /labs/telecentro-network/entrega/, que é montada pelo mesmo modelo do lab.
//
// Uso (com o site rodando em outro terminal: `pnpm dev`):
//   node labs/telecentro-network/entrega/gerar-pdf.mjs [endereço-do-site]
//
// O PDF sai nesta pasta. Ele é um rascunho: os campos em amarelo e os quadros
// de print são da equipe. Também dá para abrir a página e usar Ctrl+P.
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(aqui, "..", "..", "..", "apps", "site", "package.json"));
const { chromium } = require("@playwright/test");

const site = (process.argv[2] ?? "http://localhost:4321/").replace(/\/?$/u, "/");
const destino = join(aqui, "GS-Network-rascunho.pdf");

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const resposta = await page.goto(`${site}labs/telecentro-network/entrega/`, { waitUntil: "networkidle" });
  if (!resposta?.ok()) throw new Error(`a página respondeu ${resposta?.status()} — o site está no ar em ${site}?`);
  await page.emulateMedia({ media: "print" });
  await page.pdf({ path: destino, format: "A4", printBackground: true, preferCSSPageSize: true });
  console.log(`✓ ${destino}`);
} finally {
  await browser.close();
}
