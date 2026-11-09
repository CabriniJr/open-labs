import type { Glyph } from "@ovh/motion";

/**
 * Os ícones do handbook de redes, traço de 24×24. Desenhos próprios, um por
 * papel, e o mesmo papel tem o mesmo ícone em todo lab deste handbook.
 */
const ponto = (x: number, y: number, r = 0.9) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

export const ICONES_REDE = {
  /** Roteador: decide o caminho entre redes — o círculo com setas que se cruzam. */
  router: { paths: ["M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18", "M7.5 9.5h9", "M13.5 7l3 2.5-3 2.5", "M16.5 14.5h-9", "M10.5 12l-3 2.5 3 2.5"] },
  /** Switch: muitas portas, uma rede local — a barra com as setas dos dois lados. */
  switch: { paths: ["M3 8h18v8H3z", "M7 12h10", "M14.5 10l2.5 2-2.5 2", "M9.5 10L7 12l2.5 2"] },
  /** Ponto de acesso: o rádio que vira cabo. */
  ap: { paths: ["M12 20v-6", "M8.5 11.2a5 5 0 0 1 7 0", "M5.5 8.2a9 9 0 0 1 13 0"], fill: [ponto(12, 14, 1.2)] },
  laptop: { paths: ["M5 5.5h14v9.5H5z", "M2.5 18.5h19"] },
  pc: { paths: ["M3.5 4h17v11h-17z", "M9 20h6", "M12 15v5"] },
  server: { paths: ["M5 3h14v6H5z", "M5 9h14v6H5z", "M5 15h14v6H5z"], fill: [ponto(8, 6), ponto(8, 12), ponto(8, 18)] },
  /** O provedor: a nuvem de onde vem a internet. */
  isp: { paths: ["M7 18h10a4 4 0 0 0 .4-8A6 6 0 0 0 5.6 11.6 3.3 3.3 0 0 0 7 18z"] },
  /** Um servidor na internet: o globo. */
  web: { paths: ["M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18", "M3 12h18", "M12 3c3 3.5 3 14.5 0 18", "M12 3c-3 3.5-3 14.5 0 18"] },
} as const satisfies Record<string, Glyph>;
