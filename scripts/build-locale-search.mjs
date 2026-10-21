import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { localizeText } from "../apps/site/src/lib/localize-text.ts";
import { OVERRIDES } from "../apps/site/src/locales/overrides.ts";

const root = resolve(fileURLToPath(new URL("..", import.meta.url))), dist = join(root, "apps/site/dist");
const html = readdirSync(join(dist, "docs"), { recursive: true, withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith(".html")).map((e) => join(e.parentPath, e.name));
for (const lang of ["en", "pt-BR"]) {
  const messages = { ...JSON.parse(readFileSync(join(root, `apps/site/locales/${lang}.json`), "utf8")), ...OVERRIDES[lang] };
  const other = lang === "en" ? "pt-BR" : "en";
  const alternate = { ...JSON.parse(readFileSync(join(root, `apps/site/locales/${other}.json`), "utf8")), ...OVERRIDES[other] };
  const pages = html.map((file) => {
    const doc = new JSDOM(readFileSync(file, "utf8")).window.document;
    const title = localizeText(doc.querySelector("h1")?.textContent ?? doc.title, messages);
    for (const el of doc.querySelectorAll("script,style,nav,aside,[data-pagefind-ignore]")) el.remove();
    const body = doc.querySelector("[data-pagefind-body]") ?? doc.querySelector("main");
    const chunks = [], original = [], otherChunks = [];
    if (body) {
      const walker = doc.createTreeWalker(body, 4);
      for (let node; (node = walker.nextNode());) { const value = node.nodeValue.replace(/\s+/gu, " ").trim(); if (!value) continue; original.push(value); const code = node.parentElement?.closest("pre,code,kbd,samp"); chunks.push(code ? value : localizeText(value, messages)); otherChunks.push(code ? value : localizeText(value, alternate)); }
    }
    return { path: relative(dist, file).replace(/index\.html$/u, "").replaceAll("\\", "/"), title, text: chunks.join(" "), original: original.join(" ") + " " + otherChunks.join(" ") };
  });
  mkdirSync(join(dist, "search"), { recursive: true });
  writeFileSync(join(dist, `search/${lang}.json`), JSON.stringify({ searchVersion: 1, language: lang, pages }) + "\n");
  console.log(`✓ ${lang}: ${pages.length} localized search pages`);
}
