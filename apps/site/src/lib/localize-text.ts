export type Language = "en" | "pt-BR";
export type Messages = Readonly<Record<string, string>>;
export const normalizeMessage = (value: string) => value.replace(/\s+/gu, " ").trim();
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
interface Pattern { match: RegExp; target: string; slots: number[]; prefix: string; weak: boolean }
const compiled = new WeakMap<Messages, Pattern[]>();

function patterns(messages: Messages): Pattern[] {
  let result = compiled.get(messages); if (result) return result;
  result = Object.entries(messages).filter(([source]) => /\{\d+\}/u.test(source)).map(([source, target]) => {
    const slots: number[] = []; let end = 0, regex = "^";
    for (const match of source.matchAll(/\{(\d+)\}/gu)) { regex += escape(source.slice(end, match.index)) + "(.+?)"; slots.push(Number(match[1])); end = match.index! + match[0].length; }
    regex += escape(source.slice(end)) + "$";
    const weak = (source.replace(/\{\d+\}/gu, " ").match(/\p{L}+/gu) ?? []).length <= 1;
    return { match: new RegExp(regex, "u"), target, slots, prefix: source.slice(0, source.indexOf("{")), weak };
  }).sort((a, b) => b.match.source.length - a.match.source.length);
  compiled.set(messages, result); return result;
}

/**
 * Um valor que o modelo encaixa: número, id, endereço, arquivo, sigla, medida
 * ("13.3 KiB"). Cada pedaço entre espaços precisa ser um desses; palavra comum
 * é frase, e o ponto final de uma frase não a faz virar nome de arquivo
 * ("a{0}" casava com "an application is…").
 */
const codeToken = (token: string) => !/\p{L}/u.test(token) || /[\d_./:\\#@=<>()[\]{}-]/u.test(token) || /^[\p{Lu}\d]+$/u.test(token);
const codeLike = (value: string) => value.split(/\s+/u).every((token) => codeToken(token) || (/\d/u.test(value) && /^\p{L}{1,3}$/u.test(token)));

/**
 * Uma moldura de uma palavra só ("{0} in", "only {0}", "{0} of {1}") casa com
 * frase comum demais: "Zoom in" virava "Zoom em" e "Keep the circuit open",
 * "Keep the circuit abertos". No nível de fora, uma moldura fraca só vale se
 * cada lacuna for valor (número, id, sigla) ou frase que o catálogo conhece.
 * Dentro de outra moldura o contexto já foi validado e a regra relaxa.
 */
function plausible(pattern: Pattern, found: RegExpExecArray, messages: Messages, depth: number): boolean {
  if (!pattern.weak || depth > 0) return true;
  return pattern.slots.every((_, index) => { const value = normalizeMessage(found[index + 1]!); return codeLike(value) || messages[value] !== undefined; });
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
    const found = pattern.match.exec(source); if (!found || !plausible(pattern, found, messages, depth)) continue;
    const slot = (text: string) => (depth < 3 ? localizeText(text, messages, depth + 1) : text);
    const values = new Map(pattern.slots.map((n, index) => [n, slot(found[index + 1]!)]));
    translated = pattern.target.replace(/\{(\d+)\}/gu, (_, slot: string) => values.get(Number(slot)) ?? `{${slot}}`); break;
  }
  if (translated === undefined || translated === source) return value;
  return (value.match(/^\s*/u)?.[0] ?? "") + translated + (value.match(/\s*$/u)?.[0] ?? "");
}
