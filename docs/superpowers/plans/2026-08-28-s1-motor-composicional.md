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
| `packages/depth-core/src/model.ts` | tipos: `Kind`, `Role`, `Message`, `Emission`, `Behavior`, `ObjectSpec`, `Wire`, `WorldSpec`, `WorldState` |
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

- [ ] **Step 1: Escrever `model.ts`** (só tipos, sem runtime — não há teste próprio; o uso é testado nas tarefas seguintes)

```ts
/**
 * O modelo composicional. Tudo é objeto: `node` ocupa um lugar, `message`
 * viaja, `channel` liga dois nós. Os três usam este mesmo formato.
 *
 * O motor não sabe o que é span, OTLP ou gRPC. `kind` de mensagem é uma
 * string escolhida pelo domínio.
 */

export type Kind =
  | "composite"
  | "source"
  | "router"
  | "pipeline"
  | "buffer"
  | "sink"
  | "static";

export type Role = "node" | "message" | "channel";

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
Expected: PASS — 9 testes

- [ ] **Step 6: Commit**

```bash
git add packages/depth-core/src/model.ts packages/depth-core/src/tree.ts packages/depth-core/src/tree.test.ts
git commit -m "feat(depth-core): modelo composicional e indice da arvore"
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
 */
export function resolveTarget(
  tree: TreeIndex,
  wires: readonly Wire[],
  from: string,
  port: PortId,
): string | Drop | null {
  for (const wire of wires) {
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
Expected: PASS — 6 testes

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
    expect((run(2).nodes["gate"] as Record<string, unknown> | undefined)).toBeDefined();
    // no tick 3 a primeira mensagem já foi entregue ao gate e reemitida
    const state = run(3);
    expect(state.ledger["gate.keep"]).toBe(1);
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

  it("ids de mensagem são determinísticos: dois runs produzem os mesmos", () => {
    const a = run(5).flight.map((f) => f.message.id);
    const b = run(5).flight.map((f) => f.message.id);
    expect(a).toEqual(b);
    expect(new Set(run(5).ledger ? a : a).size).toBe(a.length);
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
  readonly #events: ParamEvent[] = [];
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
Expected: PASS — 6 testes

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
      item.to === "@drop" ? "@drop" : visibleChild(tree, focusId, item.to);

    // ambos fora do foco: a aresta inteira acontece longe daqui
    if (from === "outside" && to === "outside") continue;
    // dentro do mesmo filho visível: é tráfego interno de um bloco fechado
    if (from !== null && from === to) continue;

    out.push({
      item,
      fromVisible: from === null ? focusId : from,
      toVisible: to === null ? focusId : to,
    });
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
