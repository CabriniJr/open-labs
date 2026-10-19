import { z } from "zod";
import { CORPO_COMUM, CorSchema, IdSchema } from "./schema.js";
import { conferirHandbook } from "./conferir.js";
import { conferirArtigos, type ArquivoDeArtigo } from "./artigos.js";
import { recusaDeVersao, VERSOES_EM_ARQUIVO, type HandbookNormalizado } from "./versoes.js";
import { AssessmentSetSchema, validateAssessments, type AssessmentSet } from "./assessments.js";

export const VERSAO_DO_PACOTE = "openlabs/bundle/v1" as const;
export const VERSAO_DO_PACOTE_COM_AVALIACOES = "openlabs/bundle/v2" as const;
export const VERSOES_DO_PACOTE = [VERSAO_DO_PACOTE, VERSAO_DO_PACOTE_COM_AVALIACOES] as const;
const tintas = { acento: CorSchema, fluxo: CorSchema, descarte: CorSchema, ok: CorSchema, mutacao: CorSchema, processador: CorSchema, conduite: CorSchema, especies: z.tuple([CorSchema, CorSchema, CorSchema, CorSchema]) };
const { theme: _theme, maintainers, ...comum } = CORPO_COMUM;

/** O v1 já exportava o manifesto NORMALIZADO. Preservamos esse wire format. */
const HandbookDoPacote = z.object({
  ...comum,
  apiVersion: z.string(),
  mantenedores: maintainers,
  tema: z.object({ claro: z.object(tintas).strict(), escuro: z.object(tintas).partial().strict() }).strict(),
}).strict().transform(({ reference, tema, ...h }): HandbookNormalizado => ({
  ...h,
  ...(reference === undefined ? {} : { reference }),
  tema: { claro: tema.claro, escuro: Object.fromEntries(Object.entries(tema.escuro).filter(([, value]) => value !== undefined)) },
}));

const PacoteBaseSchema = z.object({
  exportedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "exportedAt deve ser uma data ISO válida"),
  handbook: HandbookDoPacote,
  articles: z.array(z.object({ id: IdSchema, markdown: z.string() }).strict()),
}).strict();
const PacoteSchema = z.discriminatedUnion("bundleVersion", [
  PacoteBaseSchema.extend({ bundleVersion: z.literal(VERSAO_DO_PACOTE) }),
  PacoteBaseSchema.extend({ bundleVersion: z.literal(VERSAO_DO_PACOTE_COM_AVALIACOES), assessments: AssessmentSetSchema }),
]);

export type PacoteDeHandbook = z.infer<typeof PacoteBaseSchema> & { bundleVersion: typeof VERSOES_DO_PACOTE[number]; assessments?: AssessmentSet };
export type LeituraDePacote = { readonly ok: true; readonly value: PacoteDeHandbook } | { readonly ok: false; readonly errors: readonly string[] };

/** Não usa filesystem, Astro, fetch, relógio ou execução de código recebido. */
export function lerPacote(doc: unknown): LeituraDePacote {
  const version = typeof doc === "object" && doc !== null && "bundleVersion" in doc ? doc.bundleVersion : undefined;
  if (!VERSOES_DO_PACOTE.includes(version as typeof VERSOES_DO_PACOTE[number])) return { ok: false, errors: [`bundleVersion "${String(version)}" não é suportada. Esta release lê ${VERSOES_DO_PACOTE.join(", ")}; atualize o leitor para um formato mais novo.`] };
  const rawHandbook = typeof doc === "object" && doc !== null && "handbook" in doc ? doc.handbook : undefined;
  const apiVersion = typeof rawHandbook === "object" && rawHandbook !== null && "apiVersion" in rawHandbook ? rawHandbook.apiVersion : undefined;
  if (!VERSOES_EM_ARQUIVO.some((v) => v.apiVersion === apiVersion)) return { ok: false, errors: [recusaDeVersao(apiVersion)] };
  const parsed = PacoteSchema.safeParse(doc);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`) };
  const pacote = parsed.data;
  const errors = [...conferirHandbook(pacote.handbook), ...conferirArtigos(pacote.handbook, pacote.articles)];
  if ("assessments" in pacote) errors.push(...validateAssessments(pacote.assessments, pacote.handbook));
  return errors.length ? { ok: false, errors } : { ok: true, value: pacote };
}

/** O exportador usa o MESMO leitor que o consumidor. Sem formato paralelo. */
export function criarPacote(handbook: HandbookNormalizado, articles: readonly ArquivoDeArtigo[], exportedAt: string, assessments?: AssessmentSet): PacoteDeHandbook {
  const lido = lerPacote({ bundleVersion: assessments ? VERSAO_DO_PACOTE_COM_AVALIACOES : VERSAO_DO_PACOTE, exportedAt, handbook, articles: [...articles].sort((a, b) => a.id.localeCompare(b.id)), ...(assessments ? { assessments } : {}) });
  if (!lido.ok) throw new Error(lido.errors.join("\n"));
  return lido.value;
}

/** Dependências que a instalação precisa resolver: o bundle NÃO leva o lab. */
export function labsExigidos(pacote: Pick<PacoteDeHandbook, "handbook">): readonly { readonly id: string; readonly href: string }[] {
  return pacote.handbook.labs.filter((l) => l.status === "available" && l.href !== undefined).map((l) => ({ id: l.id, href: l.href! }));
}
