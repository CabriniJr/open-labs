import { localizeText, normalizeMessage, type Language, type Messages } from "./localize-text.js";
import { OVERRIDES } from "../locales/overrides.js";

export const LANGUAGE_KEY = "openlabs-language-v1";
const subscribers = new Set<() => void>();
let language: Language = "en", messages: Messages = {}, started = false, generation = 0;
const cache = new Map<Language, Messages>();
const textSources = new WeakMap<Node, { source: string; shown: string }>();
const attributeSources = new WeakMap<Element, Map<string, { source: string; shown: string }>>();
const uncommittedIsland = 'astro-island[ssr],astro-island:not([client="only"]):not([data-locale-hydrated])';
const skip = `script,style,pre,code,kbd,samp,textarea,[contenteditable=true],[translate=no],[data-no-translate],${uncommittedIsland}`;
let scheduled = false;
const pending = new Set<Node>();

export function getLanguage(): Language { return language; }
export const subscribeLanguage = (listener: () => void) => { subscribers.add(listener); return () => { subscribers.delete(listener); }; };
export function translate(value: string): string { return localizeText(value, messages); }

/** React ref/effect signals a committed tree; Astro removes `ssr` before that. */
export function localeReady(node: HTMLElement | null): void {
  node?.closest("astro-island")?.setAttribute("data-locale-hydrated", "true");
}

async function load(lang: Language) {
  if (cache.has(lang)) return cache.get(lang)!;
  const module = lang === "en" ? await import("../../locales/en.json") : await import("../../locales/pt-BR.json");
  const result: Messages = { ...module.default, ...OVERRIDES[lang] }; cache.set(lang, result); return result;
}
function excluded(element: Element | null): boolean { return !!element?.closest(skip); }
function text(node: Node) {
  if (!node.parentElement || excluded(node.parentElement)) return;
  const value = node.nodeValue ?? ""; let entry = textSources.get(node);
  if (!entry || (value !== entry.shown && value !== entry.source)) { entry = { source: value, shown: value }; textSources.set(node, entry); }
  const next = localizeText(entry.source, messages); entry.shown = next;
  if (next !== value) node.nodeValue = next;
}
const attributes = ["aria-label", "aria-description", "title", "placeholder", "alt"];
function element(el: Element) {
  if (el.closest(`script,style,[contenteditable=true],[translate=no],[data-no-translate],${uncommittedIsland}`)) return;
  const names = el.matches("meta[name=description],meta[property='og:title'],meta[property='og:description']") ? [...attributes, "content"] : attributes;
  let entries = attributeSources.get(el); if (!entries) { entries = new Map(); attributeSources.set(el, entries); }
  for (const name of names) {
    const value = el.getAttribute(name); if (value === null) continue;
    let entry = entries.get(name);
    if (!entry || (value !== entry.source && value !== entry.shown)) { entry = { source: value, shown: value }; entries.set(name, entry); }
    const next = localizeText(entry.source, messages); entry.shown = next; if (next !== value) el.setAttribute(name, next);
  }
}
function paint(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) { text(root); return; }
  if (root instanceof Element) { element(root); if (excluded(root)) return; }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, { acceptNode(node) { if (node instanceof Element) { element(node); if (excluded(node)) return NodeFilter.FILTER_REJECT; } return NodeFilter.FILTER_ACCEPT; } });
  for (let node; (node = walker.nextNode());) if (node.nodeType === Node.TEXT_NODE) text(node);
}
function schedule(root: Node) {
  pending.add(root); if (scheduled) return; scheduled = true;
  queueMicrotask(() => { scheduled = false; const roots = [...pending]; pending.clear(); for (const node of roots) if (node.isConnected) paint(node); });
}

export async function setLanguage(next: Language): Promise<{ persisted: boolean }> {
  const request = ++generation, loaded = await load(next); if (request !== generation) return { persisted: false };
  language = next; messages = loaded; document.documentElement.lang = next; document.documentElement.dataset.locale = next;
  let persisted = true; try { localStorage.setItem(LANGUAGE_KEY, next); } catch { persisted = false; }
  paint(document.documentElement); subscribers.forEach((listener) => listener());
  document.dispatchEvent(new CustomEvent("openlabs:language", { detail: next }));
  document.documentElement.dataset.localeReady = "true";
  return { persisted };
}

export async function startI18n() {
  if (started || typeof document === "undefined") return; started = true;
  try { const theme = localStorage.getItem("ovh-theme"); if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme; } catch { /* Respect system appearance. */ }
  let preferred: Language = navigator.language.toLowerCase().startsWith("pt") ? "pt-BR" : "en";
  try { const saved = localStorage.getItem(LANGUAGE_KEY); if (saved === "en" || saved === "pt-BR") preferred = saved; } catch { /* Session-only choice remains usable. */ }
  const observer = new MutationObserver((changes) => {
    for (const change of changes) {
      if (change.type === "characterData") schedule(change.target);
      if (change.type === "childList") for (const node of change.addedNodes) schedule(node);
      if (change.type === "attributes") schedule(change.target);
    }
  });
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...attributes, "content", "ssr", "data-locale-hydrated"] });
  try { await setLanguage(preferred); }
  catch { document.documentElement.dataset.localeReady = "false"; }
}

/** Coverage tools use the same normalization as the live DOM. */
export { normalizeMessage };
