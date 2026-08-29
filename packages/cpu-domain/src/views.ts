import type { View } from "@ovh/depth-ui";

/**
 * As views do caminho de dados.
 *
 * Uma view guarda **a disposição inicial** — onde cada objeto começa e de que
 * tamanho. Ela não decide o que existe nem o que se liga a quê: isso é da
 * árvore e dos fios, e `viewDisagreement` recusa qualquer view que tente.
 *
 * O enquadramento segue o diagrama de blocos de sempre: a CPU é uma moldura, o
 * processador é uma moldura dentro dela, e as memórias ficam **fora**, embaixo,
 * com o barramento descendo até elas. Quem já viu a figura num livro reconhece;
 * a diferença é que esta anda.
 */

export const VIEW_SISTEMA: View = {
  id: "sistema",
  focus: "sistema",
  title: "O sistema: CPU, memórias e o relógio que a move",
  width: 1180,
  height: 640,
  places: [
    { id: "relogio", x: 16, y: 500, w: 110, h: 64 },

    { id: "cpu", x: 150, y: 30, w: 1000, h: 430 },
    { id: "controle", x: 190, y: 70, w: 230, h: 50 },
    { id: "decodificador", x: 460, y: 70, w: 200, h: 50 },

    { id: "processador", x: 180, y: 150, w: 940, h: 280 },
    { id: "pc", x: 210, y: 200, w: 100, h: 50 },
    { id: "banco", x: 210, y: 300, w: 160, h: 80, badge: "×32" },

    { id: "logica", x: 410, y: 175, w: 680, h: 235 },
    { id: "mux-operando", x: 440, y: 215, w: 120, h: 50 },
    { id: "ula", x: 610, y: 205, w: 140, h: 80, badge: "/32" },
    { id: "desvio", x: 800, y: 215, w: 130, h: 50 },
    { id: "mux-escrita", x: 800, y: 325, w: 130, h: 50 },

    { id: "imem", x: 200, y: 500, w: 250, h: 70 },
    { id: "memoria", x: 640, y: 500, w: 280, h: 70 },
  ],
};

/**
 * O mesmo run, enquadrado no processador. Não é outro desenho: é a mesma coisa
 * vista de mais perto, e é por isso que os números batem entre as duas.
 */
export const VIEW_PROCESSADOR: View = {
  id: "processador",
  focus: "processador",
  title: "Dentro do processador: PC, banco e a lógica combinacional",
  width: 1000,
  height: 480,
  places: [
    { id: "pc", x: 40, y: 60, w: 160, h: 80 },
    { id: "banco", x: 40, y: 220, w: 200, h: 140, badge: "×32" },
    { id: "logica", x: 300, y: 40, w: 660, h: 400 },
    { id: "mux-operando", x: 340, y: 120, w: 160, h: 80 },
    { id: "ula", x: 550, y: 100, w: 180, h: 120, badge: "/32" },
    { id: "desvio", x: 780, y: 120, w: 150, h: 80 },
    { id: "mux-escrita", x: 550, y: 300, w: 180, h: 80 },
  ],
};

export const CPU_VIEWS: readonly View[] = [VIEW_SISTEMA, VIEW_PROCESSADOR];
