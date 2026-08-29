import { describe, expect, it } from "vitest";
import { World } from "@ovh/depth-core";
import { assemble } from "./assembler.js";
import { cpuWorld } from "./datapath.js";
import type { EstadoBanco } from "./datapath.js";

const imagem = (fonte: string): readonly number[] => {
  const r = assemble(fonte);
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join(" | "));
  return r.image.words;
};

const PROGRAMA = `
  addi t0, x0, 20
  addi t1, x0, 22
  add  t2, t0, t1
`;

describe("o caminho de dados como mundo do motor", () => {
  it("passa pela validação do motor: nenhum laço combinacional, nenhum fio solto", () => {
    // O laço pc -> imem -> ... -> pc existe, e só é legal porque volta por
    // aresta de relógio. Se alguém trocasse essa aresta para acomodada, o
    // motor recusaria o mundo aqui, na construção — que é o ponto.
    expect(() => new World(cpuWorld(imagem(PROGRAMA)))).not.toThrow();
  });

  it("uma instrução por tick, e o resultado aparece no banco", () => {
    const mundo = new World(cpuWorld(imagem(PROGRAMA)));
    mundo.advance(6);
    const banco = mundo.state.nodes.banco as EstadoBanco;
    expect(banco.regs[7]).toBe(42);
  });

  it("a acomodação atravessa o caminho inteiro dentro de um tick", () => {
    // `substeps` é a profundidade do caminho combinacional. Um valor de 1
    // significaria que a busca e a ULA caíram em ticks diferentes — ou seja,
    // que isto não é um ciclo único.
    const mundo = new World(cpuWorld(imagem(PROGRAMA)));
    mundo.advance(4);
    expect(mundo.state.substeps).toBeGreaterThanOrEqual(6);
  });

  it("as linhas de controle são contadas em eixo próprio, e não como carga", () => {
    const mundo = new World(cpuWorld(imagem(PROGRAMA)));
    mundo.advance(5);
    const ledger = mundo.state.ledger;
    expect(ledger["sigin:ula.op"]).toBeGreaterThan(0);
    expect(ledger["sigin:mux-operando.selb"]).toBeGreaterThan(0);
    // A ULA recebe uma carga por instrução, e o sinal não entra nessa conta.
    expect(ledger["in:ula"]).toBe(ledger["out:mux-operando.out"]);
  });

  it("a saída da ULA alimenta dois destinos pelo leque nativo da porta", () => {
    const mundo = new World(cpuWorld(imagem(PROGRAMA)));
    mundo.advance(5);
    const ledger = mundo.state.ledger;
    const emitiu = ledger["out:ula.out"] ?? 0;
    expect(emitiu).toBeGreaterThan(0);
    // uma emissão, dois destinos: é a divergência que mede o espalhamento
    expect(ledger["in:memoria"]).toBe(emitiu);
    expect(ledger["in:desvio"]).toBe(emitiu);
  });
});
