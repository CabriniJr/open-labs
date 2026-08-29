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
    { id: "banco", x: 210, y: 300, w: 160, h: 80 },

    { id: "logica", x: 410, y: 175, w: 680, h: 235 },
    { id: "mux-operando", x: 440, y: 215, w: 120, h: 50 },
    // A ULA tem interior agora, e a view diz isso em voz alta em vez de
    // desenhar uma caixa lisa: dois cliques entram nela.
    { id: "ula", x: 610, y: 205, w: 140, h: 80, collapsed: true },
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
    { id: "banco", x: 40, y: 220, w: 200, h: 140 },
    { id: "logica", x: 300, y: 40, w: 660, h: 400 },
    { id: "mux-operando", x: 340, y: 120, w: 160, h: 80 },
    { id: "ula", x: 550, y: 100, w: 180, h: 120, collapsed: true },
    { id: "desvio", x: 780, y: 120, w: 150, h: 80 },
    { id: "mux-escrita", x: 550, y: 300, w: 180, h: 80 },
  ],
};

export const CPU_VIEWS: readonly View[] = [VIEW_SISTEMA, VIEW_PROCESSADOR];

/**
 * A vista do somador de portas, montada por laço.
 *
 * Gerar as posições não afrouxa nada: a view continua declarando onde cada
 * objeto fica, e `viewDisagreement` continua conferindo objeto por objeto
 * contra a árvore. O que o laço evita é escrever vinte e tantas coordenadas à
 * mão e errar uma em silêncio.
 */
export function viewSomador(bits: number): View {
  const alturaBit = 190;
  const topo = 30;
  const altura = topo + bits * alturaBit + 30;

  const places: View["places"] = [
    { id: "entradas", x: 30, y: topo + 10, w: 130, h: bits * alturaBit - 30 },
    { id: "somador", x: 220, y: topo, w: 680, h: bits * alturaBit + 10 },
    ...Array.from({ length: bits }, (_, i) => {
      const y = topo + 20 + i * alturaBit;
      const p = (s: string): string => `bit${i}-${s}`;
      return [
        { id: `bit${i}`, x: 240, y, w: 640, h: alturaBit - 40 },
        { id: p("xor1"), x: 270, y: y + 22, w: 100, h: 46 },
        { id: p("and1"), x: 270, y: y + 88, w: 100, h: 46 },
        { id: p("xor2"), x: 430, y: y + 22, w: 100, h: 46 },
        { id: p("and2"), x: 430, y: y + 88, w: 100, h: 46 },
        { id: p("or1"), x: 600, y: y + 88, w: 100, h: 46 },
      ];
    }).flat(),
    ...Array.from({ length: bits }, (_, i) => ({
      id: `soma${i}`,
      x: 960,
      y: topo + 42 + i * alturaBit,
      w: 110,
      h: 46,
    })),
    { id: "vaium", x: 960, y: topo + 108 + (bits - 1) * alturaBit, w: 110, h: 46 },
  ];

  return {
    id: "somador",
    focus: "circuito",
    title: `Somador de ${bits} bits, porta por porta`,
    width: 1100,
    height: altura,
    places,
  };
}
