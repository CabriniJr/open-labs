# Site: landing, documentação e Vercel — plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA — use superpowers:subagent-driven-development
> para executar tarefa a tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** publicar o projeto na Vercel com uma landing à altura do herói e uma seção de
documentação navegável — índice à esquerda por tema e capítulo, busca, tempo de leitura.

**Arquitetura:** Astro 5 estático. A documentação **não é reescrita**: os arquivos em `docs/`
já existem e são a fonte, lidos pelo content layer do Astro com o loader `glob` apontando para
fora de `src/`. A taxonomia (tema, capítulo, ordem) mora num manifesto em `apps/site/src/data`,
não no frontmatter — os documentos são conteúdo CC BY-SA escrito para serem lidos no
repositório também, e não devem ganhar metadado de site.

**Stack nova:** `astro-pagefind` (MIT) para busca estática — índice gerado no build, sem
backend, funciona offline. Nada mais.

---

## O estado de hoje

`apps/site` tem landing com o herói rodando simulação de verdade, design system em
`styles/tokens.css` (cromo editorial neutro) mais `styles/themes/otel.css` (acento do
domínio), `Base.astro`, e um componente `Roadmap`. Deploy é GitHub Pages, com
`base: "/otel-visual-handbook"`.

A documentação escrita — `docs/DECISIONS.md`, `VISION.md`, `kinds.md`, `depth.md`,
`model-format.md`, `why-simulate.md`, `roadmap.md`, `stack.md`, `PROGRESS.md` — não aparece no
site. São ~4.000 linhas de material bom, invisível para quem não clona o repositório.

**A documentação está incompleta de propósito e vai continuar assim por um tempo.** O site
precisa dizer isso em vez de esconder: cada documento declara seu estado, e o roadmap mostra o
que existe e o que falta. Documentação que finge estar pronta é pior que documentação
declaradamente parcial.

---

## Task 1: Vercel, e o caminho-base que deixa de ser fixo

**Files:**
- Modify: `apps/site/astro.config.mjs`
- Create: `vercel.json`
- Modify: `.github/workflows/*.yml` (o que faz deploy)
- Modify: `README.md`

- [ ] **Step 1: o caminho-base vira configuração, não constante**

Hoje `base: "/otel-visual-handbook"` está cravado, porque o GitHub Pages serve num
subdiretório. Na Vercel o site serve na raiz. Cravar um dos dois quebra o outro.

```js
// apps/site/astro.config.mjs
import react from "@astrojs/react";
import { defineConfig } from "astro/config";

// O GitHub Pages serve em /<repo>/; a Vercel serve na raiz. Quem chama o build
// declara onde vai servir, em vez de o código adivinhar.
const base = process.env.PUBLIC_BASE_PATH ?? "/";
const site = process.env.PUBLIC_SITE_URL ?? "https://otel-visual-handbook.vercel.app";

export default defineConfig({
  site,
  base,
  integrations: [react()],
  build: { inlineStylesheets: "auto" },
});
```

Toda URL interna do site precisa passar a respeitar `base`. Use `import.meta.env.BASE_URL`
(ou o helper que você criar) em vez de `/algo` literal. **Procure por `href="/` e `src="/` em
`apps/site/src` e conserte todos** — link quebrado só no GitHub Pages é o defeito clássico
aqui, e ele não aparece rodando local.

- [ ] **Step 2: o workflow do GitHub Pages passa a declarar o base**

No passo de build do workflow existente, acrescentar ao ambiente:

```yaml
      env:
        PUBLIC_BASE_PATH: /otel-visual-handbook/
        PUBLIC_SITE_URL: https://cabrinijr.github.io
```

Assim os dois destinos continuam funcionando, e nenhum depende de alguém lembrar de trocar
uma constante.

- [ ] **Step 3: `vercel.json` na raiz**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "pnpm build",
  "outputDirectory": "apps/site/dist",
  "installCommand": "pnpm install --frozen-lockfile",
  "framework": null,
  "headers": [
    {
      "source": "/_astro/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

`framework: null` porque a raiz é um monorepo pnpm e o autodetect da Vercel erra o diretório.

- [ ] **Step 4: verificar de verdade**

Run: `PUBLIC_BASE_PATH=/otel-visual-handbook/ pnpm build` e confira que os links no HTML
gerado saem com o prefixo. Depois `pnpm build` limpo e confira que saem sem.

Run: `pnpm --filter @ovh/site preview` e abra — a landing precisa continuar funcionando.

- [ ] **Step 5: README**

Trocar a instrução de deploy: Vercel é o destino canônico, GitHub Pages continua como espelho.
Diga qual URL é qual.

- [ ] **Step 6: Commit**

```bash
git add apps/site/astro.config.mjs vercel.json .github README.md
git commit -m "build: caminho-base configuravel e deploy na Vercel"
```

---

## Task 2: A documentação vira coleção, sem ganhar metadado de site

**Files:**
- Create: `apps/site/src/content.config.ts`
- Create: `apps/site/src/data/docs-index.ts`
- Test: `apps/site/src/data/docs-index.test.ts`

- [ ] **Step 1: a coleção lê `docs/` de fora de `src/`**

Astro 5 tem content layer com loader `glob`, que aceita `base` fora de `src/`. É isso que
permite os documentos continuarem sendo lidos no repositório **e** publicados, sem cópia — e
cópia divergiria na primeira semana.

```ts
// apps/site/src/content.config.ts
import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

/**
 * Os documentos moram em `docs/`, na raiz do repositório, porque também são
 * lidos lá. O site os consome onde eles estão em vez de manter uma cópia.
 */
const docs = defineCollection({
  loader: glob({
    pattern: ["*.md", "superpowers/specs/*.md", "superpowers/plans/*.md"],
    base: "../../docs",
  }),
  schema: z.object({}).passthrough(),
});

export const collections = { docs };
```

O schema é permissivo de propósito: os documentos não têm frontmatter e **não vão ganhar**.
Quem carrega a taxonomia é o manifesto do Step 2.

- [ ] **Step 2: o manifesto de temas e capítulos**

```ts
// apps/site/src/data/docs-index.ts

/** Um tema agrupa capítulos. É a primeira divisão do índice à esquerda. */
export interface Theme {
  readonly id: string;
  readonly title: string;
  /** Uma frase dizendo a quem este tema serve. Aparece sob o título. */
  readonly blurb: string;
  readonly chapters: readonly Chapter[];
}

export interface Chapter {
  /** O id do documento na coleção — o caminho relativo sem extensão. */
  readonly id: string;
  readonly title: string;
  /**
   * Honestidade editorial: o leitor precisa saber o que está lendo.
   * `stable` — pode confiar. `draft` — a ideia está de pé, o texto não.
   * `proposal` — ainda é discussão, pode mudar inteiro.
   */
  readonly status: "stable" | "draft" | "proposal";
}

export const THEMES: readonly Theme[] = [
  {
    id: "start",
    title: "Comece por aqui",
    blurb: "O que o projeto é, e as decisões que já foram tomadas.",
    chapters: [
      { id: "DECISIONS", title: "Decisões e ideias consolidadas", status: "stable" },
      { id: "VISION", title: "Visão e escopo", status: "draft" },
      { id: "why-simulate", title: "Por que simular", status: "draft" },
    ],
  },
  {
    id: "engine",
    title: "O motor",
    blurb: "Como a simulação funciona por dentro, e por que ela não consegue mentir.",
    chapters: [
      { id: "kinds", title: "Catálogo de arquétipos", status: "proposal" },
      { id: "depth", title: "Profundidade e níveis", status: "proposal" },
      { id: "superpowers/specs/2026-08-28-motor-composicional-design", title: "Motor composicional", status: "stable" },
    ],
  },
  {
    id: "authoring",
    title: "Escrever um lab",
    blurb: "O formato que um handbook usa — hoje ainda proposta.",
    chapters: [
      { id: "model-format", title: "Formato do modelo", status: "proposal" },
      { id: "stack", title: "O que reaproveitar", status: "draft" },
    ],
  },
  {
    id: "process",
    title: "Andamento",
    blurb: "O que já existe, o que falta, e em que ordem.",
    chapters: [
      { id: "roadmap", title: "Roteiro", status: "draft" },
      { id: "PROGRESS", title: "Progresso", status: "stable" },
    ],
  },
];

/** Todos os capítulos em ordem de leitura — o que alimenta anterior/próximo. */
export const READING_ORDER: readonly Chapter[] = THEMES.flatMap((t) => t.chapters);
```

- [ ] **Step 3: teste que impede o índice de mentir**

```ts
// apps/site/src/data/docs-index.test.ts
import { getCollection } from "astro:content";
import { describe, expect, it } from "vitest";
import { READING_ORDER, THEMES } from "./docs-index.js";

describe("índice da documentação", () => {
  it("todo capítulo do índice existe como documento", async () => {
    const ids = new Set((await getCollection("docs")).map((d) => d.id));
    for (const chapter of READING_ORDER) {
      expect(ids, `capítulo "${chapter.id}" está no índice e não existe em docs/`).toContain(chapter.id);
    }
  });

  it("nenhum capítulo aparece em dois temas", () => {
    const ids = READING_ORDER.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("todo tema tem pelo menos um capítulo", () => {
    for (const theme of THEMES) expect(theme.chapters.length).toBeGreaterThan(0);
  });
});
```

Se `getCollection` não rodar sob Vitest sem o ambiente do Astro, use `fs.readdir` sobre
`docs/` para montar o conjunto de ids — o que importa é que **um capítulo listado e
inexistente quebre o build**, e não vire link morto em produção.

- [ ] **Step 4: verde e commit**

```bash
git add apps/site/src/content.config.ts apps/site/src/data
git commit -m "feat(site): documentacao como colecao, com taxonomia em manifesto"
```

---

## Task 3: A página de documentação

**Files:**
- Create: `apps/site/src/layouts/Doc.astro`
- Create: `apps/site/src/components/DocSidebar.astro`
- Create: `apps/site/src/components/DocToc.astro`
- Create: `apps/site/src/pages/docs/index.astro`
- Create: `apps/site/src/pages/docs/[...slug].astro`
- Create: `apps/site/src/styles/docs.css`
- Create: `apps/site/src/lib/reading-time.ts`
- Test: `apps/site/src/lib/reading-time.test.ts`

- [ ] **Step 1: tempo de leitura**

Sem dependência: são dez linhas, e a conta precisa ser a nossa porque o texto é bilíngue e tem
muito bloco de código — contar código como prosa infla o número e o leitor perde a confiança
na primeira vez que percebe.

```ts
// apps/site/src/lib/reading-time.ts

const PALAVRAS_POR_MINUTO = 200;
/** Ler código é mais lento que ler prosa, e blocos longos são consultados, não lidos. */
const PALAVRAS_POR_MINUTO_CODIGO = 80;

export interface ReadingTime {
  readonly minutes: number;
  readonly words: number;
}

export function readingTime(markdown: string): ReadingTime {
  const blocos = markdown.match(/```[\s\S]*?```/g) ?? [];
  const prosa = markdown.replace(/```[\s\S]*?```/g, " ");

  const conta = (t: string): number => t.split(/\s+/).filter((w) => w.length > 0).length;
  const palavrasProsa = conta(prosa);
  const palavrasCodigo = blocos.reduce((n, b) => n + conta(b), 0);

  const minutos = palavrasProsa / PALAVRAS_POR_MINUTO + palavrasCodigo / PALAVRAS_POR_MINUTO_CODIGO;
  return {
    minutes: Math.max(1, Math.round(minutos)),
    words: palavrasProsa + palavrasCodigo,
  };
}
```

Testes: prosa pura dá o esperado; um documento só de código dá mais minutos que o mesmo número
de palavras em prosa; documento vazio dá 1 minuto e 0 palavras; a contagem não conta a cerca
de crase como palavra.

- [ ] **Step 2: `DocSidebar.astro` — o índice à esquerda**

Requisitos, e cada um tem um porquê:

- temas como grupos, capítulos como itens, **na ordem do manifesto** (é ordem de leitura, não
  alfabética);
- o capítulo atual marcado com `aria-current="page"`, e o tema dele aberto;
- **a etiqueta de estado** (`stable` / `draft` / `proposal`) visível em cada item que não seja
  estável — o leitor tem que saber que está lendo proposta antes de investir dez minutos;
- em telas estreitas, vira um `<details>` recolhido acima do conteúdo, não um menu que cobre a
  tela;
- navegável por teclado, com `:focus-visible` desenhado.

- [ ] **Step 3: `DocToc.astro` — o sumário do documento, à direita**

Alimentado por `headings` que o `render()` do Astro devolve. Só `h2` e `h3` — `h4` para baixo
polui. Se o documento tiver menos de três `h2`, **não renderize o sumário**: um sumário com
dois itens ocupa uma coluna e não ajuda ninguém.

- [ ] **Step 4: `Doc.astro` — o layout de três colunas**

Grade: índice (16rem) · conteúdo (`--measure`) · sumário (14rem). Abaixo de 1100px o sumário
some; abaixo de 820px o índice vira `<details>`.

No topo do conteúdo: título, etiqueta de estado quando não for estável, tempo de leitura e
contagem de palavras, e **o link "editar no GitHub"** apontando para o arquivo real — a
documentação é CC BY-SA e o convite a corrigir é parte do produto.

No rodapé: anterior e próximo, tirados de `READING_ORDER`.

Estilo: **use os tokens existentes** (`tokens.css` e `themes/otel.css`). Não invente paleta —
a landing e a documentação são o mesmo produto. Prosa em `--measure`, `text-wrap: balance` nos
títulos, tabelas com rolagem própria (`overflow-x: auto`), blocos de código com o mono do
sistema de tokens.

- [ ] **Step 5: as páginas**

`pages/docs/[...slug].astro` gera uma página por capítulo do manifesto (não por arquivo em
`docs/`: um plano ou spec fora do índice não vira página solta e sem contexto).

`pages/docs/index.astro` é a capa da documentação: os temas em cartões, com o blurb, a
contagem de capítulos e o estado predominante. Diga em uma frase, no topo, que a documentação
está incompleta e o que já dá para ler.

- [ ] **Step 6: verde e commit**

Run: `pnpm build` e depois `pnpm --filter @ovh/site preview`; abra `/docs` e um capítulo,
confira o índice, o sumário, o tempo de leitura, o anterior/próximo e o link de editar.

```bash
git add apps/site/src
git commit -m "feat(site): paginas de documentacao com indice, sumario e tempo de leitura"
```

---

## Task 4: Busca

**Files:**
- Modify: `apps/site/package.json`
- Modify: `apps/site/astro.config.mjs`
- Create: `apps/site/src/components/DocSearch.astro`

- [ ] **Step 1: `astro-pagefind`**

```bash
pnpm add -D astro-pagefind --filter @ovh/site
```

Pagefind indexa o HTML **depois** do build e serve um índice estático fragmentado: sem
backend, sem chave de API, funciona offline e não manda o que o leitor digita para lugar
nenhum. Para um site estático de documentação é a escolha certa, e é MIT.

Acrescentar a integração em `astro.config.mjs`.

- [ ] **Step 2: marcar o que indexar**

No `Doc.astro`, marque a região do conteúdo com `data-pagefind-body`, e o título com
`data-pagefind-meta="title"`. Marque o índice e o sumário com `data-pagefind-ignore` — senão
cada resultado vem cheio de texto de navegação.

Acrescente o estado como metadado (`data-pagefind-meta="status"`) para o resultado poder
mostrar que é proposta.

- [ ] **Step 3: `DocSearch.astro`**

Campo no topo do índice. Requisitos:

- atalho `/` para focar, `Esc` para limpar — e **anuncie o atalho** na dica do campo;
- resultados com título, o trecho com o termo destacado e a etiqueta de estado;
- estado vazio que diz o que fazer, não "nenhum resultado";
- funciona sem JavaScript? Não funciona, e tudo bem — mas o campo só deve **aparecer** depois
  do JS carregar, em vez de ficar lá morto.

- [ ] **Step 4: verificar**

Run: `pnpm build && pnpm --filter @ovh/site preview`. A busca **não funciona em `astro dev`**
(o índice é gerado no build) — deixe isso escrito num comentário no componente, senão a
próxima pessoa vai passar uma hora achando que quebrou.

Busque por um termo que só existe num documento e confira que ele vem; busque por um termo do
menu lateral e confira que **não** vem, o que prova que o `data-pagefind-ignore` pegou.

- [ ] **Step 5: Commit**

```bash
git add apps/site package.json pnpm-lock.yaml
git commit -m "feat(site): busca estatica com pagefind"
```

---

## Task 5: A landing à altura do herói

**Files:**
- Modify: `apps/site/src/pages/index.astro`
- Modify: `apps/site/src/components/Roadmap.tsx` e `.css`
- Create: `apps/site/src/components/SiteNav.astro`
- Create: `apps/site/src/components/SiteFooter.astro`

- [ ] **Step 1: navegação de verdade**

Hoje o cabeçalho é um parágrafo com o nome. Vira `SiteNav.astro`: marca, links para
`/docs` e para o roadmap, link para o GitHub, e o alternador de tema claro/escuro — os tokens
já suportam `data-theme`, só não há controle. Guarde a escolha em `localStorage` dentro de
`try/catch` e respeite `prefers-color-scheme` quando não houver escolha.

- [ ] **Step 2: o herói continua sendo o argumento**

Não mexa no `HeroSim`. O que muda ao redor:

- a chamada abaixo do herói deixa de ser só prosa e ganha **dois caminhos claros**: "ler a
  documentação" e "ver o roteiro";
- a promessa dos quatro níveis vira uma peça visual — quatro faixas com o nome do nível e uma
  frase, na ordem em que se desce — em vez de um parágrafo. É a ideia central do projeto e ela
  está escondida em prosa;
- uma faixa curta e honesta de estado: o que já roda, o que está em construção. Com link para
  o roadmap.

- [ ] **Step 3: o roadmap fica honesto sobre a documentação**

O componente `Roadmap` hoje lista entregas. Acrescente a coluna da documentação: quais
documentos existem, em que estado (`stable`/`draft`/`proposal`, vindos do mesmo manifesto da
Task 2 — **uma fonte só**), e o que ainda não foi escrito.

Isto responde ao pedido de "a doc, ainda incompleta mesmo, no roadmap": ela aparece com o
estado real em vez de ficar de fora até estar pronta.

- [ ] **Step 4: rodapé**

Licença (Apache-2.0 no código, CC BY-SA no conteúdo, com links para os dois arquivos),
procedência das afirmações técnicas (a especificação oficial), e o link do repositório.

- [ ] **Step 5: acessibilidade e responsivo, sem exceção**

- um `<h1>` por página; a ordem dos títulos não pula nível;
- foco visível em tudo que é focável;
- `prefers-reduced-motion` respeitado por qualquer animação nova;
- nada de rolagem horizontal no corpo em 360px de largura;
- contraste de texto no mínimo 4,5:1 **nos dois temas** — verifique o tema escuro, que é onde
  costuma quebrar.

- [ ] **Step 6: smoke**

Acrescente ao Playwright: a landing carrega e o herói aparece; `/docs` carrega e o índice
mostra os quatro temas; um capítulo abre e mostra tempo de leitura; o alternador de tema muda
`data-theme` e a escolha sobrevive a um reload.

Run: `pnpm build && pnpm --filter @ovh/site test:e2e`

- [ ] **Step 7: Commit**

```bash
git add apps/site
git commit -m "feat(site): navegacao, landing com os quatro niveis e roadmap com a documentacao"
```

---

## Fora do escopo desta entrega

- Traduzir a documentação. Os documentos de projeto estão em português e a landing em inglês;
  unificar é decisão editorial, não de implementação, e precisa ser tomada antes.
- Versionar a documentação (v1, v2). Não há v1 ainda.
- Comentários, feedback ou analytics.
- Renderizar os labs dentro dos documentos. Depende da S3 (palco e navegação).
