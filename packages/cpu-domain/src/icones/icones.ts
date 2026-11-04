import type { Glyph } from "@ovh/motion";

/** Os ícones do handbook da CPU, traço de 24×24: o chip, a memória, a ULA. */
export const ICONES_CPU = {
  chip: { paths: ["M7 7h10v10H7z", "M10 10h4v4h-4z", "M9.5 3v4", "M14.5 3v4", "M9.5 17v4", "M14.5 17v4", "M3 9.5h4", "M3 14.5h4", "M17 9.5h4", "M17 14.5h4"] },
  memory: { paths: ["M3 7h18v9H3z", "M6 10h2v3H6z", "M11 10h2v3h-2z", "M16 10h2v3h-2z", "M5 16v3", "M9 16v3", "M15 16v3", "M19 16v3"] },
  alu: { paths: ["M3 4h7l2 4 2-4h7l-5 16H8z"] },
  register: { paths: ["M3 7h18v10H3z", "M7.5 7v10", "M12 7v10", "M16.5 7v10"] },
} as const satisfies Record<string, Glyph>;
