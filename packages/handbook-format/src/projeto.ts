import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { lerManifesto, NOME_DO_MANIFESTO } from "./ler.js";
import { conferirArtigos, type ArquivoDeArtigo } from "./artigos.js";
import type { HandbookNormalizado } from "./versoes.js";

export interface LeituraDeProjeto {
  readonly origem: string;
  readonly handbook?: HandbookNormalizado;
  readonly articles: readonly ArquivoDeArtigo[];
  readonly problemas: readonly string[];
}

/** Projeto externo: handbook.yaml + articles/. Não conhece a árvore do site. */
export function lerProjeto(dir: string): LeituraDeProjeto {
  const origem = join(dir, NOME_DO_MANIFESTO);
  if (!existsSync(origem)) return { origem, articles: [], problemas: [`não achei ${origem}`] };
  const lido = lerManifesto(readFileSync(origem, "utf8"), origem);
  const pasta = join(dir, "articles");
  const articles = existsSync(pasta) ? readdirSync(pasta).filter((f) => f.endsWith(".md")).sort().map((f) => ({ id: f.slice(0, -3), markdown: readFileSync(join(pasta, f), "utf8") })) : [];
  const problemas = [...lido.problemas, ...(lido.handbook ? conferirArtigos(lido.handbook, articles) : [])];
  return { origem, articles, problemas, ...(lido.handbook === undefined ? {} : { handbook: lido.handbook }) };
}
