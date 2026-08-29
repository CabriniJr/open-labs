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
