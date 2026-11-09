import { useEffect, useState, type RefObject } from "react";

/**
 * As cores do tema, lidas para um `<canvas>`. O canvas não entende
 * `var(--x)`, então cada token é resolvido pelo navegador num elemento de
 * prova e devolvido em RGB. Nenhuma tinta é escrita aqui: tudo vem do
 * catálogo (`stage.css`) e do tema em vigor, e é relido quando o tema troca.
 */
export type Rgb = readonly [number, number, number];

export interface Paleta {
  /** O fundo "noturno" dos desenhos: o mais escuro entre papel e tinta. */
  readonly fundo: Rgb;
  /** O contraste do fundo: o mais claro dos dois. */
  readonly claro: Rgb;
  readonly papel: Rgb;
  readonly tinta: Rgb;
  readonly viva: Rgb;
  readonly alto: Rgb;
  readonly conduit: Rgb;
  readonly processor: Rgb;
  readonly ok: Rgb;
  /** As cinco espécies do catálogo, na ordem — a rampa de cor dos desenhos. */
  readonly especies: readonly Rgb[];
}

function resolver(prova: HTMLElement, token: string): Rgb {
  prova.style.color = `var(${token})`;
  const m = getComputedStyle(prova).color.match(/[\d.]+/gu);
  if (m === null || m.length < 3) return [128, 128, 128];
  return [Number(m[0]), Number(m[1]), Number(m[2])];
}

const luz = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

export function paletaDe(el: HTMLElement): Paleta {
  const prova = document.createElement("span");
  prova.style.display = "none";
  el.appendChild(prova);
  const t = (k: string) => resolver(prova, k);
  const papel = t("--paper");
  const tinta = t("--ink");
  const p: Paleta = {
    fundo: luz(papel) < luz(tinta) ? papel : tinta,
    claro: luz(papel) < luz(tinta) ? tinta : papel,
    papel,
    tinta,
    viva: t("--dui-viva"),
    alto: t("--dui-alto"),
    conduit: t("--dui-conduit"),
    processor: t("--dui-processor"),
    ok: t("--sig-ok"),
    especies: [t("--dui-especie-1"), t("--dui-especie-2"), t("--dui-especie-3"), t("--dui-especie-4"), t("--dui-especie-5")],
  };
  prova.remove();
  return p;
}

export function misturar(a: Rgb, b: Rgb, t: number): Rgb {
  const k = Math.max(0, Math.min(1, t));
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

export const css = (c: Rgb, alfa = 1): string => `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${alfa})`;

/** Uma cor da rampa das espécies, de 0 a 1 — o "calor" de um valor ou de uma distância. */
export function rampa(p: Paleta, t: number): Rgb {
  const cores = [p.especies[3]!, p.especies[1]!, p.especies[0]!, p.especies[2]!, p.viva];
  const x = Math.max(0, Math.min(0.9999, t)) * (cores.length - 1);
  const i = Math.floor(x);
  return misturar(cores[i]!, cores[i + 1]!, x - i);
}

/** A paleta do elemento, relida quando o tema (claro, escuro, sistema) muda. */
export function usePaleta(ref: RefObject<HTMLElement | null>): Paleta | null {
  const [p, setP] = useState<Paleta | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    const ler = () => setP(paletaDe(el));
    ler();
    const obs = new MutationObserver(ler);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", ler);
    return () => {
      obs.disconnect();
      mq.removeEventListener("change", ler);
    };
  }, [ref]);
  return p;
}
