import { describe, expect, it } from "vitest";
import { decode, encode, FORMAS } from "./isa.js";
import type { Format, Instruction, Mnemonic } from "./isa.js";

/**
 * A codificação, contra a especificação — e não contra nós mesmos.
 *
 * O diferencial confere o modelo contra o intérprete de referência, e os dois
 * compartilham `isa.ts`. Isso prova **execução**: dado um `add`, os dois somam
 * igual. Não prova **codificação**: se o opcode do `add` estivesse errado, os
 * dois estariam errados juntos, concordando o tempo todo, e o programa montado
 * aqui não rodaria em nenhum RISC-V do mundo.
 *
 * Estes números vieram do layout de campos do RV32I, escritos à mão a partir da
 * especificação, e cada linha traz a conta para quem quiser conferir sem rodar
 * nada. É a única coisa nesta pasta que não sai do nosso próprio código.
 */

interface Caso {
  readonly hex: number;
  readonly asm: string;
  readonly instr: Instruction;
}

const i = (
  mnemonic: Mnemonic,
  rd: number,
  rs1: number,
  rs2: number,
  imm: number,
): Instruction => ({ mnemonic, rd, rs1, rs2, imm });

/**
 * R: funct7[31:25] rs2[24:20] rs1[19:15] funct3[14:12] rd[11:7] opcode 0110011
 * Todas com rd=x1, rs1=x2, rs2=x3, então a base é 0x003100B3 e o que muda é
 * funct3 (bits 14:12) e funct7 (bit 30, para sub e sra).
 */
const R: readonly Caso[] = [
  { hex: 0x003100b3, asm: "add  x1, x2, x3", instr: i("add", 1, 2, 3, 0) },
  { hex: 0x403100b3, asm: "sub  x1, x2, x3", instr: i("sub", 1, 2, 3, 0) },
  { hex: 0x003110b3, asm: "sll  x1, x2, x3", instr: i("sll", 1, 2, 3, 0) },
  { hex: 0x003120b3, asm: "slt  x1, x2, x3", instr: i("slt", 1, 2, 3, 0) },
  { hex: 0x003140b3, asm: "xor  x1, x2, x3", instr: i("xor", 1, 2, 3, 0) },
  { hex: 0x003150b3, asm: "srl  x1, x2, x3", instr: i("srl", 1, 2, 3, 0) },
  { hex: 0x403150b3, asm: "sra  x1, x2, x3", instr: i("sra", 1, 2, 3, 0) },
  { hex: 0x003160b3, asm: "or   x1, x2, x3", instr: i("or", 1, 2, 3, 0) },
  { hex: 0x003170b3, asm: "and  x1, x2, x3", instr: i("and", 1, 2, 3, 0) },
];

/**
 * I: imm[31:20] rs1[19:15] funct3[14:12] rd[11:7] opcode 0010011.
 * Os deslocamentos por imediato guardam o shamt em imm[4:0] e funct7 em cima,
 * que é o único lugar onde `srli` e `srai` se separam.
 */
const I: readonly Caso[] = [
  { hex: 0x00510093, asm: "addi x1, x2, 5", instr: i("addi", 1, 2, 0, 5) },
  { hex: 0x00512093, asm: "slti x1, x2, 5", instr: i("slti", 1, 2, 0, 5) },
  { hex: 0x00514093, asm: "xori x1, x2, 5", instr: i("xori", 1, 2, 0, 5) },
  { hex: 0x00516093, asm: "ori  x1, x2, 5", instr: i("ori", 1, 2, 0, 5) },
  { hex: 0x00517093, asm: "andi x1, x2, 5", instr: i("andi", 1, 2, 0, 5) },
  { hex: 0x00511093, asm: "slli x1, x2, 5", instr: i("slli", 1, 2, 0, 5) },
  { hex: 0x00515093, asm: "srli x1, x2, 5", instr: i("srli", 1, 2, 0, 5) },
  // srai: imm = (0100000 << 5) | 5 = 0x405, e 0x405 << 20 = 0x40500000
  { hex: 0x40515093, asm: "srai x1, x2, 5", instr: i("srai", 1, 2, 0, 5) },
];

/** Memória e saltos, cada família com o seu embaralhado de imediato. */
const RESTO: readonly Caso[] = [
  // lw: I-type, opcode 0000011, funct3 010
  { hex: 0x00812083, asm: "lw x1, 8(x2)", instr: i("lw", 1, 2, 0, 8) },
  // sw: S-type, imm quebrado em [11:5] e [4:0] — 8 vira 0000000 e 01000
  { hex: 0x00112423, asm: "sw x1, 8(x2)", instr: i("sw", 0, 2, 1, 8) },
  // B-type: imm[12|10:5] em cima, imm[4:1|11] embaixo. 8 põe imm[4:1]=0100
  { hex: 0x00208463, asm: "beq x1, x2, +8", instr: i("beq", 0, 1, 2, 8) },
  { hex: 0x00209463, asm: "bne x1, x2, +8", instr: i("bne", 0, 1, 2, 8) },
  { hex: 0x0020c463, asm: "blt x1, x2, +8", instr: i("blt", 0, 1, 2, 8) },
  { hex: 0x0020d463, asm: "bge x1, x2, +8", instr: i("bge", 0, 1, 2, 8) },
  // U-type: o imediato ocupa os vinte bits de cima, sem deslocar nada
  { hex: 0x123450b7, asm: "lui   x1, 0x12345", instr: i("lui", 1, 0, 0, 0x12345) },
  { hex: 0x12345097, asm: "auipc x1, 0x12345", instr: i("auipc", 1, 0, 0, 0x12345) },
  // J-type: imm[20|10:1|11|19:12]. 8 põe imm[10:1]=4, que vai para os bits 30:21
  { hex: 0x008000ef, asm: "jal  x1, +8", instr: i("jal", 1, 0, 0, 8) },
  { hex: 0x008100e7, asm: "jalr x1, 8(x2)", instr: i("jalr", 1, 2, 0, 8) },
];

const TODOS = [...R, ...I, ...RESTO];

describe("a codificação bate com a especificação do RV32I", () => {
  it.each(TODOS.map((c) => [c.asm, c] as const))(
    "%s tem a palavra que a spec manda",
    (_asm, caso) => {
      expect(encode(caso.instr) >>> 0).toBe(caso.hex >>> 0);
    },
  );

  /**
   * Quais campos cada formato de fato usa.
   *
   * Um `addi` não tem `rs2`, e os bits que ficariam nele são metade do
   * imediato. Cobrar zero ali seria cobrar do modelo uma coisa que a
   * especificação não diz — e o teste passaria a falhar por estar errado ele,
   * que é pior do que não existir.
   */
  const USA: Readonly<Record<Format, readonly ("rd" | "rs1" | "rs2" | "imm")[]>> = {
    R: ["rd", "rs1", "rs2"],
    I: ["rd", "rs1", "imm"],
    S: ["rs1", "rs2", "imm"],
    B: ["rs1", "rs2", "imm"],
    U: ["rd", "imm"],
    J: ["rd", "imm"],
  };

  it.each(TODOS.map((c) => [c.asm, c] as const))("%s se lê de volta igual", (_asm, caso) => {
    const lido = decode(caso.hex);
    expect(lido.mnemonic).toBe(caso.instr.mnemonic);
    for (const campo of USA[FORMAS[caso.instr.mnemonic].format]) {
      expect({ campo, valor: lido[campo] }).toEqual({ campo, valor: caso.instr[campo] });
    }
  });

  it.each(TODOS.map((c) => [c.asm, c] as const))(
    "%s volta a ser a mesma palavra depois de ler e escrever",
    (_asm, caso) => {
      // Independe de qual campo o formato usa, e por isso pega troca de bit em
      // qualquer lugar da palavra.
      expect(encode(decode(caso.hex)) >>> 0).toBe(caso.hex >>> 0);
    },
  );

  it("as vinte e sete instruções do subconjunto estão todas na tabela", () => {
    // Sem isto, uma instrução nova entraria no `isa.ts` sem nunca ser conferida
    // contra a spec — e o buraco seria justamente onde ninguém olhou.
    const cobertas = new Set(TODOS.map((c) => c.instr.mnemonic));
    const todas: readonly Mnemonic[] = [
      "add", "sub", "and", "or", "xor", "sll", "srl", "sra", "slt",
      "addi", "andi", "ori", "xori", "slli", "srli", "srai", "slti",
      "lw", "sw", "beq", "bne", "blt", "bge", "jal", "jalr", "lui", "auipc",
    ];
    expect([...todas].filter((m) => !cobertas.has(m))).toEqual([]);
  });
});
