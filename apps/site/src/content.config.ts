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
  }),
  // Permissivo de propósito: os documentos não têm frontmatter e não vão
  // ganhar. Quem carrega a taxonomia é `src/data/docs-index.ts`.
  schema: z.object({}).passthrough(),
});

export const collections = { docs };
