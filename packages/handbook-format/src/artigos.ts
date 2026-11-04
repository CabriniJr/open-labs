import { parse } from "yaml";
import { ArtigoSchema, type Artigo } from "./schema.js";
import { conferirArquivosDeArtigo } from "./conferir.js";
import type { HandbookNormalizado } from "./versoes.js";

export interface ArquivoDeArtigo {
  readonly id: string;
  readonly markdown: string;
}

export type LeituraDeArtigo =
  | { readonly ok: true; readonly data: Artigo; readonly body: string }
  | { readonly ok: false; readonly errors: readonly string[] };

/** A mesma régua para o repo, o CLI instalado e um bundle recebido de fora. */
export function lerArtigo(markdown: string): LeituraDeArtigo {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/u.exec(markdown);
  if (!match) return { ok: false, errors: ["artigo sem frontmatter YAML entre linhas ---"] };
  try {
    const lido = ArtigoSchema.strict().safeParse(parse(match[1]!, { uniqueKeys: true, maxAliasCount: 20 }));
    if (!lido.success) return { ok: false, errors: lido.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`) };
    return { ok: true, data: lido.data, body: match[2]! };
  } catch (e) {
    return { ok: false, errors: [`frontmatter YAML inválido: ${e instanceof Error ? e.message : String(e)}`] };
  }
}

export function conferirArtigos(h: HandbookNormalizado, arquivos: readonly ArquivoDeArtigo[]): readonly string[] {
  const problemas = [...conferirArquivosDeArtigo(h, arquivos.map((a) => a.id))];
  const ids = arquivos.map((a) => a.id);
  if (new Set(ids).size !== ids.length) problemas.push("id de arquivo de artigo repetido");

  for (const arquivo of arquivos) {
    const lido = lerArtigo(arquivo.markdown);
    const prefixo = `${arquivo.id}.md: `;
    if (!lido.ok) { problemas.push(...lido.errors.map((e) => prefixo + e)); continue; }
    const { data, body } = lido;
    const item = h.articles.find((a) => a.id === arquivo.id);
    if (data.handbook !== h.id) problemas.push(`${prefixo}handbook deve ser ${h.id}`);
    if (item && (data.title !== item.title || data.phase !== item.phase)) problemas.push(`${prefixo}título e fase devem bater com o manifesto`);
    if (data.lab !== undefined && !h.labs.some((l) => l.status === "available" && l.href === data.lab && l.phase === data.phase)) {
      problemas.push(`${prefixo}lab deve apontar para um lab pronto da mesma fase`);
    }
    const declaradas = data.sources.map((s) => s.id);
    if (new Set(declaradas).size !== declaradas.length) problemas.push(`${prefixo}id de fonte repetido`);
    const citadas = new Set([...body.matchAll(/#src-([a-z0-9-]+)/gu)].map((m) => m[1]!));
    for (const id of declaradas) if (!citadas.has(id)) problemas.push(`${prefixo}fonte "${id}" listada e não citada`);
    for (const id of citadas) if (!declaradas.includes(id)) problemas.push(`${prefixo}citação "${id}" sem fonte declarada`);
    for (const fonte of data.sources) if (fonte.url !== undefined && !fonte.url.startsWith("https://")) problemas.push(`${prefixo}a URL da fonte "${fonte.id}" deve usar https`);
    const linhas = body.split(/\r?\n/u);
    const degraus = linhas.flatMap((l, i) => /^>\s*\[!deeper\]/u.test(l) ? [i] : []);
    if (degraus.length === 0) problemas.push(`${prefixo}precisa de pelo menos um degrau [!deeper]`);
    for (const i of degraus) if (linhas[i + 1]?.trim() !== ">" || !/^>\s*\S/u.test(linhas[i + 2]?.trim() ?? "")) problemas.push(`${prefixo}degrau na linha ${i + 1} precisa de linha em branco e corpo`);
  }
  return problemas;
}
