# A moldura na rampa — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer a moldura de uma caixa desfazer a notação de "fechada" na mesma rampa contínua em que o interior dela aparece, e devolver contraste ao canal que atravessa a fronteira.

**Architecture:** Duas funções puras novas em `packages/depth-ui/src/lod.ts` traduzem o `aparece` que o palco já calcula em (a) tinta do interior, por curva e não por piso, e (b) a notação de fechada, que interpola da caixa fechada de hoje até a `moldura` que o sistema já tem. O `Stage.tsx` publica o resultado como propriedades CSS no `<g>` do objeto; o `stage.css` consome. Nenhuma nova grandeza é inventada: tudo sai do mesmo `aparece`.

**Tech Stack:** TypeScript, React, SVG, vitest (projetos `node` e `dom`), fast-check (já no repo, raiz), Playwright.

**Spec:** `docs/superpowers/specs/2026-09-02-moldura-na-rampa-design.md`. Leia antes de começar — este plano executa aquele desenho e não o revoga.

---

## O idioma do repo — ler antes de escrever qualquer teste

Três convenções que não são negociáveis aqui, e que reprovam no portão se ignoradas:

1. **Comentário explica o porquê, nunca o quê.** O repo é escrito em português, com voz de
   quem justifica decisões. Um comentário que narra a linha abaixo é ruído.
2. **Nada de tinta escrita à mão.** Cor mora em token (`var(--dui-dado)`, `var(--paper)`).
   `pnpm catalogo` reprova hexadecimal em CSS **inclusive dentro de comentário**.
3. **Teste cobra comportamento, não implementação.** Não asserte "a função foi chamada";
   asserte o número que ela produziu e a contradição que ela impede.

Os portões, da raiz, nesta ordem:

```bash
pnpm boundaries
pnpm catalogo
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @ovh/site test:e2e
```

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `packages/depth-ui/src/lod.ts` (modificar) | Ganha `tintaDoInterior` e `notacaoDeFechada`. Continua sendo o módulo das **contas de nível de detalhe** — nenhuma delas conhece React nem SVG. |
| `packages/depth-ui/src/lod.test.ts` (modificar) | Os testes das duas funções e o invariante que as amarra. |
| `packages/depth-ui/src/Stage.tsx` (modificar) | Passa a consumir as duas funções e a publicar o resultado no `<g>` do objeto. |
| `packages/depth-ui/src/stage.css` (modificar) | Consome as propriedades publicadas; devolve contraste à `travessia`. |
| `packages/depth-ui/src/index.ts` (modificar) | Exporta as duas funções novas, seguindo a linha do `lod.js` que já existe. |
| `apps/site/tests/moldura-na-rampa.spec.ts` (criar) | O que só a tela responde: a promessa não convive com o cumprimento dela. |

---

## Bloco A — as contas

### Task 1: `tintaDoInterior`, a curva no lugar do piso

**Files:**
- Modify: `packages/depth-ui/src/lod.ts`
- Test: `packages/depth-ui/src/lod.test.ts`

- [ ] **Step 1: escrever o teste que falha**

Acrescente ao final de `packages/depth-ui/src/lod.test.ts` (e acrescente
`tintaDoInterior`, `EXPOENTE_DA_TINTA` e `TINTA_LEGIVEL` à lista de importações do topo do
arquivo, que hoje é `import { LIMIAR_CHEIO, LIMIAR_ENTRA, encaixar, quantoAparece, tabelaLegivel } from "./lod.js";`):

```ts
describe("a tinta do interior sobe rápido, e sem degrau", () => {
  /*
    O piso está proibido pela spec §2: se o interior nunca descesse abaixo de
    0,4, ele saltaria de 0 para 0,4 no instante em que a rampa começa. Um piso é
    um degrau com outro nome, e degrau é justamente o que não pode existir.
  */
  it("as pontas não mentem", () => {
    expect(tintaDoInterior(0)).toBe(0);
    expect(tintaDoInterior(1)).toBe(1);
  });

  it("no primeiro sexto da rampa o interior já é legível", () => {
    // É a afirmação de legibilidade virando número: sem isto, "sobe rápido" é
    // opinião.
    expect(tintaDoInterior(0.15)).toBeGreaterThanOrEqual(TINTA_LEGIVEL);
  });

  it("cresce sem voltar atrás", () => {
    let anterior = -1;
    for (let a = 0; a <= 1; a += 0.01) {
      const agora = tintaDoInterior(a);
      expect(agora).toBeGreaterThanOrEqual(anterior);
      anterior = agora;
    }
  });

  it("fora da faixa, não inventa tinta", () => {
    expect(tintaDoInterior(-1)).toBe(0);
    expect(tintaDoInterior(2)).toBe(1);
  });

  it("o expoente é o que faz a curva subir, e ele é menor que 1", () => {
    // Com expoente 1 a curva é a reta de hoje, e o platô do fantasma volta.
    expect(EXPOENTE_DA_TINTA).toBeLessThan(1);
    expect(EXPOENTE_DA_TINTA).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `pnpm vitest run packages/depth-ui/src/lod.test.ts`
Expected: FAIL — `tintaDoInterior` não existe.

- [ ] **Step 3: implementar**

Acrescente ao final de `packages/depth-ui/src/lod.ts`:

```ts
/**
 * O expoente da curva da tinta.
 *
 * Menor que 1 de propósito: é o que faz a tinta subir depressa no começo da
 * rampa. Com 1 a curva é a reta de hoje, e a reta é o que produz o platô de
 * fantasma — a caixa passa metade da descida desenhando um interior que existe
 * e não se lê. O número foi escolhido para satisfazer a legibilidade cobrada em
 * `TINTA_LEGIVEL`, e é o teste que o segura, não o gosto.
 */
export const EXPOENTE_DA_TINTA = 0.45;

/** Onde o interior deixa de ser fantasma e passa a ser desenho. */
export const TINTA_LEGIVEL = 0.4;

/**
 * De quanto do interior aparece para quanta tinta ele recebe.
 *
 * `quantoAparece` é medida — responde "quanto do quadro esta caixa ocupa" — e
 * não muda. Esta função é **desenho**: ela decide com que força aquela medida
 * chega ao papel. Separar as duas é o que permite melhorar a leitura sem
 * mexer no instrumento, que é o erro de ajustar a régua para o gráfico ficar
 * bonito.
 *
 * Contínua nas duas pontas, e por isso não é um piso: sai de zero em zero.
 */
export function tintaDoInterior(aparece: number): number {
  const a = Math.max(0, Math.min(1, aparece));
  return a ** EXPOENTE_DA_TINTA;
}
```

- [ ] **Step 4: rodar e ver passar**

Run: `pnpm vitest run packages/depth-ui/src/lod.test.ts`
Expected: PASS.

Confira também, à mão, que o número fecha: `node -e "console.log(0.15 ** 0.45)"` deve
imprimir `0.4258…`. Se você mudar `EXPOENTE_DA_TINTA`, é este teste que vai reclamar — e
ele está certo em reclamar.

- [ ] **Step 5: Commit**

```bash
git add packages/depth-ui/src/lod.ts packages/depth-ui/src/lod.test.ts
git commit -m "feat(depth-ui): a tinta do interior sobe por curva, e não por piso"
```

---

### Task 2: `notacaoDeFechada`, a caixa que vira moldura

**Files:**
- Modify: `packages/depth-ui/src/lod.ts`
- Test: `packages/depth-ui/src/lod.test.ts`

- [ ] **Step 1: escrever o teste que falha**

Acrescente ao final de `lod.test.ts` (e `notacaoDeFechada` à importação do topo):

```ts
describe("a notação de fechada se desfaz na rampa", () => {
  it("no começo, é exatamente o que existe hoje", () => {
    const n = notacaoDeFechada(0);
    expect(n.tracejado).toBe("8 4");
    expect(n.preenchimento).toBe(1);
  });

  it("no fim, não resta marca de fechada nenhuma", () => {
    // Vão zero é traço contínuo, e preenchimento zero é contorno e nada mais:
    // a caixa chegou na `moldura`, que é uma forma que o sistema já tem.
    const n = notacaoDeFechada(1);
    expect(n.tracejado.split(" ")[1]).toBe("0");
    expect(n.preenchimento).toBe(0);
  });

  it("o vão do tracejado só encolhe", () => {
    let anterior = Number.POSITIVE_INFINITY;
    for (let a = 0; a <= 1; a += 0.01) {
      const vao = Number(notacaoDeFechada(a).tracejado.split(" ")[1]);
      expect(vao).toBeLessThanOrEqual(anterior);
      anterior = vao;
    }
  });

  it("o preenchimento só cede", () => {
    let anterior = Number.POSITIVE_INFINITY;
    for (let a = 0; a <= 1; a += 0.01) {
      const p = notacaoDeFechada(a).preenchimento;
      expect(p).toBeLessThanOrEqual(anterior);
      anterior = p;
    }
  });

  it("fora da faixa, não inventa notação", () => {
    expect(notacaoDeFechada(-1).preenchimento).toBe(1);
    expect(notacaoDeFechada(2).preenchimento).toBe(0);
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `pnpm vitest run packages/depth-ui/src/lod.test.ts`
Expected: FAIL — `notacaoDeFechada` não existe.

- [ ] **Step 3: implementar**

Acrescente ao final de `packages/depth-ui/src/lod.ts`:

```ts
/** O traço e o preenchimento de uma caixa que está deixando de estar fechada. */
export interface NotacaoDeFechada {
  /** O `stroke-dasharray`, já pronto para ir ao SVG. */
  readonly tracejado: string;
  /** O `fill-opacity`: 1 é a caixa de hoje, 0 é contorno e nada mais. */
  readonly preenchimento: number;
}

/**
 * A caixa fechada virando moldura, continuamente.
 *
 * O defeito que isto conserta: `aparece` comandava a opacidade do interior e a
 * borda era pintada por um booleano. Metade da ligação andava numa grandeza
 * contínua e a outra metade era um interruptor — então a moldura anunciava
 * "fechada" com o interior aberto e desenhado dentro dela.
 *
 * O fim da rampa não é um estado novo: **contorno e nada mais** é a definição
 * da `moldura`, que o palco já desenha para o objeto enquadrado. A caixa não
 * vira outra coisa; ela chega onde já estava escrito que se chega.
 *
 * O vão do tracejado encolhendo até zero é o que dá continuidade sem degrau:
 * `8 4` (fechada) → `48 0`, e vão zero **é** linha contínua.
 */
export function notacaoDeFechada(aparece: number): NotacaoDeFechada {
  const a = Math.max(0, Math.min(1, aparece));
  // Duas casas bastam para o traço e evitam despejar `21.320000000000004` no
  // atributo: o SVG aceita, e quem inspeciona o desenho lê ruído.
  const duasCasas = (n: number): string => String(Math.round(n * 100) / 100);
  return {
    tracejado: `${duasCasas(8 + 40 * a)} ${duasCasas(4 - 4 * a)}`,
    preenchimento: 1 - a,
  };
}
```

- [ ] **Step 4: rodar e ver passar**

Run: `pnpm vitest run packages/depth-ui/src/lod.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/depth-ui/src/lod.ts packages/depth-ui/src/lod.test.ts
git commit -m "feat(depth-ui): a caixa fechada vira moldura ao longo da rampa"
```

---

### Task 3: o invariante que amarra as duas metades

**Files:**
- Test: `packages/depth-ui/src/lod.test.ts`

Este é o teste que a spec §4 exige, e é ele que impede o defeito de voltar. Sem ele as duas
funções existem e nada obriga uma a andar quando a outra anda.

- [ ] **Step 1: escrever o teste que falha**

Acrescente ao topo de `lod.test.ts`: `import fc from "fast-check";`

E ao final do arquivo:

```ts
describe("as duas metades da mesma ligação andam juntas", () => {
  /*
    O invariante da spec §4. Ele não cobra números; cobra que não exista ponto
    algum da rampa em que a moldura diga uma coisa e o interior mostre outra.
  */
  it("onde a tinta sobe, a marca de fechada cai", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (x, y) => {
          const [menor, maior] = x <= y ? [x, y] : [y, x];
          const tintaSobe = tintaDoInterior(maior) >= tintaDoInterior(menor);
          const vaoCai =
            Number(notacaoDeFechada(maior).tracejado.split(" ")[1]) <=
            Number(notacaoDeFechada(menor).tracejado.split(" ")[1]);
          const preenchimentoCede =
            notacaoDeFechada(maior).preenchimento <= notacaoDeFechada(menor).preenchimento;
          return tintaSobe && vaoCai && preenchimentoCede;
        },
      ),
      { numRuns: 500 },
    );
  });

  it("nas pontas não há contradição", () => {
    // Fechada de verdade: nenhuma tinta no interior, notação de fechada inteira.
    expect(tintaDoInterior(0)).toBe(0);
    expect(notacaoDeFechada(0).preenchimento).toBe(1);
    // Aberta de verdade: interior inteiro, nenhuma marca de fechada.
    expect(tintaDoInterior(1)).toBe(1);
    expect(notacaoDeFechada(1).preenchimento).toBe(0);
    expect(Number(notacaoDeFechada(1).tracejado.split(" ")[1])).toBe(0);
  });

  it("o `more inside` sai antes de o interior ficar legível", () => {
    /*
      O critério da spec §3.3, e ele é o que resolve a contradição na tela: uma
      promessa de que há algo dentro, sobreposta ao dentro já desenhado, é a
      tela dizendo o contrário do que mostra.
    */
    expect(opacidadeDoRosto(PONTO_LEGIVEL)).toBe(0);
    expect(tintaDoInterior(PONTO_LEGIVEL)).toBeCloseTo(TINTA_LEGIVEL, 6);
    expect(opacidadeDoRosto(0)).toBe(1);
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `pnpm vitest run packages/depth-ui/src/lod.test.ts`
Expected: FAIL — `opacidadeDoRosto` e `PONTO_LEGIVEL` não existem.

- [ ] **Step 3: implementar**

Acrescente ao final de `packages/depth-ui/src/lod.ts`:

```ts
/**
 * O ponto da rampa em que o interior passa a ser legível.
 *
 * É `TINTA_LEGIVEL` lido de trás para frente pela curva, e não um segundo
 * número escolhido à parte: dois números independentes dizendo a mesma coisa é
 * como duas listas de labs escritas à mão divergem.
 */
export const PONTO_LEGIVEL = TINTA_LEGIVEL ** (1 / EXPOENTE_DA_TINTA);

/**
 * O rosto da caixa — o título e o `more inside` — cedendo lugar ao interior.
 *
 * Ele tem de chegar a zero **antes** de o interior ficar legível, e não depois.
 * A regra de hoje (`1 - aparece * 2`) o mantinha na tela até o interior estar
 * com 73% de tinta: a caixa prometia "tem mais aqui dentro" por cima do dentro
 * já desenhado, que é a tela contradizendo a si mesma.
 */
export function opacidadeDoRosto(aparece: number): number {
  const a = Math.max(0, Math.min(1, aparece));
  return Math.max(0, 1 - a / PONTO_LEGIVEL);
}
```

E acrescente `opacidadeDoRosto` e `PONTO_LEGIVEL` à importação do topo de `lod.test.ts`.

- [ ] **Step 4: rodar e ver passar**

Run: `pnpm vitest run packages/depth-ui/src/lod.test.ts`
Expected: PASS.

- [ ] **Step 5: teste de mutação — sem isto o invariante não vale nada**

- [ ] Em `lod.ts`, troque o corpo de `notacaoDeFechada` por uma constante:
      `return { tracejado: "8 4", preenchimento: 1 };`
- [ ] Run: `pnpm vitest run packages/depth-ui/src/lod.test.ts`
      Expected: FAIL — "no fim, não resta marca de fechada nenhuma" cai.
- [ ] Troque `EXPOENTE_DA_TINTA` para `1` (a reta de hoje).
- [ ] Run: `pnpm vitest run packages/depth-ui/src/lod.test.ts`
      Expected: FAIL — "no primeiro sexto da rampa o interior já é legível" cai.
- [ ] Restaure as duas e confirme que voltam a passar.
- [ ] Anote o que caiu em cada mutação: entra no `PROGRESS.md` na Task 8.

- [ ] **Step 6: Commit**

```bash
git add packages/depth-ui/src/lod.ts packages/depth-ui/src/lod.test.ts
git commit -m "test(depth-ui): a moldura e o interior são cobrados como uma coisa só"
```

---

### Task 4: exportar no barril

**Files:**
- Modify: `packages/depth-ui/src/index.ts:23`

- [ ] **Step 1:** troque a linha 23, que hoje é

```ts
export { ALTURA_DA_LINHA, encaixar, fracaoDoQuadro, quantoAparece, tabelaLegivel } from "./lod.js";
```

por

```ts
export {
  ALTURA_DA_LINHA,
  EXPOENTE_DA_TINTA,
  PONTO_LEGIVEL,
  TINTA_LEGIVEL,
  encaixar,
  fracaoDoQuadro,
  notacaoDeFechada,
  opacidadeDoRosto,
  quantoAparece,
  tabelaLegivel,
  tintaDoInterior,
} from "./lod.js";
export type { NotacaoDeFechada } from "./lod.js";
```

- [ ] **Step 2:** Run `pnpm typecheck`
      Expected: sem erro.

- [ ] **Step 3: Commit**

```bash
git add packages/depth-ui/src/index.ts
git commit -m "feat(depth-ui): as contas da rampa saem no barril"
```

---

## Bloco B — o palco consome

### Task 5: o `Stage` publica o grau de abertura

**Files:**
- Modify: `packages/depth-ui/src/Stage.tsx`

O palco já calcula `aparece` (por volta da linha 1448). O que falta é ele deixar de aplicar
a grandeza crua e passar a aplicar as três traduções.

- [ ] **Step 1:** nas importações do topo de `Stage.tsx`, o bloco que hoje traz
      `quantoAparece` do `./lod.js` passa a trazer também as três funções novas. Localize a
      importação que contém `quantoAparece,` e acrescente, em ordem alfabética dentro dela:

```ts
  notacaoDeFechada,
  opacidadeDoRosto,
  tintaDoInterior,
```

- [ ] **Step 2:** logo **depois** da linha que calcula `aparece`

```ts
          const aparece =
            interior === undefined ? 0 : quantoAparece(fracaoDoQuadro(place, quadro));
```

acrescente:

```ts
          /*
            As três traduções do mesmo número. `aparece` é medida; o que vai ao
            papel é desenho, e é aqui que uma coisa vira a outra — num lugar só,
            para que a moldura e o interior não possam divergir.
          */
          const tinta = tintaDoInterior(aparece);
          const fechamento = notacaoDeFechada(aparece);
          const rosto = opacidadeDoRosto(aparece);
```

- [ ] **Step 3:** no `<g className="dui-stage__objeto">`, a propriedade `style` hoje é

```tsx
              style={{ ["--dui-atraso" as string]: `${atraso}ms` }}
```

Troque por:

```tsx
              /*
                A notação de fechada vai por propriedade CSS, e não por regra
                por forma: `.dui-stage__caixa` é cinco desenhos diferentes
                (retângulo, trapézio, estante, pista, moldura), e uma regra por
                forma seria a mesma decisão escrita cinco vezes. E vai calculada
                daqui, e não com `calc()` na folha: `calc()` dentro de
                `stroke-dasharray` é terreno instável entre navegadores.
              */
              style={{
                ["--dui-atraso" as string]: `${atraso}ms`,
                ["--dui-fechada-tracejado" as string]: fechamento.tracejado,
                ["--dui-fechada-preenchimento" as string]: String(fechamento.preenchimento),
              }}
```

- [ ] **Step 4:** troque a opacidade do interior. A linha

```tsx
                    opacity={aparece}
```

passa a ser

```tsx
                    opacity={tinta}
```

- [ ] **Step 5:** troque a opacidade do rosto. A linha

```tsx
              <g className="dui-stage__rosto" opacity={Math.max(0, 1 - aparece * 2)}>
```

passa a ser

```tsx
              <g className="dui-stage__rosto" opacity={rosto}>
```

- [ ] **Step 6:** Run `pnpm typecheck && pnpm vitest run packages/depth-ui`
      Expected: PASS. Se algum teste de `Stage`/`Inspector` cair citando opacidade, leia a
      asserção: ela pode estar fotografando o valor cru antigo, e nesse caso o conserto é
      atualizar a asserção para a tinta — **não** é reverter a mudança.

- [ ] **Step 7: Commit**

```bash
git add packages/depth-ui/src/Stage.tsx
git commit -m "feat(depth-ui): a moldura passa a andar na mesma rampa do interior"
```

---

### Task 6: o CSS consome, e o canal recupera contraste

**Files:**
- Modify: `packages/depth-ui/src/stage.css`

- [ ] **Step 1:** a regra de hoje, por volta da linha 498, é

```css
.dui-stage__objeto[data-fechado="true"] > .dui-stage__caixa {
  stroke-dasharray: 8 4;
}
```

Troque por:

```css
/*
 * Fechada é uma questão de GRAU, e não um interruptor.
 *
 * O `8 4` de antes era categórico: a borda anunciava "fechada" o caminho
 * inteiro enquanto o interior subia desenhado dentro dela. Agora os dois valores
 * chegam calculados do palco, do mesmo `aparece` que move o interior — e o fim
 * da rampa é contorno e nada mais, que é a `moldura` logo abaixo.
 *
 * A posição desta regra importa: ela vem DEPOIS de `[data-ativo]`, que tem a
 * mesma especificidade. Movida para cima, ela deixa de valer e nada avisa.
 */
.dui-stage__objeto[data-fechado="true"] > .dui-stage__caixa {
  stroke-dasharray: var(--dui-fechada-tracejado, 8 4);
  fill-opacity: var(--dui-fechada-preenchimento, 1);
}
```

- [ ] **Step 2:** a regra da `travessia`, por volta da linha 786, é

```css
.dui-stage__travessia {
  fill: none;
  stroke: color-mix(in oklab, var(--dui-dado) 35%, transparent);
  stroke-width: 1;
  stroke-dasharray: 3 3;
  vector-effect: non-scaling-stroke;
  pointer-events: none;
}
```

Troque o `stroke`, o `stroke-width` e apague o `stroke-dasharray`:

```css
.dui-stage__travessia {
  fill: none;
  /*
    O canal é ESTRUTURA, e estrutura não sussurra. A 35% e pontilhado, ele já
    nascia fraco — e multiplicado pela tinta do interior virava nada, justamente
    a linha que responde "o que entrou aqui vai parar onde lá dentro?".
    Ele continua dizendo "sou a MESMA ligação um nível abaixo" por ser mais fino
    que o trilho de fora (1,25 contra 1,6). Fino é notação; apagado é sumiço.
  */
  stroke: color-mix(in oklab, var(--dui-dado) 85%, transparent);
  stroke-width: 1.25;
  vector-effect: non-scaling-stroke;
  pointer-events: none;
}
```

Atualize também o comentário logo acima da regra (hoje ele diz "mais fino e mais apagado
que o trilho de fora"), para não deixar no arquivo uma justificativa que a regra não cumpre
mais:

```css
/*
 * O canal atravessando a fronteira.
 *
 * Mais fino que o trilho de fora, de propósito: ele não é uma ligação nova, é a
 * **mesma** ligação vista um nível abaixo. Desenhá-lo com o mesmo peso sugeriria
 * dois canais onde há um. Já a versão apagada dele sugeria coisa nenhuma — some
 * junto com a informação, e foi o defeito que esta rodada consertou.
 */
```

- [ ] **Step 3:** Run `pnpm catalogo`
      Expected: "Catálogo da linguagem visual intacto". Se reprovar, você escreveu tinta à
      mão em algum lugar — inclusive no comentário.

- [ ] **Step 4:** Run `pnpm build && pnpm --filter @ovh/site test:e2e`
      Expected: os e2e existentes passam. Se `cpu-lab.spec.ts`, `gates-lab.spec.ts` ou
      `micro-lab.spec.ts` caírem numa asserção de traço ou de opacidade, é o esperado pela
      spec §5: atualize a asserção para o valor novo, e **só** ela.

- [ ] **Step 5: Commit**

```bash
git add packages/depth-ui/src/stage.css
git commit -m "feat(depth-ui): a borda lê o grau de abertura, e o canal para de sussurrar"
```

---

## Bloco C — o que só a tela responde

### Task 7: a promessa não convive com o cumprimento

**Files:**
- Create: `apps/site/tests/moldura-na-rampa.spec.ts`

As regras sobre as contas têm teste de unidade. O que só a página responde é se, no
enquadramento real, a caixa que mostra o interior ainda promete que há mais dentro.

- [ ] **Step 1: escrever o teste**

```ts
import { expect, test } from "@playwright/test";

/**
 * A contradição que originou a rodada, cobrada onde ela aparecia: no
 * enquadramento do SDK, as três caixas de provedor desenhavam o interior E
 * anunciavam `more inside` E mantinham a borda de fechada.
 */

async function noSdk(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("labs/providers/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });
  await page
    .getByRole("group", { name: "Framing" })
    .getByRole("button", { name: "OpenTelemetry SDK", exact: true })
    .click();
  await expect
    .poll(async () => page.locator('.dui-stage__objeto[data-id="tracer-provider"]').count())
    .toBeGreaterThan(0);
}

test("a caixa que mostra o interior não promete que há mais dentro", async ({ page }) => {
  await noSdk(page);
  const caixa = page.locator('.dui-stage__objeto[data-id="tracer-provider"]');
  const tinta = await page
    .locator('.dui-stage__interior[data-dentro="tracer-provider"]')
    .evaluate((g) => Number(g.getAttribute("opacity")));
  // O caso só tem sentido quando o interior está de fato visível.
  expect(tinta).toBeGreaterThan(0.4);
  await expect(caixa.locator(".dui-stage__abrir")).toHaveCount(0);
});

test("a borda cede na mesma rampa: o vão do tracejado encolheu", async ({ page }) => {
  await noSdk(page);
  const vao = await page
    .locator('.dui-stage__objeto[data-id="tracer-provider"]')
    .evaluate((g) => {
      const caixa = g.querySelector(".dui-stage__caixa")!;
      const dash = getComputedStyle(caixa).strokeDasharray;
      return Number(dash.split(",")[1]?.trim().replace("px", "") ?? "NaN");
    });
  // Fechada de verdade tem vão 4. Com o interior aberto, ele tem de ter cedido.
  expect(vao).toBeLessThan(4);
});
```

- [ ] **Step 2:** Run `pnpm --filter @ovh/site test:e2e tests/moldura-na-rampa.spec.ts`
      Expected: PASS nos dois projetos. Se o primeiro teste falhar dizendo que a tinta é
      menor que 0,4, o enquadramento do SDK não deixa a caixa grande o bastante — nesse
      caso troque o enquadramento para `TracerProvider` nas duas funções e refaça a
      medição; o invariante é o mesmo, o que muda é onde ele é observável.

- [ ] **Step 3: Commit**

```bash
git add apps/site/tests/moldura-na-rampa.spec.ts
git commit -m "test(site): a moldura aberta não anuncia que está fechada"
```

---

## Bloco D — fechar a rodada

### Task 8: o registro

- [ ] **Step 1:** `docs/PROGRESS.md` ganha a rodada, ao final do arquivo, seguindo a forma
      das entregas anteriores (`## Entrega N — título ✅`, data, branch, spec, plano).
      Inclua, nominalmente:
      - que a causa não era falta de contraste, e sim `aparece` comandando o interior
        enquanto a borda era pintada por um booleano — **metade da ligação contínua, a
        outra metade um interruptor**;
      - que `data-fechado` quer dizer "o interior mora um nível abaixo", e não "não tem
        interior";
      - que o piso foi **recusado** porque piso é degrau com outro nome, e a continuidade é
        inviolável;
      - que o fim da rampa é a `moldura`, uma forma que o sistema já tinha;
      - o resultado das duas mutações anotado na Task 3, Step 5.
- [ ] **Step 2:** `docs/DECISIONS.md` — na seção que trata do zoom contínuo, acrescente a
      nota de que profundidade é comandada por **uma** grandeza, e que qualquer marca que
      fale de profundidade tem de derivar dela. É a regra que impede o próximo interruptor.
- [ ] **Step 3: Commit**

```bash
git add docs
git commit -m "docs: o registro da rodada da moldura na rampa"
```

---

## Os portões — rodar nesta ordem, da raiz

```bash
pnpm boundaries
pnpm catalogo
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @ovh/site test:e2e
```

E, à mão, uma vez: abra `labs/providers` no enquadramento do SDK e confira que o desenho
que motivou a rodada mudou. **Nenhum teste substitui isto** — a rodada nasceu de alguém
olhar a tela, e três dos defeitos do repo foram achados assim.

---

## Auto-revisão do plano

**Onde ele pode dar errado:**

1. **A regra do CSS não valer por ordem** (Task 6, Step 1). `[data-ativo]` tem a mesma
   especificidade e vem antes; se alguém mover a regra para cima, ela silenciosamente para
   de valer. Está escrito no comentário da própria regra, que é onde quem move vai ler.
2. **O rosto sumir cedo demais.** Com a regra nova o título da caixa sai em `aparece ≈
   0,13`, contra `0,5` de hoje. É o que a spec §3.3 pede, e é o que resolve o título caindo
   em cima do próprio interior — mas é a mudança mais visível desta rodada, e é a primeira
   coisa a olhar na conferência à mão. Se o nome fizer falta, o conserto é o rosto migrar
   para fora da caixa, e isso é rodada própria.
3. **Os e2e de CPU fotografando o estado antigo** (Task 6, Step 4). Esperado pela spec §5.
   A regra é: atualizar a asserção, nunca reverter o desenho.
4. **`fc.double` com `min`/`max`** (Task 3). A versão do fast-check no repo é a 4.x, onde
   `noNaN: true` é necessário para não sortear `NaN`. Se a API divergir, o teste equivalente
   é um laço de 0 a 1 de 0,01 em 0,01 — mais fraco, mas honesto.
5. **A caixa não ficar grande o bastante no enquadramento do SDK** (Task 7, Step 2). O
   próprio passo diz o que fazer.

**O que este plano deliberadamente não faz:** profundidade por tom de papel, o título
migrando para fora da caixa, e qualquer mexida em `quantoAparece`. Os motivos estão na §6 e
na §3.1 da spec, e nenhum deles é "não deu tempo".
