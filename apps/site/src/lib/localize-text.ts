export type Language = "en" | "pt-BR";
export type Messages = Readonly<Record<string, string>>;
export const normalizeMessage = (value: string) => value.replace(/\s+/gu, " ").trim();
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
interface Pattern { match: RegExp; target: string; slots: number[]; prefix: string }
const compiled = new WeakMap<Messages, Pattern[]>();

function patterns(messages: Messages): Pattern[] {
  let result = compiled.get(messages); if (result) return result;
  result = Object.entries(messages).filter(([source]) => /\{\d+\}/u.test(source)).map(([source, target]) => {
    const slots: number[] = []; let end = 0, regex = "^";
    for (const match of source.matchAll(/\{(\d+)\}/gu)) { regex += escape(source.slice(end, match.index)) + "(.+?)"; slots.push(Number(match[1])); end = match.index! + match[0].length; }
    regex += escape(source.slice(end)) + "$"; return { match: new RegExp(regex, "u"), target, slots, prefix: source.slice(0, source.indexOf("{")) };
  }).sort((a, b) => b.match.source.length - a.match.source.length);
  compiled.set(messages, result); return result;
}

/**
 * Text only. No keys, HTML, code, URLs or author input are evaluated/rewritten.
 *
 * A pattern's slots are translated too: a model composes sentences out of
 * sentences ("R1 drops it at {0}: {1}", where `{1}` is the rule's reason), and
 * translating only the frame left half the sentence in the source language.
 * The depth limit keeps a slot from being re-read as the frame it came from.
 */
export function localizeText(value: string, messages: Messages, depth = 0): string {
  const source = normalizeMessage(value); if (!source || !/[\p{L}]/u.test(source)) return value;
  let translated = messages[source];
  if (translated === undefined) for (const pattern of patterns(messages)) {
    if (!source.startsWith(pattern.prefix)) continue;
    const found = pattern.match.exec(source); if (!found) continue;
    const slot = (text: string) => (depth < 3 ? localizeText(text, messages, depth + 1) : text);
    const values = new Map(pattern.slots.map((n, index) => [n, slot(found[index + 1]!)]));
    translated = pattern.target.replace(/\{(\d+)\}/gu, (_, slot: string) => values.get(Number(slot)) ?? `{${slot}}`); break;
  }
  if (translated === undefined || translated === source) return value;
  return (value.match(/^\s*/u)?.[0] ?? "") + translated + (value.match(/\s*$/u)?.[0] ?? "");
}
