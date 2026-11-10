import type { Cidade, ResultadoReal } from "@ovh/algo-domain";
import { css, misturar, type Paleta } from "./tinta";

/**
 * O desenho do mapa real em canvas, dividido entre as pistas lado a lado e o
 * mapa compartilhado: projeção, traçado de uma rua, a base (ruas e pontos de
 * interesse comuns) e os rótulos com contorno.
 */
/** O tempo da busca no momento em que cada cruzamento foi resolvido — é a cor da pintura. */
export function tempos(r: ResultadoReal, n: number): { d: Float64Array; lado: Uint8Array; max: number } {
  const d = new Float64Array(n).fill(-1);
  const lado = new Uint8Array(n);
  let max = 1;
  for (const p of r.passos) {
    if (p.t !== "settle") continue;
    d[p.no] = p.d;
    lado[p.no] = p.lado;
    max = Math.max(max, p.d);
  }
  return { d, lado, max };
}

export interface Visao {
  readonly escala: number;
  readonly w: number;
  readonly h: number;
}

export const paraTela = (c: Cidade, v: Visao, x: number, y: number): [number, number] => [(x + c.largura / 2) * v.escala, (y + c.altura / 2) * v.escala];

export function tracar(ctx: CanvasRenderingContext2D, c: Cidade, v: Visao, e: number) {
  const a = c.de[e]!;
  const b = c.para[e]!;
  const g = c.geometria[e]!;
  let [x, y] = paraTela(c, v, c.x[a]!, c.y[a]!);
  ctx.moveTo(x, y);
  for (let i = 0; i < g.length; i += 2) {
    [x, y] = paraTela(c, v, g[i]!, g[i + 1]!);
    ctx.lineTo(x, y);
  }
  [x, y] = paraTela(c, v, c.x[b]!, c.y[b]!);
  ctx.lineTo(x, y);
}

/** A base: as ruas da cidade, uma vez por tamanho e por tema. Vias grandes mais grossas. */
/** Um rótulo com contorno, que vai para a esquerda do ponto quando não cabe à direita. */
export function rotular(ctx: CanvasRenderingContext2D, v: Visao, p: Paleta, texto: string, x: number, y: number, forte: boolean) {
  const largo = ctx.measureText(texto).width;
  const tx = x + 7 + largo > v.w - 2 ? x - 7 - largo : x + 7;
  ctx.lineWidth = 3;
  ctx.strokeStyle = css(p.fundo, 0.9);
  ctx.strokeText(texto, tx, y);
  ctx.fillStyle = css(p.claro, forte ? 1 : 0.8);
  ctx.fillText(texto, tx, y);
}

export const fonteDe = (v: Visao, familia: string) => `600 ${Math.max(10, Math.min(13, v.w / 50))}px ${familia}`;

export function desenharBase(c: Cidade, v: Visao, p: Paleta, dpr: number, familia: string): HTMLCanvasElement {
  const tela = document.createElement("canvas");
  tela.width = Math.round(v.w * dpr);
  tela.height = Math.round(v.h * dpr);
  const ctx = tela.getContext("2d")!;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = css(p.fundo);
  ctx.fillRect(0, 0, v.w, v.h);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const grossura = (t: number) => (t <= 3 ? 2.2 : t <= 7 ? 1.5 : 0.9);
  for (const passada of [0, 1]) {
    for (let e = 0; e < c.m; e += 1) {
      const t = c.tipo[e]!;
      if ((passada === 0) !== t > 5) continue;
      ctx.beginPath();
      tracar(ctx, c, v, e);
      ctx.strokeStyle = css(misturar(p.fundo, p.claro, t <= 5 ? 0.3 : 0.17));
      ctx.lineWidth = grossura(t) * Math.max(0.6, v.escala * 5);
      ctx.stroke();
    }
  }
  // Os pontos de interesse comuns moram na base: texto com contorno é o mais caro de
  // desenhar, e estes não mudam. Só os destacados são redesenhados a cada quadro.
  ctx.font = fonteDe(v, familia);
  ctx.textBaseline = "middle";
  for (const poi of c.pois) {
    const [x, y] = paraTela(c, v, poi.x, poi.y);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = css(p.alto, 0.75);
    ctx.fill();
    if (v.w > 520) rotular(ctx, v, p, poi.nome, x, y, false);
  }
  return tela;
}

