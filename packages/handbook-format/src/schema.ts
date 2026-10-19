import { z } from "zod";

/**
 * O contrato de um handbook submetido, como arquivo.
 *
 * Por que existe: até aqui, um handbook novo exigia editar TypeScript dentro do
 * site — `apps/site/src/data/handbooks.ts`, mais o mapa, mais o tema. Isso faz
 * duas coisas ruins ao mesmo tempo. Quem quer publicar um handbook de um
 * assunto que domina precisa aprender a casa inteira primeiro; e quem mantém a
 * casa fica dono de conteúdo que não é dele.
 *
 * O contrato troca as duas: **um diretório, um dono, um arquivo que descreve o
 * handbook e nada mais.** O que o arquivo não pode descrever é comportamento —
 * lab que roda precisa de TypeScript, e isso está dito no limite declarado em
 * `docs/handbooks.md` em vez de escondido.
 *
 * Três decisões de forma, e cada uma paga uma dívida que já doeu aqui:
 *
 * 1. **As chaves são em inglês.** O conteúdo deste repositório é em inglês e
 *    quem submete não é necessariamente brasileiro. O código em volta segue em
 *    português, e a tradução acontece no leitor de versão — que é justamente o
 *    lugar onde ela é visível e testada.
 * 2. **`strict()` em tudo.** Chave com erro de digitação é item que desaparece
 *    da página sem aviso, que é o defeito mais caro já visto neste projeto.
 *    Aqui ela é recusa com nome.
 * 3. **`apiVersion` primeiro.** Ele identifica o contrato, não a release do
 *    site, e é o que permite a casa evoluir sem quebrar handbook de ninguém.
 *    Ver `versoes.ts`.
 */

/** Id de coisa: entra em URL, em nome de arquivo e em id de página. */
export const IdSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/u, "id usa minúsculas, números e hífen: `a-stack-is-a-box`");

/**
 * Cor como o CSS a entende, e **só** hex.
 *
 * O tema deste projeto é conferido por contraste medido (`contrast.test.ts`), e
 * a conferência precisa de um valor que ela saiba ler. Aceitar `rebeccapurple`
 * ou `oklch(...)` seria aceitar um tema que o medidor não mede — e tema que não
 * se mede é tema que pode nascer ilegível.
 */
export const CorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/u, "cor é hex de seis dígitos: `#6d28d9`");

const CORES_DO_TEMA = {
  /** O acento da página: links, marcas, o que puxa o olho. */
  accent: CorSchema,
  /** Os quatro sinais: fluxo, descarte, sucesso, mutação. */
  flow: CorSchema,
  dropped: CorSchema,
  ok: CorSchema,
  mutation: CorSchema,
  /** A família que age sobre o que a atravessa. */
  processor: CorSchema,
  /** A família que transporta e nunca altera a carga. */
  conduit: CorSchema,
  /** As quatro espécies de carga, da mais proeminente para a mais discreta. */
  species: z.tuple([CorSchema, CorSchema, CorSchema, CorSchema]),
} as const;

/**
 * O tema, nos dois papéis — e o escuro é **parcial** de propósito.
 *
 * Quase toda tinta serve nos dois, e repetir a que serve é convite para as duas
 * divergirem. Só entra no escuro o que o papel escuro obriga a mudar.
 */
export const TemaSchema = z
  .object({
    light: z.object(CORES_DO_TEMA).strict(),
    dark: z
      .object({
        accent: CorSchema.optional(),
        flow: CorSchema.optional(),
        dropped: CorSchema.optional(),
        ok: CorSchema.optional(),
        mutation: CorSchema.optional(),
        processor: CorSchema.optional(),
        conduit: CorSchema.optional(),
        species: z.tuple([CorSchema, CorSchema, CorSchema, CorSchema]).optional(),
      })
      .strict()
      .default({}),
  })
  .strict();

export const FaseSchema = z
  .object({
    number: z.number().int().positive(),
    title: z.string().min(1),
    /** A frase da fase: o que ela ensina, em uma linha. */
    line: z.string().min(1),
  })
  .strict();

export const STATUS = ["available", "draft", "coming"] as const;

/**
 * Um item da trilha: um artigo ou um lab.
 *
 * `href` só existe para o que está pronto, e isso é regra e não convenção:
 * `href` para página que ninguém escreveu é link morto em produção, e o leitor
 * só descobre clicando. Os dois lados têm teste.
 */
export const ItemSchema = z
  .object({
    id: IdSchema,
    title: z.string().min(1),
    status: z.enum(STATUS),
    phase: z.number().int().positive(),
    href: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((item, ctx) => {
    if (item.status === "available" && item.href === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `"${item.id}" está pronto e não tem href: um item pronto sem link é um convite que não abre nada`,
      });
    }
    if (item.status !== "available" && item.href !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `"${item.id}" não está pronto e tem href: link para página que ninguém escreveu é link morto`,
      });
    }
  });

/**
 * De onde veio o modelo, quando ele não é nosso.
 *
 * Crédito enterrado numa página que ninguém abre é crédito que não foi dado:
 * estando aqui, a página do handbook o imprime sozinha.
 */
export const ReferenciaSchema = z
  .object({
    title: z.string().min(1),
    author: z.string().min(1),
    where: z.string().min(1),
    href: z.string().min(1),
    line: z.string().min(1),
  })
  .strict();

/**
 * Quem mantém, e é obrigatório.
 *
 * A promessa do caminho dourado é "submeta e mantenha o seu". Sem dono
 * declarado, a manutenção volta para quem mantém a casa — que é exatamente o
 * que ele existe para evitar. O handle serve para o `CODEOWNERS` sair daqui em
 * vez de ser uma segunda lista escrita à mão.
 */
export const MantenedorSchema = z
  .object({
    name: z.string().min(1),
    github: z
      .string()
      .regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/u, "handle do GitHub, sem @"),
  })
  .strict();

/** O corpo do manifesto que **toda** versão do contrato tem em comum. */
export const CORPO_COMUM = {
  id: IdSchema,
  name: z.string().min(1),
  /** O assunto, em uma palavra ou duas. Vai na etiqueta do cartão. */
  subject: z.string().min(1),
  tagline: z.string().min(1),
  blurb: z.string().min(1),
  /** O modelo ou família de modelos interativos deste handbook. */
  model: z.string().min(1),
  stage: z.enum(["building", "planned"]),
  maintainers: z.array(MantenedorSchema).min(1),
  theme: TemaSchema,
  phases: z.array(FaseSchema).min(1),
  articles: z.array(ItemSchema).default([]),
  labs: z.array(ItemSchema).default([]),
  reference: ReferenciaSchema.optional(),
} as const;

export type Tema = z.infer<typeof TemaSchema>;
export type Fase = z.infer<typeof FaseSchema>;
export type Item = z.infer<typeof ItemSchema>;
export type Referencia = z.infer<typeof ReferenciaSchema>;
export type Mantenedor = z.infer<typeof MantenedorSchema>;

/**
 * O frontmatter de um artigo, e ele vive aqui por uma razão mecânica.
 *
 * Quem o conferia era só o Astro, na coleção de conteúdo — então a ferramenta
 * de linha de comando não tinha como dizer "este artigo está errado" sem uma
 * segunda cópia da regra. Duas cópias da mesma regra divergem; já divergiram
 * aqui, entre o mapa e o catálogo de labs. Agora a regra é uma, e os dois lados
 * a importam.
 */
export const FonteSchema = z
  .object({
    /** Como o texto chama esta fonte: o link no corpo é `#src-<id>`. */
    id: IdSchema,
    author: z.string().min(1),
    year: z.string().min(1),
    title: z.string().min(1),
    /** Onde saiu: periódico, editora, escritório de patentes, comitê. */
    where: z.string().min(1),
    /**
     * Opcional de propósito. Uma fonte de 1938 pode não ter endereço estável, e
     * inventar um é pior que não ter: quem confere descobre que o link mente.
     */
    url: z.string().url().optional(),
    /** Por que vale abrir esta, em uma frase. */
    note: z.string().min(1),
  })
  .strict();

export const ArtigoSchema = z.object({
  title: z.string().min(1),
  /** O conceito prático, definido, que vai no cabeçalho. */
  dek: z.string().min(1),
  handbook: z.string().min(1),
  phase: z.number().int().positive(),
  /** O lab da mesma fase, quando já existe: o artigo é a teoria dele. */
  lab: z.string().optional(),
  sources: z.array(FonteSchema).min(1),
});

export type Fonte = z.infer<typeof FonteSchema>;
export type Artigo = z.infer<typeof ArtigoSchema>;
