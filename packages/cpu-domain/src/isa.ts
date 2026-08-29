/**
 * O conjunto de instruções, em uma tabela só.
 *
 * Este arquivo é o **único** lugar que sabe como uma instrução vira 32 bits e
 * como 32 bits viram uma instrução. O montador escreve por aqui e o caminho de
 * dados lê por aqui — se cada um tivesse a sua tabela, um erro de codificação
 * apareceria como um erro de execução, no lugar errado.
 *
 * Ficamos no RV32I, e num subconjunto dele. O que está de fora está de fora de
 * propósito e está escrito na spec: sem CSR, sem `fence`, sem `ecall`, sem
 * multiplicação, sem ponto flutuante.
 */

export type Mnemonic =
  | "add" | "sub" | "and" | "or" | "xor" | "sll" | "srl" | "sra" | "slt"
  | "addi" | "andi" | "ori" | "xori" | "slli" | "srli" | "srai" | "slti"
  | "lw" | "sw"
  | "beq" | "bne" | "blt" | "bge"
  | "jal" | "jalr"
  | "lui" | "auipc";

export type Format = "R" | "I" | "S" | "B" | "U" | "J";

interface Forma {
  readonly format: Format;
  readonly opcode: number;
  readonly funct3?: number;
  readonly funct7?: number;
}

/** A tabela. Nada aqui é derivado: são os campos da especificação, escritos. */
export const FORMAS: Readonly<Record<Mnemonic, Forma>> = {
  add: { format: "R", opcode: 0x33, funct3: 0x0, funct7: 0x00 },
  sub: { format: "R", opcode: 0x33, funct3: 0x0, funct7: 0x20 },
  sll: { format: "R", opcode: 0x33, funct3: 0x1, funct7: 0x00 },
  slt: { format: "R", opcode: 0x33, funct3: 0x2, funct7: 0x00 },
  xor: { format: "R", opcode: 0x33, funct3: 0x4, funct7: 0x00 },
  srl: { format: "R", opcode: 0x33, funct3: 0x5, funct7: 0x00 },
  sra: { format: "R", opcode: 0x33, funct3: 0x5, funct7: 0x20 },
  or: { format: "R", opcode: 0x33, funct3: 0x6, funct7: 0x00 },
  and: { format: "R", opcode: 0x33, funct3: 0x7, funct7: 0x00 },

  addi: { format: "I", opcode: 0x13, funct3: 0x0 },
  slti: { format: "I", opcode: 0x13, funct3: 0x2 },
  xori: { format: "I", opcode: 0x13, funct3: 0x4 },
  ori: { format: "I", opcode: 0x13, funct3: 0x6 },
  andi: { format: "I", opcode: 0x13, funct3: 0x7 },
  slli: { format: "I", opcode: 0x13, funct3: 0x1, funct7: 0x00 },
  srli: { format: "I", opcode: 0x13, funct3: 0x5, funct7: 0x00 },
  srai: { format: "I", opcode: 0x13, funct3: 0x5, funct7: 0x20 },

  lw: { format: "I", opcode: 0x03, funct3: 0x2 },
  jalr: { format: "I", opcode: 0x67, funct3: 0x0 },
  sw: { format: "S", opcode: 0x23, funct3: 0x2 },

  beq: { format: "B", opcode: 0x63, funct3: 0x0 },
  bne: { format: "B", opcode: 0x63, funct3: 0x1 },
  blt: { format: "B", opcode: 0x63, funct3: 0x4 },
  bge: { format: "B", opcode: 0x63, funct3: 0x5 },

  jal: { format: "J", opcode: 0x6f },
  lui: { format: "U", opcode: 0x37 },
  auipc: { format: "U", opcode: 0x17 },
};

export interface Instruction {
  readonly mnemonic: Mnemonic;
  readonly rd: number;
  readonly rs1: number;
  readonly rs2: number;
  /** Já estendido em sinal, na largura da palavra. */
  readonly imm: number;
}

const bits = (word: number, alto: number, baixo: number): number =>
  (word >>> baixo) & ((1 << (alto - baixo + 1)) - 1);

/** Estende o sinal de um campo de `largura` bits. */
export function signExtend(valor: number, largura: number): number {
  const sinal = 1 << (largura - 1);
  return (valor & (sinal - 1)) - (valor & sinal);
}

export function encode(instr: Instruction): number {
  const forma = FORMAS[instr.mnemonic];
  const { rd, rs1, rs2, imm } = instr;
  const f3 = (forma.funct3 ?? 0) << 12;

  switch (forma.format) {
    case "R":
      return (
        (((forma.funct7 ?? 0) << 25) | (rs2 << 20) | (rs1 << 15) | f3 | (rd << 7) | forma.opcode) >>>
        0
      );
    case "I": {
      // Os deslocamentos por imediato usam os 5 bits baixos e carregam funct7
      // em cima: `srai` e `srli` só se distinguem por ele.
      const campo =
        forma.funct7 === undefined ? imm & 0xfff : ((forma.funct7 << 5) | (imm & 0x1f)) & 0xfff;
      return ((campo << 20) | (rs1 << 15) | f3 | (rd << 7) | forma.opcode) >>> 0;
    }
    case "S":
      return (
        ((((imm >> 5) & 0x7f) << 25) |
          (rs2 << 20) |
          (rs1 << 15) |
          f3 |
          ((imm & 0x1f) << 7) |
          forma.opcode) >>>
        0
      );
    case "B":
      return (
        ((((imm >> 12) & 0x1) << 31) |
          (((imm >> 5) & 0x3f) << 25) |
          (rs2 << 20) |
          (rs1 << 15) |
          f3 |
          (((imm >> 1) & 0xf) << 8) |
          (((imm >> 11) & 0x1) << 7) |
          forma.opcode) >>>
        0
      );
    case "U":
      return (((imm & 0xfffff) << 12) | (rd << 7) | forma.opcode) >>> 0;
    case "J":
      return (
        ((((imm >> 20) & 0x1) << 31) |
          (((imm >> 1) & 0x3ff) << 21) |
          (((imm >> 11) & 0x1) << 20) |
          (((imm >> 12) & 0xff) << 12) |
          (rd << 7) |
          forma.opcode) >>>
        0
      );
  }
}

/**
 * 32 bits viram instrução, ou `null` se nada no subconjunto casa.
 *
 * Devolver `null` em vez de uma instrução "mais próxima" é deliberado: uma
 * palavra desconhecida executada como se fosse `add` daria um resultado, e o
 * resultado errado sem erro é a falha que este projeto persegue.
 */
export function decode(word: number): Instruction | null {
  const opcode = bits(word, 6, 0);
  const rd = bits(word, 11, 7);
  const rs1 = bits(word, 19, 15);
  const rs2 = bits(word, 24, 20);
  const funct3 = bits(word, 14, 12);
  const funct7 = bits(word, 31, 25);

  const achar = (predicado: (f: Forma) => boolean): Mnemonic | undefined =>
    (Object.keys(FORMAS) as Mnemonic[]).find((m) => predicado(FORMAS[m]));

  const monta = (mnemonic: Mnemonic | undefined, imm: number): Instruction | null =>
    mnemonic === undefined ? null : { mnemonic, rd, rs1, rs2, imm };

  switch (opcode) {
    case 0x33:
      return monta(
        achar((f) => f.opcode === opcode && f.funct3 === funct3 && f.funct7 === funct7),
        0,
      );
    case 0x13: {
      const deslocamento = funct3 === 0x1 || funct3 === 0x5;
      const mnemonic = achar(
        (f) =>
          f.opcode === opcode &&
          f.funct3 === funct3 &&
          (!deslocamento || f.funct7 === funct7),
      );
      const imm = deslocamento ? rs2 : signExtend(bits(word, 31, 20), 12);
      return monta(mnemonic, imm);
    }
    case 0x03:
    case 0x67:
      return monta(
        achar((f) => f.opcode === opcode && f.funct3 === funct3),
        signExtend(bits(word, 31, 20), 12),
      );
    case 0x23:
      return monta(
        achar((f) => f.opcode === opcode && f.funct3 === funct3),
        signExtend((funct7 << 5) | rd, 12),
      );
    case 0x63: {
      const imm =
        (bits(word, 31, 31) << 12) |
        (bits(word, 7, 7) << 11) |
        (bits(word, 30, 25) << 5) |
        (bits(word, 11, 8) << 1);
      return monta(
        achar((f) => f.opcode === opcode && f.funct3 === funct3),
        signExtend(imm, 13),
      );
    }
    case 0x6f: {
      const imm =
        (bits(word, 31, 31) << 20) |
        (bits(word, 19, 12) << 12) |
        (bits(word, 20, 20) << 11) |
        (bits(word, 30, 21) << 1);
      return monta("jal", signExtend(imm, 21));
    }
    case 0x37:
    case 0x17:
      return monta(
        achar((f) => f.opcode === opcode),
        bits(word, 31, 12),
      );
    default:
      return null;
  }
}
