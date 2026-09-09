import type { View } from "@ovh/depth-ui";
import { ROTULOS_HEROI } from "./labels.js";

/**
 * A vista do herói: três caixas numa fileira, e nada mais.
 *
 * Larga e baixa porque ela divide a primeira dobra da página com a trilha, e
 * uma vitrine que pede rolagem para ser vista inteira não é vitrine.
 */
export const VIEW_HEROI: View = {
  id: "otel-hero",
  focus: "pipeline",
  title: ROTULOS_HEROI.sistema,
  width: 720,
  height: 200,
  registro: "blocos",
  places: [
    { id: "service", x: 30, y: 55, w: 170, h: 90 },
    { id: "collector", x: 275, y: 55, w: 170, h: 90 },
    { id: "backend", x: 520, y: 55, w: 170, h: 90 },
  ],
};

export const VIEWS_DO_HEROI: readonly View[] = [VIEW_HEROI];
