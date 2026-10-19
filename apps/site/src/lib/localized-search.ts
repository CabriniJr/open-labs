import type { Language } from "./localize-text.js";

export interface SearchPage { path: string; title: string; text: string; original: string }
export interface SearchIndex { searchVersion: 1; language: Language; pages: SearchPage[] }
const normalize = (value: string) => value.toLocaleLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
export function searchLocalized(index: SearchIndex, query: string) {
  const phrase = /^"(.*)"$/u.exec(query.trim());
  const terms = phrase ? [normalize(phrase[1]!)] : normalize(query).split(/\s+/u).filter(Boolean);
  if (!terms.length) return [];
  return index.pages.map((page) => {
    const title = normalize(page.title), text = normalize(page.text), original = normalize(page.original);
    const all = `${title} ${text} ${original}`;
    const score = terms.every((t) => all.includes(t)) ? terms.reduce((n, t) => n + (title.includes(t) ? 10 : 0) + (text.includes(t) ? 3 : 1), 0) : 0;
    const at = Math.max(0, text.indexOf(terms[0]!) - 90);
    return { ...page, score, excerpt: (at ? "…" : "") + page.text.slice(at, at + 250) + (at + 250 < page.text.length ? "…" : "") };
  }).filter((page) => page.score > 0).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, index.language)).slice(0, 8);
}
