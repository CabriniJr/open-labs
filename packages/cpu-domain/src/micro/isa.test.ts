import { describe, expect, it } from "vitest";
import { FORMATO, OPCODES, decodificar, tamanhoEmBytes } from "./isa.js";
import type { Mnemonico } from "./isa.js";

describe("a tabela de opcodes", () => {
  it("traz os três códigos do deck, com o significado do deck", () => {
    expect(OPCODES.load).toBe(0x86);
    expect(OPCODES.add).toBe(0x8b);
    expect(OPCODES.store).toBe(0xb7);
  });

  it("nenhum código se repete — dois mnemônicos no mesmo byte é execução errada calada", () => {
    const codigos = Object.values(OPCODES);
    expect(new Set(codigos).size).toBe(codigos.length);
  });

  it("todo mnemônico tem formato, e só existem os dois formatos do slide 15", () => {
    for (const m of Object.keys(OPCODES) as Mnemonico[]) {
      expect([1, 2]).toContain(FORMATO[m]);
    }
  });

  it("formato 1 ocupa 2 bytes e formato 2 ocupa 3", () => {
    expect(tamanhoEmBytes("load")).toBe(2);
    expect(tamanhoEmBytes("store")).toBe(3);
  });

  it("decodificar é a volta de OPCODES", () => {
    for (const [m, byte] of Object.entries(OPCODES)) {
      expect(decodificar(byte)).toBe(m);
    }
  });

  it("byte que não é instrução decodifica como indefinido, e não como a primeira da tabela", () => {
    expect(decodificar(0x00)).toBeUndefined();
  });
});
