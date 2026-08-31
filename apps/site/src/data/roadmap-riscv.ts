import {
  MAP_WIDTH,
  type RoadmapAnnex,
  type RoadmapLab,
  type RoadmapMap,
  type RoadmapPhase,
} from "./roadmap.js";

/**
 * O mapa do RISC-V handbook.
 *
 * Ele não existia por um motivo que estava escrito: desenhar o caminho antes de
 * o modelo existir seria prometer um caminho que ainda não foi andado. O modelo
 * existe desde 29/08/2026 — executa RV32I de verdade e abre até o transistor —,
 * então a razão de não desenhar caiu.
 *
 * O que ele mostra é o que **de fato** dá para abrir hoje: dois labs. O resto é
 * caminho declarado e não andado, e é assim que tem que aparecer. Um mapa que
 * pinta de pronto o que não está é a mesma mentira de sempre, num lugar onde ela
 * custa a confiança do leitor logo na primeira porta que ele empurra.
 */

const phases: readonly RoadmapPhase[] = [
  { number: 1, title: "Signals", y: 40 },
  { number: 2, title: "Gates", y: 150 },
  { number: 3, title: "Registers and the ALU", y: 260 },
  { number: 4, title: "The datapath", y: 370 },
  { number: 5, title: "Control", y: 480 },
  { number: 6, title: "Assembly", y: 590 },
];

const labs: readonly RoadmapLab[] = [
  { id: "one-wire", title: "One wire, one tick", href: "#", status: "coming", side: "left", y: 92, phase: 1 },

  // O lab das portas desce até o transistor: as duas redes CMOS, em série e em
  // paralelo, com o somador de quatro bits rodando em cima delas.
  { id: "the-adder", title: "Adding, gate by gate", href: "labs/gates", status: "available", side: "left", y: 202, phase: 2 },

  { id: "register-write", title: "Writing a register", href: "#", status: "coming", side: "right", y: 312, phase: 3 },

  { id: "single-cycle-datapath", title: "The single-cycle datapath", href: "labs/cpu", status: "available", side: "left", y: 422, phase: 4 },

  // O que este vazio pedia — as linhas de controle de um opcode — é
  // literalmente o que a UC multiciclo do genérico é, em tempo: uma fase por
  // instante, e uma ordem acesa por fase. Reordenar o mapa em torno dela é
  // trabalho de outra rodada; o que cabe aqui é parar de apontar para o vazio.
  { id: "control-lines", title: "The instruction cycle", href: "labs/micro", status: "available", side: "right", y: 532, phase: 5 },

  // Mesmo lab do caminho de dados, e é honesto: escrever o próprio programa e
  // ver o caminho de dados rodar são duas coisas que se faz lá, e o leitor que
  // chega pela fase 6 quer a primeira.
  { id: "assemble-and-run", title: "Assemble and run your own program", href: "labs/cpu", status: "available", side: "left", y: 642, phase: 6 },
];

const annexes: readonly RoadmapAnnex[] = [
  { id: "cmos-logic", title: "CMOS logic", y: 202, afterLab: "the-adder" },
  { id: "rv32i", title: "RV32I base ISA", y: 422, afterLab: "single-cycle-datapath" },
];

export const MAPA_RISCV: RoadmapMap = {
  storageKey: "ovh:progress:riscv:v1",
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
