import { describe, expect, it } from "vitest";
import { World, indexTree } from "@ovh/depth-core";
import type { WorldSpec, WorldState } from "@ovh/depth-core";
import { bytesDe } from "./assembler.test-helper.js";
import { estadoDe, microWorld } from "./datapath.js";

const rodar = (spec: WorldSpec, ticks: number): readonly WorldState[] => {
  const mundo = new World(spec);
  const estados: WorldState[] = [mundo.state];
  for (let i = 0; i < ticks; i += 1) {
    mundo.advance(1);
    estados.push(mundo.state);
  }
  return estados;
};

const PROGRAMA_DO_SLIDE_16 = `
  LOAD  0A
  ADD   05
  ADD   12
  STORE 2000
`;

describe("o mundo do genérico", () => {
  it("é um mundo válido — o construtor do World é quem valida", () => {
    expect(() => new World(microWorld(bytesDe(PROGRAMA_DO_SLIDE_16)))).not.toThrow();
  });

  it("a unidade de controle é um sequencer e não emite nenhuma aresta de dado", () => {
    const mundo = microWorld(bytesDe(PROGRAMA_DO_SLIDE_16));
    expect(indexTree(mundo.root).byId.get("uc")?.kind).toBe("sequencer");
    for (const w of mundo.wires) {
      if (w.from === "uc") expect(w.line).toBe("control");
    }
  });

  it("o ponteiro de pilha existe e nenhuma instrução o move — como no deck", () => {
    const mundo = microWorld(bytesDe(PROGRAMA_DO_SLIDE_16));
    expect(indexTree(mundo.root).byId.get("sp")).toBeDefined();
    const estados = rodar(mundo, 40).map((s) => estadoDe(s).sp);
    expect(new Set(estados).size).toBe(1);
  });

  it("roda o programa do slide 16 e guarda 21h em 2000h", () => {
    const mundo = microWorld(bytesDe(PROGRAMA_DO_SLIDE_16));
    const fim = rodar(mundo, 40).at(-1);
    const e = estadoDe(fim!);
    expect(e.ac).toBe(0x21);
    expect(e.memoria.get(0x2000)).toBe(0x21);
  });

  it("uma instrução leva mais de um tick — é o que multiciclo quer dizer", () => {
    const estados = rodar(microWorld(bytesDe("LOAD 0A")), 10);
    const primeiroComAc = estados.findIndex((s) => estadoDe(s).ac === 0x0a);
    expect(primeiroComAc).toBeGreaterThan(1);
  });

  it("a máquina para quando o byte não é instrução, em vez de executar lixo", () => {
    const estados = rodar(microWorld(bytesDe("LOAD 0A")), 60);
    const pcs = estados.slice(-10).map((s) => estadoDe(s).pc);
    expect(new Set(pcs).size).toBe(1);
  });
});
