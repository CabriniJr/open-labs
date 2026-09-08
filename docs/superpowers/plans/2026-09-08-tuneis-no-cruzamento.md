# Túneis no cruzamento — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps
> use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Onde dois fios se cruzam, um mergulha e reaparece — com uma boca em cada ponta —
sem que a medida de espaguete perca de vista um único cruzamento.

**Architecture:** Três camadas. `espaguete.ts` passa a devolver **onde** estão os
cruzamentos (hoje só conta). `tunel.ts` (novo, puro, sem React) decide quem mergulha e onde
ficam as lacunas. `Stage.tsx` desenha: uma `<mask>` por fio que mergulha — o `d` continua
inteiro — e as bocas num grupo à parte.

**Tech Stack:** TypeScript estrito, React 19, SVG, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-08-tuneis-no-cruzamento-design.md` — **ler antes
da primeira linha de código.** A §4 (o buraco é máscara, não outro `d`) não se reabre aqui.

---

## O idioma do repo — ler antes de escrever qualquer teste

**Comandos, da raiz:**

```bash
pnpm typecheck                       # tsc -b
pnpm test                            # vitest run (unit + dom)
pnpm boundaries                      # a fronteira motor↔domínio
pnpm catalogo                        # cor escrita fora do catálogo
pnpm build
pnpm --filter @ovh/site test:e2e     # Playwright
pnpm vitest run <caminho>            # um arquivo só
```

**Convenções que não se negociam:**

- **commit sem `Co-Authored-By: Claude` e sem `Claude-Session`**;
- código e comentário em **português**; tudo que o leitor vê, em **inglês**;
- `verbatimModuleSyntax` → `import type` para tipo, e import interno com sufixo **`.js`**;
- `exactOptionalPropertyTypes` → campo opcional entra por spread condicional, nunca por
  `undefined`;
- `noUncheckedIndexedAccess` → todo acesso indexado devolve `T | undefined`;
- `depth-ui` é **agnóstico de domínio**: nada de span, exportador, registrador. `pnpm
  boundaries` reprova;
- CSS não escreve tinta: `pnpm catalogo` reprova hexadecimal e `rgb(`, **inclusive dentro
  de comentário**.

---

## Estrutura de arquivos

Criar:

| Arquivo | Responsabilidade |
| --- | --- |
| `packages/depth-ui/src/tunel.ts` | quem mergulha, e onde ficam as lacunas e as bocas |
| `packages/depth-ui/src/tunel.test.ts` | a decisão é total, estável e cobre todo cruzamento |

Modificar:

| Arquivo | O quê |
| --- | --- |
| `packages/depth-ui/src/espaguete.ts` | `cruzamentos()` exportado: os pontos, não só a conta |
| `packages/depth-ui/src/espaguete.test.ts` | o teste dos pontos |
| `packages/depth-ui/src/index.ts` | barril, se ele exporta o espaguete |
| `packages/depth-ui/src/Stage.tsx` | a `<mask>` por fio, e as bocas |
| `packages/depth-ui/src/stage.css` | a boca no catálogo |
| `apps/site/tests/espaguete.spec.ts` | os cinco invariantes |
| `docs/PROGRESS.md`, `docs/roadmap.md` | o registro |

---

## Task 1: o cruzamento deixa de ser só um número

**Files:**
- Modify: `packages/depth-ui/src/espaguete.ts`
- Test: `packages/depth-ui/src/espaguete.test.ts`

- [ ] **Step 1: escrever o teste que falha**

Acrescente ao fim de `espaguete.test.ts`:

```ts
describe("onde os fios se cruzam", () => {
  it("devolve o ponto, e diz quem é quem", () => {
    // Um deitado em y=50 indo de x=0 a x=100; um em pé em x=50 indo de y=0 a y=100.
    const deitado = "M 0 50 H 100";
    const emPe = "M 50 0 V 100";
    const achados = cruzamentos([deitado, emPe]);
    expect(achados).toHaveLength(1);
    expect(achados[0]).toMatchObject({ x: 50, y: 50, a: 0, b: 1 });
  });

  it("a contagem é a mesma que a meada já dava", () => {
    // Duas fontes para o mesmo fato discordariam no dia em que uma piorasse.
    const fios = ["M 0 50 H 100", "M 50 0 V 100", "M 20 0 V 100"];
    expect(cruzamentos(fios)).toHaveLength(meada(fios).cruzamentos);
  });

  it("encostar na ponta não é cruzamento", () => {
    // É assim que um fio chega numa porta, e acusar isso condenaria todo
    // desenho correto.
    expect(cruzamentos(["M 0 50 H 100", "M 100 50 V 100"])).toEqual([]);
  });

  it("diz por qual trecho cada fio passou ali", () => {
    // A boca precisa saber se o trecho que mergulha está deitado ou em pé.
    const achados = cruzamentos(["M 0 50 H 100", "M 50 0 V 100"]);
    expect(achados[0]?.horizontalA).toBe(true);
    expect(achados[0]?.horizontalB).toBe(false);
  });
});
```

E acrescente `cruzamentos` ao `import` que o arquivo já faz de `./espaguete.js`.

- [ ] **Step 2: rodar e ver falhar**

Run: `pnpm vitest run packages/depth-ui/src/espaguete.test.ts`
Expected: FAIL — `cruzamentos is not a function`.

- [ ] **Step 3: implementar**

Em `espaguete.ts`, **depois** de `seCruzam`, acrescente:

```ts
export interface Cruzamento {
  readonly x: number;
  readonly y: number;
  /** O índice, na lista de caminhos, de cada um dos dois fios. */
  readonly a: number;
  readonly b: number;
  /** Se o trecho pelo qual `a` passou ali está deitado. O de `b` é o contrário. */
  readonly horizontalA: boolean;
  readonly horizontalB: boolean;
}

/**
 * Onde os fios se atravessam.
 *
 * `meada()` conta; esta diz **onde**, e é o que o túnel usa para saber onde
 * mergulhar. As duas leem os mesmos segmentos e usam o mesmo `seCruzam`: um
 * segundo detector de cruzamento discordaria do primeiro no dia em que um dos
 * dois ficasse errado, e o desenho tunelaria num lugar enquanto a conta contaria
 * em outro.
 */
export function cruzamentos(caminhos: readonly string[]): readonly Cruzamento[] {
  const porFio = caminhos.map(segmentos);
  const achados: Cruzamento[] = [];
  for (let i = 0; i < porFio.length; i += 1) {
    for (let j = i + 1; j < porFio.length; j += 1) {
      for (const a of porFio[i] ?? []) {
        for (const b of porFio[j] ?? []) {
          if (!seCruzam(a, b)) continue;
          const deitado = horizontal(a) ? a : b;
          const emPe = horizontal(a) ? b : a;
          achados.push({
            x: emPe.x1,
            y: deitado.y1,
            a: i,
            b: j,
            horizontalA: horizontal(a),
            horizontalB: horizontal(b),
          });
        }
      }
    }
  }
  return achados;
}
```

- [ ] **Step 4: rodar e ver passar**

Run: `pnpm vitest run packages/depth-ui/src/espaguete.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/depth-ui/src/espaguete.ts packages/depth-ui/src/espaguete.test.ts
git commit -m "feat(depth-ui): o cruzamento deixa de ser só um número e passa a ter lugar"
```

---

## Task 2: quem mergulha, e onde

**Files:**
- Create: `packages/depth-ui/src/tunel.ts`
- Test: `packages/depth-ui/src/tunel.test.ts`

- [ ] **Step 1: escrever o teste que falha**

```ts
import { describe, expect, it } from "vitest";
import { tuneis } from "./tunel.js";

const deitado = { chave: "a", d: "M 0 50 H 100" };
const emPe = { chave: "b", d: "M 50 0 V 100" };

describe("quem mergulha", () => {
  it("o fio mais estreito passa por baixo do mais largo", () => {
    // O barramento é a linha que o leitor está seguindo; quem some é o magro.
    const achados = tuneis([
      { ...deitado, width: 1 },
      { ...emPe, width: 32 },
    ]);
    expect(achados.map((l) => l.chave)).toEqual(["a"]);
  });

  it("empatados na largura, o em pé mergulha sob o deitado", () => {
    // O olho segue a linha deitada, então ela é a que fica inteira.
    expect(tuneis([deitado, emPe]).map((l) => l.chave)).toEqual(["b"]);
  });

  it("empatados na largura e na orientação, decide a ordem das chaves", () => {
    // Dois trechos em pé podem cruzar dois deitados do mesmo fio. Sem esta
    // terceira regra sobraria caso sem dono, e o desenho mudaria entre dois
    // carregamentos da mesma página conforme a ordem de renderização.
    const um = { chave: "z", d: "M 0 50 H 100" };
    const outro = { chave: "y", d: "M 0 50 H 100 V 0" };
    const achados = tuneis([um, outro]);
    for (const lacuna of achados) expect(lacuna.chave).toBe("z");
  });

  it("a decisão é a mesma nas duas ordens de entrada", () => {
    const ida = tuneis([{ ...deitado, width: 1 }, { ...emPe, width: 32 }]);
    const volta = tuneis([{ ...emPe, width: 32 }, { ...deitado, width: 1 }]);
    expect(ida.map((l) => `${l.chave}@${l.x},${l.y}`)).toEqual(
      volta.map((l) => `${l.chave}@${l.x},${l.y}`),
    );
  });
});

describe("a lacuna", () => {
  it("cai sobre o cruzamento, e sabe para que lado ela se abre", () => {
    const [lacuna] = tuneis([deitado, emPe]);
    expect(lacuna).toMatchObject({ chave: "b", x: 50, y: 50, horizontal: false });
    expect(lacuna?.folga).toBeGreaterThan(0);
  });

  it("todo cruzamento fica coberto por alguma lacuna", () => {
    // É o invariante inteiro: cruzamento nu é o defeito que este round mata.
    const fios = [
      { chave: "a", d: "M 0 50 H 200" },
      { chave: "b", d: "M 50 0 V 100" },
      { chave: "c", d: "M 150 0 V 100" },
    ];
    const achados = tuneis(fios);
    expect(achados).toHaveLength(2);
    expect(achados.map((l) => l.x).sort((p, q) => p - q)).toEqual([50, 150]);
  });

  it("dois cruzamentos juntos viram UM túnel, e não dois buracos colados", () => {
    // É o que o belt subterrâneo faz: mergulha antes do primeiro e reaparece
    // depois do último. Duas lacunas coladas se leem como fio picotado.
    const fios = [
      { chave: "a", d: "M 0 50 H 200" },
      { chave: "b", d: "M 50 0 V 100" },
      { chave: "c", d: "M 56 0 V 100" },
    ];
    const achados = tuneis(fios);
    expect(achados).toHaveLength(1);
    expect(achados[0]?.x).toBe(53);
    // A folga cobre os dois cruzamentos, com sobra para as bocas.
    expect(achados[0]?.folga).toBeGreaterThan(3 + 6 / 2);
  });

  it("perto da ponta do trecho, a folga encolhe em vez de invadir a porta", () => {
    const fios = [
      { chave: "a", d: "M 0 50 H 100" },
      { chave: "b", d: "M 4 40 V 60" },
    ];
    const [lacuna] = tuneis(fios);
    expect(lacuna?.chave).toBe("b");
    expect(lacuna?.folga).toBeLessThanOrEqual(4);
    expect(lacuna?.folga).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `pnpm vitest run packages/depth-ui/src/tunel.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: implementar `packages/depth-ui/src/tunel.ts`**

```ts
import { cruzamentos, segmentos } from "./espaguete.js";

/**
 * O túnel: onde dois fios se cruzam, um mergulha e reaparece do outro lado.
 *
 * É o belt subterrâneo do Factorio, e ele existe lá pela mesma razão que aqui —
 * duas esteiras se cruzando sem que o leitor tenha de adivinhar o que se mistura
 * com o quê. A convenção antiga do esquemático (o T ganha pontinho, o X não)
 * está certa e é **muda por ausência**: quem não a conhece não tem como saber
 * que a falta do ponto quer dizer alguma coisa.
 *
 * Este módulo não desenha nada e não conhece React: ele decide **quem** mergulha
 * e **onde**. Quem pinta é o `Stage`.
 */

/** Um fio já roteado, do jeito que o palco o desenhou. */
export interface FioDesenhado {
  readonly chave: string;
  readonly d: string;
  /** A largura declarada pelo modelo. Ausente é fio de uma via. */
  readonly width?: number | undefined;
}

/** Onde um fio some, e por quanto. */
export interface Lacuna {
  /** De quem é o mergulho. */
  readonly chave: string;
  /** O centro do buraco. */
  readonly x: number;
  readonly y: number;
  /** Se o trecho que mergulha está deitado. Decide para que lado o buraco abre. */
  readonly horizontal: boolean;
  /** Metade do comprimento do buraco: do centro até cada boca. */
  readonly folga: number;
}

/** Do centro até a boca, quando há espaço. */
const MERGULHO = 6;
/** O mínimo que ainda se lê como buraco e não como falha de antialiasing. */
const MINIMO = 2;
/** Encostado na ponta do trecho, o buraco invadiria a porta. */
const MARGEM_DA_PONTA = 2;

const larguraDe = (fio: FioDesenhado): number => fio.width ?? 1;

/**
 * Quem mergulha, na ordem, e a primeira regra que resolver decide.
 *
 * A terceira existe para a decisão ser **total**: um critério que empata em
 * algum caso entrega aquele caso ao acaso da ordem de renderização, e a mesma
 * vista passa a se desenhar diferente entre dois carregamentos.
 */
function quemMergulha(
  a: FioDesenhado,
  b: FioDesenhado,
  horizontalA: boolean,
): { readonly fio: FioDesenhado; readonly horizontal: boolean } {
  const larguraA = larguraDe(a);
  const larguraB = larguraDe(b);
  if (larguraA !== larguraB) {
    return larguraA < larguraB
      ? { fio: a, horizontal: horizontalA }
      : { fio: b, horizontal: !horizontalA };
  }
  // Empate na largura: o em pé mergulha sob o deitado.
  if (horizontalA) return { fio: b, horizontal: false };
  if (!horizontalA && larguraA === larguraB && a !== b) {
    // `a` é o em pé, a menos que a terceira regra mande o contrário.
  }
  return { fio: a, horizontal: false };
}

/** O trecho, dentro do fio, que passa por este ponto na orientação dada. */
function trechoNoPonto(
  fio: FioDesenhado,
  x: number,
  y: number,
  horizontal: boolean,
): { readonly de: number; readonly ate: number } | undefined {
  for (const s of segmentos(fio.d)) {
    const deitado = s.y1 === s.y2;
    if (deitado !== horizontal) continue;
    if (deitado && s.y1 === y && x > Math.min(s.x1, s.x2) && x < Math.max(s.x1, s.x2)) {
      return { de: Math.min(s.x1, s.x2), ate: Math.max(s.x1, s.x2) };
    }
    if (!deitado && s.x1 === x && y > Math.min(s.y1, s.y2) && y < Math.max(s.y1, s.y2)) {
      return { de: Math.min(s.y1, s.y2), ate: Math.max(s.y1, s.y2) };
    }
  }
  return undefined;
}

/**
 * As lacunas de todos os fios.
 *
 * Cruzamentos vizinhos **no mesmo trecho do mesmo fio** viram um túnel só: é o
 * que o belt subterrâneo faz, mergulhar antes do primeiro e reaparecer depois do
 * último. Dois buracos colados se leriam como um fio picotado, que é justamente
 * a "quebra" que este round existe para matar.
 */
export function tuneis(fios: readonly FioDesenhado[]): readonly Lacuna[] {
  const achados = cruzamentos(fios.map((f) => f.d));

  /** Por fio e por trecho, as posições que precisam ficar cobertas. */
  const porTrecho = new Map<string, { readonly lacuna: Omit<Lacuna, "folga">; readonly posicoes: number[]; readonly limites: { de: number; ate: number } }>();

  for (const c of achados) {
    const a = fios[c.a];
    const b = fios[c.b];
    if (a === undefined || b === undefined) continue;

    let escolhido = quemMergulha(a, b, c.horizontalA);
    // A terceira regra: empatados em largura E em orientação, decide a chave.
    if (larguraDe(a) === larguraDe(b) && c.horizontalA === c.horizontalB) {
      const menor = a.chave <= b.chave ? a : b;
      escolhido = { fio: menor, horizontal: c.horizontalA };
    }

    const trecho = trechoNoPonto(escolhido.fio, c.x, c.y, escolhido.horizontal);
    if (trecho === undefined) continue;

    const posicao = escolhido.horizontal ? c.x : c.y;
    const chave = `${escolhido.fio.chave}|${escolhido.horizontal ? "h" : "v"}|${
      escolhido.horizontal ? c.y : c.x
    }|${trecho.de}-${trecho.ate}`;

    const existente = porTrecho.get(chave);
    if (existente === undefined) {
      porTrecho.set(chave, {
        lacuna: {
          chave: escolhido.fio.chave,
          x: c.x,
          y: c.y,
          horizontal: escolhido.horizontal,
        },
        posicoes: [posicao],
        limites: { de: trecho.de, ate: trecho.ate },
      });
      continue;
    }
    existente.posicoes.push(posicao);
  }

  const saida: Lacuna[] = [];
  for (const { lacuna, posicoes, limites } of porTrecho.values()) {
    for (const grupo of agrupar(posicoes)) {
      const centro = (Math.min(...grupo) + Math.max(...grupo)) / 2;
      const metade = (Math.max(...grupo) - Math.min(...grupo)) / 2;
      // A folga é o que cabe: perto da ponta do trecho ela encolhe em vez de
      // invadir a porta em que o fio chega.
      const espaco = Math.min(centro - limites.de, limites.ate - centro) - MARGEM_DA_PONTA;
      const folga = Math.max(MINIMO, Math.min(metade + MERGULHO, espaco));
      saida.push(
        lacuna.horizontal
          ? { ...lacuna, x: centro, folga }
          : { ...lacuna, y: centro, folga },
      );
    }
  }
  // Ordem estável: o desenho não pode depender da ordem de iteração do mapa.
  return saida.sort((p, q) => p.chave.localeCompare(q.chave) || p.x - q.x || p.y - q.y);
}

/** Posições vizinhas o bastante para caberem no mesmo túnel. */
function agrupar(posicoes: readonly number[]): readonly (readonly number[])[] {
  const ordenadas = [...posicoes].sort((a, b) => a - b);
  const grupos: number[][] = [];
  for (const p of ordenadas) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo !== undefined && p - (ultimo[ultimo.length - 1] ?? 0) <= MERGULHO * 2) {
      ultimo.push(p);
      continue;
    }
    grupos.push([p]);
  }
  return grupos;
}
```

- [ ] **Step 4: rodar, e consertar o que a suíte apontar**

Run: `pnpm vitest run packages/depth-ui/src/tunel.test.ts`
Expected: PASS. A função `quemMergulha` acima tem um ramo morto deixado à
vista (`if (!horizontalA && …)`) — **apague-o** e confirme que os testes seguem
verdes; ele existe no plano para o leitor ver que o caso do empate é decidido
fora, na terceira regra, e não ali dentro.

- [ ] **Step 5: Commit**

```bash
git add packages/depth-ui/src/tunel.ts packages/depth-ui/src/tunel.test.ts
git commit -m "feat(depth-ui): quem mergulha no cruzamento, e onde o fio some"
```

---

## Task 3: o buraco é máscara, e o `d` continua inteiro

**Files:**
- Modify: `packages/depth-ui/src/Stage.tsx`

- [ ] **Step 1: montar as lacunas ao lado das arestas**

Depois de a lista `arestas` estar pronta (a que termina com
`.filter((a): a is NonNullable<typeof a> => a !== null)`), acrescente:

```tsx
  /**
   * Onde cada fio mergulha.
   *
   * Sai da MESMA função que acha os cruzamentos, então não existe desenho
   * tunelando num lugar enquanto a conta conta em outro.
   */
  const lacunas = tuneis(
    arestas.map((a) => ({
      chave: a.chave,
      d: a.traco,
      ...(a.width === undefined ? {} : { width: a.width }),
    })),
  );
  const lacunasDe = new Map<string, Lacuna[]>();
  for (const lacuna of lacunas) {
    lacunasDe.set(lacuna.chave, [...(lacunasDe.get(lacuna.chave) ?? []), lacuna]);
  }
```

E, no topo do arquivo, ao lado dos outros imports internos:

```tsx
import { tuneis } from "./tunel.js";
import type { Lacuna } from "./tunel.js";
```

- [ ] **Step 2: a máscara, e o porquê dela em vez de partir o caminho**

Ainda em `Stage.tsx`, acrescente esta função auxiliar junto das outras funções de
módulo (fora do componente):

```tsx
/** A caixa que contém um caminho, com folga para a máscara não cortar a ponta. */
function caixaDoCaminho(d: string): { x: number; y: number; w: number; h: number } {
  const partes = segmentos(d);
  const xs = partes.flatMap((s) => [s.x1, s.x2]);
  const ys = partes.flatMap((s) => [s.y1, s.y2]);
  const margem = 20;
  const minX = Math.min(...xs, 0);
  const minY = Math.min(...ys, 0);
  return {
    x: minX - margem,
    y: minY - margem,
    w: Math.max(...xs, 0) - minX + margem * 2,
    h: Math.max(...ys, 0) - minY + margem * 2,
  };
}

/**
 * O vazio do túnel é uma **máscara**, e não um `d` partido.
 *
 * Partir o caminho limparia a tela e cegaria a medida: `meada()` lê os `d` que a
 * página desenhou, e dois trechos que não se tocam não se cruzam — o `cpu`
 * passaria de quinze cruzamentos para perto de zero sem que uma linha tivesse
 * melhorado, e o teto viraria a descrição de um estrago que ninguém mais vê.
 *
 * Com máscara, o `d` continua inteiro e a medida lê o mesmo de antes. Não existe
 * caminho pelo qual o túnel encoste no número.
 */
function MascaraDoTunel({
  id,
  d,
  lacunas,
}: {
  readonly id: string;
  readonly d: string;
  readonly lacunas: readonly Lacuna[];
}) {
  const caixa = caixaDoCaminho(d);
  // Mais grosso que o traço mais grosso do palco (o barramento, 3.5) com folga
  // para o halo: o buraco tem de atravessar o fio inteiro.
  const espessura = 9;
  return (
    <mask id={id} maskUnits="userSpaceOnUse">
      <rect x={caixa.x} y={caixa.y} width={caixa.w} height={caixa.h} fill="white" />
      {lacunas.map((lacuna) => (
        <rect
          key={`${lacuna.x},${lacuna.y}`}
          x={lacuna.horizontal ? lacuna.x - lacuna.folga : lacuna.x - espessura / 2}
          y={lacuna.horizontal ? lacuna.y - espessura / 2 : lacuna.y - lacuna.folga}
          width={lacuna.horizontal ? lacuna.folga * 2 : espessura}
          height={lacuna.horizontal ? espessura : lacuna.folga * 2}
          fill="black"
        />
      ))}
    </mask>
  );
}
```

`segmentos` já é exportado por `espaguete.ts`; acrescente-o ao import que
`Stage.tsx` faz de lá (ou crie o import, se ainda não houver).

- [ ] **Step 3: aplicar no grupo do fio, e desenhar as bocas**

No `<g className="dui-stage__fio" …>` de cada aresta (o que carrega `data-de` e
`data-para`, por volta da linha 1315), acrescente o atributo:

```tsx
            mask={
              (lacunasDe.get(aresta.chave)?.length ?? 0) > 0
                ? `url(#${identificador(`tunel-${aresta.chave}`)})`
                : undefined
            }
```

E, **dentro** desse mesmo `<g>`, antes do primeiro `<path>`:

```tsx
            {(lacunasDe.get(aresta.chave)?.length ?? 0) > 0 ? (
              <MascaraDoTunel
                id={identificador(`tunel-${aresta.chave}`)}
                d={aresta.traco}
                lacunas={lacunasDe.get(aresta.chave) ?? []}
              />
            ) : null}
```

As **bocas** não podem ficar dentro do grupo mascarado — a máscara as apagaria
junto com o fio. Elas vão num grupo próprio, depois do laço das arestas e antes
do fechamento do `<svg>`, ao lado do grupo das travessias:

```tsx
        {/*
          As bocas do túnel.

          Duas por lacuna, sempre do mesmo tamanho e do mesmo lado — é o par que
          o olho usa para reconstituir a linha. Uma boca sozinha é um fio que
          parece ter acabado, que é a "quebra" que este round mata.

          A cor não é própria: `data-linha` faz a boca herdar o token do fio a
          que ela pertence, senão um túnel de linha de controle sairia preto e
          diria que ali passa dado.
        */}
        <g className="dui-stage__tuneis">
          {lacunas.map((lacuna) => {
            const dona = arestas.find((a) => a.chave === lacuna.chave);
            const lado = 5;
            const bocas = lacuna.horizontal
              ? [
                  { x: lacuna.x - lacuna.folga, y: lacuna.y, giro: 0 },
                  { x: lacuna.x + lacuna.folga, y: lacuna.y, giro: 180 },
                ]
              : [
                  { x: lacuna.x, y: lacuna.y - lacuna.folga, giro: 90 },
                  { x: lacuna.x, y: lacuna.y + lacuna.folga, giro: 270 },
                ];
            return bocas.map((boca, i) => (
              <polygon
                key={`${lacuna.chave}-${lacuna.x}-${lacuna.y}-${i}`}
                className="dui-stage__boca"
                data-tunel={lacuna.chave}
                data-linha={dona?.linha}
                points={`0,${-lado} ${lado},0 0,${lado}`}
                transform={`translate(${boca.x} ${boca.y}) rotate(${boca.giro})`}
              />
            ));
          })}
        </g>
```

- [ ] **Step 4: ver na tela**

Run: `pnpm build && pnpm --filter @ovh/site preview`
Abra `/labs/micro/` e `/labs/cpu/`. Esperado: onde um fio preto cruzava um
barramento verde, agora há um vazio com um triangulinho de cada lado, e o
barramento segue inteiro. **Depois de mexer no desenho, olhar o desenho** — um
teste de atributo daria isto por resolvido com o CSS ainda sem pintar.

- [ ] **Step 5: Commit**

```bash
git add packages/depth-ui/src/Stage.tsx
git commit -m "feat(depth-ui): o fio mergulha no cruzamento, e o d continua inteiro"
```

---

## Task 4: a boca entra no catálogo

**Files:**
- Modify: `packages/depth-ui/src/stage.css`

- [ ] **Step 1: escrever o estilo, sem tinta**

No bloco do catálogo do `stage.css`, junto das outras formas:

```css
/*
  A boca do túnel: a figura que diz "este fio passa por baixo, e volta ali".
  Sem ela o cruzamento se lê como ligação, e a convenção que responderia isso
  hoje é a ausência de um pontinho — muda para quem não a conhece.

  A cor sai do fio dono, e não daqui: túnel de linha de controle é vermelho
  porque a linha é de controle.
*/
.dui-stage__boca {
  fill: var(--dui-dado);
}

.dui-stage__boca[data-linha="control"] {
  fill: var(--dui-controle);
}
```

Confirme os nomes dos tokens lendo o bloco do catálogo antes de escrever: eles
são os mesmos que `.dui-stage__fio[data-linha="control"] .dui-stage__trilho` já
usa. **Não** invente token novo, e **não** escreva hexadecimal — nem em
comentário.

- [ ] **Step 2: rodar a guarda**

Run: `pnpm catalogo`
Expected: "Catálogo da linguagem visual intacto".

- [ ] **Step 3: Commit**

```bash
git add packages/depth-ui/src/stage.css
git commit -m "feat(depth-ui): a boca do túnel no catálogo, pintada pelo dono"
```

---

## Task 5: os invariantes na tela

**Files:**
- Modify: `apps/site/tests/espaguete.spec.ts`

- [ ] **Step 1: escrever os testes**

Acrescente ao arquivo, reusando o `porEscopo` e os `TETOS` que ele já tem:

```ts
for (const teto of TETOS) {
  test(`${teto.nome}: nenhum cruzamento fica nu`, async ({ page }) => {
    await page.goto(teto.lab);
    const medidos = await fiosDesenhados(page);
    const bocas = await page.locator(".dui-stage__boca").evaluateAll((nos) =>
      nos.map((n) => {
        const t = (n as SVGGraphicsElement).getAttribute("transform") ?? "";
        const m = /translate\(([-\d.]+) ([-\d.]+)\)/u.exec(t);
        return {
          tunel: n.getAttribute("data-tunel") ?? "",
          x: Number(m?.[1] ?? NaN),
          y: Number(m?.[2] ?? NaN),
        };
      }),
    );

    // 1. Todo cruzamento está coberto: entre as duas bocas de algum túnel.
    for (const grupo of porEscopo(medidos)) {
      for (const c of cruzamentos(grupo.map((f) => f.d))) {
        const cobre = bocas.some((b) => Math.abs(b.x - c.x) < 24 && Math.abs(b.y - c.y) < 24);
        expect(cobre, `cruzamento nu em ${c.x},${c.y} de ${teto.nome}`).toBe(true);
      }
    }

    // 2. Boca vem em par: uma sozinha é o fio que parece ter acabado.
    const porTunel = new Map<string, number>();
    for (const b of bocas) porTunel.set(b.tunel, (porTunel.get(b.tunel) ?? 0) + 1);
    for (const [tunel, quantas] of porTunel) {
      expect(quantas % 2, `o túnel de ${tunel} tem ${quantas} bocas`).toBe(0);
    }
  });
}
```

`fiosDesenhados` é o helper que o arquivo já usa para ler os `d` da página; se
ele estiver embutido no teste existente, extraia-o para uma função do módulo
antes de escrever este teste — sem duplicar a leitura.

- [ ] **Step 2: rodar**

Run: `pnpm --filter @ovh/site test:e2e tests/espaguete.spec.ts`
Expected: PASS nos dois projetos, **e os tetos de cruzamento continuam os
mesmos** (15 no `cpu`, 7 no `micro`, 5 no `gates`, 4 no `rpn`, 1 no
`providers`). Se algum teto tiver mudado, a máscara virou `d` partido em algum
lugar — volte à Task 3.

- [ ] **Step 3: teste de mutação**

Comente a linha `mask={…}` do grupo do fio, rode de novo e confirme que o item 1
**não** cai (o cruzamento continua coberto pelas bocas) mas o desenho volta a
mentir — depois comente o grupo `dui-stage__tuneis` inteiro e confirme que o item
1 cai nomeando o lab. Restaure os dois. Anote o resultado para o `PROGRESS.md`.

- [ ] **Step 4: Commit**

```bash
git add apps/site/tests/espaguete.spec.ts
git commit -m "test(site): nenhum cruzamento fica nu, e boca vem em par"
```

---

## Task 6: o registro

- [ ] **Step 1:** captura dos cinco labs (`cpu`, `micro`, `gates`, `rpn`,
      `providers`) depois da mudança, e comparação com as de antes. Anexe o que
      mudou no `PROGRESS.md` em prosa: quantos túneis por lab, e o que ficou
      legível que não era.
- [ ] **Step 2:** `docs/PROGRESS.md` com a rodada, incluindo **o resultado do
      teste de mutação** da Task 5 e a razão de a máscara existir.
- [ ] **Step 3:** `docs/roadmap.md`: o túnel entra como parte da linguagem
      visual, e a solta do roteador fica nomeada como a rodada seguinte.
- [ ] **Step 4: Commit**

```bash
git add docs
git commit -m "docs: o registro dos túneis no cruzamento"
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

---

## Auto-revisão do plano

**Onde ele pode dar errado:**

1. **A máscara e o zoom.** `maskUnits="userSpaceOnUse"` resolve no espaço do
   desenho, que é o mesmo em que o `d` está escrito — então o buraco acompanha o
   zoom sem conta nenhuma. Se o buraco "escorregar" ao ampliar, a caixa da
   máscara está sendo calculada em outro espaço: confira `caixaDoCaminho`.
2. **Bocas dentro do grupo mascarado.** A máscara as apagaria. Elas estão num
   grupo próprio de propósito, e o Step 3 da Task 3 diz onde.
3. **Um túnel cobrindo dois cruzamentos** (Task 2) é deliberado e é o que o belt
   subterrâneo faz. A spec §7 fala em "um par de bocas por cruzamento"; o
   invariante implementado é o mais forte e o mais honesto — **todo cruzamento
   coberto**, e nenhuma boca órfã. Registre a diferença no `PROGRESS.md`.
4. **O teto mudar.** É o sinal de que o `d` foi partido em algum lugar. O Step 2
   da Task 5 cobra isso explicitamente.
5. **Fio muito curto.** Perto da ponta do trecho a folga encolhe até `MINIMO`;
   abaixo disso o buraco não se lê. Se aparecer um caso assim numa vista real, a
   resposta **não** é diminuir o mínimo — é o roteador ter roteado apertado
   demais, e isso é a rodada seguinte.

**O que este plano deliberadamente não faz:** soltar os pesos do roteador, túnel
declarado no modelo, ponte curva, e lacuna sem boca. Os motivos estão na §8 da
spec, e nenhum deles é "não deu tempo".
