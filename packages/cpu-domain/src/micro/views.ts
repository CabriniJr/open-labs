import type { View } from "@ovh/depth-ui";

/**
 * As três vistas do genérico, na anatomia do slide 9.
 *
 * Elas seguem `../views.ts`, e a razão de existirem separadas — e não
 * reaproveitando `VIEW_SISTEMA`/`VIEW_PROCESSADOR` — é que a árvore por baixo
 * é outra: esta CPU tem MAR, MBR, T, H, L e uma ULA sem unidade lógica nem mux
 * de operação, e uma view que declarasse os lugares do RISC-V discordaria da
 * árvore assim que tentasse desenhar um objeto que não existe aqui.
 *
 * Do somador para baixo não há vista escrita à mão: a mesma composição de
 * `alu.ts`/`gates.ts`/`transistors.ts` que serve o RISC-V serve o genérico, e
 * é o que a vista montada na hora (`autoView`) cobre sem que este arquivo
 * precise saber que ela existe.
 */

export const VIEW_MICRO_SISTEMA: View = {
  id: "micro-sistema",
  focus: "sistema",
  title: "The system: memory, CPU, and the buses between them",
  width: 900,
  height: 360,
  places: [
    { id: "relogio", x: 30, y: 150, w: 110, h: 60 },
    { id: "memoria", x: 190, y: 60, w: 200, h: 240 },
    { id: "barramento-endereco", x: 430, y: 80, w: 200, h: 60 },
    { id: "barramento-dado", x: 430, y: 200, w: 200, h: 120 },
    // A CPU chega fechada aqui: é o que diz em voz alta que há mais dentro
    // dela, e o próximo passo — `micro-cpu` — é justamente abrir essa caixa.
    { id: "cpu", x: 670, y: 40, w: 200, h: 280, collapsed: true },
  ],
};

export const VIEW_MICRO_CPU: View = {
  id: "micro-cpu",
  focus: "cpu",
  title: "Inside the CPU: the control unit above, the processor below",
  width: 760,
  height: 460,
  places: [
    // A UC atravessa a largura, como a faixa de controle de qualquer caminho
    // de dados — só que aqui ela também é onde o estado da fase mora.
    { id: "uc", x: 40, y: 30, w: 680, h: 110 },
    // O processador chega fechado: `micro-processador` é o degrau seguinte.
    { id: "processador", x: 40, y: 180, w: 680, h: 250, collapsed: true },
  ],
};

export const VIEW_MICRO_PROCESSADOR: View = {
  id: "micro-processador",
  focus: "processador",
  title: "Inside the processor: AC, T, H/L, the address and data latches, the ALU",
  width: 1040,
  height: 340,
  places: [
    // Fila de cima: o que fala com a memória — busca (PC, IR) e endereçamento
    // (MAR, MBR, H, L). É a ordem em que um byte entra: PC aponta, MAR copia o
    // endereço, MBR recebe o byte, e H/L guardam a metade de um endereço de
    // dezesseis bits que não coube num byte só.
    { id: "pc", x: 30, y: 30, w: 130, h: 70 },
    { id: "ir", x: 190, y: 30, w: 130, h: 70 },
    { id: "mar", x: 350, y: 30, w: 130, h: 70 },
    { id: "mbr", x: 510, y: 30, w: 130, h: 70 },
    { id: "h", x: 670, y: 30, w: 100, h: 70 },
    { id: "l", x: 800, y: 30, w: 100, h: 70 },

    // Fila de baixo: onde a conta acontece — AC e T alimentam a ULA — e o que
    // fica de fora dela: SP (declarado e sem fio) e o registrador de status.
    { id: "ac", x: 30, y: 160, w: 130, h: 110 },
    { id: "t", x: 190, y: 160, w: 130, h: 110 },
    { id: "ula", x: 350, y: 150, w: 320, h: 130, collapsed: true },
    { id: "status", x: 700, y: 160, w: 100, h: 110 },
    { id: "sp", x: 830, y: 160, w: 100, h: 110 },
  ],
};

export const MICRO_VIEWS: readonly View[] = [
  VIEW_MICRO_SISTEMA,
  VIEW_MICRO_CPU,
  VIEW_MICRO_PROCESSADOR,
];
