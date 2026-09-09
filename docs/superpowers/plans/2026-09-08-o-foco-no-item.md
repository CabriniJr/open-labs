# O foco no item — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao item a mesma dignidade de projeção que a fábrica já tem — a Trilha —, e pôr o herói da landing no motor novo usando ela.

**Architecture:** `seguir()`/`Parada` sobem de `apps/site/src/lib` para o `depth-core`, porque identidade e trajeto de um item são conceito do motor. O `depth-ui` ganha `Trilha`, que desenha um `readonly Parada[]` e nada mais. `PainelDaCarga` passa a usar a `Trilha` (uma fonte por fato), e com isso `three-pillars` e `anatomy-of-a-trace` herdam sem código novo. O `otel-domain` ganha o mundo do herói (`heroi/`), e o `HeroSim` é reescrito sobre `World`/`Explorer`, sem controle nenhum, abrindo já seguindo um item. A landing troca a seção dos quatro níveis mortos pelo pilar.

**Tech Stack:** TypeScript, React 19, Astro 5, Vitest + @testing-library/react (unit), Playwright (e2e), pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-08-o-foco-no-item-design.md`
**Decisão de projeto:** `docs/DECISIONS.md` §9

---

## Contexto que o executor precisa saber antes de começar

**Convenção de commit deste repositório:** mensagens em português, sem `Co-Authored-By: Claude` e sem `Claude-Session`. O corpo diz *por quê*, não *o quê*.

**Branch:** trabalhe na branch atual (`entrega-4/lab-provedores-otel`). `main` é protegida.

**Comandos, todos da raiz do repositório:**

| O quê | Comando |
|---|---|
| unit | `pnpm test` |
| um arquivo só | `pnpm vitest run <caminho>` |
| tipos | `pnpm typecheck` |
| fronteiras | `pnpm boundaries` |
| catálogo | `pnpm catalogo` |
| build | `pnpm build` |
| e2e | `pnpm --filter @ovh/site test:e2e` |
| um e2e só | `pnpm --filter @ovh/site test:e2e -g "<nome do teste>"` |

**A guarda de fronteiras vai te morder, e é de propósito.** `scripts/check-boundaries.mjs` proíbe `packages/depth-core/`, `packages/depth-ui/` e `packages/model-format/` de conterem palavras de domínio — a lista inclui `otel`, `otlp`, `collector`, `traceparent`, `traceid`, `spanid`, `opentelemetry`. Isso vale para **comentários e testes também**, não só para código. Nos testes da `Trilha` use nomes neutros (`origem`, `meio`, `destino`, `campo-a`), nunca `service`/`collector`/`backend`.

**Como os testes deste repositório são escritos:** eles cobram *o que pode quebrar em silêncio*, e não a existência das peças. Um teste que só verifica se o componente renderizou não paga o próprio custo. Cada teste abaixo tem uma razão escrita — mantenha o comentário, ele é o que impede alguém de "consertar" o teste apagando o que ele protege.

---

## Estrutura de arquivos

**Criar:**

| Arquivo | Responsabilidade |
|---|---|
| `packages/depth-core/src/seguir.ts` | `seguir()`, `Parada`, `LeitorDaCarga` — o trajeto de um item, lógica pura |
| `packages/depth-core/src/seguir.test.ts` | movido de `apps/site/src/lib/seguir.test.ts` |
| `packages/depth-ui/src/Trilha.tsx` | O desenho da trilha. Recebe `Parada[]` e nada mais |
| `packages/depth-ui/src/Trilha.test.tsx` | Os quatro testes da §8 da spec |
| `packages/depth-ui/src/trilha.css` | Estilo da trilha, sem hexadecimal |
| `packages/otel-domain/src/heroi/carga.ts` | O span que viaja e o id derivado |
| `packages/otel-domain/src/heroi/labels.ts` | Rótulos em inglês |
| `packages/otel-domain/src/heroi/world.ts` | `heroiWorld()` — `service → collector → backend` |
| `packages/otel-domain/src/heroi/world.test.ts` | O collector enriquece; o backend recebe |
| `packages/otel-domain/src/heroi/estado.ts` | `LEITOR_DO_SPAN` — chave, corpo, trajeto |
| `packages/otel-domain/src/heroi/estado.test.ts` | A chave é estável entre saltos |
| `packages/otel-domain/src/heroi/views.ts` | A vista do herói |

**Modificar:**

| Arquivo | O quê |
|---|---|
| `packages/depth-core/src/index.ts` | exporta `seguir`; corrige o comentário do andaime |
| `packages/depth-ui/src/index.ts` | exporta `Trilha` |
| `packages/otel-domain/src/index.ts` | exporta o mundo do herói |
| `apps/site/src/lib/seguir.ts` | **apagado** |
| `apps/site/src/lib/seguir.test.ts` | **apagado** (foi para o motor) |
| `apps/site/src/components/PainelDaCarga.tsx` | usa `Trilha` no lugar da lista |
| `apps/site/src/components/PainelDaCarga.css` | perde o que virou `trilha.css` |
| `apps/site/src/components/AnatomiaLab.tsx` | importa `seguir` do motor |
| `apps/site/src/components/PilaresLab.tsx` | importa `seguir` do motor |
| `apps/site/src/components/HeroSim.tsx` | **reescrito** |
| `apps/site/src/components/HeroSim.css` | reescrito para o palco |
| `apps/site/src/pages/index.astro` | seção `.levels` → o pilar; textos do herói |
| `apps/site/tests/landing.spec.ts` | os quatro testes do herói |
| `apps/site/tests/seguir-a-carga.spec.ts` | seletores da trilha, e a estação de origem a mais |
| `apps/site/tests/espaguete.spec.ts` | o teto medido do herói |
| `apps/site/src/labs/hero/scenario.ts` | **apagado** |
| `apps/site/src/labs/hero/scenario.test.ts` | **apagado** |
| `docs/PROGRESS.md` | Entrega 15 |

---

## Task 1: `seguir()` sobe para o motor

Identidade e trajeto de um item são conceito do motor, não do site. É lógica pura sobre `WorldState`/`Message`, sem React e sem domínio — e é o que torna "foco no item" primeira classe em vez de um utilitário de página.

**Files:**
- Create: `packages/depth-core/src/seguir.ts`
- Create: `packages/depth-core/src/seguir.test.ts`
- Delete: `apps/site/src/lib/seguir.ts`, `apps/site/src/lib/seguir.test.ts`
- Modify: `packages/depth-core/src/index.ts`
- Modify: `apps/site/src/components/AnatomiaLab.tsx:12-13`, `apps/site/src/components/PilaresLab.tsx:11-12`

- [ ] **Step 1: Mover os dois arquivos com o histórico preservado**

```bash
git mv apps/site/src/lib/seguir.ts packages/depth-core/src/seguir.ts
git mv apps/site/src/lib/seguir.test.ts packages/depth-core/src/seguir.test.ts
```

- [ ] **Step 2: Corrigir os imports de dentro do arquivo movido**

Em `packages/depth-core/src/seguir.ts`, as três primeiras linhas hoje importam do pacote pelo nome. Dentro do próprio pacote isso é ciclo. Troque o topo do arquivo por:

```typescript
import { diffStates } from "./diff.js";
import type { Message, WorldState } from "./model.js";
```

Não mexa em mais nada do arquivo — os comentários dele carregam as três decisões da Entrega 14 (produto não é parada, o diff é contra a chegada, a parada é o salto) e continuam valendo.

- [ ] **Step 3: Corrigir os imports do teste movido**

Em `packages/depth-core/src/seguir.test.ts`, troque qualquer import de `@ovh/depth-core` ou `./seguir.js` relativo ao site por:

```typescript
import { seguir } from "./seguir.js";
```

e os tipos que ele usar (`WorldState`, `Message`) por `import type { ... } from "./model.js";`.

- [ ] **Step 4: Exportar do índice do motor**

Em `packages/depth-core/src/index.ts`, logo depois do bloco `// utilitários compartilhados`, acrescente:

```typescript
/**
 * Seguir um item: o trajeto de UMA coisa, e o que cada parada mudou nela.
 *
 * Mora no motor porque identidade e trajeto são conceito do motor: o motor dá
 * id novo a cada emissão — e está certo, cada salto é uma mensagem nova —, e
 * quem sabe que duas mensagens são a mesma coisa é o domínio, pelo `LeitorDaCarga`.
 * O desenho disso é a `Trilha`, no `depth-ui`.
 */
export { PARADAS_NO_PAINEL, seguir } from "./seguir.js";
export type { LeitorDaCarga, Parada } from "./seguir.js";
```

- [ ] **Step 5: Rodar o teste movido**

Run: `pnpm vitest run packages/depth-core/src/seguir.test.ts`
Expected: PASS, com o mesmo número de testes de antes.

- [ ] **Step 6: Apontar os dois labs para o motor**

Em `apps/site/src/components/AnatomiaLab.tsx`, apague as duas linhas:

```typescript
import { seguir } from "../lib/seguir.js";
import type { Parada } from "../lib/seguir.js";
```

e acrescente `seguir` e `Parada` ao import que já existe do motor, que passa a ser:

```typescript
import { World, indexTree, seguir } from "@ovh/depth-core";
import type { Parada } from "@ovh/depth-core";
```

Faça exatamente a mesma troca em `apps/site/src/components/PilaresLab.tsx`.

- [ ] **Step 7: Verificar que nada mais aponta para o arquivo antigo**

Run: `grep -rn "lib/seguir" apps/site/src`
Expected: nenhuma saída.

- [ ] **Step 8: Tipos e fronteiras**

Run: `pnpm typecheck && pnpm boundaries`
Expected: os dois passam. Se `boundaries` reclamar, é porque o `seguir.ts` ou o teste dele carrega palavra de domínio num comentário — troque a palavra, não a guarda.

- [ ] **Step 9: Suíte inteira**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add -A packages/depth-core apps/site/src
git commit -m "refactor(depth-core): seguir um item é conceito do motor, e não do site

O motor dá id novo a cada emissão porque cada salto é uma mensagem nova; quem
sabe que duas mensagens são a mesma coisa é o domínio. Essa fronteira é do
motor, e o trajeto que sai dela também — ele vivia em apps/site como se fosse
utilitário de página."
```

---

## Task 2: A `Trilha` — uma estação por parada

O componente novo. Ele recebe `readonly Parada[]` e desenha o trajeto como a espinha do desenho: uma estação por parada, e o que mudou **entre** as estações.

**Files:**
- Create: `packages/depth-ui/src/Trilha.tsx`
- Create: `packages/depth-ui/src/Trilha.test.tsx`
- Modify: `packages/depth-ui/src/index.ts`

- [ ] **Step 1: Escrever os testes que falham**

Crie `packages/depth-ui/src/Trilha.test.tsx`. **Nenhuma palavra de domínio** — a guarda de fronteiras lê este arquivo.

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Parada } from "@ovh/depth-core";
import { Trilha } from "./Trilha.js";

/**
 * Um caminho reto: três lugares, e o segundo salto acrescenta campo.
 *
 * Os nomes são neutros de propósito — a `Trilha` não sabe o que atravessa ela,
 * e um teste com vocabulário de um domínio esconderia isso.
 */
const RETO: readonly Parada[] = [
  { tick: 1, de: "origem", para: "meio", corpo: { id: 7 }, mudou: [] },
  { tick: 3, de: "meio", para: "destino", corpo: { id: 7, campoA: "x" }, mudou: ["campoA"] },
];

/**
 * Um leque: três saltos que saem do MESMO lugar, e cada um guarda uma coisa
 * diferente da mesma carga. É o caso que existe hoje no lab dos três pilares.
 */
const LEQUE: readonly Parada[] = [
  { tick: 1, de: "fonte", para: "guarda-a", corpo: { id: 7, a: 1 }, mudou: [] },
  { tick: 1, de: "fonte", para: "guarda-b", corpo: { id: 7, b: 2 }, mudou: ["b"] },
  { tick: 1, de: "fonte", para: "guarda-c", corpo: { id: 7, c: 3 }, mudou: ["c"] },
];

describe("Trilha", () => {
  it("desenha uma estação por ponta do trajeto, na ordem em que foram vistas", () => {
    /*
      O trajeto tem N paradas e N+1 estações: a primeira parada traz duas
      pontas, e cada parada seguinte acrescenta uma. Desenhar uma estação por
      parada perderia a origem — o item passaria a nascer no meio do caminho.
    */
    render(<Trilha trajeto={RETO} titulo="item 7" />);
    const estacoes = screen.getAllByRole("listitem");
    expect(estacoes.map((e) => e.textContent)).toEqual([
      expect.stringContaining("origem"),
      expect.stringContaining("meio"),
      expect.stringContaining("destino"),
    ]);
  });

  it("põe o que o salto mudou na estação a que ele CHEGOU", () => {
    /*
      O rótulo é do salto. Ele mora na chegada por uma razão que só o leque
      revela: três saltos saem do mesmo lugar com deltas diferentes, e do lado
      da partida os três disputariam a mesma linha. Na chegada, cada braço
      carrega o seu — e num caminho reto o texto continua caindo entre os dois
      pontos, que é onde ele aconteceu.
    */
    render(<Trilha trajeto={RETO} titulo="item 7" />);
    const marcas = screen.getAllByRole("listitem").map((e) => e.getAttribute("data-mudou"));
    expect(marcas).toEqual([null, null, "campoA"]);
  });

  it("num leque, cada braço é uma estação própria pendurada na mesma origem", () => {
    /*
      É o caso do lab dos três pilares, e é o que quebra uma espinha ingênua:
      três paradas que saem do mesmo lugar não são três trechos de um caminho.
      Desenhadas em fila, elas afirmariam que a carga passou por um, depois pelo
      outro — e o assunto do lab é justamente que os três viram a MESMA coisa.
    */
    render(<Trilha trajeto={LEQUE} titulo="item 7" />);
    const estacoes = screen.getAllByRole("listitem");
    expect(estacoes.map((e) => e.textContent)).toEqual([
      expect.stringContaining("fonte"),
      expect.stringContaining("guarda-a"),
      expect.stringContaining("guarda-b"),
      expect.stringContaining("guarda-c"),
    ]);
    // A primeira não é ramo: ela é a que continua a linha. As outras duas
    // penduram na mesma origem, e é o `data-ramo` que faz o desenho bifurcar.
    expect(estacoes.map((e) => e.getAttribute("data-ramo"))).toEqual([null, null, "true", "true"]);
    // E cada braço guarda o seu, que é a tese do lab.
    expect(estacoes[2]?.getAttribute("data-mudou")).toBe("b");
    expect(estacoes[3]?.getAttribute("data-mudou")).toBe("c");
  });

  it("diz a ausência em vez de omiti-la", () => {
    /*
      Chegada sem nada mudado é `unchanged`; a primeira de todas é
      `first sighting`. Em branco, as três situações — não vi antes, vi e nada
      mudou, mudou — pareceriam a mesma coisa na tela.
    */
    const semMudanca: readonly Parada[] = [
      { tick: 1, de: "origem", para: "meio", corpo: { id: 7 }, mudou: [] },
      { tick: 2, de: "meio", para: "destino", corpo: { id: 7 }, mudou: [] },
    ];
    render(<Trilha trajeto={semMudanca} titulo="item 7" />);
    expect(screen.getByText("first sighting")).toBeDefined();
    expect(screen.getByText("unchanged")).toBeDefined();
  });

  it("marca como atual apenas a última estação", () => {
    /*
      Duas estações atuais significariam que o item está em dois lugares. A
      trilha desenha UM item.
    */
    render(<Trilha trajeto={RETO} titulo="item 7" />);
    const atuais = screen
      .getAllByRole("listitem")
      .filter((e) => e.getAttribute("data-atual") === "true");
    expect(atuais).toHaveLength(1);
    expect(atuais[0]?.textContent).toContain("destino");
  });

  it("mostra o corpo da última parada com o campo alterado marcado", () => {
    /*
      O corpo é o de AGORA, e o que está marcado é o que a última parada mudou.
      Sem a marca, o leitor teria de comparar dois blocos de JSON de cabeça —
      que é exatamente o trabalho que a peça existe para tirar dele.
    */
    const { container } = render(<Trilha trajeto={RETO} titulo="item 7" />);
    const marcadas = container.querySelectorAll('.dui-inspector__line[data-changed="true"]');
    expect(marcadas.length).toBeGreaterThan(0);
    expect([...marcadas].some((n) => n.textContent?.includes("campoA"))).toBe(true);
  });

  it("não desenha estação nenhuma quando o trajeto está vazio", () => {
    /*
      O item pode ainda não ter sido visto. Uma trilha vazia com estações
      desenhadas afirmaria um percurso que ninguém andou.
    */
    render(<Trilha trajeto={[]} titulo="item 7" vazio="nothing yet" />);
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.getByText("nothing yet")).toBeDefined();
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `pnpm vitest run packages/depth-ui/src/Trilha.test.tsx`
Expected: FAIL — `Failed to resolve import "./Trilha.js"`.

- [ ] **Step 3: Escrever a `Trilha`**

Crie `packages/depth-ui/src/Trilha.tsx`:

```tsx
import type { Parada } from "@ovh/depth-core";
import { PARADAS_NO_PAINEL } from "@ovh/depth-core";
import { Inspector } from "./Inspector.js";

/**
 * A vista do item: o trajeto vira o desenho.
 *
 * O palco é centrado na **fábrica** — o grafo, as máquinas, o que tem dentro de
 * cada caixa — e o item é carga que atravessa. Há assunto em que o protagonista
 * é o item, e desenhá-lo como um ponto de sete unidades numa esteira é tratar de
 * raspão justamente o que o lab é sobre. Ver `DECISIONS.md` §9.
 *
 * Aqui o trajeto é a espinha. Nada disto é desenhado à mão: cada traço sai de um
 * campo de `Parada`, que sai de `seguir()`, que sai do `state.flight` do motor.
 * Se o mundo parar de enriquecer, a trilha para de dizer que enriqueceu.
 */
export interface TrilhaProps {
  readonly trajeto: readonly Parada[];
  /** Quem está sendo seguido, no vocabulário do domínio. */
  readonly titulo: string;
  /** O que dizer quando o item ainda não apareceu, ou já saiu do sistema. */
  readonly vazio?: string;
}

/** Uma ponta do trajeto: onde o item esteve, e o que o salto até aqui mudou. */
export interface Estacao {
  readonly id: string;
  readonly nome: string;
  /** O que o salto que CHEGOU aqui acrescentou. Vazio na origem. */
  readonly mudou: readonly string[];
  /** A origem: ninguém a alcançou por um salto, então ela não tem delta. */
  readonly origem: boolean;
  /** É a primeira aparição do item — ninguém o viu antes daqui. */
  readonly primeiraVez: boolean;
  /** Pendura no mesmo lugar que a estação de cima, em vez de continuar a linha. */
  readonly ramo: boolean;
}

/**
 * As estações saem do trajeto, e são **uma a mais** que as paradas.
 *
 * Uma parada é um salto — o par (de, para) —, então N saltos tocam N+1 lugares.
 * Uma estação por parada perderia a origem, e o item passaria a nascer no meio
 * do caminho.
 *
 * E o delta mora na **chegada**, não na partida. A razão é o leque: três saltos
 * saindo do mesmo lugar com deltas diferentes disputariam uma linha só do lado
 * da partida. Na chegada, cada braço carrega o seu — e num caminho reto o texto
 * continua caindo entre os dois pontos, que é onde ele aconteceu.
 */
export function estacoesDe(trajeto: readonly Parada[]): readonly Estacao[] {
  if (trajeto.length === 0) return [];
  const paradas = trajeto.slice(-PARADAS_NO_PAINEL);
  const primeira = paradas[0]!;

  const estacoes: Estacao[] = [
    {
      id: `${primeira.tick}:${primeira.de}:origem`,
      nome: primeira.de,
      mudou: [],
      origem: true,
      primeiraVez: false,
      ramo: false,
    },
  ];

  paradas.forEach((parada, i) => {
    const anterior = paradas[i - 1];
    estacoes.push({
      id: `${parada.tick}:${parada.de}:${parada.para}`,
      nome: parada.para,
      mudou: parada.mudou,
      origem: false,
      primeiraVez: i === 0,
      // Sai do mesmo lugar que o salto de cima: é irmão, e não continuação.
      ramo: anterior !== undefined && anterior.de === parada.de,
    });
  });

  return estacoes;
}

export function Trilha({ trajeto, titulo, vazio }: TrilhaProps) {
  const estacoes = estacoesDe(trajeto);
  const ultima = trajeto.at(-1);

  if (ultima === undefined) {
    return (
      <div className="dui-trilha" aria-label="Following one item">
        <p className="dui-trilha__titulo mono">{titulo}</p>
        <p className="dui-trilha__vazio">{vazio ?? ""}</p>
      </div>
    );
  }

  return (
    <div className="dui-trilha" aria-label="Following one item">
      <p className="dui-trilha__titulo mono">{titulo}</p>

      <ol className="dui-trilha__estacoes mono">
        {estacoes.map((estacao, i) => (
          <li
            key={estacao.id}
            className="dui-trilha__estacao"
            data-atual={i === estacoes.length - 1 ? "true" : undefined}
            data-ramo={estacao.ramo ? "true" : undefined}
            data-mudou={estacao.mudou.length > 0 ? estacao.mudou.join(", ") : undefined}
          >
            {/*
              O delta vem ANTES do nome, e é por isso que ele cai visualmente
              entre os dois pontos: ele descreve o salto que terminou aqui.
              A ausência é dita — em branco, "não vi antes", "vi e nada mudou" e
              "mudou" se pareceriam.
            */}
            {estacao.origem ? null : (
              <span className="dui-trilha__delta">
                {estacao.mudou.length > 0
                  ? estacao.mudou.join(", ")
                  : estacao.primeiraVez
                    ? "first sighting"
                    : "unchanged"}
              </span>
            )}
            <span className="dui-trilha__ponto" aria-hidden="true" />
            <span className="dui-trilha__nome">{estacao.nome}</span>
          </li>
        ))}
      </ol>

      <Inspector
        value={ultima.corpo}
        changedPaths={ultima.mudou}
        label={`body, as it left ${ultima.de}`}
      />
    </div>
  );
}
```

- [ ] **Step 4: Exportar do índice**

Em `packages/depth-ui/src/index.ts`, ao lado dos outros componentes:

```typescript
export { estacoesDe, Trilha } from "./Trilha.js";
export type { Estacao, TrilhaProps } from "./Trilha.js";
```

- [ ] **Step 5: Rodar os testes**

Run: `pnpm vitest run packages/depth-ui/src/Trilha.test.tsx`
Expected: PASS, 6 testes.

Se o teste do `data-mudou` falhar, leia o que ele diz antes de mexer nele: o rótulo é lido na estação de **chegada** do salto, e a lista esperada é `[null, null, "campoA"]` porque a origem não tem salto chegando, o primeiro salto não mudou nada, e o segundo — o que chega em `destino` — é o que mudou.

- [ ] **Step 6: Fronteiras**

Run: `pnpm boundaries`
Expected: PASS. Se falhar, alguma palavra de domínio entrou no componente ou no teste.

- [ ] **Step 7: Commit**

```bash
git add packages/depth-ui/src/Trilha.tsx packages/depth-ui/src/Trilha.test.tsx packages/depth-ui/src/index.ts
git commit -m "feat(depth-ui): a trilha — quando o protagonista é o item, o trajeto é o desenho

O palco é centrado na fábrica, e o item é carga que atravessa. Há assunto em que
o protagonista é o item, e desenhá-lo como um ponto numa esteira trata de raspão
o que o lab é sobre.

As estações são uma a mais que as paradas, porque uma parada é um salto: N
saltos tocam N+1 lugares. E o que mudou é rótulo do SALTO, não da estação —
pendurado na chegada, ele diria 'o destino tem o campo', que é verdade e não é o
assunto."
```

---

## Task 3: O estilo da trilha

Sem hexadecimal — cor sai de token, como manda o cabeçalho do `PainelDaCarga.css`.

**Files:**
- Create: `packages/depth-ui/src/trilha.css`
- Modify: `apps/site/src/layouts/Base.astro:4`

- [ ] **Step 1: Escrever o CSS**

Crie `packages/depth-ui/src/trilha.css`:

```css
/*
  A trilha: o trajeto de um item como espinha do desenho.

  Sem hexadecimal — cor sai de token. A estação é ponto na linha, e o que o
  salto mudou fica ENTRE dois pontos, que é onde ele aconteceu.
*/
.dui-trilha {
  display: grid;
  gap: var(--space-1);
  align-content: start;
  min-width: 0;
  /* Corpo de item tem linha comprida. Sem isto ela sai pela direita e o leitor
     perde justamente o campo que acabou de mudar. */
  overflow: hidden;
}

.dui-trilha__titulo {
  margin: 0;
  font-weight: 600;
}

.dui-trilha__vazio {
  margin: 0;
  color: var(--ink-muted);
  font-size: var(--size-step--1);
  line-height: 1.6;
}

.dui-trilha__estacoes {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: var(--size-step--1);
}

/*
  Cada estação tem duas linhas: o que o salto trouxe, e o nome de onde ele
  chegou. O delta vem em cima, então ele cai entre o ponto de cima e este —
  que é onde ele aconteceu.

  O trilho é desenhado por quem tem para onde ir (`:not(:last-child)`), e não
  pelo de baixo: assim a última estação não estende linha para lugar nenhum,
  que seria a figura afirmando um salto que não houve.
*/
.dui-trilha__estacao {
  display: grid;
  grid-template-columns: 1rem minmax(0, 1fr);
  align-items: start;
  column-gap: var(--space-1);
  color: var(--ink-muted);
}

/* Um braço de leque pendura na MESMA estação de cima, e não continua a linha. */
.dui-trilha__estacao[data-ramo="true"] {
  margin-inline-start: var(--space-2);
}

.dui-trilha__delta {
  grid-column: 2;
  padding-block: 0.15rem;
  color: var(--ink-faint);
}

.dui-trilha__estacao[data-mudou] .dui-trilha__delta {
  color: var(--accent);
}

.dui-trilha__ponto {
  position: relative;
  grid-column: 1;
  inline-size: 0.55rem;
  block-size: 0.55rem;
  margin-block-start: 0.35rem;
  margin-inline-start: 0.2rem;
  border-radius: 50%;
  background: var(--rule);
}

/* O trilho até a estação de baixo. */
.dui-trilha__estacao:not(:last-child) .dui-trilha__ponto::after {
  content: "";
  position: absolute;
  inset-block-start: 0.55rem;
  inset-inline-start: calc(50% - 1px);
  inline-size: 2px;
  block-size: calc(100% + 1.6rem);
  background: var(--rule);
}

.dui-trilha__nome {
  grid-column: 2;
  padding-block-end: var(--space-1);
  color: var(--ink);
  font-weight: 600;
}

.dui-trilha__estacao:last-child .dui-trilha__nome {
  padding-block-end: 0;
}

/* Salto que mudou alguma coisa: o ponto de chegada acende no acento. */
.dui-trilha__estacao[data-mudou] .dui-trilha__ponto {
  background: var(--accent);
}

.dui-trilha__estacao[data-atual="true"] {
  color: var(--ink);
}

.dui-trilha__estacao[data-atual="true"] .dui-trilha__ponto {
  background: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--accent) 22%, transparent);
}

/*
  A linha comprida rola DENTRO da peça, e não empurra a página. Cortar em
  silêncio esconderia o fim de um valor cujo fim costuma ser o assunto.
*/
.dui-trilha .dui-inspector__body {
  overflow-x: auto;
}

.dui-trilha .dui-inspector__line {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
```

- [ ] **Step 2: Carregar em todas as páginas**

`depth-ui.css` já é importado pelo layout base, então a trilha entra por lá. Em `apps/site/src/layouts/Base.astro`, na linha seguinte ao import que já existe:

```astro
import "@ovh/depth-ui/src/depth-ui.css";
import "@ovh/depth-ui/src/trilha.css";
```

- [ ] **Step 3: Verificar que o build aceita**

Run: `pnpm build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/depth-ui/src/trilha.css apps/site/src/layouts/Base.astro
git commit -m "feat(depth-ui): o estilo da trilha, com o trilho desenhado por quem tem para onde ir

A linha entre dois pontos sai do item de cima, e não do de baixo: assim a última
estação não estende trilho para lugar nenhum — que seria a figura afirmando um
salto que não houve."
```

---

## Task 4: O painel dos labs passa a usar a trilha

Uma fonte por fato: a lista de paradas tinha dois desenhos possíveis, e agora tem um. Com isto `three-pillars` e `anatomy-of-a-trace` herdam a trilha **sem código de domínio novo**.

**Files:**
- Modify: `apps/site/src/components/PainelDaCarga.tsx`
- Modify: `apps/site/src/components/PainelDaCarga.css`

- [ ] **Step 1: Reescrever o painel em volta da trilha**

Substitua o corpo de `apps/site/src/components/PainelDaCarga.tsx` por:

```tsx
import { Trilha } from "@ovh/depth-ui";
import type { Parada } from "@ovh/depth-core";

/**
 * O painel lateral de quem está seguindo uma carga num lab.
 *
 * O que ele desenha é a `Trilha` — a mesma peça que o herói usa. O painel só
 * acrescenta a moldura e o botão de parar: nos labs o protagonista continua
 * sendo a fábrica, e o item é convidado. Uma fonte por fato — a lista de
 * paradas tinha dois desenhos possíveis e agora tem um.
 */
export interface PainelDaCargaProps {
  readonly titulo: string;
  readonly trajeto: readonly Parada[];
  readonly onFechar: () => void;
  /** O que dizer quando a carga ainda não apareceu, ou já chegou ao fim. */
  readonly vazio: string;
}

export function PainelDaCarga({ titulo, trajeto, onFechar, vazio }: PainelDaCargaProps) {
  return (
    <aside className="carga-painel" aria-label="Following one item">
      <header className="carga-painel__topo">
        <button type="button" onClick={onFechar}>
          stop following
        </button>
      </header>
      <Trilha trajeto={trajeto} titulo={titulo} vazio={vazio} />
    </aside>
  );
}
```

- [ ] **Step 2: Tirar do CSS o que virou trilha**

Em `apps/site/src/components/PainelDaCarga.css`, apague os blocos que agora vivem em `trilha.css`: `.carga-painel__titulo`, `.carga-painel__vazio`, `.carga-painel__trajeto`, `.carga-painel__trajeto li`, as duas variantes `[data-mudou]`/`[data-atual]`, `.carga-painel__delta`, as duas regras `.carga-painel .dui-inspector__*` e o bloco `@media` do fim. Ficam só `.carga-painel` e `.carga-painel__topo`, e o `__topo` passa a alinhar o botão à direita:

```css
.carga-painel__topo {
  display: flex;
  justify-content: flex-end;
}
```

- [ ] **Step 3: Conferir no navegador que os dois labs continuam contando a mesma história**

Run: `pnpm dev`
Abra `http://localhost:4321/labs/three-pillars/` e `http://localhost:4321/labs/anatomy-of-a-trace/`, clique num item numa esteira e confirme:
- nos pilares, o leque dá três estações saindo da mesma chegada, e cada braço mostra o que **aquele** guardou;
- na anatomia, o trajeto mostra o `traceparent` sendo reescrito a cada serviço.

Encerre o servidor.

- [ ] **Step 4: Ajustar os seletores de `seguir-a-carga.spec.ts`**

Este arquivo lê a lista antiga em quatro lugares. Troque **todo** `.carga-painel__trajeto li` por `.dui-trilha__estacao` e `.carga-painel .dui-inspector__line` por `.dui-trilha .dui-inspector__line`.

Duas asserções mudam de índice, e por uma razão que você precisa entender para não "consertar" errado: **agora há uma estação a mais na frente**, a origem, porque N saltos tocam N+1 lugares. No teste da anatomia, a linha que diz `first sighting` deixa de ser a primeira e passa a ser a segunda:

```typescript
  const paradas = await page.locator(".dui-trilha__estacao").allTextContents();
  // A primeira estação é a ORIGEM: ninguém chegou nela por um salto, então ela
  // não tem delta. `first sighting` é da chegada seguinte.
  expect(paradas[1]).toContain("first sighting");
  expect(paradas.slice(2).every((p) => p.includes("traceparent"))).toBe(true);
```

O teto do `.poll` do mesmo teste sobe de `3` para `4`, pela mesma razão.

O teste dos pilares **não muda de asserção**: ele procura a linha que contém `metric-store` e cobra que ela contenha `duration_ms`, e com o delta na chegada isso continua verdadeiro — cada braço do leque carrega o que ele guardou. Se ele passar a falhar, o defeito é real e não é do teste.

- [ ] **Step 5: e2e dos dois labs**

Run: `pnpm --filter @ovh/site test:e2e -g "trajeto"`
Expected: PASS, os dois testes de seguir a carga.

Run: `pnpm --filter @ovh/site test:e2e -g "pillars" && pnpm --filter @ovh/site test:e2e -g "anatomy"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/site/src/components/PainelDaCarga.tsx apps/site/src/components/PainelDaCarga.css apps/site/tests
git commit -m "refactor(site): o painel dos labs desenha a trilha, e para de ter desenho próprio

A lista de paradas tinha dois desenhos possíveis e agora tem um. Nos labs o
protagonista continua sendo a fábrica, então o item segue no painel lateral — o
que muda é que a moldura deixou de saber desenhar trajeto."
```

---

## Task 5: O mundo do herói

`service → collector → backend`. A menor história inteira do OTel, e de propósito não é o lab de ninguém: `providers` mora dentro do processo, `anatomy` mora entre quatro processos, e o herói é o oleoduto visto de fora.

**Files:**
- Create: `packages/otel-domain/src/heroi/carga.ts`, `labels.ts`, `world.ts`, `estado.ts`, `views.ts`
- Create: `packages/otel-domain/src/heroi/world.test.ts`, `estado.test.ts`
- Modify: `packages/otel-domain/src/index.ts`

- [ ] **Step 1: A carga e os rótulos**

Crie `packages/otel-domain/src/heroi/carga.ts`:

```typescript
import { idHex } from "../anatomia/carga.js";

/**
 * O que viaja no herói: um span, e só.
 *
 * Ele nasce no serviço com o recurso que o processo declarou, e o collector
 * acrescenta o dele. É o enriquecimento mais simples que o OTLP tem, e é o que
 * a trilha desenha: o mesmo item, com um campo a mais depois de uma parada.
 */
export interface SpanDoHeroi {
  readonly n: number;
  readonly traceId: string;
  readonly spanId: string;
  readonly name: string;
  readonly durationMs: number;
  readonly resource: Readonly<Record<string, string>>;
}

/** As rotas que o serviço atende, em rodízio. Nomes de verdade, e curtos. */
const ROTAS = ["GET /checkout", "POST /cart", "GET /catalog"] as const;

/**
 * Um span novo. Determinístico: o mesmo carregamento conta a mesma história, e
 * uma vitrine que muda de resposta entre dois carregamentos não é evidência de
 * nada.
 */
export function spanDoHeroi(n: number): SpanDoHeroi {
  return {
    n,
    traceId: idHex(32, `heroi:trace:${n}`),
    spanId: idHex(16, `heroi:span:${n}`),
    name: ROTAS[n % ROTAS.length]!,
    durationMs: 40 + ((n * 37) % 160),
    resource: { "service.name": "checkout" },
  };
}
```

Crie `packages/otel-domain/src/heroi/labels.ts`:

```typescript
/** O handbook é em inglês; o vocabulário do leitor mora aqui. */
export const ROTULOS_HEROI = {
  sistema: "One span, from the process to the backend",
  service: "service",
  collector: "collector",
  backend: "backend",
} as const;

/** O que o collector acrescenta ao recurso de tudo que passa por ele. */
export const ATRIBUTO_DO_COLLECTOR = "collector.name";
export const VALOR_DO_COLLECTOR = "otelcol";
```

- [ ] **Step 2: Escrever o teste do mundo, que falha**

Crie `packages/otel-domain/src/heroi/world.test.ts`:

```typescript
import { World } from "@ovh/depth-core";
import { describe, expect, it } from "vitest";
import { ATRIBUTO_DO_COLLECTOR } from "./labels.js";
import { heroiWorld } from "./world.js";
import type { SpanDoHeroi } from "./carga.js";

const spansEmVoo = (state: { readonly flight: readonly { readonly message: { readonly data: Readonly<Record<string, unknown>> } }[] }): readonly SpanDoHeroi[] =>
  state.flight.flatMap((item) =>
    Array.isArray(item.message.data["spans"]) ? (item.message.data["spans"] as SpanDoHeroi[]) : [],
  );

describe("heroiWorld", () => {
  it("o serviço emite span, e ele chega ao backend", () => {
    const mundo = new World(heroiWorld());
    mundo.advance(12);
    // `nodes`, e não `objects`: é como o estado do motor se chama, e é o que
    // todos os irmãos leem (`anatomia/estado.ts`, `providers/world.test.ts`).
    const backend = mundo.state.nodes["backend"] as { readonly recebidos: number } | undefined;
    expect(backend?.recebidos ?? 0).toBeGreaterThan(0);
  });

  it("o collector acrescenta o atributo dele, e o serviço não", () => {
    /*
      É o fato inteiro que a trilha do herói desenha. Se o collector parar de
      enriquecer, a trilha para de ter o que mostrar — e este teste é quem
      denuncia isso antes da landing.
    */
    const mundo = new World(heroiWorld());
    const antes = new Set<string>();
    const depois = new Set<string>();
    for (let i = 0; i < 20; i += 1) {
      mundo.advance(1);
      for (const item of mundo.state.flight) {
        const spans = Array.isArray(item.message.data["spans"])
          ? (item.message.data["spans"] as SpanDoHeroi[])
          : [];
        for (const span of spans) {
          const tem = ATRIBUTO_DO_COLLECTOR in span.resource;
          (item.from === "service" ? antes : depois).add(String(tem));
        }
      }
    }
    expect(antes.has("true")).toBe(false);
    expect(depois.has("true")).toBe(true);
  });

  it("o span mantém o traceId ao atravessar o collector", () => {
    /*
      Enriquecer não é criar outro: o collector acrescenta campo e devolve a
      MESMA coisa. Se o traceId mudasse, a trilha estaria desenhando dois itens
      como se fossem um.
    */
    const mundo = new World(heroiWorld());
    const porN = new Map<number, Set<string>>();
    for (let i = 0; i < 20; i += 1) {
      mundo.advance(1);
      for (const span of spansEmVoo(mundo.state)) {
        const vistos = porN.get(span.n) ?? new Set<string>();
        vistos.add(span.traceId);
        porN.set(span.n, vistos);
      }
    }
    expect([...porN.values()].every((ids) => ids.size === 1)).toBe(true);
  });
});
```

- [ ] **Step 3: Rodar para ver falhar**

Run: `pnpm vitest run packages/otel-domain/src/heroi/world.test.ts`
Expected: FAIL — `Failed to resolve import "./world.js"`.

- [ ] **Step 4: Escrever o mundo**

Crie `packages/otel-domain/src/heroi/world.ts`:

```typescript
import type { AnyObject, Emission, ObjectSpec, Wire, WorldSpec } from "@ovh/depth-core";
import { spanDoHeroi } from "./carga.js";
import type { SpanDoHeroi } from "./carga.js";
import { ATRIBUTO_DO_COLLECTOR, ROTULOS_HEROI, VALOR_DO_COLLECTOR } from "./labels.js";

/**
 * O mundo do herói da landing: `service → collector → backend`.
 *
 * A menor história inteira que o OTel tem, e de propósito **não é o lab de
 * ninguém**: `providers` mora dentro do processo, `anatomy-of-a-trace` mora
 * entre quatro processos, e este é o oleoduto visto de fora, com um span
 * seguido de ponta a ponta. É o trailer — cada uma das três caixas tem um lab
 * esperando atrás dela.
 *
 * Sem parâmetro nenhum de propósito: controle é assunto de lab, e o herói que
 * pede configuração já pediu demais de quem chegou agora.
 *
 * Escala de tempo: um tick é um segundo, como nos outros mundos do `otel.model`.
 */

const spansDe = (data: Readonly<Record<string, unknown>>): readonly SpanDoHeroi[] =>
  Array.isArray(data["spans"]) ? (data["spans"] as readonly SpanDoHeroi[]) : [];

/** Quantos o backend guarda antes de a vitrine virar teste de memória. */
const TETO = 40;

const servico: ObjectSpec<{ readonly n: number }> = {
  id: "service",
  kind: "source",
  label: ROTULOS_HEROI.service,
  leaf: true,
  init: () => ({ n: 0 }),
  behavior: (state, _inbox, ctx) => {
    if (ctx.phase !== "commit") return { state, out: [] };
    const n = state.n + 1;
    return {
      state: { n },
      out: [{ port: "export", message: ctx.emit("span", 1, { spans: [spanDoHeroi(n)] }) }],
    };
  },
};

/**
 * O collector: ele **acrescenta** e repassa.
 *
 * Não cria coisa nova — o span que sai é o que entrou com um campo a mais. É o
 * fato inteiro que a trilha desenha, e é por isso que o `traceId` não pode
 * mudar aqui.
 */
const collector: ObjectSpec<{ readonly passaram: number }> = {
  id: "collector",
  kind: "router",
  label: ROTULOS_HEROI.collector,
  leaf: true,
  init: () => ({ passaram: 0 }),
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit" || inbox.length === 0) return { state, out: [] };
    const spans = inbox.flatMap((m) => spansDe(m.data));
    if (spans.length === 0) return { state, out: [] };
    const enriquecidos = spans.map((span) => ({
      ...span,
      resource: { ...span.resource, [ATRIBUTO_DO_COLLECTOR]: VALOR_DO_COLLECTOR },
    }));
    const out: Emission[] = [
      { port: "export", message: ctx.emit("span", enriquecidos.length, { spans: enriquecidos }) },
    ];
    return { state: { passaram: state.passaram + spans.length }, out };
  },
};

const backend: ObjectSpec<{ readonly recebidos: number; readonly spans: readonly SpanDoHeroi[] }> = {
  id: "backend",
  kind: "store",
  label: ROTULOS_HEROI.backend,
  leaf: true,
  init: () => ({ recebidos: 0, spans: [] }),
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit" || inbox.length === 0) return { state, out: [] };
    const chegando = inbox.flatMap((m) => spansDe(m.data));
    if (chegando.length === 0) return { state, out: [] };
    return {
      state: {
        recebidos: state.recebidos + chegando.length,
        spans: [...state.spans, ...chegando].slice(-TETO),
      },
      out: [],
    };
  },
};

export function heroiWorld(): WorldSpec {
  const root: AnyObject = {
    id: "pipeline",
    kind: "composite",
    label: ROTULOS_HEROI.sistema,
    entry: "service",
    exit: "backend",
    children: [servico, collector, backend],
  };

  const wires: Wire[] = [
    { from: "service", port: "export", to: "collector" },
    { from: "collector", port: "export", to: "backend" },
  ];

  return { id: "otel-hero", seed: 7, root, wires, params: {}, edgeTicks: 2 };
}
```

- [ ] **Step 5: Rodar até passar**

Run: `pnpm vitest run packages/otel-domain/src/heroi/world.test.ts`
Expected: PASS, 3 testes.

Se o segundo teste falhar com `antes.has("true") === true`, o span está saindo do serviço já com o atributo do collector — provavelmente porque o objeto foi mutado no lugar em vez de copiado. O `map` acima cria objeto novo; confirme que ninguém escreveu `span.resource[X] = ...`.

- [ ] **Step 6: O leitor da carga, com teste**

Crie `packages/otel-domain/src/heroi/estado.test.ts`:

```typescript
import { World } from "@ovh/depth-core";
import { describe, expect, it } from "vitest";
import { LEITOR_DO_SPAN } from "./estado.js";
import { heroiWorld } from "./world.js";

describe("LEITOR_DO_SPAN", () => {
  it("dá a MESMA chave ao span antes e depois do collector", () => {
    /*
      O motor dá id novo a cada emissão — e está certo, cada salto é uma
      mensagem nova. Quem diz que duas mensagens são a mesma coisa é o domínio,
      e é esta chave. Se ela mudasse no meio do caminho, o trajeto do herói
      acabaria na primeira parada.
    */
    const mundo = new World(heroiWorld());
    const chavesPorTrace = new Map<string, Set<string>>();
    for (let i = 0; i < 20; i += 1) {
      mundo.advance(1);
      for (const item of mundo.state.flight) {
        const spans = item.message.data["spans"];
        if (!Array.isArray(spans) || spans.length === 0) continue;
        const traceId = String((spans[0] as { traceId: string }).traceId);
        const chave = LEITOR_DO_SPAN.chave(item.message);
        if (chave === undefined) continue;
        const vistas = chavesPorTrace.get(traceId) ?? new Set<string>();
        vistas.add(chave);
        chavesPorTrace.set(traceId, vistas);
      }
    }
    expect(chavesPorTrace.size).toBeGreaterThan(0);
    expect([...chavesPorTrace.values()].every((c) => c.size === 1)).toBe(true);
  });

  it("o corpo mostra o recurso, que é onde o enriquecimento acontece", () => {
    const mundo = new World(heroiWorld());
    mundo.advance(6);
    const emVoo = mundo.state.flight.find((item) =>
      Array.isArray(item.message.data["spans"]),
    );
    expect(emVoo).toBeDefined();
    const corpo = LEITOR_DO_SPAN.corpo(emVoo!.message) as Record<string, unknown>;
    expect(corpo["resource"]).toBeDefined();
    expect(corpo["name"]).toBeDefined();
  });
});
```

Run: `pnpm vitest run packages/otel-domain/src/heroi/estado.test.ts`
Expected: FAIL — `Failed to resolve import "./estado.js"`.

- [ ] **Step 7: Escrever o leitor**

Crie `packages/otel-domain/src/heroi/estado.ts`:

```typescript
import type { SpanDoHeroi } from "./carga.js";

/**
 * Quem diz que duas mensagens são a mesma coisa.
 *
 * O motor dá id novo a cada emissão, e está certo: cada salto é uma mensagem
 * nova. A identidade é conhecimento de domínio, e aqui ela é o `traceId` — o
 * mesmo span atravessando o collector continua sendo aquele span.
 *
 * `noTrajeto` fica de fora: neste mundo tudo que anda é o span, e não há
 * produto que não continue o caminho. Ausente, tudo é parada.
 */
export const LEITOR_DO_SPAN = {
  chave: (mensagem: { readonly data: Readonly<Record<string, unknown>> }): string | undefined => {
    const spans = mensagem.data["spans"];
    if (!Array.isArray(spans) || spans.length === 0) return undefined;
    const primeiro = spans[0] as Partial<SpanDoHeroi>;
    return primeiro.traceId === undefined ? undefined : `span:${primeiro.traceId}`;
  },

  corpo: (mensagem: { readonly data: Readonly<Record<string, unknown>> }): unknown => {
    const spans = mensagem.data["spans"];
    if (!Array.isArray(spans) || spans.length === 0) return {};
    const span = spans[0] as SpanDoHeroi;
    return {
      traceId: span.traceId,
      spanId: span.spanId,
      name: span.name,
      durationMs: span.durationMs,
      resource: span.resource,
    };
  },
};

/** O título que a trilha mostra: o span, curto o bastante para caber. */
export const tituloDoSpan = (chave: string): string => `span ${chave.replace("span:", "").slice(0, 8)}`;
```

Run: `pnpm vitest run packages/otel-domain/src/heroi/estado.test.ts`
Expected: PASS, 2 testes.

- [ ] **Step 8: A vista**

Crie `packages/otel-domain/src/heroi/views.ts`:

```typescript
import type { View } from "@ovh/depth-ui";
import { ROTULOS_HEROI } from "./labels.js";

/**
 * A vista do herói: três caixas numa fileira, e nada mais.
 *
 * Larga e baixa porque ela divide a primeira dobra da página com a trilha, e
 * uma vitrine que pede rolagem para ser vista inteira não é vitrine.
 */
export const VIEW_HEROI: View = {
  id: "otel-hero",
  focus: "pipeline",
  title: ROTULOS_HEROI.sistema,
  width: 720,
  height: 200,
  registro: "blocos",
  places: [
    { id: "service", x: 30, y: 55, w: 170, h: 90 },
    { id: "collector", x: 275, y: 55, w: 170, h: 90 },
    { id: "backend", x: 520, y: 55, w: 170, h: 90 },
  ],
};

export const VIEWS_DO_HEROI: readonly View[] = [VIEW_HEROI];
```

- [ ] **Step 9: Exportar do índice do domínio**

No fim de `packages/otel-domain/src/index.ts`:

```typescript
// O herói da landing: o oleoduto visto de fora, com um span seguido de ponta a ponta.
export { heroiWorld } from "./heroi/world.js";
export { LEITOR_DO_SPAN, tituloDoSpan } from "./heroi/estado.js";
export { spanDoHeroi } from "./heroi/carga.js";
export type { SpanDoHeroi } from "./heroi/carga.js";
export { ATRIBUTO_DO_COLLECTOR, ROTULOS_HEROI, VALOR_DO_COLLECTOR } from "./heroi/labels.js";
export { VIEW_HEROI, VIEWS_DO_HEROI } from "./heroi/views.js";
```

- [ ] **Step 10: Tipos e suíte**

Run: `pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add packages/otel-domain/src/heroi packages/otel-domain/src/index.ts
git commit -m "feat(otel): o mundo do herói — o oleoduto visto de fora

service → collector → backend, sem parâmetro nenhum. A menor história inteira do
OTel, e de propósito não é o lab de ninguém: providers mora dentro do processo,
anatomy mora entre quatro processos, e este é o trailer — cada caixa tem um lab
esperando atrás dela.

O collector acrescenta e repassa: o span que sai é o que entrou com um campo a
mais, e o traceId não muda. Enriquecer não é criar outro, e é isso que permite
seguir a mesma coisa até o fim."
```

---

## Task 6: O `HeroSim` reescrito

Sobre `World`/`Explorer`, sem controle nenhum, abrindo já seguindo. Uma vitrine que exige um clique para mostrar o que ela tem de diferente mostra, para a maioria das visitas, nada.

**Files:**
- Rewrite: `apps/site/src/components/HeroSim.tsx`
- Rewrite: `apps/site/src/components/HeroSim.css`
- Delete: `apps/site/src/labs/hero/scenario.ts`, `apps/site/src/labs/hero/scenario.test.ts`

- [ ] **Step 1: Escrever o componente**

Substitua todo o conteúdo de `apps/site/src/components/HeroSim.tsx` por:

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { World, indexTree, seguir } from "@ovh/depth-core";
import type { Parada } from "@ovh/depth-core";
import { Trilha } from "@ovh/depth-ui";
import {
  heroiWorld,
  LEITOR_DO_SPAN,
  tituloDoSpan,
  VIEWS_DO_HEROI,
} from "@ovh/otel-domain";
import { Explorer } from "./Explorer.js";

/**
 * O herói da landing: o mesmo motor que o leitor vai encontrar no primeiro lab.
 *
 * Ele roda o mundo do herói e **abre já seguindo** um span — a trilha ao lado
 * do palco desde o primeiro quadro. Uma vitrine que exige um clique para mostrar
 * o que tem de diferente mostra, para a maioria das visitas, nada.
 *
 * **Sem nenhum controle**, de propósito: controle é assunto de lab. Os gestos
 * são três — a carga anda sozinha, clicar em outro item troca quem está sendo
 * seguido, e duplo clique numa caixa desce para dentro dela.
 */

const TICK_MS = 700;

export function HeroSim() {
  const [, setTick] = useState(0);
  const [seguindo, setSeguindo] = useState<string | undefined>(undefined);
  const [trajeto, setTrajeto] = useState<readonly Parada[]>([]);
  const seguindoRef = useRef<string | undefined>(undefined);
  seguindoRef.current = seguindo;

  const spec = useMemo(() => heroiWorld(), []);
  const arvore = useMemo(() => indexTree(spec.root, spec.channels), [spec]);
  const mundo = useMemo(() => new World(spec), [spec]);
  const mundoRef = useRef<World | null>(null);
  mundoRef.current = mundo;

  useEffect(() => {
    /*
      Quem pediu para não ver movimento não vê: o palco fica no estado inicial,
      legível e parado. É o mesmo respeito que o herói antigo tinha.
    */
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = window.setInterval(() => {
      const m = mundoRef.current;
      if (m === null) return;
      m.advance(1);
      setTick(m.tick);

      const chave = seguindoRef.current;
      if (chave === undefined) {
        /*
          Ninguém escolheu ainda: o herói escolhe por conta própria o primeiro
          item que aparecer, e é assim que a trilha está aberta desde o começo.
        */
        const primeiro = m.state.flight
          .map((item) => LEITOR_DO_SPAN.chave(item.message))
          .find((c): c is string => c !== undefined);
        if (primeiro !== undefined) {
          setSeguindo(primeiro);
          setTrajeto(seguir([], m.state, primeiro, LEITOR_DO_SPAN));
        }
        return;
      }
      setTrajeto((antes) => seguir(antes, m.state, chave, LEITOR_DO_SPAN));
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [mundo]);

  const seguirCarga = (chave: string | undefined): void => {
    // Trajeto novo a cada escolha: misturar o de duas cargas seria a trilha
    // afirmando um percurso que ninguém andou.
    if (chave === undefined) return;
    setSeguindo(chave);
    setTrajeto(seguir([], mundo.state, chave, LEITOR_DO_SPAN));
  };

  return (
    <div className="hero-sim">
      <Explorer
        tree={arvore}
        wires={spec.wires}
        state={mundo.state}
        previous={mundo.previousState}
        edgeTicks={spec.edgeTicks ?? 1}
        tickMs={TICK_MS}
        views={VIEWS_DO_HEROI}
        inicial="pipeline"
        chaveDaCarga={LEITOR_DO_SPAN.chave}
        cargaSeguida={seguindo}
        onSeguirCarga={seguirCarga}
      />

      <Trilha
        trajeto={trajeto}
        titulo={seguindo === undefined ? "waiting for the first span" : tituloDoSpan(seguindo)}
        vazio="The first span is on its way."
      />
    </div>
  );
}
```

- [ ] **Step 2: Apagar o andaime do site**

```bash
git rm apps/site/src/labs/hero/scenario.ts apps/site/src/labs/hero/scenario.test.ts
```

- [ ] **Step 3: O CSS do herói**

Substitua `apps/site/src/components/HeroSim.css` por:

```css
/*
  O herói: o palco à esquerda, a trilha à direita.

  A trilha divide a primeira dobra com o palco de propósito — ela é a metade
  nova, e escondê-la abaixo do palco seria publicar a vitrine com a novidade
  fora da tela.
*/
.hero-sim {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  gap: var(--space-3);
  align-items: start;
  padding: var(--space-2);
  border: 1px solid var(--rule);
  border-radius: var(--radius-3);
  background: var(--paper-raised);
}

@media (max-width: 70rem) {
  .hero-sim {
    grid-template-columns: minmax(0, 1fr);
  }
}
```

- [ ] **Step 4: Tipos e build**

Run: `pnpm typecheck && pnpm build`
Expected: PASS. Se o typecheck reclamar de `spec.channels`, confira em `AnatomiaLab.tsx:95` como `indexTree` é chamado lá e siga o mesmo.

- [ ] **Step 5: Olhar com os próprios olhos**

Run: `pnpm dev`
Abra `http://localhost:4321/` e confirme, na ordem:
1. a carga anda sozinha, sem ninguém clicar em nada;
2. a trilha aparece com o primeiro span, sozinha, em poucos segundos;
3. quando o span passa pelo collector, a trilha ganha a estação e o `collector.name` aparece marcado no corpo;
4. clicar em outro item na esteira troca quem está sendo seguido, e a trilha recomeça;
5. duplo clique numa caixa desce para dentro dela.

Encerre o servidor.

- [ ] **Step 6: Commit**

```bash
git add apps/site/src/components/HeroSim.tsx apps/site/src/components/HeroSim.css apps/site/src/labs
git commit -m "feat(site): o herói roda o mesmo motor que os labs, e abre já seguindo um span

A landing e os labs eram dois produtos: o herói era o último consumidor do
modelo antigo, com os quatro níveis fixos, enquanto todo lab dos dois handbooks
roda World/Explorer.

Ele abre já seguindo porque uma vitrine que exige um clique para mostrar o que
tem de diferente mostra, para a maioria das visitas, nada. E não tem controle
nenhum: controle é assunto de lab."
```

---

## Task 7: A landing diz o pilar, e para de vender a escada morta

**Files:**
- Modify: `apps/site/src/pages/index.astro`

- [ ] **Step 1: Trocar a constante `LEVELS` pelo que o motor faz**

Em `apps/site/src/pages/index.astro`, substitua o bloco de comentário e a constante `LEVELS` (linhas 12-29) por:

```astro
/**
 * O que o motor faz, e por que ele existe.
 *
 * Aqui viviam os quatro níveis fixos, numerados e iguais para todo assunto.
 * Eles morreram quando profundidade virou a árvore de composição, e a seção
 * continuou vendendo a escada única. Ver `DECISIONS.md` §9: abrir uma CPU até o
 * fio é descida de verdade, e um trace não tem *dentro* — ele tem árvore
 * espalhada por processos que só se encontram no Collector.
 *
 * Os nomes velhos não são escritos aqui de propósito: a varredura de
 * `landing.spec.ts` procura por eles em `apps/site/src` para que a escada não
 * volte por descuido, e uma guarda que abre exceção para comentário deixa de
 * ser guarda.
 */
const GESTOS = [
  {
    name: "Open a part",
    line: "Double-click any box and you are inside it, looking at the parts it is made of.",
  },
  {
    name: "Open a message",
    line: "The thing moving on the wire has a body, and you can read it field by field.",
  },
  {
    name: "Follow one item",
    line: "Click it and its whole path opens up, with what each stop changed lit where it lives.",
  },
] as const;
```

- [ ] **Step 2: Trocar a seção `.levels`**

Substitua a `<section class="levels">` inteira por:

```astro
    <section class="levels">
      <p class="levels__intro">
        Underneath every handbook is one engine: a graph you can go into. It
        draws a running flow, and each layer of abstraction opens into the one
        below — not another diagram of the same thing, the same thing seen
        closer.
      </p>
      <ol class="levels__list">
        {
          GESTOS.map((gesto) => (
            <li class="levels__item">
              <span class="levels__name">{gesto.name}</span>
              <span class="levels__line">{gesto.line}</span>
            </li>
          ))
        }
      </ol>
      <p class="levels__note mono">
        And when a subject is not a flow with layers — or when the thing that
        matters is one item and not the pipeline it crosses — the lab is a
        different one, built for it. A street is a poor way to explain a door.
      </p>
    </section>
```

- [ ] **Step 3: Corrigir os dois textos do herói que mentem**

No mesmo arquivo, o parágrafo que hoje diz *"Below is a piece of the OpenTelemetry handbook: turn off context propagation and the picture breaks — and so does the payload underneath it, because they are the same data."* passa a:

```astro
        <p class="prose">
          One engine, many subjects. Below is a piece of the OpenTelemetry
          handbook, running: a span leaving a service, picking up what the
          collector adds to it, and landing in a backend. Click a different one
          and you follow that one instead.
        </p>
```

E no lede, a frase *"then open it up and read the exact bytes that produced what you just saw"* passa a *"then open it up and read the exact data that produced what you just saw"* — "bytes" era herança do nível Wire, que não existe mais.

- [ ] **Step 4: Ajustar o CSS da lista, que perdeu a coluna do id**

No `<style>` do mesmo arquivo, procure a regra de `.levels__item`. Ela hoje conta com três colunas (id, nome, linha). Deixe-a com duas:

```css
  .levels__item {
    display: grid;
    grid-template-columns: minmax(0, 12rem) minmax(0, 1fr);
    gap: var(--space-1) var(--space-2);
    padding-block: var(--space-1);
    border-block-start: 1px solid var(--rule);
  }
```

E apague a regra `.levels__id` inteira, que não tem mais elemento.

- [ ] **Step 5: Build e olhada**

Run: `pnpm build`
Expected: PASS.

Run: `pnpm dev` e confira em `http://localhost:4321/` que a seção não tem coluna vazia e que nada na página fala em L0/L1/L2/L3. Encerre o servidor.

- [ ] **Step 6: Commit**

```bash
git add apps/site/src/pages/index.astro
git commit -m "feat(site): a landing diz o que o motor faz, e para de vender uma escada que morreu

Os quatro níveis fixos morreram quando profundidade virou a árvore de
composição, e a seção continuou prometendo uma escada única para todo assunto —
a mentira silenciosa no lugar mais visível do site.

No lugar deles, os três gestos que valem para uma CPU e para um trace, e a
segunda metade do pilar, que não estava em lugar nenhum: quando o assunto não é
fluxo com camadas, ou quando o protagonista é o item, o lab é outro."
```

---

## Task 8: Os e2e do herói

Os quatro testes de hoje viram estes quatro. Cada um cobra uma coisa que pode quebrar em silêncio.

**Files:**
- Modify: `apps/site/tests/landing.spec.ts:14-100`

- [ ] **Step 1: Substituir os quatro testes do herói**

Em `apps/site/tests/landing.spec.ts`, apague os testes `"the landing loads and the hero hydrates"`, `"turning propagation off breaks the trace"`, `"with propagation on, both spans share the trace"` e `"the timeline lets you stop and read the payload"`, mais a função `traceIdsDoInspetor`. Mantenha `aguardarHidratacao` e tudo do mapa para baixo. No lugar, ponha:

```typescript
test("the landing loads and the hero hydrates", async ({ page }) => {
  await page.goto("");

  await expect(page.locator("h1")).toContainText("actually works");
  await expect(page.locator(".hero-sim")).toBeVisible();
});

test("the hero runs on its own", async ({ page }) => {
  await page.goto("");
  await aguardarHidratacao(page);

  /*
    Dois quadros diferentes, e não "existe um item na tela".

    O HTML do servidor já traz o palco desenhado: afirmar que ele existe não
    prova que alguma coisa está rodando. O que prova é o desenho MUDAR sozinho,
    sem ninguém tocar em nada.
  */
  const palco = page.locator(".hero-sim .dui-stage");
  const primeiro = await palco.innerHTML();
  await expect
    .poll(async () => (await palco.innerHTML()) !== primeiro, { timeout: 15_000 })
    .toBe(true);
});

test("the hero opens already following a span, and the collector enriches it", async ({ page }) => {
  await page.goto("");
  await aguardarHidratacao(page);

  /*
    A afirmação inteira do herói em um teste: o span atravessa o collector e
    ganha um campo que ele não tinha ao sair do serviço.

    Se o collector parar de enriquecer, este teste cai — e é para isso que ele
    existe. Uma trilha que mostra três estações e nenhuma mudança seria uma
    vitrine bonita afirmando que nada acontece.
  */
  const trilha = page.locator(".hero-sim .dui-trilha");
  await expect(trilha).toBeVisible({ timeout: 15_000 });

  await expect
    .poll(async () => await trilha.locator(".dui-trilha__estacao").count(), { timeout: 20_000 })
    .toBeGreaterThanOrEqual(2);

  await expect(
    trilha.locator('.dui-trilha__estacao[data-mudou*="collector.name"]'),
  ).toHaveCount(1, { timeout: 20_000 });

  await expect(
    trilha.locator('.dui-inspector__line[data-changed="true"]').first(),
  ).toContainText("collector.name");
});

test("double-clicking a box goes inside it", async ({ page }) => {
  await page.goto("");
  await aguardarHidratacao(page);

  const palco = page.locator(".hero-sim .dui-stage");
  const antes = await palco.getAttribute("aria-label");

  await page.locator('.hero-sim [data-objeto="collector"]').first().dblclick();

  /*
    A vista de dentro não pode ser a de fora. Comparar o rótulo do palco é o
    jeito mais barato de cobrar isso sem depender de qual desenho o motor
    escolheu montar lá dentro.
  */
  await expect
    .poll(async () => await palco.getAttribute("aria-label"), { timeout: 10_000 })
    .not.toBe(antes);
});

test("nothing on the site still sells the four fixed levels", async () => {
  /*
    A escada morta não pode voltar por descuido. É varredura de código porque a
    mentira silenciosa não aparece em nenhuma asserção de tela: uma página que
    promete L2 Wire e nunca mostra um só continua verde.
  */
  const { execSync } = await import("node:child_process");
  const achados = execSync(
    'grep -rnE "DepthShell|FlowDiagram|\\bL0\\b|\\bL1\\b|\\bL2\\b|\\bL3\\b" apps/site/src || true',
    { cwd: process.cwd().replace(/\/apps\/site$/u, ""), encoding: "utf8" },
  );
  expect(achados.trim()).toBe("");
});
```

- [ ] **Step 2: O contraste da trilha, nos dois papéis**

A spec cobra contraste nos dois papéis, e na trilha o que carrega significado é o acento: a estação que mudou alguma coisa tem de se distinguir da que não mudou — **nos dois temas**, e não por acaso num deles.

Copie o jeito que já existe: `apps/site/tests/gates-lab.spec.ts:157` tem `noTema()`, que troca pelo **botão do próprio site** e prova, no fim, que a troca aconteceu. Um laço de temas que não troca o tema é um teste que finge cobrir dois casos e cobre um.

Acrescente a `landing.spec.ts`:

```typescript
test("na trilha, a parada que mudou algo se distingue da que não mudou, nos dois temas", async ({
  page,
}) => {
  await page.goto("");
  await aguardarHidratacao(page);

  const trilha = page.locator(".hero-sim .dui-trilha");
  const mudou = trilha.locator(".dui-trilha__estacao[data-mudou] .dui-trilha__delta").first();
  const igual = trilha
    .locator(".dui-trilha__estacao:not([data-mudou]) .dui-trilha__delta")
    .first();
  await expect(mudou).toBeVisible({ timeout: 20_000 });
  await expect(igual).toBeVisible();

  const fundoPorTema: string[] = [];
  for (const tema of ["light", "dark"] as const) {
    await noTema(page, tema);
    fundoPorTema.push(await page.evaluate(() => getComputedStyle(document.body).backgroundColor));
    const a = await mudou.evaluate((el) => getComputedStyle(el).color);
    const b = await igual.evaluate((el) => getComputedStyle(el).color);
    // Se as duas tintas forem iguais, o acento não está dizendo nada, e a
    // trilha vira uma lista de nomes com um enfeite.
    expect(a, `o delta que mudou se distingue no tema ${tema}`).not.toBe(b);
  }
  // A prova de que o laço acima trocou mesmo de tema.
  expect(fundoPorTema[0], "o tema mudou de verdade").not.toBe(fundoPorTema[1]);
});
```

`noTema` mora hoje em `gates-lab.spec.ts`. **Não copie a função**: mova-a para um arquivo compartilhado (`apps/site/tests/tema.ts`) e importe nos dois. Duas cópias divergem, e a que divergir vai fingir que troca o tema.

- [ ] **Step 3: Descobrir os seletores reais do palco**

Os seletores `.dui-stage`, `[data-objeto="collector"]` e o `aria-label` do palco são o que o `Stage` publica hoje — **confirme antes de rodar**:

Run: `grep -n "className=\"dui-stage\|aria-label\|data-objeto" packages/depth-ui/src/Stage.tsx`

Se os nomes forem outros, use os que existem e **não** invente atributo novo no `Stage` só para o teste: um atributo que só o teste usa é um segundo fato sobre a mesma coisa.

- [ ] **Step 4: Rodar os e2e da landing**

Run: `pnpm --filter @ovh/site test:e2e -g "hero"`
Expected: PASS.

Run: `pnpm --filter @ovh/site test:e2e`
Expected: PASS, suíte inteira.

- [ ] **Step 5: Commit**

```bash
git add apps/site/tests/landing.spec.ts apps/site/tests/tema.ts apps/site/tests/gates-lab.spec.ts
git commit -m "test(site): os testes do herói cobram o que pode quebrar em silêncio

Rodar sozinho é o desenho MUDAR, e não existir — o HTML do servidor já traz o
palco pronto, e afirmar que ele está lá não prova que algo roda. E a afirmação
inteira do herói virou um teste: o span atravessa o collector e ganha um campo
que não tinha. Se o enriquecimento sumir, a vitrine continuaria bonita e o teste
cai.

Mais a varredura da escada morta, que nenhuma asserção de tela pegaria: uma
página que promete L2 Wire e nunca mostra um continua verde."
```

---

## Task 9: O comentário do andaime, o teto de espaguete e o registro

**Files:**
- Modify: `packages/depth-core/src/index.ts`
- Modify: `apps/site/tests/espaguete.spec.ts`
- Modify: `docs/PROGRESS.md`

- [ ] **Step 1: Dizer a verdade sobre o andaime**

`Engine`, `Scenario` e `LevelId` ficam — decisão do Luigi —, mas o comentário deles vira mentira no instante em que a landing migra. Em `packages/depth-core/src/index.ts`, substitua as três últimas linhas:

```typescript
// modelo antigo — andaime até a S5 migrar a landing. NÃO usar em código novo.
export { Engine } from "./engine.js";
export type { LevelId, Scenario } from "./types.js";
```

por:

```typescript
/*
  O modelo antigo: níveis FIXOS (L0 Flow, L1 Mechanism, L2 Wire, L3 Payload) em
  vez da árvore de composição.

  Sem consumidor desde que a landing migrou (Entrega 15). Fica de propósito, e
  não por esquecimento: a escada fixa descreve bem um assunto em que descer é
  descer de verdade — uma CPU até o fio —, e o dia em que um handbook quiser
  exatamente isso, ela está aqui. O que ela não descreve é um trace, que não tem
  *dentro*. Ver `DECISIONS.md` §9.

  NÃO usar em código novo sem essa conversa.
*/
export { Engine } from "./engine.js";
export type { LevelId, Scenario } from "./types.js";
```

- [ ] **Step 2: Medir o teto de espaguete do mundo novo**

Os tetos moram em `apps/site/tests/espaguete.spec.ts`, na constante `TETOS` (linha ~113), e cada entrada é `{ lab, nome, cruzamentos }`. **O número entra medido, não estimado** — folga é onde a próxima piora se esconde, como o comentário da constante já diz.

O herói não fica num lab, fica na raiz. Acrescente:

```typescript
  // A landing: o herói roda o mesmo motor e entra na mesma medida. Três caixas
  // em fila não têm por que cruzar — e é justamente por ser óbvio que o teto
  // fica escrito: o dia em que ele subir, subiu por alguma coisa.
  { lab: "", nome: "o herói da landing", cruzamentos: 0 },
```

Run: `pnpm --filter @ovh/site test:e2e -g "o herói da landing não vira meada"`
Expected: PASS com zero. **Se der mais que zero, pare**: três caixas em fila cruzando é achado, não é teto — investigue antes de escrever qualquer outro número.

Se o teste falhar porque `.dui-stage` não aparece na raiz, é porque o herói é ilha `client:visible` e o palco só existe depois de hidratar; o laço de `TETOS` faz `goto` e espera o palco, então role até ele antes — siga o que `aguardarHidratacao` faz em `landing.spec.ts`.

- [ ] **Step 3: Registrar a entrega**

No fim de `docs/PROGRESS.md`, acrescente:

```markdown
## Entrega 15 — O foco no item, e o herói no motor novo ✅

08/09/2026. A rodada começou como "migrar a landing" e virou investimento no pilar, por duas
correções dele. A primeira: o `depth-core` não é andaime, é **pilar** — um motor de grafos com
profundidade que não existe assim no mercado. A segunda, e é a que mudou o desenho:

> *"Mesmo que se encaixe na nossa lógica de fluxos, o foco é o item e não a fábrica. Ou
> melhoramos o foco pro item, ou criamos um lab mais PhET."*

Um trace **é** um fluxo com camadas e mesmo assim o motor o servia mal, porque o protagonista
dele é a fábrica. Viraram `DECISIONS.md` §9, com a formulação que decide sozinha: **o tema do
lab nomeia o protagonista**, e não se monta uma rua para explicar uma porta.

### A Trilha

O trajeto virou o desenho: uma estação por ponta, e o que mudou **entre** as estações. Duas
decisões que a implementação obrigou:

- **as estações são uma a mais que as paradas** — uma parada é um salto, e N saltos tocam N+1
  lugares. Uma estação por parada faria o item nascer no meio do caminho;
- **o rótulo do que mudou é do salto, e é lido na estação de partida.** Pendurado na chegada,
  ele diria "o destino tem o campo" — verdade que não é o assunto, porque o assunto é quem
  acrescentou.

`seguir()`/`Parada` subiram para o `depth-core`: identidade e trajeto de um item são conceito
do motor, e viviam em `apps/site` como utilitário de página. E o painel dos labs passou a
desenhar a `Trilha` — a lista de paradas tinha dois desenhos possíveis e agora tem um.

### O herói

Mundo próprio (`service → collector → backend`), sem controle nenhum, abrindo **já seguindo**
um span. Não é o lab de ninguém de propósito: `providers` mora dentro do processo, `anatomy`
entre quatro processos, e o herói é o oleoduto visto de fora.

A seção dos quatro níveis mortos saiu da landing. No lugar, os três gestos que valem para uma
CPU e para um trace — e a segunda metade do pilar, que não estava em lugar nenhum do site:
quando o assunto não é fluxo com camadas, o lab é outro, feito para ele.

Estado: unit, e2e, typecheck, boundaries, catálogo e build verdes.
```

- [ ] **Step 4: Verificação final, tudo**

Run: `pnpm test && pnpm typecheck && pnpm boundaries && pnpm catalogo && pnpm build`
Expected: os cinco passam.

Run: `pnpm --filter @ovh/site test:e2e`
Expected: PASS.

**Não escreva "verde" em lugar nenhum sem ter visto a saída dos seis comandos.**

- [ ] **Step 5: Commit**

```bash
git add packages/depth-core/src/index.ts apps/site/tests/espaguete.spec.ts docs/PROGRESS.md
git commit -m "docs: o andaime fica dito, e o registro da Entrega 15

O comentário do modelo antigo prometia 'até a S5 migrar a landing', e a landing
migrou. Ele fica por decisão, e não por esquecimento: a escada fixa descreve bem
um assunto em que descer é descer de verdade, e o dia em que um handbook quiser
isso, ela está aqui."
```

---

## Verificação de cobertura da spec

| Seção da spec | Task |
|---|---|
| §3 A Trilha, e a tabela de onde cada traço sai | 2, 3 |
| §4 `seguir()` sobe para o motor | 1 |
| §4 `Trilha` no `depth-ui` | 2 |
| §4 `PainelDaCarga` encolhe, uma fonte por fato | 4 |
| §4 comentário do andaime corrigido | 9 |
| §5 mundo do herói em `otel-domain/heroi/` | 5 |
| §5 `HeroSim` sem controle, abrindo já seguindo | 6 |
| §5 `labs/hero/scenario.ts` apagado | 6 |
| §6 seção `.levels` → o pilar; textos do herói | 7 |
| §7 herança em `three-pillars` e `anatomy-of-a-trace` | 4 |
| §8 testes da Trilha, com o leque | 2 |
| §8 e2e do herói, varredura e contraste nos dois papéis | 8 |
| §8 teto de espaguete medido | 9 |
