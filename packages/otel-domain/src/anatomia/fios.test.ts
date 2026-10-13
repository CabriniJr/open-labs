// packages/otel-domain/src/anatomia/fios.test.ts
//
// A outra metade do buraco que `sem-perda.test.ts` cobre.
//
// Lá: uma emissão que sai por porta sem fio — o comportamento fala e ninguém
// ouve. Aqui: um fio que sai de porta onde nada é emitido — o desenho mostra
// uma ligação que não existe. No typo de uma letra as duas acontecem juntas, e
// a primeira guarda basta; separadas, não. Acrescentar ao mmd uma aresta
// `gateway -- "metrics:foo" --> backend`, com nenhum comportamento emitindo por
// `metrics`, não perde emissão nenhuma: perde só a verdade do desenho.
//
// Para um material visual é a pior das duas. O leitor não tem como saber que
// aquela linha nunca carregou nada, e o desenho é o argumento.
//
// POR QUE ISTO É LOCAL, E NÃO UM MEDIDOR DO MOTOR: `portCount` lê
// `out:<nó>.<porta>` do livro-caixa, e a chave de um fio que sai de COMPOSTO
// pertence às folhas de dentro dele, não ao composto. Medido: na CPU, 67 dos
// 68 fios que esta conta chamaria de mortos saem de composto e carregam carga
// normalmente. Quem resolve a cadeia de bornes é `emissoesPorPorta`, por tick.
// A `anatomia` escapa disso porque o único composto dela é a raiz `sistema`, e
// nenhum fio sai dela — todos os oito saem de folha, e aí a conta é exata.
import { describe, expect, it } from "vitest";
import { World, indexTree, portCount } from "@ovh/depth-core";
import { parseSkeleton } from "@ovh/mermaid-skeleton";
import ANATOMY_MMD from "./anatomy.mmd?raw";
import { anatomiaWorld } from "./world.js";

describe("todo fio do anatomy.mmd carrega alguma coisa", () => {
  it("o único composto é a raiz, e nenhum fio sai dela — a conta vale", () => {
    // A premissa da guarda, cobrada e não suposta: no dia em que a anatomia
    // ganhar um subgraph, este teste cai primeiro e diz por quê.
    const spec = anatomiaWorld();
    const tree = indexTree(spec.root);
    const compostos = [...tree.byId.values()]
      .filter((n) => n.leaf !== true && (n.children?.length ?? 0) > 0)
      .map((n) => n.id);
    expect(compostos).toEqual(["sistema"]);
    expect(spec.wires.filter((w) => w.from === "sistema")).toEqual([]);
  });

  it("no caminho feliz, nenhuma aresta do desenho fica sem tráfego", () => {
    const spec = anatomiaWorld();
    const world = new World(spec);
    world.advance(20);
    const mudos = spec.wires
      .filter((w) => (w.line ?? "data") === "data")
      .filter((w) => portCount(world.state, w.from, w.port) === 0)
      .map((w) => `${w.from}.${w.port} -> ${String(w.to)}`);
    expect(mudos, `\nfio sem tráfego nenhum:\n  ${mudos.join("\n  ")}`).toEqual([]);
  });

  it("são as oito arestas do mmd, e não um subconjunto que por acaso passa", () => {
    // Sem isto a guarda acima passaria com a lista vazia se alguém quebrasse o
    // parser: zero fio é zero fio sem tráfego.
    const spec = anatomiaWorld();
    expect(spec.wires.filter((w) => (w.line ?? "data") === "data")).toHaveLength(8);
  });
});

describe("e carrega o que o rótulo diz que carrega", () => {
  /*
    A terceira perna, e a mais silenciosa das três.

    O parser lê o rótulo `call:request` como porta `call` e kind de mensagem
    `request` — e guarda os dois no `SkeletonEdge`. O compilador usa a porta e
    **descarta o kind**: `WorldSpec.wires` não tem campo para ele, e quem decide
    o kind do que viaja é `ctx.emit(kind, …)`, lá no comportamento.

    Então o mmd pode dizer `call:request` enquanto o comportamento emite
    `ctx.emit("pedido")`, e nada acusa. Não perde emissão — o fio existe e
    carrega. Não há fio morto — ele tem tráfego. O que se perde é só o que o
    rótulo promete, e a §3 do design é explícita em dizer que esse rótulo **é**
    o kind da mensagem no vocabulário do domínio.

    Num material em que o desenho é o argumento, um canal rotulado com o kind
    errado é a mentira mais barata de cometer e a mais difícil de ver: o lab
    roda, ensina a topologia certa, e nomeia errado o que passa por ela.

    Vale a mesma ressalva de escopo das guardas acima: `item.from`/`item.port`
    são do emissor real, então isto é exato porque todo nó da anatomia é folha.
  */
  const declaradoNoMmd = (): ReadonlyMap<string, string> => {
    const parsed = parseSkeleton(ANATOMY_MMD);
    if (!parsed.ok) throw new Error(`anatomy.mmd inválido: ${parsed.errors.join(" | ")}`);
    const porCanal = new Map<string, string>();
    for (const e of parsed.value.edges) {
      if (e.messageKind === null) continue;
      porCanal.set(`${e.from}.${e.fromPort ?? "out"}`, e.messageKind);
    }
    return porCanal;
  };

  /** Os kinds que de fato saíram de cada porta, acumulados tick a tick. */
  const kindsQueViajaram = (ticks: number): ReadonlyMap<string, ReadonlySet<string>> => {
    const world = new World(anatomiaWorld());
    const porCanal = new Map<string, Set<string>>();
    for (let i = 0; i < ticks; i += 1) {
      world.advance(1);
      for (const item of world.state.flight) {
        const canal = `${item.from}.${item.port}`;
        const vistos = porCanal.get(canal) ?? new Set<string>();
        vistos.add(item.message.kind);
        porCanal.set(canal, vistos);
      }
    }
    return porCanal;
  };

  it("cada canal carrega exatamente o kind que o rótulo declara", () => {
    const declarado = declaradoNoMmd();
    const real = kindsQueViajaram(20);
    const divergem: string[] = [];
    for (const [canal, kind] of declarado) {
      const vistos = [...(real.get(canal) ?? [])].sort();
      if (vistos.length === 0) continue; // fio mudo é problema do teste acima
      if (vistos.length !== 1 || vistos[0] !== kind) {
        divergem.push(`${canal}: rótulo diz "${kind}", viajou ${JSON.stringify(vistos)}`);
      }
    }
    expect(divergem, `\n${divergem.join("\n")}`).toEqual([]);
  });

  it("os oito canais têm kind declarado — nenhum fio anônimo", () => {
    // Um canal sem rótulo não mente, mas também não ensina: o leitor vê uma
    // linha e não sabe o que passa nela.
    expect(declaradoNoMmd().size).toBe(8);
  });
});
