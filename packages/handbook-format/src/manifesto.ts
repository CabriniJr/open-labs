import { parse, stringify } from "yaml";
import { conferirHandbook } from "./conferir.js";
import { lerDocumento, ManifestoV1Schema, type HandbookNormalizado } from "./versoes.js";

export interface LeituraDeManifesto {
  readonly id: string;
  readonly origem: string;
  readonly handbook?: HandbookNormalizado;
  readonly problemas: readonly string[];
}

/** Texto e contrato somente: compartilhado por CLI, browser e filesystem. */
export function lerManifesto(texto: string, origem: string): LeituraDeManifesto {
  let doc: unknown;
  try { doc = parse(texto, { uniqueKeys: true, maxAliasCount: 20 }); }
  catch (erro) { return { id: origem, origem, problemas: [`YAML inválido: ${erro instanceof Error ? erro.message : String(erro)}`] }; }
  const lido = lerDocumento(doc);
  if (!lido.ok) return { id: origem, origem, problemas: lido.errors };
  const problemas = conferirHandbook(lido.value);
  return problemas.length ? { id: lido.value.id, origem, problemas } : { id: lido.value.id, origem, handbook: lido.value, problemas: [] };
}

/** Volta à fonte editável sem trocar a versão do contrato recebido. */
export function serializarManifesto(h: HandbookNormalizado): string {
  if (h.apiVersion !== "openlabs/handbook/v1") throw new Error(`A edição de ${h.apiVersion} exige um escritor dessa versão.`);
  const theme = (t: Partial<HandbookNormalizado["tema"]["claro"]>) => ({
    ...(t.acento === undefined ? {} : { accent: t.acento }),
    ...(t.fluxo === undefined ? {} : { flow: t.fluxo }),
    ...(t.descarte === undefined ? {} : { dropped: t.descarte }),
    ...(t.ok === undefined ? {} : { ok: t.ok }),
    ...(t.mutacao === undefined ? {} : { mutation: t.mutacao }),
    ...(t.processador === undefined ? {} : { processor: t.processador }),
    ...(t.conduite === undefined ? {} : { conduit: t.conduite }),
    ...(t.especies === undefined ? {} : { species: t.especies }),
  });
  const doc = ManifestoV1Schema.parse({
    apiVersion: h.apiVersion, id: h.id, name: h.name, subject: h.subject,
    tagline: h.tagline, blurb: h.blurb, model: h.model, stage: h.stage,
    maintainers: h.mantenedores, theme: { light: theme(h.tema.claro), dark: theme(h.tema.escuro) },
    phases: h.phases, articles: h.articles, labs: h.labs,
    ...(h.reference === undefined ? {} : { reference: h.reference }),
  });
  return stringify(doc);
}
