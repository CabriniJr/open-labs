import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { OVERRIDES } from "../apps/site/src/locales/overrides.ts";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const inventory = JSON.parse(readFileSync(resolve(root, "dist/locale-inventory.json"), "utf8"));
const slots = (s) => [...s.matchAll(/\{\d+\}/gu)].map((m) => m[0]).sort().join("|");
const errors = [];
for (const language of ["en", "pt-BR"]) {
  const data = JSON.parse(readFileSync(resolve(root, `apps/site/locales/${language}.json`), "utf8"));
  const messages = { ...data, ...OVERRIDES[language] };
  for (const [source, translation] of Object.entries(messages)) {
    if (typeof translation !== "string" || !translation.trim()) errors.push(`${language}: empty translation for ${source.slice(0, 80)}`);
    if (slots(source) !== slots(translation)) errors.push(`${language}: interpolation changed: ${source.slice(0, 80)}`);
    if (/__OLTOKEN|\[OL\d{6}\]/u.test(translation)) errors.push(`${language}: internal translation marker: ${source.slice(0, 80)}`);
  }
  for (const item of inventory.messages) if (item.language !== language && !messages[item.source]) errors.push(`${language}: missing ${item.source.slice(0, 100)}`);
}
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log(`✓ ${inventory.messages.length} inventoried source messages covered; both locales preserve interpolation.`);
