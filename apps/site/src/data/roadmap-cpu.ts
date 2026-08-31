import {
  MAP_WIDTH,
  type RoadmapAnnex,
  type RoadmapLab,
  type RoadmapMap,
  type RoadmapPhase,
} from "./roadmap.js";

/**
 * O mapa do handbook da CPU.
 *
 * Ele não existia por um motivo que estava escrito: desenhar o caminho antes de
 * o modelo existir seria prometer um caminho que ainda não foi andado. O modelo
 * existe desde 29/08/2026 — executa RV32I de verdade e abre até o transistor —,
 * então a razão de não desenhar caiu.
 *
 * A ordem das fases é a ordem em que as duas máquinas se sustentam: sinais,
 * portas, registradores e ULA são comuns às duas. Dali em diante elas se
 * separam — o genérico gasta uma fase inteira andando o ciclo de instrução
 * instante a instante, o RV32I faz o mesmo ciclo em um drawing só —, e o mapa
 * mostra as duas em vez de só a segunda, que era o que sobrava quando só uma
 * máquina existia.
 *
 * O que ele mostra é o que **de fato** dá para abrir hoje. O resto é caminho
 * declarado e não andado, e é assim que tem que aparecer. Um mapa que pinta de
 * pronto o que não está é a mesma mentira de sempre, num lugar onde ela custa a
 * confiança do leitor logo na primeira porta que ele empurra.
 */

const phases: readonly RoadmapPhase[] = [
  { number: 1, title: "Signals", y: 40 },
  { number: 2, title: "Gates", y: 150 },
  { number: 3, title: "Registers and the ALU", y: 260 },
  { number: 4, title: "The instruction cycle", y: 370 },
  { number: 5, title: "The datapath, all at once", y: 480 },
  { number: 6, title: "Assembly", y: 590 },
];

const labs: readonly RoadmapLab[] = [
  { id: "one-wire", title: "One wire, one tick", href: "#", status: "coming", side: "left", y: 92, phase: 1 },

  // O lab das portas desce até o transistor: as duas redes CMOS, em série e em
  // paralelo, com o somador de quatro bits rodando em cima delas.
  { id: "the-adder", title: "Adding, gate by gate", href: "labs/gates", status: "available", side: "left", y: 202, phase: 2 },

  { id: "register-write", title: "Writing a register", href: "#", status: "coming", side: "right", y: 312, phase: 3 },

  // A máquina genérica do deck de referência. Ela ocupa o lugar que o vazio
  // "control lines of one opcode" ocupava, e não é substituição arbitrária: uma
  // unidade de controle multiciclo **é** as linhas de controle de um opcode,
  // desenroladas no tempo.
  { id: "instruction-cycle", title: "One instruction, instant by instant", href: "labs/micro", status: "available", side: "left", y: 422, phase: 4 },

  { id: "single-cycle-datapath", title: "The whole cycle in one tick", href: "labs/cpu", status: "available", side: "right", y: 532, phase: 5 },

  // Mesmo lab do caminho de dados, e é honesto: escrever o próprio programa e
  // ver o caminho de dados rodar são duas coisas que se faz lá, e o leitor que
  // chega pela fase 6 quer a primeira.
  { id: "assemble-and-run", title: "Assemble and run your own program", href: "labs/cpu", status: "available", side: "left", y: 642, phase: 6 },
];

const annexes: readonly RoadmapAnnex[] = [
  { id: "cmos-logic", title: "CMOS logic", y: 202, afterLab: "the-adder" },
  { id: "generic-isa", title: "The generic ISA", y: 422, afterLab: "instruction-cycle" },
  { id: "rv32i", title: "RV32I base ISA", y: 532, afterLab: "single-cycle-datapath" },
];

export const MAPA_CPU: RoadmapMap = {
  // v2: o v1 guardava progresso por nó de um mapa que ainda não tinha as duas
  // máquinas nem a fase reordenada. Manter a chave faria o navegador de um
  // leitor antigo marcar como feito um nó que mudou de fase e de sentido.
  storageKey: "ovh:progress:cpu:v2",
  height: 700,
  spineTop: 27,
  spineBottom: 642,
  phases,
  labs,
  annexes,
  annexLegend: "The Datasheet · reference, not a step",
};

/** Só para o mapa não sair do espaço de coordenadas sem ninguém notar. */
export const LARGURA_DO_MAPA = MAP_WIDTH;
