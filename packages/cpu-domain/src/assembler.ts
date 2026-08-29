import { encode, FORMAS } from "./isa.js";
import type { Instruction, Mnemonic } from "./isa.js";

/**
 * O montador: texto em uma imagem de memória.
 *
 * **Programa não é parâmetro.** Mudar um parâmetro é um evento no tempo, e o
 * mundo reage de onde está; mudar o programa é outro mundo, começando no tick 0
 * — antes disso não há passado daquele programa. Por isso a saída daqui é uma
 * imagem, e quem a recebe monta um mundo novo.
 *
 * Todo erro aponta **linha e coluna**. Um montador que diz só "erro de sintaxe"
 * transfere para quem escreveu o trabalho de achar o que ele já sabia.
 */

export interface AssemblyError {
  readonly line: number;
  readonly column: number;
  readonly message: string;
}

export interface Assembled {
  /** Palavras de 32 bits, na ordem, a partir do endereço 0. */
  readonly words: readonly number[];
  /** Em que linha do fonte nasceu cada palavra. É o que liga tela e execução. */
  readonly lineOf: readonly number[];
  readonly labels: Readonly<Record<string, number>>;
}

export type AssembleResult =
  | { readonly ok: true; readonly image: Assembled }
  | { readonly ok: false; readonly errors: readonly AssemblyError[] };

/** Nomes ABI, porque é assim que se escreve na vida real. */
const ABI: Readonly<Record<string, number>> = {
  zero: 0, ra: 1, sp: 2, gp: 3, tp: 4,
  t0: 5, t1: 6, t2: 7,
  s0: 8, fp: 8, s1: 9,
  a0: 10, a1: 11, a2: 12, a3: 13, a4: 14, a5: 15, a6: 16, a7: 17,
  s2: 18, s3: 19, s4: 20, s5: 21, s6: 22, s7: 23, s8: 24, s9: 25, s10: 26, s11: 27,
  t3: 28, t4: 29, t5: 30, t6: 31,
};

const R_TYPE = new Set<Mnemonic>(["add", "sub", "and", "or", "xor", "sll", "srl", "sra", "slt"]);
const I_ALU = new Set<Mnemonic>(["addi", "andi", "ori", "xori", "slli", "srli", "srai", "slti"]);
const MEM = new Set<Mnemonic>(["lw", "sw"]);
const BRANCH = new Set<Mnemonic>(["beq", "bne", "blt", "bge"]);
const U_TYPE = new Set<Mnemonic>(["lui", "auipc"]);

interface Campo {
  readonly texto: string;
  /** Coluna 1-based no fonte, para o erro poder apontar. */
  readonly coluna: number;
}

interface Linha {
  readonly numero: number;
  readonly mnemonic: Campo;
  readonly operandos: readonly Campo[];
  readonly endereco: number;
}

function semComentario(texto: string): string {
  const corte = texto.search(/[#;]/);
  return corte < 0 ? texto : texto.slice(0, corte);
}

/** Quebra em campos guardando a coluna de cada um. */
function campos(linha: string): Campo[] {
  const achados: Campo[] = [];
  const re = /[^\s,]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(linha)) !== null) {
    achados.push({ texto: m[0], coluna: m.index + 1 });
  }
  return achados;
}

export function assemble(source: string): AssembleResult {
  const erros: AssemblyError[] = [];
  const labels: Record<string, number> = {};
  const linhas: Linha[] = [];
  let endereco = 0;

  // Primeira passada: rótulos e posições. Sem ela, um desvio para a frente
  // não teria alvo — e resolver isso "quando aparecer" faria o montador
  // depender da ordem em que o programa foi escrito.
  source.split("\n").forEach((bruta, i) => {
    const numero = i + 1;
    let resto = semComentario(bruta);

    const rotulo = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/.exec(resto);
    if (rotulo !== null) {
      const nome = rotulo[1] as string;
      if (nome in labels) {
        erros.push({
          line: numero,
          column: (rotulo.index ?? 0) + 1,
          message: `o rótulo "${nome}" já foi definido — dois alvos com o mesmo nome fariam um desvio escolher em silêncio`,
        });
      }
      labels[nome] = endereco;
      resto = " ".repeat(rotulo[0].length) + resto.slice(rotulo[0].length);
    }

    const partes = campos(resto);
    const cabeca = partes[0];
    if (cabeca === undefined) return;

    linhas.push({
      numero,
      mnemonic: cabeca,
      operandos: partes.slice(1),
      endereco,
    });
    endereco += 4;
  });

  const words: number[] = [];
  const lineOf: number[] = [];

  const erro = (linha: Linha, campo: Campo | undefined, message: string): null => {
    erros.push({ line: linha.numero, column: campo?.coluna ?? 1, message });
    return null;
  };

  const registrador = (linha: Linha, campo: Campo | undefined): number | null => {
    if (campo === undefined) return erro(linha, campo, "faltou um operando de registrador");
    const texto = campo.texto.toLowerCase();
    const porNumero = /^x(\d{1,2})$/.exec(texto);
    if (porNumero !== null) {
      const n = Number(porNumero[1]);
      if (n > 31) return erro(linha, campo, `"${campo.texto}" não existe: os registradores vão de x0 a x31`);
      return n;
    }
    const abi = ABI[texto];
    if (abi !== undefined) return abi;
    return erro(linha, campo, `"${campo.texto}" não é um registrador — use x0..x31 ou o nome ABI (a0, sp, t1...)`);
  };

  const numero = (linha: Linha, campo: Campo | undefined): number | null => {
    if (campo === undefined) return erro(linha, campo, "faltou um número");
    const texto = campo.texto;
    const valor = /^[+-]?0[xX][0-9a-fA-F]+$/.test(texto) ? Number(texto) : Number(texto);
    if (!Number.isInteger(valor)) {
      return erro(linha, campo, `"${texto}" não é um número inteiro`);
    }
    return valor;
  };

  /** Um alvo pode ser rótulo (vira deslocamento) ou número já em bytes. */
  const alvo = (linha: Linha, campo: Campo | undefined): number | null => {
    if (campo === undefined) return erro(linha, campo, "faltou o alvo do desvio");
    if (/^[A-Za-z_]/.test(campo.texto)) {
      const destino = labels[campo.texto];
      if (destino === undefined) {
        return erro(linha, campo, `o rótulo "${campo.texto}" não existe neste programa`);
      }
      return destino - linha.endereco;
    }
    return numero(linha, campo);
  };

  for (const linha of linhas) {
    const nome = linha.mnemonic.texto.toLowerCase();
    if (!(nome in FORMAS)) {
      erro(
        linha,
        linha.mnemonic,
        `"${linha.mnemonic.texto}" não está no subconjunto montado — as instruções aceitas são ${Object.keys(FORMAS).join(", ")}`,
      );
      continue;
    }
    const mnemonic = nome as Mnemonic;
    const [a, b, c] = linha.operandos;
    let instr: Instruction | null = null;

    if (R_TYPE.has(mnemonic)) {
      const rd = registrador(linha, a);
      const rs1 = registrador(linha, b);
      const rs2 = registrador(linha, c);
      if (rd !== null && rs1 !== null && rs2 !== null) {
        instr = { mnemonic, rd, rs1, rs2, imm: 0 };
      }
    } else if (I_ALU.has(mnemonic)) {
      const rd = registrador(linha, a);
      const rs1 = registrador(linha, b);
      const imm = numero(linha, c);
      if (rd !== null && rs1 !== null && imm !== null) {
        const deslocamento = mnemonic === "slli" || mnemonic === "srli" || mnemonic === "srai";
        if (deslocamento && (imm < 0 || imm > 31)) {
          erro(linha, c, `deslocamento de ${imm}: só há 32 bits para deslocar, então o valor vai de 0 a 31`);
        } else {
          instr = { mnemonic, rd, rs1, rs2: 0, imm };
        }
      }
    } else if (MEM.has(mnemonic)) {
      // forma `lw rd, imm(rs1)` — a mais escrita, e a que mais confunde
      const alvoMem = /^([+-]?(?:0[xX][0-9a-fA-F]+|\d+))?\(([^)]+)\)$/.exec(b?.texto ?? "");
      const reg = registrador(linha, a);
      if (alvoMem === null) {
        erro(linha, b, `esperava a forma deslocamento(registrador), como 8(sp) — recebi "${b?.texto ?? ""}"`);
      } else if (reg !== null) {
        const base = registrador(linha, { texto: alvoMem[2] as string, coluna: b?.coluna ?? 1 });
        const desloc = alvoMem[1] === undefined ? 0 : Number(alvoMem[1]);
        if (base !== null) {
          instr =
            mnemonic === "lw"
              ? { mnemonic, rd: reg, rs1: base, rs2: 0, imm: desloc }
              : { mnemonic, rd: 0, rs1: base, rs2: reg, imm: desloc };
        }
      }
    } else if (BRANCH.has(mnemonic)) {
      const rs1 = registrador(linha, a);
      const rs2 = registrador(linha, b);
      const desvio = alvo(linha, c);
      if (rs1 !== null && rs2 !== null && desvio !== null) {
        instr = { mnemonic, rd: 0, rs1, rs2, imm: desvio };
      }
    } else if (mnemonic === "jal") {
      const rd = registrador(linha, a);
      const desvio = alvo(linha, b);
      if (rd !== null && desvio !== null) instr = { mnemonic, rd, rs1: 0, rs2: 0, imm: desvio };
    } else if (mnemonic === "jalr") {
      const rd = registrador(linha, a);
      const rs1 = registrador(linha, b);
      const imm = c === undefined ? 0 : numero(linha, c);
      if (rd !== null && rs1 !== null && imm !== null) {
        instr = { mnemonic, rd, rs1, rs2: 0, imm };
      }
    } else if (U_TYPE.has(mnemonic)) {
      const rd = registrador(linha, a);
      const imm = numero(linha, b);
      if (rd !== null && imm !== null) instr = { mnemonic, rd, rs1: 0, rs2: 0, imm };
    }

    if (instr === null) {
      // já houve erro reportado acima; mantém o endereço alinhado para que os
      // rótulos seguintes continuem apontando para onde a primeira passada disse
      words.push(0);
      lineOf.push(linha.numero);
      continue;
    }
    words.push(encode(instr));
    lineOf.push(linha.numero);
  }

  if (erros.length > 0) return { ok: false, errors: erros };
  return { ok: true, image: { words, lineOf, labels } };
}
