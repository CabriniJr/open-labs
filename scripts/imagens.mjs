#!/usr/bin/env node
/**
 * Baixa as imagens curadas dos handbooks e o crédito de cada uma.
 *
 *   node scripts/imagens.mjs            # baixa o que falta
 *   node scripts/imagens.mjs --refresh  # rebaixa tudo
 *
 * Entrada: `apps/site/src/data/imagens.manifest.json`, escrito à mão — a
 * curadoria é a decisão humana: qual arquivo da Wikimedia Commons, o texto
 * alternativo, e o recorte (`focus`).
 *
 * Saída: o JPEG em `apps/site/src/assets/handbooks/<nome>.jpg` (o Astro gera
 * AVIF/WebP em vários tamanhos no build) e `imagens.credits.json`, com autor e
 * licença lidos da API da Commons. O crédito nunca é digitado: digitado, ele
 * envelhece e mente; lido da fonte, ele é a fonte.
 *
 * Só entram licenças que permitem uso com atribuição (CC BY, CC BY-SA, CC0,
 * domínio público). Outra licença faz o script parar com o nome do arquivo.
 *
 * Rede: commons.wikimedia.org e upload.wikimedia.org. A API limita clientes
 * anônimos; o script espera o `retry-after` em vez de insistir. Atrás de proxy
 * no Node ≥ 22.21: `NODE_USE_ENV_PROXY=1`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const site = resolve(root, "apps/site");
const sharp = createRequire(resolve(site, "package.json"))("sharp");
const manifestPath = resolve(site, "src/data/imagens.manifest.json");
const creditsPath = resolve(site, "src/data/imagens.credits.json");
const assets = resolve(site, "src/assets/handbooks");
const refresh = process.argv.includes("--refresh");

const UA = { "User-Agent": "OpenLabsImages/1.0 (curated handbook images; low volume)" };
const ALLOWED = /^(cc[ -]by(-sa)?[ -][\d.]+|cc0|pd|public domain)/iu;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const plain = (html = "") => html
  .replace(/<[^>]+>/gu, "")
  .replace(/&(#\d+|#x[\da-f]+|[a-z]+);/giu, (m, e) => e[0] === "#" ? String.fromCodePoint(Number(e[1] === "x" ? `0${e.slice(1)}` : e.slice(1))) : (ENTITIES[e.toLowerCase()] ?? m))
  .replace(/\s+/gu, " ").trim();

async function get(url) {
  for (let i = 0; i < 12; i++) {
    const r = await fetch(url, { headers: UA });
    if (r.status !== 429) {
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return r;
    }
    const wait = Number(r.headers.get("retry-after") ?? 30) + 3;
    console.error(`  limite da API — esperando ${wait}s`);
    await sleep(wait * 1000);
  }
  throw new Error(`desisti depois de 12 recusas: ${url}`);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const credits = existsSync(creditsPath) ? JSON.parse(readFileSync(creditsPath, "utf8")) : {};

for (const [name, entry] of Object.entries(manifest)) {
  const out = resolve(assets, `${name}.jpg`);
  if (!refresh && existsSync(out) && credits[name]?.file === entry.file && credits[name]?.author === (entry.credit ?? credits[name]?.authorSource ?? credits[name]?.author)) continue;
  const width = name.endsWith("/hero") ? 1920 : 1280;
  const api = "https://commons.wikimedia.org/w/api.php?" + new URLSearchParams({
    action: "query", format: "json", titles: entry.file, prop: "imageinfo",
    iiprop: "url|size|extmetadata", iiurlwidth: String(width),
  });
  const page = Object.values((await (await get(api)).json()).query.pages)[0];
  const info = page?.imageinfo?.[0];
  if (!info) throw new Error(`${name}: arquivo não encontrado na Commons — ${entry.file}`);
  const meta = info.extmetadata;
  const license = meta.LicenseShortName?.value ?? "";
  if (!ALLOWED.test(license)) throw new Error(`${name}: licença "${license}" não permite reuso com atribuição — ${entry.file}`);

  const raw = Buffer.from(await (await get(info.thumburl)).arrayBuffer());
  mkdirSync(dirname(out), { recursive: true });
  // Foto de detalhe fino (die shot, tecido) comprime mal: desce a qualidade em
  // degraus até caber no orçamento, em vez de deixar o repositório engordar.
  let jpeg;
  for (const quality of [80, 74, 68, 62]) {
    jpeg = await sharp(raw).rotate().resize({ width, withoutEnlargement: true }).jpeg({ quality, mozjpeg: true }).toBuffer();
    if (jpeg.length <= 500_000) break;
  }
  writeFileSync(out, jpeg);

  credits[name] = {
    file: entry.file,
    alt: entry.alt,
    // `credit` no manifesto só arruma o texto que a API devolve (uma URL no
    // lugar do nome, "(talk)", o histórico de obra derivada). Quem é o autor
    // não muda: o original fica em `authorSource`, e o teste confere que o
    // nome dele continua dentro do crédito arrumado.
    author: entry.credit ?? (plain(meta.Artist?.value) || "Unknown author"),
    ...(entry.credit ? { authorSource: plain(meta.Artist?.value) } : {}),
    license,
    licenseUrl: meta.LicenseUrl?.value,
    source: info.descriptionurl,
    ...(entry.focus ? { focus: entry.focus } : {}),
  };
  console.log(`✓ ${name} — ${credits[name].author} · ${license}`);
  await sleep(1500);
}

// A limpeza vale também para o que já estava gravado.
for (const c of Object.values(credits)) { c.author = plain(c.author); if (c.authorSource) c.authorSource = plain(c.authorSource); }
// Sem imagem órfã: o que saiu do manifesto sai do crédito também.
for (const name of Object.keys(credits)) if (!Object.hasOwn(manifest, name)) delete credits[name];
const sorted = Object.fromEntries(Object.entries(credits).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(creditsPath, `${JSON.stringify(sorted, null, 2)}\n`);
console.log(`${Object.keys(sorted).length} imagens com crédito.`);
