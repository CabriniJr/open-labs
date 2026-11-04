import type { Glyph } from "@ovh/motion";

/**
 * Os ícones do handbook de OpenTelemetry: traço de 24×24, um por papel que uma
 * peça pode ter no filme. São da identidade deste handbook — o motor só os
 * desenha. Um papel, um ícone, em todo lab: o Collector tem a mesma cara na
 * vitrine, na propagação e no Agent-ou-gateway, e é isso que faz o leitor
 * reconhecê-lo de um lab para o outro.
 *
 * `otel` é um glifo próprio (luneta + sinal), que evoca o projeto sem copiar a
 * marca registrada.
 */
const g = (paths: readonly string[], fill: readonly string[] = []): Glyph => (fill.length === 0 ? { paths } : { paths, fill });
const ponto = (x: number, y: number, r = 0.9) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

export const ICONES_OTEL = {
  otel: g(["M3.5 14.5 14 8.5l2 3.5-10.5 6z", "M14.5 7.7 18 5.7l2 3.5-3.5 2", "M9.5 15.8 7 21.5", "M9.5 15.8 12.5 21.5", "M19 2.5v2", "M21.5 3.5h-2"]),
  browser: g(["M3 5h18v14H3z", "M3 9h18"], [ponto(5.6, 7, 0.7), ponto(7.9, 7, 0.7), ponto(10.2, 7, 0.7)]),
  service: g(["M4 4h16v16H4z", "M9.5 9.5 7 12l2.5 2.5", "M14.5 9.5 17 12l-2.5 2.5", "M13 8.5l-2 7"]),
  sdk: g(["M12 3l8 4.5v9L12 21l-8-4.5v-9z", "M12 12l8-4.5", "M12 12v9", "M12 12 4 7.5"]),
  collector: g(["M9 6h6v12H9z", "M2.5 8h6.5", "M2.5 12h6.5", "M2.5 16h6.5", "M15 12h6.5", "M18.5 9l3 3-3 3"]),
  receiver: g(["M5.6 6.4a8 8 0 0 0 0 11.2", "M8.4 9.2a4 4 0 0 0 0 5.6", "M13 12h8", "M17.5 8.5 21 12l-3.5 3.5"], [ponto(11, 12, 1.2)]),
  processor: g(["M4 7h16v10H4z", "M8 7v10", "M16 7v10", "M11 10.5l2 1.5-2 1.5"]),
  limiter: g(["M4 16a8 8 0 1 1 16 0", "M12 16l4.5-5", "M4 16h16"]),
  batch: g(["M3 8h4v8H3z", "M10 8h4v8h-4z", "M17 8h4v8h-4z"]),
  exporter: g(["M3 12h11", "M10.5 8.5 14 12l-3.5 3.5", "M16 4h4v16h-4"]),
  backend: g(["M5 6c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3z", "M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6", "M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"]),
  gateway: g(["M4 21V9l8-6 8 6v12", "M9 21v-7h6v7"]),
  proxy: g(["M3 12h6", "M15 12h6", "M9 7h6v10H9z", "M18 9l3 3-3 3"]),
  queue: g(["M3 8h4v8H3z", "M10 8h4v8h-4z", "M17 8h4v8h-4z", "M2 20h20"]),
  host: g(["M4 4h16v6H4z", "M4 14h16v6H4z"], [ponto(7, 7), ponto(7, 17)]),
  pod: g(["M12 2.5l8.5 5v9L12 21.5l-8.5-5v-9z", "M12 8.5l3.5 2v4L12 16.5l-3.5-2v-4z"]),
  agent: g(["M12 2.5l8.5 5v9L12 21.5l-8.5-5v-9z", "M9 10.5a4 4 0 0 1 6 0", "M10.5 12.5a1.8 1.8 0 0 1 3 0"], [ponto(12, 15, 1)]),
  trace: g(["M3 5h11", "M6 10h8", "M10 15h10", "M13 20h6"]),
  metric: g(["M3 3v18h18", "M7 15l4-5 3 3 5-7"]),
  log: g(["M6 3h9l4 4v14H6z", "M15 3v4h4", "M9 11h7", "M9 15h7", "M9 19h4"]),
  bytes: g(["M8 4H6.5A2.5 2.5 0 0 0 4 6.5V10l-2 2 2 2v3.5A2.5 2.5 0 0 0 6.5 20H8", "M16 4h1.5A2.5 2.5 0 0 1 20 6.5V10l2 2-2 2v3.5a2.5 2.5 0 0 1-2.5 2.5H16"], ["M8.5 9.5h1.6v5H8.5z", "M12 9.5h1.6v5H12z", "M15.2 11h.01"]),
  context: g(["M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1", "M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"]),
  baggage: g(["M4 8h16v12H4z", "M9 8V5h6v3", "M4 13h16"]),
  sampler: g(["M3 4h18l-7 8v6l-4 2v-8z"]),
} as const satisfies Record<string, Glyph>;

export type IconeOtel = keyof typeof ICONES_OTEL;
