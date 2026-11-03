import type { Tone } from "@ovh/motion";

/**
 * O tom de uma peça é lido do catálogo visual do site, pelo nome do sentido —
 * a mesma tabela do `motion.css`. WebGL não lê CSS, então a cor é resolvida
 * uma vez, no elemento hospedeiro, e relida quando o tema muda.
 */
export const VARIAVEL_DO_TOM: Readonly<Record<Tone, string>> = {
  ink: "--dui-tinta",
  muted: "--ink-faint",
  live: "--dui-viva",
  high: "--dui-alto",
  processor: "--dui-processor",
  container: "--dui-container",
  controller: "--dui-controller",
  conduit: "--dui-conduit",
  "kind-1": "--dui-especie-1",
  "kind-2": "--dui-especie-2",
  "kind-3": "--dui-especie-3",
  "kind-4": "--dui-especie-4",
  "kind-5": "--dui-especie-5",
};

export interface Paleta {
  readonly tom: (t: Tone) => string;
  readonly papel: string;
  readonly papelElevado: string;
  readonly regua: string;
  readonly tinta: string;
}

/** Lê os tokens no elemento; um token vazio cai na tinta, nunca numa cor inventada. */
export function lerPaleta(el: Element): Paleta {
  const cs = getComputedStyle(el);
  const v = (nome: string) => cs.getPropertyValue(nome).trim();
  const tinta = v("--ink") || v("color") || "currentColor";
  const cache = new Map<Tone, string>();
  return {
    tom: (t) => {
      const pronta = cache.get(t);
      if (pronta !== undefined) return pronta;
      const cor = v(VARIAVEL_DO_TOM[t]) || tinta;
      cache.set(t, cor);
      return cor;
    },
    papel: v("--paper") || tinta,
    papelElevado: v("--paper-raised") || v("--paper") || tinta,
    regua: v("--rule") || tinta,
    tinta,
  };
}
