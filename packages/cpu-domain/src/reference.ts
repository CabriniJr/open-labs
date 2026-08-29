import { ENDERECO_ENTRADA, ENDERECO_SAIDA } from "./datapath.js";
import { decode } from "./isa.js";

/**
 * O intérprete de referência.
 *
 * Ele existe para discordar do modelo. É escrito direto — busca, decodifica,
 * executa, avança — sem motor de simulação nenhum, justamente para que um erro
 * de composição no caminho de dados apareça como divergência em vez de passar.
 *
 * **O limite, dito em voz alta:** ele e o modelo compartilham `isa.ts`, então o
 * diferencial prova a *execução*, não a *codificação*. E os dois foram escritos
 * pela mesma cabeça: um mal-entendido sobre o que uma instrução faz apareceria
 * igual nos dois lados. Confrontar com um emulador de terceiro continua na
 * lista, e é o que fecha essa brecha — está registrado como pendência, não como
 * feito.
 */

export interface CpuState {
  /** O que o programa falou pelo endereço de saída, na ordem. */
  readonly saida: readonly number[];
  /** O que o dispositivo de entrada responde. Constante durante um run. */
  readonly entrada: number;
  /** x0..x31. `x0` é sempre zero, e escrever nele não faz nada. */
  readonly regs: readonly number[];
  readonly pc: number;
  /** Memória por endereço de byte alinhado em 4. Só o que foi tocado existe. */
  readonly mem: ReadonlyMap<number, number>;
  /** Verdadeiro quando a última busca não achou instrução do subconjunto. */
  readonly halted: boolean;
}

export function initialCpu(image: readonly number[], pc = 0, entrada = 0): CpuState {
  const mem = new Map<number, number>();
  image.forEach((word, i) => mem.set(i * 4, word | 0));
  return { regs: new Array<number>(32).fill(0), pc, mem, halted: false, saida: [], entrada };
}

const u = (n: number): number => n >>> 0;

/** Um passo: uma instrução inteira. É a granularidade do diferencial. */
export function stepCpu(state: CpuState): CpuState {
  if (state.halted) return state;
  const word = state.mem.get(state.pc);
  const instr = word === undefined ? null : decode(word);
  if (instr === null) return { ...state, halted: true };

  const regs = [...state.regs];
  const mem = new Map(state.mem);
  const saida = [...state.saida];
  const a = regs[instr.rs1] ?? 0;
  const b = regs[instr.rs2] ?? 0;
  const { imm } = instr;
  let proximo = state.pc + 4;
  let destino: number | undefined;

  switch (instr.mnemonic) {
    case "add": destino = (a + b) | 0; break;
    case "sub": destino = (a - b) | 0; break;
    case "and": destino = a & b; break;
    case "or": destino = a | b; break;
    case "xor": destino = a ^ b; break;
    case "sll": destino = a << (b & 31); break;
    case "srl": destino = a >>> (b & 31); break;
    case "sra": destino = a >> (b & 31); break;
    case "slt": destino = a < b ? 1 : 0; break;

    case "addi": destino = (a + imm) | 0; break;
    case "andi": destino = a & imm; break;
    case "ori": destino = a | imm; break;
    case "xori": destino = a ^ imm; break;
    case "slli": destino = a << (imm & 31); break;
    case "srli": destino = a >>> (imm & 31); break;
    case "srai": destino = a >> (imm & 31); break;
    case "slti": destino = a < imm ? 1 : 0; break;

    // Os dois endereços que não são memória: ler dali é ouvir, guardar é falar.
    case "lw": {
      const endereco = (a + imm) | 0;
      destino =
        endereco === ENDERECO_ENTRADA
          ? state.entrada
          : endereco === ENDERECO_SAIDA
            ? 0
            : (mem.get(endereco) ?? 0);
      break;
    }
    case "sw": {
      const endereco = (a + imm) | 0;
      if (endereco === ENDERECO_SAIDA) saida.push(b | 0);
      else mem.set(endereco, b | 0);
      break;
    }

    case "beq": if (a === b) proximo = state.pc + imm; break;
    case "bne": if (a !== b) proximo = state.pc + imm; break;
    case "blt": if (a < b) proximo = state.pc + imm; break;
    case "bge": if (a >= b) proximo = state.pc + imm; break;

    case "jal":
      destino = state.pc + 4;
      proximo = state.pc + imm;
      break;
    case "jalr":
      destino = state.pc + 4;
      // O bit 0 do alvo é zerado: é regra da instrução, não arredondamento.
      proximo = ((a + imm) | 0) & ~1;
      break;

    case "lui": destino = imm << 12; break;
    case "auipc": destino = (state.pc + (imm << 12)) | 0; break;
  }

  // Escrever em x0 é legal e não tem efeito. É a única instrução do
  // subconjunto cujo comportamento correto É não fazer nada.
  if (destino !== undefined && instr.rd !== 0) regs[instr.rd] = destino | 0;

  return { regs, pc: u(proximo) | 0, mem, halted: false, saida, entrada: state.entrada };
}

/** Roda até `passos` instruções, ou até parar. Devolve a trilha inteira. */
export function runCpu(state: CpuState, passos: number): CpuState[] {
  const trilha: CpuState[] = [];
  let atual = state;
  for (let i = 0; i < passos && !atual.halted; i += 1) {
    atual = stepCpu(atual);
    trilha.push(atual);
  }
  return trilha;
}
