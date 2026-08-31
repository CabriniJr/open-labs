import type { View } from "@ovh/depth-ui";

/**
 * A máquina, numa faixa só.
 *
 * O caminho é literalmente da esquerda para a direita — fita, esteira,
 * despachante — e o que volta volta por baixo, na faixa de retorno: o
 * resultado do operador para a pilha, e o pedido do próximo símbolo para a
 * fita. Reservar a faixa de baixo é o que impede a volta de cruzar a ida, que é
 * o que transforma qualquer diagrama em espaguete.
 */
export const VIEW_MAQUINA: View = {
  id: "maquina",
  focus: "maquina",
  title: "A stack machine: one symbol at a time",
  width: 1120,
  height: 560,
  places: [
    // a ida
    { id: "fita", x: 40, y: 60, w: 170, h: 220 },
    { id: "esteira", x: 250, y: 150, w: 150, h: 26 },
    { id: "despachante", x: 440, y: 120, w: 150, h: 90 },

    // a pilha, embaixo do despachante: é para lá que número vai
    { id: "pilha", x: 440, y: 300, w: 170, h: 200 },

    // quem transforma, e a fita que guarda o que ele produziu
    { id: "operador", x: 700, y: 120, w: 160, h: 90 },
    { id: "visor", x: 920, y: 300, w: 160, h: 200 },
  ],
};

export const ALGO_VIEWS: readonly View[] = [VIEW_MAQUINA];
