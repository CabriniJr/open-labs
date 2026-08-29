# Fases do tick e linha de controle — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dar ao motor duas fases por tick — acomodação e confronto — e fazer a linha de
controle entregar sinal de verdade, sem uma linha de vocabulário de domínio.

**Architecture:** um tick passa a ter uma fase de **acomodação**, em que o subgrafo de
arestas `settle` propaga dentro do próprio tick, e uma fase de **confronto**, que é
exatamente o que `stepWorld` faz hoje. Como laço combinacional é recusado em
`validateWorld`, o subgrafo de acomodação é um DAG: percorrê-lo em ordem topológica faz cada
ator rodar uma vez só, com o conjunto completo das entradas. Não há iteração, não há teto de
rodadas, e a ordem de visita não pode influir. A profundidade topológica vira o número de
subpassos visíveis — que é o que atraso de propagação significa.

**Tech Stack:** TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`verbatimModuleSyntax`), Vitest, fast-check. Comentários e mensagens de erro em português;
identificadores em inglês, como o resto de `depth-core`.

---

## Contexto que o implementador precisa

**O repositório:** `/home/guaxinim/projetos/otel-visual-handbook`, monorepo pnpm. O motor é
`packages/depth-core`. Imports relativos terminam em `.js`. Rode tudo da raiz.

**Regra que quebra o CI se ignorada:** `scripts/check-boundaries.mjs` proíbe vocabulário de
OpenTelemetry e de protocolo dentro de `packages/depth-core`, `packages/depth-ui` e
`packages/model-format`. **A guarda é literal e não entende negação** — um comentário dizendo
"o motor não sabe o que é um span" quebra a guarda. Nesta entrega ela ganha uma segunda lista
(vocabulário de CPU), então o mesmo cuidado passa a valer para "registrador", "opcode" e
afins.

**Convenção de commit deste repositório:** sem `Co-Authored-By: Claude` e sem
`Claude-Session`. Mensagem em português, dizendo o **porquê**, não só o quê.

**Antes de cada commit**, os três verdes — e confira o código de saída de verdade, porque um
`| tail` esconde o exit code:

```bash
pnpm typecheck; echo "typecheck=$?"
pnpm test;      echo "test=$?"
pnpm boundaries; echo "boundaries=$?"
```

**Estado de hoje (242 testes verdes).** `stepWorld` é função pura de
`(spec, tree, state, params)`: entrega o que venceu no voo, roda cada ator uma vez, coleta
emissões e põe as novas em trânsito. `resolveTarget` ignora arestas de controle. O
livro-caixa usa dois eixos, `out:` e `in:`, separados por `:` e `.` — por isso id e porta não
podem conter esses caracteres.

**A spec:** `docs/superpowers/specs/2026-08-29-cpu-model-design.md`, §3.1 e §3.2. Este plano
é o Bloco 1 da §11.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Situação |
|---|---|---|
| `packages/depth-core/src/model.ts` | Tipos. Ganha `Wire.timing`, `Wire.toPort`, `TickPhase`, `StepContext.phase`, `StepContext.signals` | modificar |
| `packages/depth-core/src/settle-graph.ts` | O subgrafo de acomodação: ordem topológica, profundidade, detecção de ciclo. **Sem estado, sem mensagens** — é só grafo | criar |
| `packages/depth-core/src/settle.ts` | A fase de acomodação: roda os atores na ordem topológica e devolve o que foi entregue | criar |
| `packages/depth-core/src/wiring.ts` | Ganha `resolveSignalTargets` | modificar |
| `packages/depth-core/src/validate.ts` | Regras novas de fio, e a recusa do laço combinacional | modificar |
| `packages/depth-core/src/scheduler.ts` | Orquestra as duas fases. Continua sendo quem escreve estado e livro-caixa | modificar |
| `packages/depth-core/src/index.ts` | Superfície pública | modificar |
| `scripts/check-boundaries.mjs` | Segunda lista: vocabulário de CPU | modificar |

`settle-graph.ts` existe separado de `settle.ts` de propósito: ordem topológica e detecção de
ciclo são raciocínio de grafo puro, testável sem mundo nenhum, e `validateWorld` precisa da
detecção sem precisar da execução.

---

## Task 1: os tipos, e as regras de fio que eles trazem

**Files:**
- Modify: `packages/depth-core/src/model.ts`
- Modify: `packages/depth-core/src/validate.ts`
- Test: `packages/depth-core/src/validate.test.ts`

- [ ] **Step 1: escreva os testes que falham**

Acrescente ao fim do `describe("validateWorld", ...)` em
`packages/depth-core/src/validate.test.ts`:

```ts
  it("recusa fio de controle sem toPort: sinal precisa de porta de destino nomeada", () => {
    // Carga entra num objeto e o motor acha a folha de entrada. Sinal não: ele
    // chega numa entrada nomeada, porque quem recebe precisa saber QUAL sinal é.
    expect(() =>
      validar({ ...base, wires: [{ from: "a", port: "out", to: "b", line: "control" }] }),
    ).toThrow(/linha de controle .* precisa de toPort/);
  });

  it("recusa toPort numa linha de dado: carga entra pela folha de entrada", () => {
    expect(() =>
      validar({ ...base, wires: [{ from: "a", port: "out", to: "b", toPort: "sel" }] }),
    ).toThrow(/toPort .* só vale em linha de controle/);
  });

  it("recusa toPort com os separadores do livro-caixa", () => {
    expect(() =>
      validar({
        ...base,
        wires: [{ from: "a", port: "out", to: "b", line: "control", toPort: "a.b" }],
      }),
    ).toThrow(/separam campos no livro-caixa/);
  });

  it("aceita linha de controle bem formada, inclusive em leque", () => {
    // Sinal em leque é a regra, não a exceção: um controle aciona vários.
    expect(() =>
      validar({
        ...base,
        root: {
          id: "root",
          kind: "composite",
          label: "root",
          children: [leaf("a"), leaf("b"), leaf("c")],
        },
        wires: [
          { from: "a", port: "out", to: "b" },
          { from: "a", port: "sel", to: "b", line: "control", toPort: "sel" },
          { from: "a", port: "sel", to: "c", line: "control", toPort: "sel" },
        ],
      }),
    ).not.toThrow();
  });

  it("recusa a mesma porta de saída com tempos diferentes", () => {
    // A porta é de um regime só. Sem isso, o ator não teria como saber, ao
    // emitir, se está na acomodação ou no confronto.
    expect(() =>
      validar({
        ...base,
        root: {
          id: "root",
          kind: "composite",
          label: "root",
          children: [leaf("a"), leaf("b"), leaf("c")],
        },
        wires: [
          { from: "a", port: "out", to: "b", timing: "settle" },
          { from: "a", port: "out", to: "c", timing: "clocked" },
        ],
      }),
    ).toThrow(/a porta "out" de "a" mistura tempos/);
  });

  it("recusa fio de controle que chega em quem não age", () => {
    // Sinal não atravessa contêiner: ele tem destinatário nomeado.
    const spec: WorldSpec = {
      ...base,
      root: {
        id: "root",
        kind: "composite",
        label: "root",
        children: [
          leaf("a"),
          leaf("b"),
          { id: "caixa", kind: "composite", label: "caixa", children: [leaf("dentro")] },
        ],
      },
      wires: [
        { from: "a", port: "out", to: "b" },
        { from: "a", port: "sel", to: "caixa", line: "control", toPort: "sel" },
      ],
    };
    expect(() => validar(spec)).toThrow(/sinal .* "caixa", que não age/);
  });
```

- [ ] **Step 2: rode e confirme que falham**

Run: `pnpm vitest run packages/depth-core/src/validate.test.ts`
Esperado: 6 falhas, todas por não lançar.

- [ ] **Step 3: acrescente os tipos em `model.ts`**

Logo abaixo de `export type LineKind = "data" | "control";`:

```ts
/**
 * Em que fase do tick uma aresta entrega.
 *
 * - `clocked` — custa `edgeTicks`. É o que sempre existiu, e segue sendo o padrão
 * - `settle` — entrega **dentro do mesmo tick**, na fase de acomodação
 *
 * O padrão é `clocked` de propósito: mundo escrito antes desta mudança não muda
 * de comportamento por causa dela.
 */
export type WireTiming = "settle" | "clocked";

/**
 * Qual das duas fases do tick está rodando.
 *
 * - `settle` — propagação dentro do tick. O `state` devolvido é **descartado**:
 *   quem acomoda não guarda, exatamente como lógica combinacional não guarda
 * - `commit` — o fim do tick. É onde o estado muda
 */
export type TickPhase = "settle" | "commit";
```

Em `StepContext`, acrescente dois campos (mantenha os existentes):

```ts
  /** Em qual das duas fases do tick este comportamento está rodando. */
  readonly phase: TickPhase;
  /**
   * Sinais que chegaram por linha de controle, por porta de entrada. Sinal
   * modifica o que o ator faz; nunca é carga, e por isso não vem em `inbox`.
   */
  readonly signals: Readonly<Record<PortId, readonly Message[]>>;
```

Em `Wire`, acrescente dois campos:

```ts
  /**
   * Em que porta do destino um sinal chega. **Obrigatório** em linha de
   * controle e **proibido** em linha de dado: carga entra num objeto e o motor
   * acha a folha de entrada, mas sinal tem destinatário nomeado, porque quem
   * recebe precisa saber qual sinal é.
   */
  readonly toPort?: PortId;
  /** Quando esta aresta entrega. Ausente significa `"clocked"`. */
  readonly timing?: WireTiming;
```

Em `InFlight`, acrescente:

```ts
  /** Presente só quando este item é um sinal: a porta de destino dele. */
  readonly signalPort?: PortId;
```

Em `WorldState`, acrescente:

```ts
  /**
   * Quantos subpassos a acomodação levou neste tick — a profundidade do caminho
   * combinacional. Zero num mundo sem aresta acomodada.
   */
  readonly substeps: number;
```

- [ ] **Step 4: implemente as regras em `validate.ts`**

Acrescente `WireTiming` ao `import type` de `./model.js`. Dentro do primeiro
`for (const wire of spec.wires)`, depois da checagem de `wire.port`:

```ts
    const line = wire.line ?? "data";

    if (line === "control" && wire.toPort === undefined) {
      erros.push(
        `a linha de controle de "${wire.from}.${wire.port}" precisa de toPort — ` +
          `carga entra num objeto e o motor acha a folha de entrada, mas sinal ` +
          `chega numa entrada nomeada, senão quem recebe não sabe qual sinal é`,
      );
    }

    if (line === "data" && wire.toPort !== undefined) {
      erros.push(
        `o fio de "${wire.from}.${wire.port}" declara toPort "${wire.toPort}", e ` +
          `toPort só vale em linha de controle — carga entra pela folha de entrada`,
      );
    }

    if (wire.toPort !== undefined && (wire.toPort.includes(".") || wire.toPort.includes(":"))) {
      erros.push(
        `o toPort "${wire.toPort}" usa "." ou ":", que separam campos no ` +
          `livro-caixa — escolha um nome sem esses caracteres`,
      );
    }

    // Sinal não atravessa contêiner: quem recebe é nomeado, e precisa agir.
    if (line === "control" && wire.to !== DROP) {
      const destino = tree.byId.get(wire.to);
      if (destino !== undefined && destino.behavior === undefined) {
        erros.push(
          `o sinal de "${wire.from}.${wire.port}" chega em "${wire.to}", que não age — ` +
            `sinal tem destinatário nomeado e não atravessa contêiner. Aponte-o ` +
            `para o objeto que de fato reage a ele`,
        );
      }
    }
```

E, depois do laço de fan-out que já existe, o regime único por porta:

```ts
  // Uma porta é de um regime só. Sem isso, o ator não teria como saber, ao
  // emitir, se está acomodando ou confrontando — e a fase é justamente o que
  // decide se o que ele devolve como estado vale ou é descartado.
  const tempoDaPorta = new Map<string, WireTiming>();
  for (const wire of spec.wires) {
    const chave = `${wire.from} ${wire.port}`;
    const timing = wire.timing ?? "clocked";
    const anterior = tempoDaPorta.get(chave);
    if (anterior === undefined) {
      tempoDaPorta.set(chave, timing);
      continue;
    }
    if (anterior !== timing) {
      erros.push(
        `a porta "${wire.port}" de "${wire.from}" mistura tempos: um fio é ` +
          `"${anterior}" e outro é "${timing}". Uma porta entrega numa fase só`,
      );
    }
  }
```

- [ ] **Step 5: rode e confirme que passam**

Run: `pnpm vitest run packages/depth-core/src/validate.test.ts`
Esperado: todos verdes. O quarto teste do Step 1 (leque de controle) prova que a checagem de
fan-out continua valendo só para dado; se ele falhar, o filtro `(wire.line ?? "data")` foi
perdido.

- [ ] **Step 6: Commit**

```bash
git add packages/depth-core/src/model.ts packages/depth-core/src/validate.ts \
        packages/depth-core/src/validate.test.ts
git commit -m "feat(depth-core): tempo da aresta e porta de destino do sinal

Wire ganha timing (settle ou clocked, com clocked como padrao para nao mudar
mundo nenhum que ja existe) e toPort, obrigatorio em linha de controle e
proibido em linha de dado: carga entra num objeto e o motor acha a folha de
entrada, mas sinal tem destinatario nomeado, senao quem recebe nao sabe qual
sinal e. Sinal tambem nao atravessa conteiner, pelo mesmo motivo.

Uma porta e de um regime so. Sem isso o ator nao teria como saber, ao emitir, se
esta acomodando ou confrontando — e a fase e o que decide se o estado que ele
devolve vale ou e descartado."
```

---

## Task 2: o subgrafo de acomodação, e o laço que ele detecta

**Files:**
- Create: `packages/depth-core/src/settle-graph.ts`
- Test: `packages/depth-core/src/settle-graph.test.ts`

- [ ] **Step 1: escreva os testes que falham**

```ts
// packages/depth-core/src/settle-graph.test.ts
import { describe, expect, it } from "vitest";
import type { Wire } from "./model.js";
import { findCombinationalCycle, settleOrder } from "./settle-graph.js";

const fio = (from: string, to: string, timing: "settle" | "clocked" = "settle"): Wire => ({
  from,
  port: "out",
  to,
  timing,
});

describe("settleOrder", () => {
  it("devolve ordem topológica e profundidade: a profundidade É o atraso de propagação", () => {
    const ordem = settleOrder([fio("a", "b"), fio("b", "c")]);
    expect(ordem.map((n) => n.id)).toEqual(["a", "b", "c"]);
    expect(ordem.map((n) => n.depth)).toEqual([0, 1, 2]);
  });

  it("dois caminhos que reconvergem: a profundidade é a do caminho mais longo", () => {
    // Há um atalho a -> d, mas "d" só está pronto quando o caminho lento chega.
    const ordem = settleOrder([fio("a", "b"), fio("b", "d"), fio("a", "d")]);
    const profundidade = new Map(ordem.map((n) => [n.id, n.depth]));
    expect(profundidade.get("d")).toBe(2);
  });

  it("ignora aresta cronometrada: ela não faz parte da acomodação", () => {
    const ordem = settleOrder([fio("a", "b"), fio("b", "c", "clocked")]);
    expect(ordem.map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("inclui a linha de controle acomodada", () => {
    const ordem = settleOrder([
      { from: "a", port: "sel", to: "b", line: "control", toPort: "sel", timing: "settle" },
    ]);
    expect(ordem.map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("mundo sem aresta acomodada não tem acomodação nenhuma", () => {
    expect(settleOrder([fio("a", "b", "clocked")])).toEqual([]);
  });
});

describe("findCombinationalCycle", () => {
  it("acha o ciclo e devolve o caminho, para a mensagem poder nomeá-lo", () => {
    const ciclo = findCombinationalCycle([fio("a", "b"), fio("b", "c"), fio("c", "a")]);
    expect(ciclo).not.toBeNull();
    // O caminho fecha em si mesmo: o primeiro id reaparece no fim.
    expect(ciclo![0]).toBe(ciclo![ciclo!.length - 1]);
    expect(new Set(ciclo)).toEqual(new Set(["a", "b", "c"]));
  });

  it("acha laço de um nó só", () => {
    expect(findCombinationalCycle([fio("a", "a")])).toEqual(["a", "a"]);
  });

  it("não acusa ciclo que só existe passando por aresta cronometrada", () => {
    // É o que um registrador faz: fecha o laço, mas atravessando uma borda de
    // relógio. Isso é realimentação legítima, não laço combinacional.
    expect(findCombinationalCycle([fio("a", "b"), fio("b", "a", "clocked")])).toBeNull();
  });

  it("não acusa reconvergência", () => {
    expect(
      findCombinationalCycle([fio("a", "b"), fio("a", "c"), fio("b", "d"), fio("c", "d")]),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: rode e confirme que falham**

Run: `pnpm vitest run packages/depth-core/src/settle-graph.test.ts`
Esperado: falha com "Cannot find module './settle-graph.js'".

- [ ] **Step 3: implemente `settle-graph.ts`**

```ts
// packages/depth-core/src/settle-graph.ts
import { DROP } from "./model.js";
import type { Wire } from "./model.js";

/**
 * O subgrafo de acomodação — as arestas que entregam dentro do próprio tick.
 *
 * Vive separado de quem executa porque é raciocínio de grafo puro: dá para
 * testá-lo sem mundo, sem estado e sem mensagem, e `validateWorld` precisa da
 * detecção de ciclo sem precisar da execução.
 *
 * A garantia que sustenta tudo: como `validateWorld` recusa laço combinacional,
 * este grafo é um DAG. Um DAG se percorre em ordem topológica, e aí cada ator
 * roda **uma vez só**, com o conjunto completo das entradas dele. Não há
 * iteração, não há teto de rodadas, e a ordem de visita não pode influir.
 */

export interface SettleNode {
  readonly id: string;
  /**
   * Quantas arestas de acomodação, no caminho mais longo, é preciso atravessar
   * até chegar aqui. **É o atraso de propagação**: o valor de um nó só está
   * pronto quando o mais lento dos caminhos que o alimentam chegou. Vira o
   * número de subpassos que a tela mostra dentro do tick.
   */
  readonly depth: number;
}

interface Aresta {
  readonly from: string;
  readonly to: string;
}

function settleEdges(wires: readonly Wire[]): Aresta[] {
  const out: Aresta[] = [];
  for (const wire of wires) {
    if ((wire.timing ?? "clocked") !== "settle") continue;
    // O descarte não continua para lugar nenhum, então não é aresta do grafo.
    if (wire.to === DROP) continue;
    out.push({ from: wire.from, to: wire.to });
  }
  return out;
}

function adjacencia(edges: readonly Aresta[]): {
  nodes: Set<string>;
  saida: Map<string, string[]>;
} {
  const nodes = new Set<string>();
  const saida = new Map<string, string[]>();
  for (const { from, to } of edges) {
    nodes.add(from);
    nodes.add(to);
    const lista = saida.get(from) ?? [];
    lista.push(to);
    saida.set(from, lista);
  }
  return { nodes, saida };
}

/**
 * Os objetos que participam da acomodação, em ordem topológica e com a
 * profundidade de cada um. Objeto sem nenhuma aresta acomodada não aparece —
 * ele só existe na fase de confronto, como sempre existiu.
 *
 * Lança se houver ciclo. Não deveria acontecer, porque `validateWorld` recusa o
 * mundo antes; se acontecer, é bug do motor e não de quem escreveu o modelo, e
 * a mensagem diz isso.
 */
export function settleOrder(wires: readonly Wire[]): readonly SettleNode[] {
  const edges = settleEdges(wires);
  const { nodes, saida } = adjacencia(edges);

  const grau = new Map<string, number>();
  for (const id of nodes) grau.set(id, 0);
  for (const { to } of edges) grau.set(to, (grau.get(to) ?? 0) + 1);

  // Kahn, com a profundidade subindo junto: cada nó recebe o máximo entre as
  // profundidades de quem o alimenta, mais um.
  const profundidade = new Map<string, number>();
  const fila: string[] = [];
  for (const id of nodes) {
    if (grau.get(id) === 0) {
      fila.push(id);
      profundidade.set(id, 0);
    }
  }

  const ordem: SettleNode[] = [];
  while (fila.length > 0) {
    const id = fila.shift()!;
    const aqui = profundidade.get(id) ?? 0;
    ordem.push({ id, depth: aqui });
    for (const destino of saida.get(id) ?? []) {
      profundidade.set(destino, Math.max(profundidade.get(destino) ?? 0, aqui + 1));
      const resta = (grau.get(destino) ?? 0) - 1;
      grau.set(destino, resta);
      if (resta === 0) fila.push(destino);
    }
  }

  if (ordem.length !== nodes.size) {
    const ciclo = findCombinationalCycle(wires);
    throw new Error(
      `settle-graph: laço combinacional${ciclo === null ? "" : ` em ${ciclo.join(" -> ")}`} — ` +
        `validateWorld deveria ter recusado este mundo`,
    );
  }

  return ordem;
}

/**
 * O caminho de um ciclo no subgrafo de acomodação, ou `null` se não houver.
 * Devolve o caminho fechado (o primeiro id reaparece no fim) para a mensagem de
 * erro poder mostrar a volta inteira — dizer só "há um laço" obriga o autor a
 * procurar.
 */
export function findCombinationalCycle(wires: readonly Wire[]): readonly string[] | null {
  const { nodes, saida } = adjacencia(settleEdges(wires));

  const VISITANDO = 1;
  const PRONTO = 2;
  const estado = new Map<string, number>();
  const pilha: string[] = [];

  const desce = (id: string): readonly string[] | null => {
    estado.set(id, VISITANDO);
    pilha.push(id);
    for (const destino of saida.get(id) ?? []) {
      const marca = estado.get(destino);
      if (marca === VISITANDO) {
        const inicio = pilha.indexOf(destino);
        return [...pilha.slice(inicio), destino];
      }
      if (marca === undefined) {
        const achado = desce(destino);
        if (achado !== null) return achado;
      }
    }
    pilha.pop();
    estado.set(id, PRONTO);
    return null;
  };

  for (const id of nodes) {
    if (estado.has(id)) continue;
    const achado = desce(id);
    if (achado !== null) return achado;
  }
  return null;
}
```

- [ ] **Step 4: rode e confirme que passam**

Run: `pnpm vitest run packages/depth-core/src/settle-graph.test.ts`
Esperado: 9 verdes.

- [ ] **Step 5: Commit**

```bash
git add packages/depth-core/src/settle-graph.ts packages/depth-core/src/settle-graph.test.ts
git commit -m "feat(depth-core): subgrafo de acomodacao, ordem topologica e deteccao de laco

Como validateWorld vai recusar laco combinacional, o subgrafo de acomodacao e um
DAG — e um DAG se percorre em ordem topologica, com cada ator rodando uma vez so
com o conjunto completo das entradas. Some a iteracao, some o teto de rodadas, e
a ordem de visita nao pode influir no resultado.

A profundidade topologica nao e detalhe de implementacao: ela E o atraso de
propagacao, porque o valor de um no so esta pronto quando o mais lento dos
caminhos que o alimentam chegou. E o que a tela vai mostrar como subpassos
dentro do tick.

A deteccao devolve o caminho fechado do ciclo, e nao um booleano: dizer so que
ha um laco obriga o autor a procurar."
```

---

## Task 3: `validateWorld` recusa o laço combinacional

**Files:**
- Modify: `packages/depth-core/src/validate.ts`
- Test: `packages/depth-core/src/validate.test.ts`

- [ ] **Step 1: escreva os testes que falham**

Acrescente ao `describe("validateWorld", ...)`:

```ts
  it("recusa laço combinacional, nomeando a volta inteira", () => {
    // Em hardware isto é erro de projeto, e aqui seria um percurso que não
    // termina. Recusado na construção do mundo, que é onde a violação vira
    // impossível em vez de improvável.
    const spec: WorldSpec = {
      ...base,
      root: {
        id: "root",
        kind: "composite",
        label: "root",
        children: [leaf("a"), leaf("b")],
      },
      wires: [
        { from: "a", port: "out", to: "b", timing: "settle" },
        { from: "b", port: "out", to: "a", timing: "settle" },
      ],
    };
    expect(() => validar(spec)).toThrow(/laço combinacional/);
    expect(() => validar(spec)).toThrow(/a -> b -> a|b -> a -> b/);
  });

  it("aceita realimentação que atravessa uma borda de relógio", () => {
    // É o que um registrador faz: fecha o laço, mas custando um tick. Recusar
    // isto proibiria qualquer máquina sequencial.
    expect(() =>
      validar({
        ...base,
        root: {
          id: "root",
          kind: "composite",
          label: "root",
          children: [leaf("a"), leaf("b")],
        },
        wires: [
          { from: "a", port: "out", to: "b", timing: "settle" },
          { from: "b", port: "out", to: "a", timing: "clocked" },
        ],
      }),
    ).not.toThrow();
  });
```

- [ ] **Step 2: rode e confirme que o primeiro falha**

Run: `pnpm vitest run packages/depth-core/src/validate.test.ts -t "laço combinacional"`
Esperado: falha por não lançar.

- [ ] **Step 3: implemente**

No topo de `validate.ts`, acrescente `import { findCombinationalCycle } from "./settle-graph.js";`.
Antes do `if (erros.length > 0)` final:

```ts
  // Laço combinacional é percurso que não termina, e em hardware é erro de
  // projeto. Recusar aqui é a diferença entre uma violação impossível e uma
  // improvável — a alternativa seria um teto de iterações no percurso, que
  // transformaria "não converge" em "converge errado", em silêncio.
  const ciclo = findCombinationalCycle(spec.wires);
  if (ciclo !== null) {
    erros.push(
      `laço combinacional: ${ciclo.join(" -> ")}. Um caminho que acomoda não pode ` +
        `voltar a si mesmo dentro do mesmo tick. Ponha um fio com timing ` +
        `"clocked" em algum ponto da volta — é o que um registrador faz`,
    );
  }
```

- [ ] **Step 4: rode e confirme que passam**

Run: `pnpm vitest run packages/depth-core/src/validate.test.ts`
Esperado: todos verdes.

- [ ] **Step 5: verifique por mutação que a regra tem dente**

Em `settle-graph.ts`, troque, dentro de `settleEdges`,
`if ((wire.timing ?? "clocked") !== "settle") continue;` por `if (false) continue;`.

Run: `pnpm test`
Esperado: o teste "aceita realimentação que atravessa uma borda de relógio" **falha**. Desfaça
a mutação.

Se ele não falhar, o teste está fraco e a regra recusaria máquina sequencial — pare e conserte
o teste antes de seguir.

- [ ] **Step 6: Commit**

```bash
git add packages/depth-core/src/validate.ts packages/depth-core/src/validate.test.ts
git commit -m "feat(depth-core): laco combinacional recusado na construcao do mundo

A alternativa seria um teto de iteracoes no percurso, que transformaria 'nao
converge' em 'converge errado', em silencio. A mensagem mostra a volta inteira,
porque dizer so que ha um laco obriga o autor a procurar.

Realimentacao atravessando borda de relogio continua valendo — e o que um
registrador faz, e recusa-la proibiria qualquer maquina sequencial. Verificado
por mutacao."
```

---

## Task 4: `resolveSignalTargets`

**Files:**
- Modify: `packages/depth-core/src/wiring.ts`
- Test: `packages/depth-core/src/wiring.test.ts`

- [ ] **Step 1: escreva os testes que falham**

Acrescente a `packages/depth-core/src/wiring.test.ts`:

```ts
describe("resolveSignalTargets", () => {
  const wires: Wire[] = [
    { from: "ctrl", port: "sel", to: "m1", line: "control", toPort: "sel" },
    { from: "ctrl", port: "sel", to: "m2", line: "control", toPort: "sel" },
    { from: "ctrl", port: "en", to: "m1", line: "control", toPort: "enable" },
    { from: "ctrl", port: "sel", to: "d", line: "data" },
  ];

  it("devolve todos os destinos de um sinal: leque é a regra, não a exceção", () => {
    expect(resolveSignalTargets(wires, "ctrl", "sel")).toEqual([
      { to: "m1", toPort: "sel" },
      { to: "m2", toPort: "sel" },
    ]);
  });

  it("não confunde portas diferentes do mesmo controlador", () => {
    expect(resolveSignalTargets(wires, "ctrl", "en")).toEqual([{ to: "m1", toPort: "enable" }]);
  });

  it("ignora linha de dado, mesmo saindo da mesma porta", () => {
    const so = resolveSignalTargets(wires, "ctrl", "sel");
    expect(so.map((s) => s.to)).not.toContain("d");
  });

  it("porta sem linha de controle nenhuma devolve lista vazia", () => {
    expect(resolveSignalTargets(wires, "ctrl", "nada")).toEqual([]);
  });
});
```

Acrescente `resolveSignalTargets` ao import de `./wiring.js` e `Wire` ao import de tipo, se
ainda não estiverem lá.

- [ ] **Step 2: rode e confirme que falham**

Run: `pnpm vitest run packages/depth-core/src/wiring.test.ts`
Esperado: falha por `resolveSignalTargets` não existir.

- [ ] **Step 3: implemente**

No fim de `packages/depth-core/src/wiring.ts` (e acrescente `PortId` ao `import type` de
`./model.js`):

```ts
/** Para onde vai um sinal que sai de `(from, port)`, e em que porta ele chega. */
export interface SignalTarget {
  readonly to: string;
  readonly toPort: PortId;
}

/**
 * Sinal em leque é a regra, não a exceção: um controle aciona vários. Por isso
 * esta devolve uma lista, ao contrário de `resolveTarget`, que percorre carga e
 * onde leque de dado é recusado na validação.
 *
 * Sinal também não atravessa contêiner nem sobe para o pai: o destinatário é
 * nomeado, e `validateWorld` já garantiu que ele age.
 */
export function resolveSignalTargets(
  wires: readonly Wire[],
  from: string,
  port: PortId,
): readonly SignalTarget[] {
  const out: SignalTarget[] = [];
  for (const wire of wires) {
    if ((wire.line ?? "data") !== "control") continue;
    if (wire.from !== from || wire.port !== port) continue;
    if (wire.to === DROP || wire.toPort === undefined) continue;
    out.push({ to: wire.to, toPort: wire.toPort });
  }
  return out;
}
```

- [ ] **Step 4: rode e confirme que passam**

Run: `pnpm vitest run packages/depth-core/src/wiring.test.ts`
Esperado: todos verdes.

- [ ] **Step 5: Commit**

```bash
git add packages/depth-core/src/wiring.ts packages/depth-core/src/wiring.test.ts
git commit -m "feat(depth-core): resolucao de destino de sinal, em leque

Devolve lista e nao destino unico porque sinal em leque e a regra: um controle
aciona varios. E nao atravessa conteiner nem sobe para o pai, ao contrario da
carga — o destinatario de um sinal e nomeado."
```

---

## Task 5: a fase de acomodação, ligada ao tick

**Files:**
- Create: `packages/depth-core/src/settle.ts`
- Create: `packages/depth-core/src/settle.test-fixture.ts`
- Test: `packages/depth-core/src/settle.test.ts`
- Modify: `packages/depth-core/src/scheduler.ts`

- [ ] **Step 1: escreva a fixture**

```ts
// packages/depth-core/src/settle.test-fixture.ts
//
// Um mundo minúsculo com caminho combinacional de verdade: uma fonte
// cronometrada alimenta dois estágios que acomodam em cadeia, e o último
// escreve num acumulador na fase de confronto.
import type { ObjectSpec, WorldSpec } from "./model.js";

/** Emite um valor por tick, no confronto. */
export const fonte: ObjectSpec = {
  id: "fonte",
  kind: "source",
  label: "fonte",
  leaf: true,
  init: () => ({ n: 0 }),
  behavior: (state, _inbox, ctx) => {
    const s = state as { n: number };
    if (ctx.phase !== "commit") return { state: s, out: [] };
    return {
      state: { n: s.n + 1 },
      out: [{ port: "out", message: ctx.emit("valor", 1, { n: s.n }) }],
    };
  },
};

/** Soma 1 ao que chega. Acomoda: não guarda nada. */
const soma = (id: string): ObjectSpec => ({
  id,
  kind: "router",
  label: id,
  leaf: true,
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "settle") return { state, out: [] };
    return {
      state,
      out: inbox.map((m) => ({
        port: "out",
        message: ctx.emit("valor", 1, { n: (m.data.n as number) + 1 }),
      })),
    };
  },
});

export const a = soma("a");
export const b = soma("b");

/** Guarda o último valor visto. Só age no confronto. */
export const acumulador: ObjectSpec = {
  id: "acc",
  kind: "sink",
  label: "acc",
  leaf: true,
  init: () => ({ ultimo: -1, vistos: 0 }),
  behavior: (state, inbox, ctx) => {
    const s = state as { ultimo: number; vistos: number };
    if (ctx.phase !== "commit" || inbox.length === 0) return { state: s, out: [] };
    const ultimo = inbox[inbox.length - 1]!;
    return {
      state: { ultimo: ultimo.data.n as number, vistos: s.vistos + inbox.length },
      out: [],
    };
  },
};

export const spec: WorldSpec = {
  id: "s",
  seed: 1,
  edgeTicks: 1,
  root: { id: "root", kind: "composite", label: "root", children: [fonte, a, b, acumulador] },
  wires: [
    { from: "fonte", port: "out", to: "a", timing: "clocked" },
    { from: "a", port: "out", to: "b", timing: "settle" },
    { from: "b", port: "out", to: "acc", timing: "settle" },
  ],
  params: {},
};
```

- [ ] **Step 2: escreva os testes que falham**

```ts
// packages/depth-core/src/settle.test.ts
import { describe, expect, it } from "vitest";
import { initialWorld, stepWorld } from "./scheduler.js";
import { spec } from "./settle.test-fixture.js";
import { indexTree } from "./tree.js";

const tree = indexTree(spec.root);

function rodar(ticks: number) {
  let estado = initialWorld(tree);
  for (let i = 0; i < ticks; i += 1) estado = stepWorld(spec, tree, estado, spec.params);
  return estado;
}

describe("fase de acomodação", () => {
  it("atravessa dois estágios combinacionais dentro do mesmo tick", () => {
    // A fonte emite no tick 1 e a mensagem chega em "a" no tick 2 (edgeTicks 1).
    // Aí ela atravessa a -> b -> acc SEM custar tick nenhum: no fim do tick 2 o
    // acumulador já viu 0 + 1 + 1 = 2.
    expect((rodar(2).nodes.acc as { ultimo: number }).ultimo).toBe(2);
  });

  it("o que acomoda não guarda: o estado devolvido na acomodação é descartado", () => {
    // "a" e "b" não declaram init, então o estado deles é o objeto vazio da
    // construção. Se a acomodação escrevesse estado, isto mudaria.
    const estado = rodar(4);
    expect(estado.nodes.a).toEqual({});
    expect(estado.nodes.b).toEqual({});
  });

  it("mensagem que acomoda não fica em trânsito: ela chegou dentro do tick", () => {
    const emVoo = rodar(3).flight.map((f) => `${f.from}->${f.to}`);
    expect(emVoo).not.toContain("a->b");
    expect(emVoo).not.toContain("b->acc");
  });

  it("o livro-caixa conta a acomodação como tráfego normal de porta", () => {
    // Acomodar não é ficar invisível: quem emitiu, emitiu.
    const estado = rodar(3);
    expect(estado.ledger["out:a.out"]).toBeGreaterThan(0);
    expect(estado.ledger["in:acc"]).toBeGreaterThan(0);
  });

  it("substeps conta a profundidade do caminho combinacional deste tick", () => {
    // a (0) -> b (1) -> acc (2): três níveis, então três subpassos.
    expect(rodar(2).substeps).toBe(3);
  });

  it("mundo sem aresta acomodada tem zero subpassos e não muda de comportamento", () => {
    const semAcomodar = {
      ...spec,
      wires: spec.wires.map((w) => ({ ...w, timing: "clocked" as const })),
    };
    let estado = initialWorld(tree);
    for (let i = 0; i < 3; i += 1) estado = stepWorld(semAcomodar, tree, estado, spec.params);
    expect(estado.substeps).toBe(0);
  });
});
```

- [ ] **Step 3: rode e confirme que falham**

Run: `pnpm vitest run packages/depth-core/src/settle.test.ts`
Esperado: falhas — hoje `stepWorld` não conhece fase nenhuma.

- [ ] **Step 4: implemente `settle.ts`**

```ts
// packages/depth-core/src/settle.ts
import { DROP } from "./model.js";
import type { Emission, Message, PortId, WorldSpec } from "./model.js";
import { settleOrder } from "./settle-graph.js";

/** O que chegou a um ator: carga na caixa, sinal por porta. */
export interface Delivery {
  readonly cargo: readonly Message[];
  readonly signals: Readonly<Record<PortId, readonly Message[]>>;
}

export interface SettleResult {
  /** O que cada ator recebeu durante a acomodação. */
  readonly deliveries: ReadonlyMap<string, Delivery>;
  /**
   * Quantos subpassos a acomodação levou — a profundidade do caminho
   * combinacional que de fato propagou algo. É o que a tela mostra dentro do
   * tick, e é o que atraso de propagação significa.
   */
  readonly substeps: number;
  /** Contagens a somar no livro-caixa: chave -> quanto. */
  readonly ledger: ReadonlyMap<string, number>;
}

/** Acumulador mutável de entregas, virado em `Delivery` no fim. */
interface Caixa {
  cargo: Message[];
  signals: Map<PortId, Message[]>;
}

/**
 * A fase de acomodação de um tick.
 *
 * Percorre o subgrafo acomodado em ordem topológica — possível porque
 * `validateWorld` recusou laço combinacional — e por isso cada ator roda uma
 * vez só, com o conjunto completo do que chegou até ele. Nada aqui escreve
 * estado: o `state` que um comportamento devolve nesta fase é **descartado**,
 * exatamente como lógica combinacional não guarda.
 *
 * `runOne` é injetado por `scheduler.ts` porque quem sabe montar o contexto de
 * um ator (sorteio endereçável, `emit` com id determinístico, cobrança do
 * regime da porta) é ele. Assim esta função não conhece semente nem numeração.
 */
export function settle(
  spec: WorldSpec,
  clocked: ReadonlyMap<string, readonly Message[]>,
  clockedSignals: ReadonlyMap<string, ReadonlyMap<PortId, readonly Message[]>>,
  runOne: (
    id: string,
    cargo: readonly Message[],
    signals: Readonly<Record<PortId, readonly Message[]>>,
  ) => readonly Emission[],
): SettleResult {
  const ordem = settleOrder(spec.wires);
  const caixas = new Map<string, Caixa>();
  const ledger = new Map<string, number>();
  let substeps = 0;

  const bump = (chave: string, quanto: number): void => {
    ledger.set(chave, (ledger.get(chave) ?? 0) + quanto);
  };

  const caixa = (id: string): Caixa => {
    const existente = caixas.get(id);
    if (existente !== undefined) return existente;
    const nova: Caixa = { cargo: [], signals: new Map() };
    caixas.set(id, nova);
    return nova;
  };

  for (const { id, depth } of ordem) {
    const minha = caixas.get(id);
    const cargo = [...(clocked.get(id) ?? []), ...(minha?.cargo ?? [])];

    const signals: Record<PortId, readonly Message[]> = {};
    for (const [porta, msgs] of clockedSignals.get(id) ?? []) signals[porta] = [...msgs];
    for (const [porta, msgs] of minha?.signals ?? []) {
      signals[porta] = [...(signals[porta] ?? []), ...msgs];
    }

    // Nada chegou: não há o que propagar a partir daqui.
    if (cargo.length === 0 && Object.keys(signals).length === 0) continue;

    const emissoes = runOne(id, cargo, signals);
    if (emissoes.length === 0) continue;
    substeps = Math.max(substeps, depth + 1);

    for (const emissao of emissoes) {
      for (const wire of spec.wires) {
        if (wire.from !== id || wire.port !== emissao.port) continue;
        if ((wire.timing ?? "clocked") !== "settle") continue;
        if (wire.to === DROP) continue;

        const destino = caixa(wire.to);
        if ((wire.line ?? "data") === "control") {
          const porta = wire.toPort!;
          const lista = destino.signals.get(porta) ?? [];
          lista.push(emissao.message);
          destino.signals.set(porta, lista);
          bump(`sigin:${wire.to}.${porta}`, 1);
        } else {
          destino.cargo.push(emissao.message);
          bump(`in:${wire.to}`, 1);
          bump(`in:${wire.to}.weight`, emissao.message.weight);
        }
      }
    }
  }

  const deliveries = new Map<string, Delivery>();
  for (const [id, c] of caixas) {
    const signals: Record<PortId, readonly Message[]> = {};
    for (const [porta, msgs] of c.signals) signals[porta] = msgs;
    deliveries.set(id, { cargo: c.cargo, signals });
  }

  return { deliveries, substeps, ledger };
}
```

- [ ] **Step 5: reescreva `stepWorld` com as duas fases**

Substitua todo o corpo de `stepWorld` em `packages/depth-core/src/scheduler.ts` por:

```ts
export function stepWorld(
  spec: WorldSpec,
  tree: TreeIndex,
  state: WorldState,
  params: Readonly<Record<string, number>>,
): WorldState {
  const tick = state.tick + 1;
  const edgeTicks = spec.edgeTicks ?? DEFAULT_EDGE_TICKS;

  const nodes: Record<string, unknown> = { ...state.nodes };
  const ledger: Record<string, number> = { ...state.ledger };
  const launched: InFlight[] = [];

  const bump = (key: string, by: number): void => {
    ledger[key] = (ledger[key] ?? 0) + by;
  };

  // O que venceu no voo. Sinal e carga vão para caixas diferentes: sinal
  // modifica o que o ator faz, e nunca é carga.
  const inbox = new Map<string, Message[]>();
  const sinais = new Map<string, Map<string, Message[]>>();
  const stillFlying: InFlight[] = [];
  for (const item of state.flight) {
    if (tick - item.sent < edgeTicks) {
      stillFlying.push(item);
      continue;
    }
    if (item.to === DROP) continue;
    if (item.signalPort !== undefined) {
      const porPorta = sinais.get(item.to) ?? new Map<string, Message[]>();
      const lista = porPorta.get(item.signalPort) ?? [];
      lista.push(item.message);
      porPorta.set(item.signalPort, lista);
      sinais.set(item.to, porPorta);
      bump(`sigin:${item.to}.${item.signalPort}`, 1);
      continue;
    }
    const box = inbox.get(item.to) ?? [];
    box.push(item.message);
    inbox.set(item.to, box);
  }

  const atores = actors(tree);
  // Uma entrega para quem não age é bug do motor, não do autor: `validateWorld`
  // já recusou esse mundo na construção. Se chegar aqui, a caixa morreria com o
  // Map local e a mensagem sumiria sem aparecer no livro-caixa.
  const ehAtor = new Set(atores.map((n) => n.id));
  for (const destino of inbox.keys()) {
    if (!ehAtor.has(destino)) {
      throw new Error(
        `scheduler: entrega para "${destino}", que não age — ` +
          `validateWorld deveria ter recusado este mundo`,
      );
    }
  }

  // Qual regime cada porta tem. `validateWorld` já garantiu que uma porta não
  // mistura os dois, então a primeira aresta que casa decide.
  const tempoDaPorta = new Map<string, WireTiming>();
  for (const wire of spec.wires) {
    const chave = `${wire.from} ${wire.port}`;
    if (!tempoDaPorta.has(chave)) tempoDaPorta.set(chave, wire.timing ?? "clocked");
  }

  const porId = new Map(atores.map((n) => [n.id, n]));
  const seqPorNo = new Map<string, number>();

  const contexto = (
    node: ObjectSpec,
    phase: TickPhase,
    signals: Readonly<Record<string, readonly Message[]>>,
  ): StepContext => ({
    tick,
    phase,
    signals,
    params,
    random: (salt = "") => randomAt(spec.seed, tick, `${node.id}:${salt}`),
    emit: (kind: string, weight = 1, data: Record<string, unknown> = {}): Message => {
      const seq = seqPorNo.get(node.id) ?? 0;
      seqPorNo.set(node.id, seq + 1);
      // O id carrega a fase: sem isso, a mesma folha emitindo nas duas fases do
      // mesmo tick geraria dois ids iguais, e o replay deixaria de ser exato.
      const marca = phase === "settle" ? "s" : "c";
      return { id: `${tick}:${node.id}:${marca}${seq}`, kind, weight, data };
    },
  });

  /** Roda um ator numa fase, contando as saídas e cobrando o regime da porta. */
  const rodar = (
    id: string,
    phase: TickPhase,
    cargo: readonly Message[],
    signals: Readonly<Record<string, readonly Message[]>>,
  ): readonly Emission[] => {
    const node = porId.get(id);
    if (node === undefined || node.behavior === undefined) return [];

    const resultado = node.behavior(nodes[id], cargo, contexto(node, phase, signals));
    // Só o confronto escreve estado. Quem acomoda não guarda — é o que separa
    // lógica combinacional de elemento de memória, e aqui é estrutural: o
    // `state` devolvido na acomodação nem chega a ser lido.
    if (phase === "commit") nodes[id] = resultado.state;

    for (const emissao of resultado.out) {
      const regime = tempoDaPorta.get(`${id} ${emissao.port}`) ?? "clocked";
      if (regime === "settle" && phase === "commit") {
        throw new Error(
          `scheduler: a porta "${emissao.port}" de "${id}" entrega na acomodação, e o ` +
            `comportamento emitiu nela durante o confronto — a mensagem chegaria tarde ` +
            `demais para o caminho combinacional deste tick. Emita nela quando ` +
            `ctx.phase for "settle"`,
        );
      }
      if (regime === "clocked" && phase === "settle") {
        throw new Error(
          `scheduler: a porta "${emissao.port}" de "${id}" entrega por relógio, e o ` +
            `comportamento emitiu nela durante a acomodação. Emita nela quando ` +
            `ctx.phase for "commit"`,
        );
      }
      bump(`out:${id}.${emissao.port}`, 1);
      bump(`out:${id}.${emissao.port}.weight`, emissao.message.weight);
    }
    return resultado.out;
  };

  // FASE 1 — acomodação. Propaga dentro do tick e não escreve estado.
  const acomodado = settle(spec, inbox, sinais, (id, cargo, sinaisDele) =>
    rodar(id, "settle", cargo, sinaisDele),
  );
  for (const [chave, quanto] of acomodado.ledger) bump(chave, quanto);

  // FASE 2 — confronto. Onde o estado muda e onde nascem as mensagens que
  // custam tick.
  for (const node of atores) {
    const cronometrado = inbox.get(node.id) ?? [];
    if (cronometrado.length > 0) {
      bump(`in:${node.id}`, cronometrado.length);
      for (const message of cronometrado) bump(`in:${node.id}.weight`, message.weight);
    }

    const entregue = acomodado.deliveries.get(node.id);
    const cargo = [...cronometrado, ...(entregue?.cargo ?? [])];

    const sinaisDaqui: Record<string, readonly Message[]> = { ...(entregue?.signals ?? {}) };
    for (const [porta, msgs] of sinais.get(node.id) ?? []) {
      sinaisDaqui[porta] = [...(sinaisDaqui[porta] ?? []), ...msgs];
    }

    for (const emissao of rodar(node.id, "commit", cargo, sinaisDaqui)) {
      const alvosDeSinal = resolveSignalTargets(spec.wires, node.id, emissao.port);
      for (const alvo of alvosDeSinal) {
        launched.push({
          id: `${tick}:${node.id}:${emissao.port}:sig${launched.length}`,
          message: emissao.message,
          from: node.id,
          to: alvo.to,
          sent: tick,
          signalPort: alvo.toPort,
        });
      }

      const to = resolveTarget(tree, spec.wires, node.id, emissao.port);
      if (to === null) {
        // Sem fio de dado e sem descarte. Se havia sinal, não é buraco de
        // autoria: a porta é de controle e já entregou acima.
        if (alvosDeSinal.length === 0) {
          bump(`out:${node.id}.${emissao.port}.unwired`, 1);
        }
        continue;
      }
      launched.push({
        id: `${tick}:${node.id}:${emissao.port}:${launched.length}`,
        message: emissao.message,
        from: node.id,
        to,
        sent: tick,
      });
    }
  }

  return {
    tick,
    nodes,
    flight: [...stillFlying, ...launched],
    ledger,
    substeps: acomodado.substeps,
  };
}
```

Ajuste os imports do topo de `scheduler.ts` para incluir:

```ts
import { settle } from "./settle.js";
import { resolveSignalTargets, resolveTarget } from "./wiring.js";
import type { Emission, StepContext, TickPhase, WireTiming } from "./model.js";
```

E `initialWorld` passa a devolver `substeps: 0`:

```ts
  return { tick: 0, nodes, flight: [], ledger: {}, substeps: 0 };
```

- [ ] **Step 6: rode a suíte inteira**

Run: `pnpm vitest run packages/depth-core`
Esperado: os testes de `settle.test.ts` passam **e** os 242 anteriores continuam passando —
mundo sem aresta `settle` não muda de comportamento, que é o ponto do padrão `clocked`.

Se algum teste antigo quebrar por causa do formato do id da mensagem (que agora carrega `s` ou
`c`), **não afrouxe a asserção**: o formato mudou de propósito, e o teste deve ser atualizado
para a forma nova mantendo o que ele de fato prova (ids não se repetem, replay reproduz os
mesmos ids).

- [ ] **Step 7: Commit**

```bash
git add packages/depth-core/src
git commit -m "feat(depth-core): o tick ganha duas fases

Acomodacao propaga dentro do proprio tick, percorrendo o subgrafo acomodado em
ordem topologica; confronto e o que stepWorld sempre fez. O padrao da aresta e
clocked, entao nenhum mundo que ja existe muda de comportamento.

O que separa as duas fases e estrutural, nao disciplina: o state devolvido na
acomodacao nem chega a ser lido, do mesmo jeito que logica combinacional nao
guarda. E emitir numa porta cujo regime nao e o da fase corrente e erro alto,
com a mensagem dizendo em que fase aquela porta espera ser usada — o silencio
ali seria uma mensagem chegando tarde demais sem ninguem perceber.

O id da mensagem passa a carregar a fase: sem isso, a mesma folha emitindo nas
duas fases do mesmo tick geraria dois ids iguais e o replay deixaria de ser
exato."
```

---

## Task 6: sinal de controle muda a decisão, e é contado à parte

**Files:**
- Create: `packages/depth-core/src/control.test-fixture.ts`
- Test: `packages/depth-core/src/control.test.ts`

- [ ] **Step 1: escreva a fixture**

```ts
// packages/depth-core/src/control.test-fixture.ts
//
// Um seletor que só deixa a carga passar quando recebe sinal, e um controlador
// que decide se manda o sinal. É a forma mínima de "controle manda em quem está
// no caminho, sem estar nele".
import type { ObjectSpec, WorldSpec } from "./model.js";

/** Manda sinal quando o parâmetro `abrir` é 1. Nunca toca em carga. */
export const controle: ObjectSpec = {
  id: "ctrl",
  kind: "router",
  label: "ctrl",
  leaf: true,
  behavior: (state, _inbox, ctx) => {
    if (ctx.phase !== "commit" || ctx.params.abrir !== 1) return { state, out: [] };
    return { state, out: [{ port: "sel", message: ctx.emit("sinal") }] };
  },
};

export const fonte: ObjectSpec = {
  id: "fonte",
  kind: "source",
  label: "fonte",
  leaf: true,
  behavior: (state, _inbox, ctx) =>
    ctx.phase === "commit"
      ? { state, out: [{ port: "out", message: ctx.emit("carga") }] }
      : { state, out: [] },
};

/** Deixa passar só o que chega quando há sinal na porta "sel". */
export const seletor: ObjectSpec = {
  id: "sel",
  kind: "router",
  label: "sel",
  leaf: true,
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit") return { state, out: [] };
    const aberto = (ctx.signals.sel ?? []).length > 0;
    return { state, out: aberto ? inbox.map((m) => ({ port: "out", message: m })) : [] };
  },
};

export const destino: ObjectSpec = {
  id: "dst",
  kind: "sink",
  label: "dst",
  leaf: true,
  init: () => ({ got: 0 }),
  behavior: (state, inbox, ctx) =>
    ctx.phase === "commit"
      ? { state: { got: (state as { got: number }).got + inbox.length }, out: [] }
      : { state, out: [] },
};

export const spec: WorldSpec = {
  id: "c",
  seed: 1,
  edgeTicks: 1,
  root: {
    id: "root",
    kind: "composite",
    label: "root",
    children: [controle, fonte, seletor, destino],
  },
  wires: [
    { from: "fonte", port: "out", to: "sel" },
    { from: "sel", port: "out", to: "dst" },
    { from: "ctrl", port: "sel", to: "sel", line: "control", toPort: "sel" },
  ],
  params: { abrir: 1 },
};
```

- [ ] **Step 2: escreva os testes**

```ts
// packages/depth-core/src/control.test.ts
import { describe, expect, it } from "vitest";
import { inCount, portCount, portWeight } from "./meters.js";
import { initialWorld, stepWorld } from "./scheduler.js";
import { spec } from "./control.test-fixture.js";
import { indexTree } from "./tree.js";

const tree = indexTree(spec.root);

function rodar(ticks: number, params: Readonly<Record<string, number>> = spec.params) {
  let estado = initialWorld(tree);
  for (let i = 0; i < ticks; i += 1) estado = stepWorld(spec, tree, estado, params);
  return estado;
}

describe("linha de controle", () => {
  it("com sinal, a carga passa; sem sinal, não passa", () => {
    expect((rodar(6).nodes.dst as { got: number }).got).toBeGreaterThan(0);
    expect((rodar(6, { abrir: 0 }).nodes.dst as { got: number }).got).toBe(0);
  });

  it("sinal é contado em eixo próprio, e nunca soma com carga", () => {
    const estado = rodar(6);
    expect(estado.ledger["sigin:sel.sel"]).toBeGreaterThan(0);
    // O eixo "in:" é só de carga. Se o sinal vazasse para lá, a pergunta
    // "quanto dado passou por aqui?" deixaria de ter resposta.
    expect(estado.ledger["in:sel"]).toBe(estado.ledger["out:fonte.out"]);
  });

  it("o medidor de porta não enxerga sinal: ele lê só os eixos de carga", () => {
    // Estrutural, não disciplina: `portCount` lê "out:" e `inCount` lê "in:", e
    // sinal não escreve em nenhum dos dois.
    const estado = rodar(6);
    expect(portCount(estado, "ctrl", "sel")).toBeGreaterThan(0);
    expect(inCount(estado, "sel")).toBeGreaterThan(0);
    expect(portWeight(estado, "ctrl", "sel")).toBeGreaterThan(0);
    // O que importa é que a CHEGADA do sinal não conta como carga chegando.
    expect(estado.ledger["in:sel"]).not.toBe(
      (estado.ledger["in:sel"] ?? 0) + (estado.ledger["sigin:sel.sel"] ?? 0),
    );
  });

  it("sinal em voo é distinguível de carga em voo", () => {
    // Um item de sinal tem signalPort; a carga não. A vista agregada é sobre
    // carga, e controle é uma camada visual própria.
    for (const item of rodar(3).flight.filter((f) => f.signalPort !== undefined)) {
      expect(item.to).toBe("sel");
      expect(item.signalPort).toBe("sel");
    }
  });

  it("porta que só tem linha de controle não conta como fio esquecido", () => {
    // `.unwired` existe para acusar buraco de autoria. Ali não há buraco: a
    // porta entregou, por outro caminho.
    expect(rodar(6).ledger["out:ctrl.sel.unwired"]).toBeUndefined();
  });
});
```

- [ ] **Step 3: rode**

Run: `pnpm vitest run packages/depth-core/src/control.test.ts`
Esperado: todos verdes. A Task 5 já implementou o caminho de sinal; se algum falhar, o defeito
está lá — em particular o último, que depende de `alvosDeSinal.length === 0` guardar o `bump`
de `.unwired`.

- [ ] **Step 4: Commit**

```bash
git add packages/depth-core/src/control.test-fixture.ts packages/depth-core/src/control.test.ts
git commit -m "test(depth-core): sinal muda a decisao e nunca conta como carga

O eixo sigin: e separado de in:/out: nao por organizacao, mas porque o medidor de
porta le so os eixos de carga — entao ele nao CONSEGUE enxergar a chegada de um
sinal, e a pergunta 'quanto dado passou aqui?' continua tendo resposta. E porta
que so tem linha de controle nao conta como fio esquecido: .unwired existe para
acusar buraco de autoria, e ali nao ha buraco."
```

---

## Task 7: as propriedades — a ordem não influi, e o caminho longo é que manda

**Files:**
- Test: `packages/depth-core/src/settle.property.test.ts`

- [ ] **Step 1: escreva os property tests**

```ts
// packages/depth-core/src/settle.property.test.ts
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Wire, WorldState } from "./model.js";
import { initialWorld, stepWorld } from "./scheduler.js";
import { settleOrder } from "./settle-graph.js";
import { spec } from "./settle.test-fixture.js";
import { indexTree } from "./tree.js";

const tree = indexTree(spec.root);

function rodar(wires: readonly Wire[]): WorldState {
  const mundo = { ...spec, wires };
  let estado = initialWorld(tree);
  for (let i = 0; i < 6; i += 1) estado = stepWorld(mundo, tree, estado, mundo.params);
  return estado;
}

describe("propriedades da acomodação", () => {
  it("a ordem em que os fios são declarados não muda o resultado", () => {
    // Se mudasse, dois mundos idênticos com os fios escritos em ordem diferente
    // produziriam runs diferentes — e o modelo passaria a depender de como o
    // autor digitou, que é a definição de resultado não confiável.
    const esperado = rodar(spec.wires);

    fc.assert(
      fc.property(
        fc.shuffledSubarray([...spec.wires], { minLength: spec.wires.length }),
        (wires) => {
          const obtido = rodar(wires);
          expect(obtido.nodes).toEqual(esperado.nodes);
          expect(obtido.ledger).toEqual(esperado.ledger);
          expect(obtido.substeps).toEqual(esperado.substeps);
        },
      ),
    );
  });

  it("a ordem topológica é sempre válida: ninguém aparece antes de quem o alimenta", () => {
    const arbFios = fc
      .array(fc.tuple(fc.integer({ min: 0, max: 5 }), fc.integer({ min: 0, max: 5 })), {
        maxLength: 12,
      })
      // Só arestas de menor para maior: garante DAG por construção, que é o
      // pré-requisito que `validateWorld` impõe ao mundo de verdade.
      .map((pares) =>
        pares
          .filter(([a, b]) => a < b)
          .map(([a, b]): Wire => ({ from: `n${a}`, port: "out", to: `n${b}`, timing: "settle" })),
      );

    fc.assert(
      fc.property(arbFios, (wires) => {
        const posicao = new Map(settleOrder(wires).map((n, i) => [n.id, i]));
        for (const wire of wires) {
          const de = posicao.get(wire.from);
          const para = posicao.get(wire.to as string);
          if (de === undefined || para === undefined) continue;
          expect(de).toBeLessThan(para);
        }
      }),
    );
  });

  it("a profundidade é o caminho mais longo, nunca o mais curto", () => {
    const wires: Wire[] = [
      { from: "a", port: "out", to: "b", timing: "settle" },
      { from: "b", port: "out", to: "c", timing: "settle" },
      { from: "c", port: "out", to: "d", timing: "settle" },
      { from: "a", port: "out2", to: "d", timing: "settle" },
    ];
    const profundidade = new Map(settleOrder(wires).map((n) => [n.id, n.depth]));
    // Há um atalho a -> d, mas "d" só está pronto quando o caminho longo chega.
    expect(profundidade.get("d")).toBe(3);
  });

  it("ids de mensagem não se repetem, com as duas fases emitindo no mesmo tick", () => {
    let estado = initialWorld(tree);
    const vistos: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      estado = stepWorld(spec, tree, estado, spec.params);
      for (const item of estado.flight) vistos.push(item.message.id);
    }
    expect(vistos.length).toBeGreaterThan(0);
    expect(new Set(vistos).size).toBe(new Set(vistos).size);
  });
});
```

- [ ] **Step 2: rode**

Run: `pnpm vitest run packages/depth-core/src/settle.property.test.ts`
Esperado: todos verdes.

- [ ] **Step 3: verifique por mutação que a primeira propriedade tem dente**

Em `settle.ts`, troque `for (const { id, depth } of ordem)` por
`for (const { id, depth } of [...ordem].reverse())`.

Run: `pnpm test`
Esperado: **falha**. Percorrer o DAG ao contrário quebra a propagação. Desfaça a mutação.

Se não falhar, a fixture não tem cadeia combinacional de verdade e a propriedade não está
provando nada. Pare e conserte a fixture antes de seguir.

- [ ] **Step 4: Commit**

```bash
git add packages/depth-core/src/settle.property.test.ts
git commit -m "test(depth-core): a ordem nao influi, e o caminho longo e que manda

Se a ordem em que os fios foram declarados mudasse o resultado, o modelo passaria
a depender de como o autor digitou. E a profundidade tem que ser o caminho mais
longo e nao o mais curto: um no so esta pronto quando o mais lento dos caminhos
que o alimentam chegou, que e o que atraso de propagacao significa. Verificado
por mutacao."
```

---

## Task 8: superfície pública, e a guarda passa a vigiar dois domínios

**Files:**
- Modify: `packages/depth-core/src/index.ts`
- Modify: `scripts/check-boundaries.mjs`
- Test: `scripts/check-boundaries.test.mjs`
- Modify: `docs/PROGRESS.md`

- [ ] **Step 1: exporte o que é público**

Em `packages/depth-core/src/index.ts`, acrescente:

```ts
export { findCombinationalCycle, settleOrder } from "./settle-graph.js";
export type { SettleNode } from "./settle-graph.js";
export { resolveSignalTargets } from "./wiring.js";
export type { SignalTarget } from "./wiring.js";
```

e, na lista de tipos de `./model.js`, acrescente `TickPhase` e `WireTiming`.

`settle.ts` **não** é exportado: quem consome o motor usa `World` e `stepWorld`, e a fase de
acomodação é mecanismo interno. Exportá-la convidaria alguém a rodar meia fase.

- [ ] **Step 2: escreva o teste da guarda que falha**

Em `scripts/check-boundaries.test.mjs`, acrescente:

```js
test("acusa vocabulário de CPU dentro do motor", () => {
  const achados = findViolations(
    "packages/depth-core/src/x.ts",
    "// o registrador guarda o valor\n",
  );
  assert.equal(achados.length, 1);
});

test("não acusa palavra de domínio em pacote de domínio", () => {
  assert.equal(
    findViolations("packages/cpu-domain/src/x.ts", "const registrador = 1;\n").length,
    0,
  );
});
```

- [ ] **Step 3: rode e confirme que o primeiro falha**

Run: `node --test scripts/check-boundaries.test.mjs`
Esperado: falha — hoje a guarda não conhece essas palavras.

- [ ] **Step 4: acrescente a segunda lista**

Em `scripts/check-boundaries.mjs`, junto da lista de termos que já existe, acrescente os
termos de CPU **ao mesmo mecanismo de busca** (não crie um segundo caminho de código):

```js
// Duas listas, um mecanismo. O motor existe para servir mais de um domínio, e
// agora há dois provando isso — deixar só a primeira lista faria a fronteira
// valer contra um domínio e não contra o outro.
const CPU = [
  "registrador",
  "register file",
  "opcode",
  "riscv",
  "risc-v",
  "assembly",
  "transistor",
  "instruction set",
];
```

Cuidado com falso positivo: `register` sozinho aparece em `registerX` de bibliotecas — por
isso a lista traz `register file` e não `register`.

- [ ] **Step 5: rode tudo**

```bash
node --test scripts/check-boundaries.test.mjs
pnpm boundaries; echo "boundaries=$?"
pnpm typecheck;  echo "typecheck=$?"
pnpm test;       echo "test=$?"
```
Esperado: todos zero.

Se `pnpm boundaries` acusar algo no motor, **leia o achado antes de silenciar**: pode ser um
comentário que de fato usa a palavra, e nesse caso o comentário é que muda.

- [ ] **Step 6: atualize `docs/PROGRESS.md`**

Acrescente, na seção da Entrega 2, um bloco com estes fatos:

- as duas fases do tick e a semântica da linha de controle estão em código;
- o padrão da aresta é `clocked`, então nenhum mundo anterior mudou de comportamento;
- a acomodação percorre um DAG em ordem topológica **porque** o laço combinacional é recusado
  na construção — some a iteração e some o teto de rodadas;
- a profundidade topológica é o atraso de propagação, e vira `WorldState.substeps`, que a tela
  mostrará como subpassos dentro do tick (trabalho do Bloco 3);
- o eixo `sigin:` é separado de `in:`/`out:` porque o medidor de porta lê só os eixos de carga
  e portanto **não consegue** enxergar sinal;
- a guarda de fronteira passou a vigiar dois domínios.

Cite o SHA do commit da Task 5.

- [ ] **Step 7: Commit**

```bash
git add packages/depth-core/src/index.ts scripts/check-boundaries.mjs \
        scripts/check-boundaries.test.mjs docs/PROGRESS.md
git commit -m "feat: superficie publica das fases, e a guarda vigia dois dominios

O motor existe para servir mais de um dominio, e agora ha dois provando isso.
Deixar so a lista de OpenTelemetry faria a fronteira valer contra um dominio e
nao contra o outro.

settle.ts nao e exportado: a fase de acomodacao e mecanismo interno, e expo-la
convidaria alguem a rodar meia fase."
```

---

## Fora do escopo deste plano

- **Fan-out de dado**, multiplicidade (`×N`, `/N`) e atalho com equivalência provada — são o
  Bloco 2 da §11 da spec, e mexem noutra parte do contrato.
- **Mostrar os subpassos na tela.** `WorldState.substeps` passa a existir e a ser contado;
  desenhar a acomodação como subpassos é trabalho de `depth-ui`, no Bloco 3.
- **Qualquer coisa de CPU.** Nenhum arquivo deste plano menciona registrador, ULA ou
  instrução — e a Task 8 põe uma guarda para que continue assim.
