import { describe, expect, it } from "vitest";
import { montarMicro } from "./assembler.js";
import { bytesDe } from "./assembler.test-helper.js";

const erros = (fonte: string): readonly string[] => {
  const r = montarMicro(fonte);
  if (r.ok) throw new Error("esperava erro e o montador aceitou");
  return r.errors.map((e) => e.message);
};

describe("o montador do genérico", () => {
  it("monta o programa do slide 16, byte por byte", () => {
    expect([...bytesDe(`
      LOAD  0A
      ADD   05
      ADD   12
      STORE 2000
    `)]).toEqual([0x86, 0x0a, 0x8b, 0x05, 0x8b, 0x12, 0xb7, 0x20, 0x00]);
  });

  it("quebra o endereço em parte alta e parte baixa, nessa ordem", () => {
    expect([...bytesDe("JMP 1234")]).toEqual([0xc3, 0x12, 0x34]);
  });

  it("ignora comentário depois de ; e linha em branco", () => {
    expect([...bytesDe("; nada\n\nLOAD 01 ; carrega\n")]).toEqual([0x86, 0x01]);
  });

  it("recusa valor que não cabe em um byte, dizendo o que fazer", () => {
    expect(erros("LOAD 100").join(" ")).toMatch(/um byte/);
  });

  it("recusa endereço que não cabe em dois bytes", () => {
    expect(erros("JMP 10000").join(" ")).toMatch(/dois bytes/);
  });

  it("recusa mnemônico que não existe, listando os que existem", () => {
    expect(erros("MOV 01").join(" ")).toMatch(/LOAD/);
  });

  it("o erro diz a linha, porque quem escreve o programa é o leitor do lab", () => {
    const r = montarMicro("LOAD 01\nMOV 02");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.linha).toBe(2);
  });

  it("junta os erros em vez de parar no primeiro", () => {
    expect(erros("MOV 01\nXYZ 02")).toHaveLength(2);
  });
});
