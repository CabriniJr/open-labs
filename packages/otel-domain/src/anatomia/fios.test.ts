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
