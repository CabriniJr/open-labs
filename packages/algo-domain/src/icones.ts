import type { Glyph } from "@ovh/motion";

/**
 * Os ícones do handbook de algoritmos, traço de 24×24. Desenhos próprios, um
 * por papel, e o mesmo papel tem o mesmo ícone em todos os labs daqui.
 */
const ponto = (x: number, y: number, r = 1.4) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

export const ICONES_ALGO = {
  /** Um ponto do grafo: o nó. */
  no: { paths: ["M12 6a6 6 0 1 0 0 12a6 6 0 1 0 0-12"] },
  /** Uma ligação: dois pontos e a linha. */
  aresta: { paths: ["M7.5 16.5l9-9"], fill: [ponto(6, 18, 2.2), ponto(18, 6, 2.2)] },
  /** Casa: de onde a busca sai. */
  casa: { paths: ["M4 11l8-7 8 7", "M6 10v10h12V10", "M10 20v-5h4v5"] },
  /** Âncora: o porto, o destino. */
  porto: { paths: ["M12 5v15", "M8 9h8", "M5 14a7 7 0 0 0 14 0"], fill: [ponto(12, 4, 1.6)] },
  /** Um lugar qualquer do mapa: o alfinete. */
  lugar: { paths: ["M12 21s-6-6.2-6-11a6 6 0 1 1 12 0c0 4.8-6 11-6 11z"], fill: [ponto(12, 10, 1.8)] },
  /** A fila de prioridade: itens em fila, o da frente maior. */
  fronteira: { paths: ["M3 8h6v8H3z", "M11 9h5v6h-5z", "M18 10h3v4h-3z"] },
  /** Comparar dois: a balança. */
  comparar: { paths: ["M12 4v16", "M5 8h14", "M5 8l-2.5 6h5z", "M19 8l-2.5 6h5z", "M8 20h8"] },
  /** Trocar dois de lugar. */
  trocar: { paths: ["M4 8h14", "M15 5l3 3-3 3", "M20 16H6", "M9 13l-3 3 3 3"] },
  /** Memória extra: a fita auxiliar. */
  auxiliar: { paths: ["M3 7h18v10H3z", "M9 7v10", "M15 7v10"] },
  /** O contador de operações. */
  contador: { paths: ["M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16", "M12 8v4l3 2"] },
  /** Uma moeda. */
  moeda: { paths: ["M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18", "M12 7v10", "M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5"] },
  /** A tabela que lembra. */
  tabela: { paths: ["M3 5h18v14H3z", "M3 10h18", "M3 15h18", "M9 5v14", "M15 5v14"] },
} as const satisfies Record<string, Glyph>;
