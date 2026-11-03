/**
 * Curvas de tempo. Uma curva recebe o avanço linear `u` em [0, 1] e devolve o
 * avanço percebido. `step` é a curva que não interpola: segura o valor anterior
 * até o instante do quadro-chave, e é ela que troca texto, tom e estado.
 */
export type Easing = (u: number) => number;

export const clamp01 = (u: number): number => (u <= 0 ? 0 : u >= 1 ? 1 : u);
export const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;

const C1 = 1.70158;
const C3 = C1 + 1;

export const EASINGS = {
  linear: (u: number) => u,
  in: (u: number) => u * u * u,
  out: (u: number) => 1 - (1 - u) ** 3,
  inOut: (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2),
  /** Passa um pouco do alvo e volta: chegada com peso. */
  outBack: (u: number) => 1 + C3 * (u - 1) ** 3 + C1 * (u - 1) ** 2,
  /** Desacelera longo, para câmera: o olho chega antes do quadro. */
  outExpo: (u: number) => (u >= 1 ? 1 : 1 - 2 ** (-10 * u)),
  step: (u: number) => (u >= 1 ? 1 : 0),
} satisfies Record<string, Easing>;

export type EaseName = keyof typeof EASINGS;

export function ease(name: EaseName | undefined, u: number): number {
  return EASINGS[name ?? "inOut"](clamp01(u));
}
