import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

/**
 * Os documentos moram em `docs/`, na raiz do repositório, porque também são
 * lidos lá — pelo Luigi, pelo git, por quem clona. O site os consome onde eles
 * estão em vez de manter uma cópia, que divergiria na primeira semana.
 */
const docs = defineCollection({
  loader: glob({
    pattern: ["*.md", "superpowers/specs/*.md", "superpowers/plans/*.md"],
    base: "../../docs",
    // Sem isto o Astro gera o id "slugificado" (DECISIONS -> decisions), e o
    // manifesto, que nomeia os arquivos como eles são no repositório, deixaria
    // de casar — em silêncio, porque a página simplesmente não nasceria.
    generateId: ({ entry }) => entry.replace(/\.md$/, ""),
  }),
  // Permissivo de propósito: os documentos não têm frontmatter e não vão
  // ganhar. Quem carrega a taxonomia é `src/data/docs-index.ts`.
  schema: z.object({}).passthrough(),
});

/**
 * Um artigo é a teoria do assunto, e ele mora numa coleção própria porque não é
 * documentação de projeto: `docs/` é em português e fala do motor; o artigo é
 * em inglês e fala do tema, ao lado do lab da mesma fase.
 *
 * O que o frontmatter carrega é o que a página promete e o corpo tem que
 * honrar: o conceito prático no cabeçalho (`dek`) e as **fontes primárias**.
 * Elas ficam aqui, e não escritas à mão no meio do texto, porque duas listas
 * da mesma coisa divergem — foi o que já aconteceu entre o mapa e o catálogo de
 * labs. O texto cita apontando para `#src-<id>`, e um teste cobra os dois lados.
 */
const fonte = z.object({
  /** Como o texto chama esta fonte: o link no corpo é `#src-<id>`. */
  id: z.string().regex(/^[a-z0-9-]+$/),
  author: z.string(),
  year: z.string(),
  title: z.string(),
  /** Onde saiu: periódico, editora, escritório de patentes, comitê. */
  where: z.string(),
  /**
   * Opcional de propósito. Uma fonte de 1938 pode não ter endereço estável, e
   * inventar um é pior que não ter: quem confere descobre que o link mente.
   */
  url: z.string().url().optional(),
  /** Por que vale abrir esta, em uma frase. */
  note: z.string(),
});

const articles = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/articles" }),
  schema: z.object({
    title: z.string(),
    /** O conceito prático, definido, que vai no cabeçalho. */
    dek: z.string(),
    handbook: z.string(),
    phase: z.number().int().positive(),
    /** O lab da mesma fase, quando já existe: o artigo é a teoria dele. */
    lab: z.string().optional(),
    sources: z.array(fonte).min(1),
  }),
});

export const collections = { docs, articles };
