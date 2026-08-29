# S1 — Motor composicional (núcleo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o modelo de níveis fixos por um motor onde a profundidade é a árvore de composição do objeto: só folhas têm comportamento, o pai é um escalonador de mensagens, e a vista agregada é uma projeção de fronteira do mesmo run.

**Architecture:** Cinco módulos novos em `packages/depth-core/src`, todos puros e agnósticos de domínio. `model.ts` define os tipos (`ObjectSpec`, `Kind`, `Message`, `Behavior`). `tree.ts` indexa a árvore e responde perguntas de estrutura (pai, folha de entrada/saída, o que é abrível, qual filho visível contém uma folha). `wiring.ts` resolve `(nó, porta) → folha de destino`, incluindo o encadeamento implícito de um `pipeline`. `scheduler.ts` executa **um tick** como função pura `WorldState → WorldState`. `world.ts` guarda o histórico append-only, faz `seek` exato e trata parâmetro como **evento no tempo** (mudar parâmetro nunca volta o tick para 0). `meters.ts` lê exclusivamente o livro-caixa de portas.

O modelo antigo (`types.ts`, `engine.ts`, `LevelId`, `Scenario`) **fica intacto nesta sessão** para manter `main` verde — a landing ainda depende dele. A remoção é a S5. Por isso o motor novo entra como `world.ts`/`World` em vez de sobrescrever `engine.ts`; é andaime declarado, não arquitetura.

**Tech Stack:** TypeScript estrito (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`), Vitest, pnpm workspaces. Sem dependências novas.

**Spec:** `docs/superpowers/specs/2026-08-28-motor-composicional-design.md`

---

## Estrutura de arquivos

| Caminho | Responsabilidade |
|---|---|
| `packages/depth-core/src/model.ts` | tipos: `Kind`, `Family`, `Role`, `Message`, `Emission`, `Behavior`, `ObjectSpec`, `Wire`, `WorldSpec`, `WorldState` + `familyOf` |
| `packages/depth-core/src/tree.ts` | índice da árvore: pai, filhos de fluxo, folha de entrada/saída, abrível, filho visível |
| `packages/depth-core/src/tree.test.ts` | testes de estrutura |
| `packages/depth-core/src/wiring.ts` | `resolveTarget(tree, wires, from, port)` com encadeamento implícito de pipeline |
| `packages/depth-core/src/wiring.test.ts` | testes de fiação |
| `packages/depth-core/src/scheduler.ts` | `stepWorld`: um tick puro |
| `packages/depth-core/src/scheduler.test.ts` | entrega, emissão, descarte, livro-caixa |
| `packages/depth-core/src/world.ts` | `World`: histórico, `seek` exato, eventos de parâmetro |
| `packages/depth-core/src/world.test.ts` | determinismo e continuidade sob mudança de parâmetro |
| `packages/depth-core/src/meters.ts` | leituras puras do livro-caixa e travessias de fronteira |
| `packages/depth-core/src/meters.test.ts` | honestidade dos medidores e "agregado = fronteira" |
| `packages/depth-core/src/index.ts` | superfície pública (modificado) |
| `scripts/check-boundaries.mjs` | guarda ampliada (modificado) |

Preservados sem alteração: `random.ts`, `diff.ts`, `types.ts`, `engine.ts`.

---

## Task 1: O modelo e o índice da árvore

**Files:**
- Create: `packages/depth-core/src/model.ts`
- Create: `packages/depth-core/src/tree.ts`
- Test: `packages/depth-core/src/tree.test.ts`

- [ ] **Step 1: Escrever `model.ts`** (tipos + a única função de runtime, `familyOf`, testada no Step 2)

```ts
/**
 * O modelo composicional. Tudo é objeto: `node` ocupa um lugar, `message`
 * viaja, `channel` liga dois nós. Os três usam este mesmo formato.
 *
 * O motor não sabe o que é telemetria, protocolo de exportação ou formato de
 * payload. `kind` de mensagem é uma string escolhida pelo domínio.
 *
 * (Cuidado ao comentar código aqui: `scripts/check-boundaries.mjs` é literal e
 * não entende negação — citar um termo de domínio, mesmo para dizer que o
 * motor não o conhece, quebra o CI. É a intenção.)
 */

export type Kind =
  | "composite"
  | "source"
  | "router"
  | "pipeline"
  | "buffer"
  | "sink"
  | "channel"
  | "static";

export type Role = "node" | "message" | "channel";

/**
 * A família vem antes do arquétipo e carrega a linguagem de forma. O `kind` só
 * faz a variação dentro dela — nunca uma forma inteiramente nova. É o que
 * impede o handbook de virar coleção de ilustrações sob medida, e o que faz
 * outro domínio herdar a linguagem inteira trocando só as variações.
 */
export type Family = "block" | "conduit" | "plate";

export function familyOf(kind: Kind): Family {
  if (kind === "channel") return "conduit";
  if (kind === "static") return "plate";
  return "block";
}

export type PortId = string;

/** Identificador da lixeira. Não é um objeto: é a ausência de destino. */
export const DROP = "@drop" as const;
export type Drop = typeof DROP;

export interface Message {
  readonly id: string;
  /** A forma da mensagem. Muda quando ela atravessa quem a transforma. */
  readonly kind: string;
  /** Quantos itens ela carrega. Um lote de 6 tem peso 6. */
  readonly weight: number;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface Emission {
  readonly port: PortId;
  readonly message: Message;
}

export interface StepContext {
  readonly tick: number;
  readonly random: () => number;
  readonly params: Readonly<Record<string, number>>;
  /**
   * Cria uma mensagem com id determinístico, derivado de (tick, nó, ordem).
   * Nunca um contador global: replay tem que reproduzir os mesmos ids.
   */
  readonly emit: (
    kind: string,
    weight?: number,
    data?: Record<string, unknown>,
  ) => Message;
}

/** Função pura. Nunca muta `state`; sempre devolve um novo. */
export type Behavior<S = unknown> = (
  state: S,
  inbox: readonly Message[],
  ctx: StepContext,
) => { readonly state: S; readonly out: readonly Emission[] };

export interface ObjectSpec<S = unknown> {
  readonly id: string;
  readonly kind: Kind;
  readonly role?: Role;
  readonly label: string;
  readonly children?: readonly ObjectSpec[];
  /** Folha mesmo tendo filhos: a válvula da regra de abertura. */
  readonly leaf?: true;
  /** Abrível, mas os filhos são o conteúdo, não uma sub-árvore declarada. */
  readonly dynamic?: true;
  /** Obrigatório em objeto que age. Composto NUNCA tem comportamento. */
  readonly behavior?: Behavior<S>;
  readonly init?: () => S;
}

export interface Wire {
  readonly from: string;
  readonly port: PortId;
  readonly to: string | Drop;
  /**
   * O id do objeto `channel` que ESTA aresta é. Um canal não é filho de
   * ninguém na árvore: ele é a linha. Quando presente, a aresta é clicável e
   * abrível, e a subárvore do canal descreve o interior dele.
   */
  readonly channel?: string;
}

export interface WorldSpec {
  readonly id: string;
  readonly seed: number;
  readonly root: ObjectSpec;
  readonly wires: readonly Wire[];
  readonly params: Readonly<Record<string, number>>;
  /** Quantos ticks uma mensagem leva para atravessar uma aresta. */
  readonly edgeTicks?: number;
}

export interface InFlight {
  readonly id: string;
  readonly message: Message;
  readonly from: string;
  readonly to: string | Drop;
  readonly sent: number;
}

export interface WorldState {
  readonly tick: number;
  /** Estado interno de cada folha, por id. */
  readonly nodes: Readonly<Record<string, unknown>>;
  readonly flight: readonly InFlight[];
  /** Livro-caixa de portas: "no.porta" → contagem. Única fonte dos medidores. */
  readonly ledger: Readonly<Record<string, number>>;
}
```

- [ ] **Step 2: Escrever o teste que falha**

```ts
// packages/depth-core/src/tree.test.ts
import { describe, expect, it } from "vitest";
import { familyOf } from "./model.js";
import type { ObjectSpec } from "./model.js";
import {
  entryLeaf,
  exitLeaf,
  flowChildren,
  indexTree,
  isOpenable,
  visibleChild,
} from "./tree.js";

const leaf = (id: string, kind: ObjectSpec["kind"]): ObjectSpec => ({
  id,
  kind,
  label: id,
  leaf: true,
  behavior: (state) => ({ state, out: [] }),
});

const root: ObjectSpec = {
  id: "root",
  kind: "composite",
  label: "root",
  children: [
    leaf("src", "source"),
    {
      id: "box",
      kind: "composite",
      label: "box",
      children: [
        leaf("note", "static"),
        leaf("gate", "router"),
        {
          id: "chain",
          kind: "pipeline",
          label: "chain",
          children: [leaf("a", "sink"), leaf("b", "sink")],
        },
      ],
    },
    leaf("out", "sink"),
  ],
};

describe("familyOf", () => {
  it("agrupa os arquétipos em famílias de forma", () => {
    expect(familyOf("channel")).toBe("conduit");
    expect(familyOf("static")).toBe("plate");
    for (const kind of ["composite", "source", "router", "pipeline", "buffer", "sink"] as const) {
      expect(familyOf(kind)).toBe("block");
    }
  });
});

describe("indexTree", () => {
  it("mapeia cada objeto ao pai dele", () => {
    const t = indexTree(root);
    expect(t.parent.get("gate")).toBe("box");
    expect(t.parent.get("a")).toBe("chain");
    expect(t.parent.get("root")).toBeUndefined();
    expect(t.byId.get("chain")?.kind).toBe("pipeline");
  });
});

describe("isOpenable", () => {
  it("abre quem tem filhos", () => {
    const t = indexTree(root);
    expect(isOpenable(t, "box")).toBe(true);
    expect(isOpenable(t, "gate")).toBe(false);
  });

  it("respeita a válvula leaf mesmo com filhos", () => {
    const t = indexTree({
      ...root,
      children: [{ id: "shut", kind: "pipeline", label: "shut", leaf: true, children: [leaf("x", "sink")] }],
    });
    expect(isOpenable(t, "shut")).toBe(false);
  });

  it("abre objeto dinâmico sem filhos declarados", () => {
    const t = indexTree({
      ...root,
      children: [{ id: "q", kind: "buffer", label: "q", dynamic: true, behavior: (s) => ({ state: s, out: [] }) }],
    });
    expect(isOpenable(t, "q")).toBe(true);
  });
});

describe("flowChildren", () => {
  it("ignora os estáticos, que não são atravessados", () => {
    const t = indexTree(root);
    expect(flowChildren(t, "box")).toEqual(["gate", "chain"]);
  });
});

describe("entryLeaf e exitLeaf", () => {
  it("descem até a folha, pulando estáticos", () => {
    const t = indexTree(root);
    expect(entryLeaf(t, "box")).toBe("gate");
    expect(exitLeaf(t, "box")).toBe("b");
    expect(entryLeaf(t, "gate")).toBe("gate");
  });
});

describe("visibleChild", () => {
  it("devolve o filho do foco que contém a folha", () => {
    const t = indexTree(root);
    expect(visibleChild(t, "root", "a")).toBe("box");
    expect(visibleChild(t, "box", "a")).toBe("chain");
  });

  it("devolve null quando a folha é o próprio foco", () => {
    const t = indexTree(root);
    expect(visibleChild(t, "gate", "gate")).toBeNull();
  });

  it("devolve 'outside' quando a folha está fora do foco", () => {
    const t = indexTree(root);
    expect(visibleChild(t, "box", "src")).toBe("outside");
  });
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `pnpm vitest run packages/depth-core/src/tree.test.ts`
Expected: FAIL — `Failed to resolve import "./tree.js"`

- [ ] **Step 4: Implementar `tree.ts`**

```ts
import type { ObjectSpec } from "./model.js";

export interface TreeIndex {
  readonly byId: ReadonlyMap<string, ObjectSpec>;
  readonly parent: ReadonlyMap<string, string>;
  readonly rootId: string;
}

export function indexTree(root: ObjectSpec): TreeIndex {
  const byId = new Map<string, ObjectSpec>();
  const parent = new Map<string, string>();

  const walk = (node: ObjectSpec): void => {
    if (byId.has(node.id)) {
      throw new Error(`tree: id duplicado "${node.id}"`);
    }
    byId.set(node.id, node);
    for (const child of node.children ?? []) {
      parent.set(child.id, node.id);
      walk(child);
    }
  };
  walk(root);

  return { byId, parent, rootId: root.id };
}

function spec(tree: TreeIndex, id: string): ObjectSpec {
  const node = tree.byId.get(id);
  if (node === undefined) throw new Error(`tree: objeto desconhecido "${id}"`);
  return node;
}

/**
 * Um objeto é abrível se os filhos dele trocam mensagens que dá para ver — ou
 * se o interior dele É o conteúdo (`dynamic`). `leaf` é a válvula do autor.
 */
export function isOpenable(tree: TreeIndex, id: string): boolean {
  const node = spec(tree, id);
  if (node.leaf === true) return false;
  if (node.dynamic === true) return true;
  return (node.children?.length ?? 0) > 0;
}

/** Filhos que participam do fluxo. Estático é consultado, não atravessado. */
export function flowChildren(tree: TreeIndex, id: string): string[] {
  return (spec(tree, id).children ?? [])
    .filter((c) => c.kind !== "static")
    .map((c) => c.id);
}

function terminal(tree: TreeIndex, id: string, pick: "first" | "last"): string {
  const node = spec(tree, id);
  if (node.leaf === true || (node.children?.length ?? 0) === 0) return id;
  const kids = flowChildren(tree, id);
  const next = pick === "first" ? kids[0] : kids[kids.length - 1];
  if (next === undefined) {
    throw new Error(`tree: "${id}" não tem filho de fluxo`);
  }
  return terminal(tree, next, pick);
}

export function entryLeaf(tree: TreeIndex, id: string): string {
  return terminal(tree, id, "first");
}

export function exitLeaf(tree: TreeIndex, id: string): string {
  return terminal(tree, id, "last");
}

/**
 * Qual filho do foco contém esta folha. `null` = é o próprio foco;
 * `"outside"` = está fora da subárvore do foco.
 *
 * É esta função que faz a vista agregada existir sem ser autorada.
 */
export function visibleChild(
  tree: TreeIndex,
  focusId: string,
  leafId: string,
): string | null | "outside" {
  if (leafId === focusId) return null;
  let cursor: string | undefined = leafId;
  while (cursor !== undefined) {
    const up: string | undefined = tree.parent.get(cursor);
    if (up === focusId) return cursor;
    cursor = up;
  }
  return "outside";
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `pnpm vitest run packages/depth-core/src/tree.test.ts`
Expected: PASS — 10 testes

- [ ] **Step 6: Commit**

```bash
git add packages/depth-core/src/model.ts packages/depth-core/src/tree.ts packages/depth-core/src/tree.test.ts
git commit -m "feat(depth-core): modelo composicional e indice da arvore"
```

---

## Task 1b: Retrabalho da Task 1 (achados da revisão de qualidade)

A revisão de qualidade aprovou a estrutura e apontou seis defeitos, cinco deles da classe
"mente em silêncio e passa nos testes". Esta tarefa fecha todos.

**Files:**
- Modify: `packages/depth-core/src/model.ts`
- Modify: `packages/depth-core/src/tree.ts`
- Modify: `packages/depth-core/src/tree.test.ts`

- [ ] **Step 1: `visibleChild` devolve resultado discriminado e valida os ids**

O sentinela `"outside"` morava no mesmo espaço de nomes dos ids: uma árvore com um filho
chamado `outside` era indistinguível de "está fora do foco". Pior, a função era a única do
arquivo que não validava id — um id inexistente devolvia `"outside"` e o pacote sumia da tela
sem erro. É exatamente o defeito que a §2.1 diz ser impossível por construção.

Em `model.ts`, acrescentar:

```ts
/** Onde uma folha está em relação a um foco. Discriminado de propósito: um id
 *  de objeto nunca pode ser confundido com "está fora daqui". */
export type Locus =
  | { readonly at: "child"; readonly id: string }
  | { readonly at: "self" }
  | { readonly at: "outside" };
```

Em `tree.ts`, substituir `visibleChild` por:

```ts
export function visibleChild(
  tree: TreeIndex,
  focusId: string,
  leafId: string,
): Locus {
  spec(tree, focusId);
  spec(tree, leafId);
  if (leafId === focusId) return { at: "self" };
  let cursor: string | undefined = leafId;
  // `parent` vem sempre de indexTree, que rejeita id duplicado e por isso não
  // produz ciclo. Um TreeIndex montado à mão é responsabilidade de quem monta.
  while (cursor !== undefined) {
    const up: string | undefined = tree.parent.get(cursor);
    if (up === focusId) return { at: "child", id: cursor };
    cursor = up;
  }
  return { at: "outside" };
}
```

Importar `Locus` de `./model.js` com `import type`.

- [ ] **Step 2: `isOpenable` conta filhos de fluxo, não filhos quaisquer**

Um `composite` só com `static` dentro (agrupar Resource e SpanLimits é plausível) era abrível
e explodia ao ser percorrido: `entryLeaf` lançava "não tem filho de fluxo". O docstring já
descrevia a regra certa; o código é que não a implementava.

```ts
export function isOpenable(tree: TreeIndex, id: string): boolean {
  const node = spec(tree, id);
  if (node.leaf === true) return false;
  if (node.dynamic === true) return true;
  // filhos que só são consultados não constituem tráfego para ver
  return flowChildren(tree, id).length > 0;
}
```

- [ ] **Step 3: fronteira de um contêiner é declarada, não acidental**

`entryLeaf`/`exitLeaf` derivavam a fronteira da ordem de declaração — inclusive em
`composite`, que a §3 define como contêiner **sem ordem imposta**. Reordenar os filhos de um
composto mudava para onde uma aresta entrega, e a ordem não devia significar nada ali.

Em `model.ts`, acrescentar a `ObjectSpec`:

```ts
  /** Por onde uma aresta que chega neste contêiner entra. Padrão: o primeiro
   *  filho de fluxo. Num `pipeline` a ordem é contrato e o padrão basta; num
   *  `composite` ela é acidental, então declare. */
  readonly entry?: string;
  /** Por onde uma aresta que sai deste contêiner parte. Padrão: o último. */
  readonly exit?: string;
```

Em `tree.ts`:

```ts
function terminal(tree: TreeIndex, id: string, pick: "first" | "last"): string {
  const node = spec(tree, id);
  if (node.leaf === true || node.dynamic === true) return id;
  if ((node.children?.length ?? 0) === 0) return id;

  const declared = pick === "first" ? node.entry : node.exit;
  if (declared !== undefined) {
    spec(tree, declared);
    return terminal(tree, declared, pick);
  }

  const kids = flowChildren(tree, id);
  const next = pick === "first" ? kids[0] : kids[kids.length - 1];
  if (next === undefined) {
    throw new Error(
      `tree: "${id}" tem filhos, mas nenhum de fluxo — só objetos consultados`,
    );
  }
  return terminal(tree, next, pick);
}
```

Repare que `dynamic` agora encerra a descida: os filhos de um buffer são conteúdo de runtime,
não destino de aresta.

- [ ] **Step 4: canais ganham onde morar**

`Wire.channel` apontava para um `ObjectSpec` que a árvore não indexava — `indexTree` só
percorre `root.children`. Qualquer id de canal quebrava `entryLeaf` e sumia em `visibleChild`.
Pendurar o canal em `root.children` seria pior: ele entraria em `flowChildren` e `exitLeaf`
poderia terminar dentro de um cano.

Em `model.ts`, acrescentar a `WorldSpec`:

```ts
  /** Canais são arestas, não filhos: têm subárvore própria e são indexados
   *  junto, mas nunca aparecem em `flowChildren` de ninguém. */
  readonly channels?: readonly ObjectSpec[];
```

Em `tree.ts`, `indexTree` passa a aceitar as raízes extras:

```ts
export function indexTree(
  root: ObjectSpec,
  channels: readonly ObjectSpec[] = [],
): TreeIndex {
  const byId = new Map<string, ObjectSpec>();
  const parent = new Map<string, string>();

  const walk = (node: ObjectSpec): void => {
    if (byId.has(node.id)) {
      throw new Error(`tree: id duplicado "${node.id}"`);
    }
    byId.set(node.id, node);
    for (const child of node.children ?? []) {
      parent.set(child.id, node.id);
      walk(child);
    }
  };

  walk(root);
  for (const channel of channels) walk(channel);

  return { byId, parent, rootId: root.id };
}
```

- [ ] **Step 5: o invariante central vira erro, não convenção**

"Objeto composto NUNCA tem comportamento" é o que impede a vista agregada de divergir do
interior. Estava só num comentário: um `composite` com `behavior` typechecava e o motor
descartaria o comportamento em silêncio.

Dentro de `walk`, antes de descer nos filhos:

```ts
    if (node.behavior !== undefined && node.leaf !== true && node.dynamic !== true) {
      const flow = (node.children ?? []).filter((c) => c.kind !== "static");
      if (flow.length > 0) {
        throw new Error(
          `tree: "${node.id}" é composto e tem behavior — o que um composto faz ` +
            `é o resultado de rodar os filhos. Marque leaf: true ou remova o behavior.`,
        );
      }
    }
```

- [ ] **Step 6: o genérico de `ObjectSpec` deixa de ser inutilizável**

`children: readonly ObjectSpec[]` é `ObjectSpec<unknown>[]`, e `Behavior<S>` é contravariante
no estado sob `strictFunctionTypes`: uma folha com estado real não entra na árvore
(`TS2375`). Toda folha viraria `ObjectSpec<unknown>` com cast dentro do comportamento — o
oposto do que o genérico existe para fazer.

Em `model.ts`:

```ts
/**
 * Um objeto de estado qualquer, para uso em posições onde a variância do
 * estado não importa (a lista de filhos). O `any` é deliberado: sem ele, uma
 * folha com estado real não pode ser filha de nada.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyObject = ObjectSpec<any>;
```

e trocar, dentro de `ObjectSpec`, `readonly children?: readonly ObjectSpec[];` por
`readonly children?: readonly AnyObject[];`. Idem em `WorldSpec.root`, `WorldSpec.channels` e
no parâmetro `channels` de `indexTree`.

- [ ] **Step 7: cobrir as bordas onde os defeitos moravam**

Acrescentar a `tree.test.ts`:

```ts
describe("bordas que a revisão expôs", () => {
  it("recusa id duplicado", () => {
    expect(() =>
      indexTree({
        id: "r",
        kind: "composite",
        label: "r",
        children: [leaf("dup", "sink"), leaf("dup", "sink")],
      }),
    ).toThrow(/id duplicado/);
  });

  it("recusa comportamento em objeto composto", () => {
    expect(() =>
      indexTree({
        id: "r",
        kind: "composite",
        label: "r",
        behavior: (state) => ({ state, out: [] }),
        children: [leaf("a", "sink")],
      }),
    ).toThrow(/é composto e tem behavior/);
  });

  it("visibleChild recusa id que não existe em vez de dizer 'outside'", () => {
    const t = indexTree(root);
    expect(() => visibleChild(t, "root", "fantasma")).toThrow(/objeto desconhecido/);
    expect(() => visibleChild(t, "fantasma", "src")).toThrow(/objeto desconhecido/);
  });

  it("um filho chamado 'outside' não é confundido com estar fora do foco", () => {
    const t = indexTree({
      id: "r",
      kind: "composite",
      label: "r",
      children: [leaf("outside", "sink"), leaf("other", "sink")],
    });
    expect(visibleChild(t, "r", "outside")).toEqual({ at: "child", id: "outside" });
    expect(visibleChild(t, "outside", "other")).toEqual({ at: "outside" });
  });

  it("contêiner só de estáticos não é abrível", () => {
    const t = indexTree({
      id: "r",
      kind: "composite",
      label: "r",
      children: [
        { id: "grp", kind: "composite", label: "grp", children: [leaf("k1", "static"), leaf("k2", "static")] },
      ],
    });
    expect(isOpenable(t, "grp")).toBe(false);
  });

  it("a fronteira declarada vence a ordem de declaração", () => {
    const t = indexTree({
      id: "r",
      kind: "composite",
      label: "r",
      entry: "b",
      exit: "a",
      children: [leaf("a", "sink"), leaf("b", "sink")],
    });
    expect(entryLeaf(t, "r")).toBe("b");
    expect(exitLeaf(t, "r")).toBe("a");
  });

  it("árvore de um nó só se resolve nela mesma", () => {
    const t = indexTree(leaf("solo", "source"));
    expect(entryLeaf(t, "solo")).toBe("solo");
    expect(visibleChild(t, "solo", "solo")).toEqual({ at: "self" });
  });

  it("indexa canais, que não são filhos de ninguém", () => {
    const t = indexTree(root, [
      { id: "pipe", kind: "channel", label: "pipe", children: [leaf("wire", "sink")] },
    ]);
    expect(t.byId.get("pipe")?.kind).toBe("channel");
    expect(t.parent.get("pipe")).toBeUndefined();
    expect(flowChildren(t, "root")).not.toContain("pipe");
  });
});
```

Ajustar as asserções existentes de `visibleChild` para o retorno novo
(`{ at: "child", id: "box" }`, `{ at: "self" }`, `{ at: "outside" }`), e trocar a asserção de
`flowChildren` sobre o `composite` `box` por uma sobre o `pipeline` `chain`, onde a ordem é
contrato e não detalhe de declaração.

- [ ] **Step 8: rodar tudo**

Run: `pnpm vitest run packages/depth-core/src/tree.test.ts && pnpm typecheck && pnpm boundaries`
Expected: todos os testes passam; typecheck limpo; `Fronteira motor↔domínio intacta.`

- [ ] **Step 9: Commit**

```bash
git add packages/depth-core/src
git commit -m "fix(depth-core): fronteira declarada, invariante do composto e locus discriminado"
```

- [ ] **Step 10: quatro correções da revisão do commit `3c9c192`**

1. **`entry`/`exit` passam a ser validados em `indexTree`, não em quem percorre.** O Step 3
   só checava que o id existia na árvore inteira: uma fronteira podia apontar para um irmão
   (a aresta entregava fora do contêiner), para um `static` (o estático virava fronteira de
   fluxo, furando o Step 2) ou para si mesma (estouro de pilha). Validar na indexação torna a
   violação impossível: nenhum `TreeIndex` chega a existir com a fronteira mentindo. Com isso,
   o `spec(tree, declared)` dentro de `terminal` virou redundante e saiu.
2. **`isOpenable` e `terminal` param no mesmo predicado.** O Step 2 tornou um contêiner só de
   estáticos válido e não-abrível, mas `entryLeaf` sobre ele ainda lançava. Agora `terminal`
   devolve o próprio id quando `!isOpenable(...)`, e o `throw` de "tem filhos, mas nenhum de
   fluxo" — inalcançável — saiu. As duas funções não podem mais divergir sobre o mesmo nó.
3. **As duas válvulas do invariante do Step 5 ganharam teste.** Nenhuma fixture combinava
   `behavior` com filhos de fluxo e `leaf`/`dynamic`, então mutar o guard não quebrava nada.
   Três testes novos: `leaf: true` com filho de fluxo e comportamento próprio, o equivalente
   para `dynamic: true`, e a parada de descida em `dynamic` (que também não tinha teste).
4. **`TreeIndex.byId` virou `ReadonlyMap<string, AnyObject>`.** Ficou de fora do Step 6, e o
   `any` fazia a ponte calada em `byId.set` enquanto quem lesse `spec(tree, id).behavior`
   recebia `Behavior<unknown>`. `spec` devolve `AnyObject`.

---

## Task 1c: Cinco famílias e a segunda espécie de linha

Vem da §17 da spec, que reconcilia este motor com o desenho das PRs aceitas (`d3900c0`).
Duas mudanças estruturais, ambas baratas agora e caras depois: a família do controlador —
peças que **não ficam no caminho do dado** — e a distinção entre linha de dado e linha de
controle. Nenhum `kind` novo entra aqui; o catálogo cresce na S2.

**Files:**
- Modify: `packages/depth-core/src/model.ts`
- Modify: `packages/depth-core/src/model.test.ts` (criar se não existir)

- [ ] **Step 1: `Family` vira cinco, e a tabela força a exaustividade**

Trocar em `model.ts`:

```ts
/**
 * A que espécie de coisa um objeto pertence. A família carrega a linguagem de
 * formas do desenho; o `kind` só faz a variação dentro dela.
 *
 * - `container` organiza e nunca tem comportamento próprio
 * - `processor` age sobre o que o atravessa
 * - `conduit` transporta e nunca altera a carga
 * - `controller` observa, concede, dispara — e **não** está no caminho da carga
 * - `plate` é dado anexado: consultado, nunca atravessado
 */
export type Family =
  | "container"
  | "processor"
  | "conduit"
  | "controller"
  | "plate";

/**
 * Tabela em vez de cadeia de `if`: sendo um `Record<Kind, Family>`, acrescentar
 * um `kind` sem lhe dar família deixa de compilar. O catálogo cresce em ondas,
 * e crescer sem esquecer é o ponto.
 */
const FAMILY: Record<Kind, Family> = {
  composite: "container",
  pipeline: "container",
  source: "processor",
  router: "processor",
  buffer: "processor",
  sink: "processor",
  channel: "conduit",
  static: "plate",
};

export function familyOf(kind: Kind): Family {
  return FAMILY[kind];
}
```

Repare que `pipeline` e `composite` saem de `block` e viram `container`. Pô-los na mesma
família de `source` diria que têm comportamento, e o invariante central é que não têm.
Nenhum `kind` mapeia para `controller` ainda — os controladores (`clock`, `arbiter`,
`supervisor`, `probe`) chegam na S2.

- [ ] **Step 2: a aresta declara de que espécie é**

Acrescentar a `model.ts`:

```ts
/**
 * Duas espécies de linha, e o ganho é de legibilidade: a pergunta "por onde o
 * dado passa?" se responde olhando só as linhas de dado.
 */
export type LineKind = "data" | "control";
```

e a `Wire`:

```ts
  /** Espécie da linha. Ausente significa `"data"` — a esmagadora maioria. Uma
   *  linha de controle carrega sinal (pedido, concessão, gatilho, medida) e
   *  **nunca** carga. */
  readonly line?: LineKind;
```

- [ ] **Step 3: testes**

Criar `packages/depth-core/src/model.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { familyOf } from "./model.js";
import type { Kind } from "./model.js";

describe("familyOf", () => {
  it("contêiner não é processador — organizar não é agir sobre a carga", () => {
    expect(familyOf("composite")).toBe("container");
    expect(familyOf("pipeline")).toBe("container");
  });

  it("separa cano, placa e processador", () => {
    expect(familyOf("channel")).toBe("conduit");
    expect(familyOf("static")).toBe("plate");
    expect(familyOf("source")).toBe("processor");
    expect(familyOf("router")).toBe("processor");
    expect(familyOf("buffer")).toBe("processor");
    expect(familyOf("sink")).toBe("processor");
  });

  it("todo kind tem família", () => {
    const todos: readonly Kind[] = [
      "composite", "pipeline", "source", "router",
      "buffer", "sink", "channel", "static",
    ];
    for (const k of todos) expect(familyOf(k)).toBeDefined();
  });
});
```

- [ ] **Step 4: consertar o que quebrou**

`familyOf` mudou de contrato: qualquer uso de `"block"` no repositório precisa virar
`"container"` ou `"processor"`. Rode `pnpm typecheck` e siga os erros.

Run: `pnpm test && pnpm typecheck && pnpm boundaries`
Expected: tudo verde, incluindo `Fronteira motor↔domínio intacta.`

- [ ] **Step 5: Commit**

```bash
git add packages/depth-core/src
git commit -m "feat(depth-core): cinco familias e a linha de controle"
```

---

## Task 2: Fiação, com encadeamento implícito de pipeline

**Files:**
- Create: `packages/depth-core/src/wiring.ts`
- Test: `packages/depth-core/src/wiring.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// packages/depth-core/src/wiring.test.ts
import { describe, expect, it } from "vitest";
import { DROP } from "./model.js";
import type { ObjectSpec, Wire } from "./model.js";
import { indexTree } from "./tree.js";
import { resolveTarget } from "./wiring.js";

const leaf = (id: string, kind: ObjectSpec["kind"]): ObjectSpec => ({
  id,
  kind,
  label: id,
  leaf: true,
  behavior: (state) => ({ state, out: [] }),
});

const root: ObjectSpec = {
  id: "root",
  kind: "composite",
  label: "root",
  children: [
    leaf("src", "source"),
    {
      id: "box",
      kind: "composite",
      label: "box",
      children: [
        leaf("gate", "router"),
        {
          id: "chain",
          kind: "pipeline",
          label: "chain",
          children: [leaf("a", "sink"), leaf("note", "static"), leaf("b", "sink")],
        },
      ],
    },
    leaf("sink", "sink"),
  ],
};

const wires: readonly Wire[] = [
  { from: "src", port: "out", to: "box" },
  { from: "gate", port: "keep", to: "chain" },
  { from: "gate", port: "drop", to: DROP },
  { from: "box", port: "out", to: "sink" },
];

const tree = indexTree(root);

describe("resolveTarget", () => {
  it("resolve um contêiner para a folha de entrada dele", () => {
    expect(resolveTarget(tree, wires, "src", "out")).toBe("gate");
  });

  it("entrega o descarte na lixeira", () => {
    expect(resolveTarget(tree, wires, "gate", "drop")).toBe(DROP);
  });

  it("encadeia os filhos de um pipeline sem fio declarado", () => {
    expect(resolveTarget(tree, wires, "a", "out")).toBe("b");
  });

  it("pula estáticos no encadeamento", () => {
    // "note" é estático e fica entre "a" e "b": não pode receber nada
    expect(resolveTarget(tree, wires, "a", "out")).not.toBe("note");
  });

  it("sobe para o fio do pai quando o pipeline acaba", () => {
    expect(resolveTarget(tree, wires, "b", "out")).toBe("sink");
  });

  it("devolve null quando não há destino", () => {
    expect(resolveTarget(tree, wires, "sink", "out")).toBeNull();
  });

  it("não segue linha de controle — ela carrega sinal, não carga", () => {
    const comControle: readonly Wire[] = [
      ...wires,
      { from: "sink", port: "out", to: "src", line: "control" },
    ];
    expect(resolveTarget(tree, comControle, "sink", "out")).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm vitest run packages/depth-core/src/wiring.test.ts`
Expected: FAIL — `Failed to resolve import "./wiring.js"`

- [ ] **Step 3: Implementar `wiring.ts`**

```ts
import { DROP } from "./model.js";
import type { Drop, PortId, Wire } from "./model.js";
import { entryLeaf, flowChildren } from "./tree.js";
import type { TreeIndex } from "./tree.js";

/**
 * Para onde vai o que sai de `(from, port)`.
 *
 * Um fio declarado vence. Sem fio, o arquétipo decide: num `pipeline`, a saída
 * de um filho é a entrada do próximo — é isso que torna "a ordem importa" um
 * fato do modelo em vez de uma frase no texto. Esgotado o pipeline, a busca
 * sobe para o fio do pai.
 *
 * Linhas de controle são invisíveis daqui de propósito: elas carregam sinal, não
 * carga, e misturar as duas faria a pergunta "por onde a carga passa?" deixar de
 * ter resposta olhando o desenho.
 */
export function resolveTarget(
  tree: TreeIndex,
  wires: readonly Wire[],
  from: string,
  port: PortId,
): string | Drop | null {
  for (const wire of wires) {
    if ((wire.line ?? "data") !== "data") continue;
    if (wire.from === from && wire.port === port) {
      return wire.to === DROP ? DROP : entryLeaf(tree, wire.to);
    }
  }

  const parent = tree.parent.get(from);
  if (parent === undefined) return null;

  if (tree.byId.get(parent)?.kind === "pipeline") {
    const kids = flowChildren(tree, parent);
    const here = kids.indexOf(from);
    const next = here >= 0 ? kids[here + 1] : undefined;
    if (next !== undefined) return entryLeaf(tree, next);
  }

  return resolveTarget(tree, wires, parent, "out");
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `pnpm vitest run packages/depth-core/src/wiring.test.ts`
Expected: PASS — 7 testes

- [ ] **Step 5: Commit**

```bash
git add packages/depth-core/src/wiring.ts packages/depth-core/src/wiring.test.ts
git commit -m "feat(depth-core): fiacao com encadeamento implicito de pipeline"
```

---

## Task 3: O tick — só folhas têm comportamento

**Files:**
- Create: `packages/depth-core/src/scheduler.ts`
- Test: `packages/depth-core/src/scheduler.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// packages/depth-core/src/scheduler.test.ts
import { describe, expect, it } from "vitest";
import { DROP } from "./model.js";
import type { ObjectSpec, WorldSpec } from "./model.js";
import { indexTree } from "./tree.js";
import { initialWorld, stepWorld } from "./scheduler.js";

/** Emite uma mensagem por tick enquanto `rate` for 1. */
const source: ObjectSpec = {
  id: "src",
  kind: "source",
  label: "src",
  leaf: true,
  init: () => ({ made: 0 }),
  behavior: (state, _inbox, ctx) => {
    const s = state as { made: number };
    if (ctx.params.rate !== 1) return { state: s, out: [] };
    return { state: { made: s.made + 1 }, out: [{ port: "out", message: ctx.emit("blob") }] };
  },
};

/** Manda para "keep" quando `keepAll` é 1, senão para "drop". */
const gate: ObjectSpec = {
  id: "gate",
  kind: "router",
  label: "gate",
  leaf: true,
  init: () => ({}),
  behavior: (state, inbox, ctx) => ({
    state,
    out: inbox.map((m) => ({ port: ctx.params.keepAll === 1 ? "keep" : "drop", message: m })),
  }),
};

const sink: ObjectSpec = {
  id: "sink",
  kind: "sink",
  label: "sink",
  leaf: true,
  init: () => ({ got: 0 }),
  behavior: (state, inbox) => ({ state: { got: (state as { got: number }).got + inbox.length }, out: [] }),
};

const spec: WorldSpec = {
  id: "t",
  seed: 1,
  edgeTicks: 2,
  root: { id: "root", kind: "composite", label: "root", children: [source, gate, sink] },
  wires: [
    { from: "src", port: "out", to: "gate" },
    { from: "gate", port: "keep", to: "sink" },
    { from: "gate", port: "drop", to: DROP },
  ],
  params: { rate: 1, keepAll: 1 },
};

const tree = indexTree(spec.root);
const run = (ticks: number, params = spec.params) => {
  let state = initialWorld(spec, tree);
  for (let i = 0; i < ticks; i += 1) state = stepWorld(spec, tree, state, params);
  return state;
};

describe("stepWorld", () => {
  it("a origem emite e a mensagem entra em trânsito", () => {
    const state = run(1);
    expect(state.tick).toBe(1);
    expect(state.flight).toHaveLength(1);
    expect(state.flight[0]?.to).toBe("gate");
  });

  it("a mensagem só chega depois de edgeTicks", () => {
    // emitida no tick 1, com edgeTicks 2 ela só é entregue no tick 3
    expect(run(2).ledger["gate.keep"]).toBeUndefined();
    expect(run(3).ledger["gate.keep"]).toBe(1);
  });

  it("conta cada travessia de porta no livro-caixa", () => {
    const state = run(6);
    expect(state.ledger["src.out"]).toBe(6);
    expect(state.ledger["gate.keep"]).toBe(4);
  });

  it("o descarte some: não vira entrega em lugar nenhum", () => {
    const state = run(6, { rate: 1, keepAll: 0 });
    expect(state.ledger["gate.drop"]).toBe(4);
    expect(state.ledger["gate.keep"]).toBeUndefined();
    expect((state.nodes["sink"] as { got: number }).got).toBe(0);
  });

  it("ids de mensagem são determinísticos e únicos", () => {
    const a = run(5).flight.map((f) => f.message.id);
    const b = run(5).flight.map((f) => f.message.id);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
  });

  it("nunca muta o estado que recebeu", () => {
    const before = initialWorld(spec, tree);
    const snapshot = JSON.stringify(before);
    stepWorld(spec, tree, before, spec.params);
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm vitest run packages/depth-core/src/scheduler.test.ts`
Expected: FAIL — `Failed to resolve import "./scheduler.js"`

- [ ] **Step 3: Implementar `scheduler.ts`**

```ts
import { createRandom } from "./random.js";
import { DROP } from "./model.js";
import type {
  InFlight,
  Message,
  ObjectSpec,
  WorldSpec,
  WorldState,
} from "./model.js";
import { resolveTarget } from "./wiring.js";
import type { TreeIndex } from "./tree.js";

const DEFAULT_EDGE_TICKS = 4;

/** Objetos que agem: folha (ou dinâmico) com comportamento. */
function actors(tree: TreeIndex): ObjectSpec[] {
  const out: ObjectSpec[] = [];
  for (const node of tree.byId.values()) {
    if (node.kind === "static") continue;
    if (node.behavior === undefined) continue;
    out.push(node);
  }
  return out;
}

export function initialWorld(spec: WorldSpec, tree: TreeIndex): WorldState {
  const nodes: Record<string, unknown> = {};
  for (const node of actors(tree)) {
    nodes[node.id] = node.init === undefined ? {} : node.init();
  }
  return { tick: 0, nodes, flight: [], ledger: {} };
}

/**
 * Um tick: entrega o que chegou, roda cada folha, coleta as emissões e põe as
 * mensagens novas em trânsito.
 *
 * Função pura de (estado, parâmetros) — é isso que faz `seek` ser exato e o
 * comportamento ser testável sem pixel nenhum.
 */
export function stepWorld(
  spec: WorldSpec,
  tree: TreeIndex,
  state: WorldState,
  params: Readonly<Record<string, number>>,
): WorldState {
  const tick = state.tick + 1;
  const edgeTicks = spec.edgeTicks ?? DEFAULT_EDGE_TICKS;

  const inbox = new Map<string, Message[]>();
  const stillFlying: InFlight[] = [];
  for (const item of state.flight) {
    if (tick - item.sent < edgeTicks) {
      stillFlying.push(item);
      continue;
    }
    if (item.to === DROP) continue;
    const box = inbox.get(item.to) ?? [];
    box.push(item.message);
    inbox.set(item.to, box);
  }

  const nodes: Record<string, unknown> = { ...state.nodes };
  const ledger: Record<string, number> = { ...state.ledger };
  const launched: InFlight[] = [];

  const bump = (key: string, by: number): void => {
    ledger[key] = (ledger[key] ?? 0) + by;
  };

  for (const node of actors(tree)) {
    const box = inbox.get(node.id) ?? [];
    if (box.length > 0) {
      bump(`${node.id}.in`, box.length);
      for (const message of box) bump(`${node.id}.in.weight`, message.weight);
    }

    let seq = 0;
    const ctx = {
      tick,
      random: createRandom(spec.seed + tick),
      params,
      emit: (
        kind: string,
        weight = 1,
        data: Record<string, unknown> = {},
      ): Message => {
        // id derivado de (tick, nó, ordem): replay reproduz exatamente os mesmos
        const id = `${tick}:${node.id}:${seq}`;
        seq += 1;
        return { id, kind, weight, data };
      },
    };

    const behavior = node.behavior;
    if (behavior === undefined) continue;
    const result = behavior(nodes[node.id], box, ctx);
    nodes[node.id] = result.state;

    for (const emission of result.out) {
      bump(`${node.id}.${emission.port}`, 1);
      bump(`${node.id}.${emission.port}.weight`, emission.message.weight);
      const to = resolveTarget(tree, spec.wires, node.id, emission.port);
      if (to === null) continue;
      launched.push({
        id: `${tick}:${node.id}:${emission.port}:${launched.length}`,
        message: emission.message,
        from: node.id,
        to,
        sent: tick,
      });
    }
  }

  return { tick, nodes, flight: [...stillFlying, ...launched], ledger };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `pnpm vitest run packages/depth-core/src/scheduler.test.ts`
Expected: PASS — 6 testes

- [ ] **Step 5: Commit**

```bash
git add packages/depth-core/src/scheduler.ts packages/depth-core/src/scheduler.test.ts
git commit -m "feat(depth-core): um tick como funcao pura sobre a arvore"
```

---

## Task 3b: Aproveitar o open source — `pure-rand` e `fast-check`

O `docs/stack.md` que entrou com as PRs já fez o levantamento com licença verificada peça a
peça. Duas dessas peças pertencem à S1, e as duas fecham buracos reais em vez de serem
enfeite.

**O buraco do determinismo.** `createRandom(seed)` devolve uma **closure com estado
escondido**. A §5.2 da spec exige `seek` exato; com estado escondido, rebobinar para o tick
40 obriga a reexecutar do tick 0, e qualquer consumidor que sortear fora de ordem corrompe a
sequência de todo mundo. A spec já diz o que é preciso: **aleatoriedade como função de
`(semente, tick)`**, não como fluxo. `pure-rand` (MIT) dá PRNG portátil com estado explícito;
`xoroshiro128plus` é barato de instanciar, que é o que este uso pede.

**O buraco do teste.** A propriedade central deste motor — a vista agregada é exatamente o
tráfego que cruzou as portas — é universalmente quantificada: vale para **qualquer** objeto
em **qualquer** tick. Exemplo escolhido a dedo não testa isso; property test testa.
`fast-check` (MIT, mesmo autor do `pure-rand`) é a peça, e ela chega agora porque as
propriedades que já dá para afirmar sobre o `stepWorld` são as que mais custam se quebrarem
em silêncio.

`createRandom` **fica** onde está: `engine.ts` e `types.ts` legados ainda o usam, e o modelo
antigo só morre na S5. Coexistência é andaime, não arquitetura — mas derrubar o andaime cedo
quebra a `main`.

**Files:**
- Modify: `packages/depth-core/package.json`
- Modify: `package.json` (raiz)
- Create: `packages/depth-core/src/rng.ts`
- Test: `packages/depth-core/src/rng.test.ts`
- Test: `packages/depth-core/src/scheduler.property.test.ts`

- [ ] **Step 1: Instalar**

```bash
pnpm add pure-rand --filter @ovh/depth-core
pnpm add -D -w fast-check
```

Confira que `pure-rand` entrou como dependência de `packages/depth-core/package.json` (é
runtime — o motor sorteia) e `fast-check` como `devDependency` da raiz (é ferramenta de
teste).

- [ ] **Step 2: Escrever o teste que falha**

```ts
// packages/depth-core/src/rng.test.ts
import { describe, expect, it } from "vitest";
import { randomAt } from "./rng.js";

describe("randomAt", () => {
  it("é função pura: mesma entrada, mesma saída, sempre", () => {
    expect(randomAt(7, 42, "gate")).toBe(randomAt(7, 42, "gate"));
  });

  it("não depende de ordem de chamada — é isso que torna o seek exato", () => {
    // sorteando fora de ordem, o valor do tick 42 não muda
    const direto = randomAt(7, 42, "gate");
    for (let t = 0; t < 100; t += 1) randomAt(7, t, "outro");
    expect(randomAt(7, 42, "gate")).toBe(direto);
  });

  it("separa por semente, por tick e por sal", () => {
    expect(randomAt(7, 42, "gate")).not.toBe(randomAt(8, 42, "gate"));
    expect(randomAt(7, 42, "gate")).not.toBe(randomAt(7, 43, "gate"));
    expect(randomAt(7, 42, "gate")).not.toBe(randomAt(7, 42, "porta"));
  });

  it("fica em [0, 1)", () => {
    for (let t = 0; t < 500; t += 1) {
      const v = randomAt(3, t, "x");
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("distribui: 500 sorteios não caem todos na mesma metade", () => {
    let baixos = 0;
    for (let t = 0; t < 500; t += 1) if (randomAt(3, t, "x") < 0.5) baixos += 1;
    expect(baixos).toBeGreaterThan(150);
    expect(baixos).toBeLessThan(350);
  });
});
```

Run: `pnpm vitest run packages/depth-core/src/rng.test.ts`
Expected: FAIL — `Failed to resolve import "./rng.js"`

- [ ] **Step 3: Implementar `rng.ts`**

```ts
import { unsafeUniformIntDistribution, xoroshiro128plus } from "pure-rand";

const RANGE = 2 ** 30;

/**
 * Mistura os três eixos num inteiro de 32 bits (FNV-1a sobre o sal, temperado
 * com semente e tick). Não precisa ser criptográfico — precisa é espalhar, para
 * que dois objetos vizinhos no mesmo tick não sorteiem valores correlacionados.
 */
function mix(seed: number, tick: number, salt: string): number {
  let h = 0x811c9dc5 ^ (seed >>> 0);
  for (let i = 0; i < salt.length; i += 1) {
    h ^= salt.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= tick + 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  return (h ^ (h >>> 13)) >>> 0;
}

/**
 * Aleatoriedade como **função** de (semente, tick, sal), nunca como fluxo.
 *
 * Um gerador com estado escondido obrigaria a rebobinar do tick 0 para chegar
 * ao tick 40, e faria a ordem das chamadas dentro de um tick virar parte do
 * resultado. Aqui cada sorteio é endereçável: o mesmo endereço devolve sempre o
 * mesmo valor, e é isso que torna o `seek` exato em vez de aproximado.
 *
 * O `salt` é o que separa dois sorteios no mesmo tick — use o id do objeto,
 * ou o id mais o propósito quando ele sortear duas vezes.
 */
export function randomAt(seed: number, tick: number, salt: string): number {
  const gerador = xoroshiro128plus(mix(seed, tick, salt));
  return unsafeUniformIntDistribution(0, RANGE - 1, gerador) / RANGE;
}
```

Run: `pnpm vitest run packages/depth-core/src/rng.test.ts`
Expected: PASS — 5 testes

- [ ] **Step 4: O `StepContext` passa a oferecer o sorteio endereçável**

Em `model.ts`, garantir que `StepContext` exponha `random(salt?: string): number`, e em
`scheduler.ts` construir esse contexto por objeto como
`random: (salt = "") => randomAt(spec.seed, tick, `${node.id}:${salt}`)`.

O sal padrão embute o id do objeto, então uma folha que sorteia uma vez não precisa pensar
no assunto, e uma que sorteia duas vezes distingue os sorteios por propósito. Ajuste o que
for preciso para o `pnpm typecheck` passar.

- [ ] **Step 5: As propriedades do `stepWorld`, com `fast-check`**

```ts
// packages/depth-core/src/scheduler.property.test.ts
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { indexTree } from "./tree.js";
import { initialWorld, stepWorld } from "./scheduler.js";
import { spec } from "./scheduler.test-fixture.js";

const tree = indexTree(spec.root);
const params = fc.record({
  rate: fc.integer({ min: 0, max: 1 }),
  keepAll: fc.integer({ min: 0, max: 1 }),
});

function rodar(ticks: number, p: Record<string, number>) {
  let estado = initialWorld(spec, tree);
  for (let i = 0; i < ticks; i += 1) estado = stepWorld(spec, tree, estado, p);
  return estado;
}

describe("propriedades do tick", () => {
  it("é determinístico: a mesma entrada dá o mesmo mundo, sempre", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 40 }), params, (ticks, p) => {
        expect(rodar(ticks, p)).toEqual(rodar(ticks, p));
      }),
    );
  });

  it("nunca muta o estado que recebeu, em nenhum tick", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 40 }), params, (ticks, p) => {
        const antes = rodar(ticks, p);
        const foto = JSON.stringify(antes);
        stepWorld(spec, tree, antes, p);
        expect(JSON.stringify(antes)).toBe(foto);
      }),
    );
  });

  it("o tick anda exatamente um por passo", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 40 }), params, (ticks, p) => {
        expect(rodar(ticks, p).tick).toBe(ticks);
      }),
    );
  });

  it("todo id de mensagem em trânsito é único", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 40 }), params, (ticks, p) => {
        const ids = rodar(ticks, p).flight.map((f) => f.message.id);
        expect(new Set(ids).size).toBe(ids.length);
      }),
    );
  });

  it("o livro-caixa só cresce — travessia de porta não desconta", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 30 }), params, (ticks, p) => {
        const antes = rodar(ticks, p);
        const depois = stepWorld(spec, tree, antes, p);
        for (const [porta, valor] of Object.entries(antes.ledger)) {
          expect(depois.ledger[porta] ?? 0).toBeGreaterThanOrEqual(valor);
        }
      }),
    );
  });
});
```

Isto exige extrair o `spec` do `scheduler.test.ts` para
`packages/depth-core/src/scheduler.test-fixture.ts`, exportando `spec` (e as folhas, se
ajudar), e fazer o `scheduler.test.ts` importar de lá. Duplicar a fixture seria pior: as duas
cópias divergiriam e os dois testes passariam a falar de mundos diferentes.

**A propriedade que ainda não dá para escrever aqui** é a central — *a vista agregada é
exatamente o tráfego que cruzou as portas*. Ela precisa de `boundaryCrossings`, que chega na
Task 5. Deixe o comentário dizendo isso no topo do arquivo, para o próximo leitor saber que a
ausência é sequenciamento e não esquecimento.

- [ ] **Step 6: Rodar tudo**

Run: `pnpm test && pnpm typecheck && pnpm boundaries`
Expected: tudo verde, incluindo `Fronteira motor↔domínio intacta.`

- [ ] **Step 7: O fio esquecido deixa de ser indistinguível do descarte**

Achado da Task 3: uma emissão cuja porta não tem destino (`resolveTarget` devolve `null`) é
contada no livro-caixa como qualquer travessia e some do trânsito — exatamente como um
descarte explícito (`to: DROP`). Ou seja, **o autor que esquece de ligar um fio vê a mesma
coisa que o autor que descartou de propósito**: mensagens saindo e nada chegando, com o
medidor parecendo normal.

Descartar é uma decisão do modelo e precisa ser visível como decisão. Esquecer o fio é um
defeito de autoria e precisa gritar. Hoje os dois são o mesmo silêncio, e essa é a classe de
defeito que a §2.1 diz ser inaceitável.

Em `scheduler.ts`, onde a emissão é resolvida, contar a saída sem destino numa chave própria:

```ts
    if (destino === null) {
      // Sem fio declarado e sem descarte: não é uma decisão do modelo, é um
      // buraco na autoria. Fica contado numa chave própria para que o modo autor
      // possa acusá-lo, em vez de virar o mesmo silêncio de um descarte.
      bump(`${node.id}.${emission.port}.unwired`, 1);
      continue;
    }
```

E acrescentar ao `scheduler.test.ts`:

```ts
  it("saída sem fio é contada à parte, não confundida com descarte", () => {
    const solto: WorldSpec = {
      ...spec,
      wires: [{ from: "src", port: "out", to: "gate" }],
    };
    const t = indexTree(solto.root);
    let estado = initialWorld(solto, t);
    for (let i = 0; i < 6; i += 1) estado = stepWorld(solto, t, estado, solto.params);

    expect(estado.ledger["gate.keep"]).toBeGreaterThan(0);
    expect(estado.ledger["gate.keep.unwired"]).toBe(estado.ledger["gate.keep"]);
    expect(estado.ledger["gate.drop.unwired"]).toBeUndefined();
  });
```

Repare no contraste que o teste prende: `gate.keep` sem fio acumula `.unwired`; `gate.drop`,
que continua ligado ao `DROP`, **não** acumula — porque descartar é decisão, não buraco.

- [ ] **Step 8: Commit**

```bash
git add packages/depth-core package.json pnpm-lock.yaml
git commit -m "feat(depth-core): sorteio enderecavel, propriedades, e o fio esquecido visivel"
```

---

## Task 4: `World` — histórico, `seek` exato e parâmetro como evento

**Files:**
- Create: `packages/depth-core/src/world.ts`
- Test: `packages/depth-core/src/world.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// packages/depth-core/src/world.test.ts
import { describe, expect, it } from "vitest";
import type { ObjectSpec, WorldSpec } from "./model.js";
import { World } from "./world.js";

/** Acumula `step` por tick. Simples de prever de cabeça. */
const counter: ObjectSpec = {
  id: "c",
  kind: "source",
  label: "c",
  leaf: true,
  init: () => ({ total: 0, noise: 0 }),
  behavior: (state, _inbox, ctx) => {
    const s = state as { total: number; noise: number };
    return { state: { total: s.total + ctx.params.step, noise: ctx.random() }, out: [] };
  },
};

const spec: WorldSpec = {
  id: "w",
  seed: 7,
  root: { id: "root", kind: "composite", label: "root", children: [counter] },
  wires: [],
  params: { step: 1 },
};

const total = (w: World): number => (w.state.nodes["c"] as { total: number }).total;

describe("World", () => {
  it("começa no tick 0 com o estado inicial", () => {
    const w = new World(spec);
    expect(w.tick).toBe(0);
    expect(total(w)).toBe(0);
  });

  it("rebobinar é reler o histórico, não recalcular por aproximação", () => {
    const w = new World(spec);
    w.advance(10);
    const at10 = total(w);
    w.seek(3);
    expect(total(w)).toBe(3);
    w.seek(10);
    expect(total(w)).toBe(at10);
  });

  it("mudar parâmetro NÃO volta o tick para 0 e preserva o acumulado", () => {
    const w = new World(spec);
    w.advance(5);
    expect(total(w)).toBe(5);
    w.setParam("step", 10);
    expect(w.tick).toBe(5);
    expect(total(w)).toBe(5);
    w.advance(1);
    expect(total(w)).toBe(15);
  });

  it("seek continua exato depois de mudanças de parâmetro", () => {
    const w = new World(spec);
    w.advance(3);
    w.setParam("step", 4);
    w.advance(3);
    const at6 = total(w);
    w.seek(0);
    w.seek(6);
    expect(total(w)).toBe(at6);
    expect(at6).toBe(3 + 12);
  });

  it("replay do zero com a mesma linha do tempo dá o mesmo resultado", () => {
    const a = new World(spec);
    a.advance(3);
    a.setParam("step", 4);
    a.advance(3);

    const b = new World(spec);
    b.advance(3);
    b.setParam("step", 4);
    b.advance(3);

    expect(JSON.stringify(b.state)).toBe(JSON.stringify(a.state));
  });

  it("rebobinar e mudar parâmetro abandona o futuro que existia", () => {
    const w = new World(spec);
    w.advance(3);
    w.setParam("step", 100);   // evento no tick 3
    w.advance(3);              // tick 6, total 3 + 300
    expect(total(w)).toBe(303);

    w.seek(1);
    w.setParam("step", 2);     // outra linha do tempo a partir do tick 1
    w.advance(5);              // tick 6
    // o evento do tick 3 pertencia à linha abandonada: não pode ressuscitar
    expect(total(w)).toBe(1 + 2 * 5);
  });

  it("o aleatório é função de (seed, tick), não do caminho percorrido", () => {
    const a = new World(spec);
    a.advance(5);
    const noiseAt5 = (a.state.nodes["c"] as { noise: number }).noise;

    const b = new World(spec);
    b.seek(5);
    expect((b.state.nodes["c"] as { noise: number }).noise).toBe(noiseAt5);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm vitest run packages/depth-core/src/world.test.ts`
Expected: FAIL — `Failed to resolve import "./world.js"`

- [ ] **Step 3: Implementar `world.ts`**

```ts
import type { WorldSpec, WorldState } from "./model.js";
import { initialWorld, stepWorld } from "./scheduler.js";
import { indexTree } from "./tree.js";
import type { TreeIndex } from "./tree.js";

interface ParamEvent {
  readonly tick: number;
  readonly name: string;
  readonly value: number;
}

/**
 * Roda um mundo composicional e guarda o histórico desde o tick 0, o que faz
 * `seek` ser exato: rebobinar é reler, não reestimar.
 *
 * Parâmetro é **evento no tempo**, não um reset. Mudar um valor mantém o tick
 * e o estado acumulado — o mundo reage de onde está. Um lab que recomeça a
 * cada arrasto de slider apaga o que o leitor acabou de construir e esconde a
 * transição entre dois regimes, que é justamente onde está o aprendizado.
 */
export class World {
  readonly #spec: WorldSpec;
  readonly #tree: TreeIndex;
  #events: ParamEvent[] = [];
  #history: WorldState[];
  #tick = 0;

  constructor(spec: WorldSpec) {
    this.#spec = spec;
    this.#tree = indexTree(spec.root);
    this.#history = [initialWorld(spec, this.#tree)];
  }

  get tree(): TreeIndex {
    return this.#tree;
  }

  get tick(): number {
    return this.#tick;
  }

  get state(): WorldState {
    return this.#at(this.#tick);
  }

  get previousState(): WorldState | undefined {
    return this.#tick === 0 ? undefined : this.#at(this.#tick - 1);
  }

  /** Parâmetros vigentes num tick: os eventos dobrados até ali. */
  paramsAt(tick: number): Readonly<Record<string, number>> {
    const params: Record<string, number> = { ...this.#spec.params };
    for (const event of this.#events) {
      if (event.tick <= tick) params[event.name] = event.value;
    }
    return params;
  }

  get params(): Readonly<Record<string, number>> {
    return this.paramsAt(this.#tick);
  }

  advance(n = 1): void {
    this.seek(this.#tick + n);
  }

  seek(tick: number): void {
    const target = Math.max(0, Math.trunc(tick));
    this.#ensure(target);
    this.#tick = target;
  }

  /**
   * Grava a mudança no tick atual. O histórico à frente (se houver) é
   * descartado porque foi calculado com o valor antigo; o passado continua
   * válido, então `seek` para trás segue exato.
   */
  setParam(name: string, value: number): void {
    // Rebobinar e mexer num parâmetro abandona o futuro que existia: os estados
    // dali para a frente foram calculados com o valor antigo, e os eventos
    // marcados lá também pertencem àquela linha do tempo. Descartar só os
    // estados e guardar os eventos faria o mundo recalcular o passado com uma
    // decisão que o leitor nunca tomou nesta linha.
    this.#events = this.#events.filter((e) => e.tick <= this.#tick);
    this.#events.push({ tick: this.#tick, name, value });
    this.#history = this.#history.slice(0, this.#tick + 1);
  }

  #at(tick: number): WorldState {
    const state = this.#history[tick];
    if (state === undefined) {
      throw new Error(`World: tick ${tick} ainda não foi computado`);
    }
    return state;
  }

  #ensure(tick: number): void {
    while (this.#history.length <= tick) {
      const next = this.#history.length;
      this.#history.push(
        stepWorld(this.#spec, this.#tree, this.#at(next - 1), this.paramsAt(next)),
      );
    }
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `pnpm vitest run packages/depth-core/src/world.test.ts`
Expected: PASS — 7 testes

- [ ] **Step 5: Commit**

```bash
git add packages/depth-core/src/world.ts packages/depth-core/src/world.test.ts
git commit -m "feat(depth-core): World com seek exato e parametro como evento no tempo"
```

---

## Task 5: Medidores e "agregado = fronteira"

**Files:**
- Create: `packages/depth-core/src/meters.ts`
- Test: `packages/depth-core/src/meters.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// packages/depth-core/src/meters.test.ts
import { describe, expect, it } from "vitest";
import { DROP } from "./model.js";
import type { ObjectSpec, WorldSpec } from "./model.js";
import { boundaryCrossings, portCount, portWeight } from "./meters.js";
import { World } from "./world.js";

const relay = (id: string): ObjectSpec => ({
  id,
  kind: "sink",
  label: id,
  leaf: true,
  init: () => ({}),
  behavior: (state, inbox) => ({ state, out: inbox.map((m) => ({ port: "out", message: m })) }),
});

const spec: WorldSpec = {
  id: "m",
  seed: 3,
  edgeTicks: 2,
  root: {
    id: "root",
    kind: "composite",
    label: "root",
    children: [
      {
        id: "src",
        kind: "source",
        label: "src",
        leaf: true,
        init: () => ({}),
        behavior: (state, _inbox, ctx) => ({ state, out: [{ port: "out", message: ctx.emit("blob", 2) }] }),
      },
      {
        id: "box",
        kind: "pipeline",
        label: "box",
        children: [relay("a"), relay("b")],
      },
      relay("end"),
    ],
  },
  wires: [
    { from: "src", port: "out", to: "box" },
    { from: "box", port: "out", to: "end" },
    { from: "end", port: "sunk", to: DROP },
  ],
  params: {},
};

describe("portCount e portWeight", () => {
  it("leem só o livro-caixa de portas", () => {
    const w = new World(spec);
    w.advance(6);
    expect(portCount(w.state, "src", "out")).toBe(6);
    expect(portWeight(w.state, "src", "out")).toBe(12);
  });

  it("devolvem zero para porta que nunca teve tráfego", () => {
    const w = new World(spec);
    w.advance(6);
    expect(portCount(w.state, "src", "inexistente")).toBe(0);
  });
});

describe("boundaryCrossings", () => {
  it("no foco raiz, mostra o que cruza a fronteira de cada filho", () => {
    const w = new World(spec);
    w.advance(8);
    for (const crossing of boundaryCrossings(w.tree, w.state, "root")) {
      expect(crossing.fromVisible).not.toBe(crossing.toVisible);
    }
  });

  it("esconde o tráfego interno de um bloco fechado", () => {
    const w = new World(spec);
    w.advance(8);
    // a → b acontece dentro de "box": não pode aparecer no foco raiz
    const atRoot = boundaryCrossings(w.tree, w.state, "root");
    expect(atRoot.some((c) => c.item.from === "a" && c.item.to === "b")).toBe(false);
    // mas aparece quando o foco é "box"
    const inBox = boundaryCrossings(w.tree, w.state, "box");
    const internal = w.state.flight.some((f) => f.from === "a" && f.to === "b");
    expect(inBox.some((c) => c.item.from === "a" && c.item.to === "b")).toBe(internal);
  });

  it("é um subconjunto do que está realmente em trânsito: a vista não inventa", () => {
    const w = new World(spec);
    for (let tick = 1; tick <= 20; tick += 1) {
      w.seek(tick);
      const flying = new Set(w.state.flight.map((f) => f.id));
      for (const focus of ["root", "box"]) {
        for (const crossing of boundaryCrossings(w.tree, w.state, focus)) {
          expect(flying.has(crossing.item.id)).toBe(true);
        }
      }
    }
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm vitest run packages/depth-core/src/meters.test.ts`
Expected: FAIL — `Failed to resolve import "./meters.js"`

- [ ] **Step 3: Implementar `meters.ts`**

```ts
import { DROP } from "./model.js";
import type { InFlight, PortId, WorldState } from "./model.js";
import { visibleChild } from "./tree.js";
import type { TreeIndex } from "./tree.js";

/**
 * Um medidor é função pura sobre o tráfego de PORTA. Nunca espia o estado
 * interno de um objeto. É o que o mantém honesto: ele mede o que o leitor vê
 * acontecer, e por isso pode vir de graça junto com o arquétipo.
 *
 * A assinatura recebe `WorldState` e devolve número — não há caminho para
 * `state.nodes` a partir daqui.
 */
export function portCount(state: WorldState, node: string, port: PortId): number {
  return state.ledger[`${node}.${port}`] ?? 0;
}

export function portWeight(state: WorldState, node: string, port: PortId): number {
  return state.ledger[`${node}.${port}.weight`] ?? 0;
}

export interface Crossing {
  readonly item: InFlight;
  /** Filho do foco de onde a mensagem sai, ou "outside". */
  readonly fromVisible: string;
  /** Filho do foco onde ela entra, "outside", ou "@drop". */
  readonly toVisible: string;
}

/**
 * As mensagens que cruzam a fronteira de dois objetos visíveis a partir deste
 * foco. É isto que a vista agregada desenha — e é por isso que ela não precisa
 * ser autorada: o L0 é uma projeção do mesmo run que o interior mostra em
 * detalhe, e não tem como divergir dele.
 */
export function boundaryCrossings(
  tree: TreeIndex,
  state: WorldState,
  focusId: string,
): Crossing[] {
  const out: Crossing[] = [];

  for (const item of state.flight) {
    const from = visibleChild(tree, focusId, item.from);
    const to =
      item.to === DROP ? ({ at: "drop" } as const) : visibleChild(tree, focusId, item.to);

    // ambos fora do foco: a aresta inteira acontece longe daqui
    if (from.at === "outside" && to.at === "outside") continue;
    // dentro do mesmo filho visível: é tráfego interno de um bloco fechado
    if (from.at === "child" && to.at === "child" && from.id === to.id) continue;

    const name = (locus: typeof from | typeof to): string => {
      switch (locus.at) {
        case "child":
          return locus.id;
        case "self":
          return focusId;
        case "drop":
          return DROP;
        case "outside":
          return "outside";
      }
    };

    out.push({ item, fromVisible: name(from), toVisible: name(to) });
  }

  return out;
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `pnpm vitest run packages/depth-core/src/meters.test.ts`
Expected: PASS — 5 testes

- [ ] **Step 5: Commit**

```bash
git add packages/depth-core/src/meters.ts packages/depth-core/src/meters.test.ts
git commit -m "feat(depth-core): medidores de porta e travessias de fronteira"
```

---

## Task 6: Superfície pública e guarda de fronteira ampliada

**Files:**
- Modify: `packages/depth-core/src/index.ts`
- Modify: `scripts/check-boundaries.mjs:14-27`
- Test: `scripts/check-boundaries.test.mjs`

- [ ] **Step 1: Escrever o teste que falha**

```js
// acrescentar em scripts/check-boundaries.test.mjs
import { describe, expect, it } from "vitest";
import { findViolations } from "./check-boundaries.mjs";

describe("guarda ampliada: protocolo também é domínio", () => {
  it("acusa gRPC no motor", () => {
    const found = findViolations("packages/depth-core/src/x.ts", "// fala grpc aqui");
    expect(found).toHaveLength(1);
  });

  it("acusa spanprocessor no motor", () => {
    const found = findViolations("packages/depth-core/src/x.ts", "const spanprocessor = 1;");
    expect(found).toHaveLength(1);
  });

  it("acusa sampler no motor", () => {
    const found = findViolations("packages/depth-ui/src/x.tsx", "// o sampler decide");
    expect(found).toHaveLength(1);
  });

  it("não acusa vocabulário do motor", () => {
    const found = findViolations(
      "packages/depth-core/src/x.ts",
      "const kind = 'pipeline'; // router, buffer, composite",
    );
    expect(found).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm vitest run scripts/check-boundaries.test.mjs`
Expected: FAIL — três testes falham com `expected [] to have a length of 1`

- [ ] **Step 3: Ampliar a lista de termos em `scripts/check-boundaries.mjs`**

Substituir o array `DOMAIN_WORDS` por:

```js
/**
 * Termos inequívocos de domínio. `span` e `trace` sozinhos ficam de fora de
 * propósito: `<span>` é HTML legítimo e "trace" aparece em "traceability".
 *
 * Protocolo também é domínio: o motor não pode saber que gRPC existe.
 */
const DOMAIN_WORDS = [
  "otlp",
  "opentelemetry",
  "otel",
  "traceparent",
  "tracestate",
  "resourcespans",
  "scopespans",
  "spanid",
  "traceid",
  "collector",
  "tracerprovider",
  "spanprocessor",
  "batchspanprocessor",
  "spanexporter",
  "sampler",
  "grpc",
  "http2",
  "protobuf",
  "hpack",
  "w3c",
];
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `pnpm vitest run scripts/check-boundaries.test.mjs`
Expected: PASS

- [ ] **Step 5: Publicar a superfície nova em `packages/depth-core/src/index.ts`**

```ts
// motor composicional (novo)
export { World } from "./world.js";
export { initialWorld, stepWorld } from "./scheduler.js";
export {
  entryLeaf,
  exitLeaf,
  flowChildren,
  indexTree,
  isOpenable,
  visibleChild,
} from "./tree.js";
export type { TreeIndex } from "./tree.js";
export { resolveTarget } from "./wiring.js";
export { boundaryCrossings, portCount, portWeight } from "./meters.js";
export type { Crossing } from "./meters.js";
export { DROP } from "./model.js";
export type {
  Behavior,
  Drop,
  Emission,
  InFlight,
  Kind,
  Message,
  ObjectSpec,
  PortId,
  Role,
  StepContext,
  Wire,
  WorldSpec,
  WorldState,
} from "./model.js";

// utilitários compartilhados
export { diffStates } from "./diff.js";
export { createRandom } from "./random.js";

// modelo antigo — andaime até a S5 migrar a landing. NÃO usar em código novo.
export { Engine } from "./engine.js";
export type { LevelId, Scenario } from "./types.js";
```

- [ ] **Step 6: Rodar a bateria inteira**

Run: `pnpm typecheck && pnpm test && pnpm boundaries`
Expected: typecheck sem erro; todos os testes passam (58 antigos + 32 novos); `Fronteira motor↔domínio intacta.`

- [ ] **Step 7: Commit**

```bash
git add packages/depth-core/src/index.ts scripts/check-boundaries.mjs scripts/check-boundaries.test.mjs
git commit -m "feat(depth-core): superficie publica do motor composicional e guarda ampliada"
```

---

## Task 7: Atualizar o registro de progresso

**Files:**
- Modify: `docs/PROGRESS.md`

- [ ] **Step 1: Marcar a S1 como concluída**

Trocar a linha da S1 por:

```markdown
- [x] **S1 — Motor composicional.** `model`, `tree`, `wiring`, `scheduler`, `world`,
      `meters` + testes. O modelo antigo (`types.ts`, `engine.ts`) segue exportado
      como andaime até a S5 migrar a landing — não usar em código novo.
```

- [ ] **Step 2: Commit**

```bash
git add docs/PROGRESS.md
git commit -m "docs: S1 concluida"
```

---

## Fora do escopo desta sessão

- Os sete arquétipos (`composite`, `source`, `router`, `pipeline`, `buffer`, `sink`, `static`) — **S2**. Aqui os comportamentos são escritos à mão nos testes.
- Palco, foco, breadcrumb, inspector, modelo estrito de desenho — **S3** e **S6**.
- A árvore do TracerProvider e as transformações de mensagem — **S4**.
- Remoção de `types.ts`/`engine.ts` e migração do herói — **S5**.
- Regime nomeado, log de eventos, perturbações — **S6**.
- Cenários, encaixe tipado, manifesto e contrato de fidelidade — **Entrega 3**.
