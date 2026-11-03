import type { Glyph } from "@ovh/motion";

/**
 * Os ícones do handbook de Kubernetes, traço de 24×24. Desenhos próprios, um
 * por papel: o Pod é o hexágono com o contêiner dentro, o nó é a máquina, o
 * plano de controle é o que decide.
 */
const ponto = (x: number, y: number, r = 0.9) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

export const ICONES_K8S = {
  pod: { paths: ["M12 2.5l8.5 5v9L12 21.5l-8.5-5v-9z", "M12 8.5l3.5 2v4L12 16.5l-3.5-2v-4z"] },
  node: { paths: ["M4 4h16v6H4z", "M4 14h16v6H4z"], fill: [ponto(7, 7), ponto(7, 17)] },
  scheduler: { paths: ["M4 6h16v14H4z", "M4 10h16", "M8 3v5", "M16 3v5", "M9 15l2 2 4-4"] },
  controller: { paths: ["M20 12a8 8 0 1 1-2.3-5.7", "M20 4v4.5h-4.5", "M12 8v4l3 2"] },
  apiserver: { paths: ["M12 3l8 4v5c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V7z", "M9 12h6", "M12 9v6"] },
} as const satisfies Record<string, Glyph>;
