import type { Point } from "./geometry.js";
import type { Shape } from "./scene.js";

/**
 * As formas do palco, como CONTORNO e DETALHES.
 *
 * Uma forma é dado, não desenho: um polígono (o contorno, que o 3D extruda) e
 * linhas e círculos de detalhe (pinos, células, o traço extra de uma XOR). O
 * palco plano desenha os dois; o isométrico levanta o contorno em sólido e
 * pinta os detalhes na face de cima. Uma definição, duas mídias — e nenhuma das
 * duas inventa a forma da outra.
 *
 * Coordenadas locais, com a caixa centrada na origem: x em [-w/2, w/2], y em
 * [-h/2, h/2]. As curvas viram pontos aqui mesmo, com amostragem fixa.
 */
export interface Forma {
  readonly contorno: readonly Point[];
  readonly detalhes: readonly (readonly Point[])[];
  readonly circulos: readonly { readonly x: number; readonly y: number; readonly r: number }[];
}

const P = (x: number, y: number): Point => ({ x, y });

function quad(a: Point, c: Point, b: Point, n = 10): Point[] {
  return Array.from({ length: n }, (_, i) => {
    const u = (i + 1) / n;
    const v = 1 - u;
    return P(v * v * a.x + 2 * v * u * c.x + u * u * b.x, v * v * a.y + 2 * v * u * c.y + u * u * b.y);
  });
}

function retangulo(w: number, h: number, raio = 0): Point[] {
  if (raio <= 0) return [P(-w / 2, -h / 2), P(w / 2, -h / 2), P(w / 2, h / 2), P(-w / 2, h / 2)];
  const r = Math.min(raio, w / 2, h / 2);
  const x0 = -w / 2;
  const x1 = w / 2;
  const y0 = -h / 2;
  const y1 = h / 2;
  return [
    P(x0 + r, y0), P(x1 - r, y0), ...quad(P(x1 - r, y0), P(x1, y0), P(x1, y0 + r), 4),
    P(x1, y1 - r), ...quad(P(x1, y1 - r), P(x1, y1), P(x1 - r, y1), 4),
    P(x0 + r, y1), ...quad(P(x0 + r, y1), P(x0, y1), P(x0, y1 - r), 4),
    P(x0, y0 + r), ...quad(P(x0, y0 + r), P(x0, y0), P(x0 + r, y0), 4),
  ];
}

function elipse(w: number, h: number, n = 40): Point[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return P((Math.cos(a) * w) / 2, (Math.sin(a) * h) / 2);
  });
}

export function formaDe(shape: Shape, w: number, h: number): Forma {
  const x0 = -w / 2;
  const x1 = w / 2;
  const y0 = -h / 2;
  const y1 = h / 2;
  switch (shape) {
    case "circle":
    case "cylinder":
      return { contorno: elipse(w, h), detalhes: [], circulos: [] };
    case "diamond":
      return { contorno: [P(0, y0), P(x1, 0), P(0, y1), P(x0, 0)], detalhes: [], circulos: [] };
    case "pill":
      return { contorno: retangulo(w, h, h / 2), detalhes: [], circulos: [] };
    case "mux":
      // O trapézio do seletor: entra largo, sai estreito.
      return { contorno: [P(x0, y0), P(x1, y0 + h * 0.22), P(x1, y1 - h * 0.22), P(x0, y1)], detalhes: [], circulos: [] };
    case "alu": {
      // A ULA do livro: duas entradas à esquerda separadas pelo entalhe, uma saída à direita.
      const contorno = [P(x0, y0), P(x1, y0 + h * 0.3), P(x1, y1 - h * 0.3), P(x0, y1), P(x0, h * 0.12), P(x0 + w * 0.22, 0), P(x0, -h * 0.12)];
      return { contorno, detalhes: [], circulos: [] };
    }
    case "and": {
      const contorno = [P(x0, y0), P(0, y0), ...quad(P(0, y0), P(x1, y0), P(x1, 0), 8), ...quad(P(x1, 0), P(x1, y1), P(0, y1), 8), P(x0, y1)];
      return { contorno, detalhes: [], circulos: [] };
    }
    case "or":
    case "xor": {
      const contorno = [P(x0, y0), ...quad(P(x0, y0), P(w * 0.15, y0), P(x1, 0), 10), ...quad(P(x1, 0), P(w * 0.15, y1), P(x0, y1), 10), ...quad(P(x0, y1), P(x0 + w * 0.28, 0), P(x0, y0), 8)];
      const detalhes = shape === "xor" ? [[P(x0 - w * 0.12, y0), ...quad(P(x0 - w * 0.12, y0), P(x0 + w * 0.16, 0), P(x0 - w * 0.12, y1), 8)]] : [];
      return { contorno, detalhes, circulos: [] };
    }
    case "not": {
      const r = Math.min(w, h) * 0.1;
      return { contorno: [P(x0, y0), P(x1 - 2 * r, 0), P(x0, y1)], detalhes: [], circulos: [{ x: x1 - r, y: 0, r }] };
    }
    case "chip": {
      // O encapsulamento: corpo e pinos dos quatro lados, e a marca do pino 1.
      const pinos: Point[][] = [];
      const n = 7;
      const comp = Math.min(w, h) * 0.06;
      for (let i = 0; i < n; i += 1) {
        const fx = x0 + (w * (i + 1)) / (n + 1);
        const fy = y0 + (h * (i + 1)) / (n + 1);
        pinos.push([P(fx, y0), P(fx, y0 - comp)], [P(fx, y1), P(fx, y1 + comp)], [P(x0, fy), P(x0 - comp, fy)], [P(x1, fy), P(x1 + comp, fy)]);
      }
      const k = Math.min(w, h) * 0.08;
      return { contorno: retangulo(w, h, Math.min(w, h) * 0.04), detalhes: pinos, circulos: [{ x: x0 + k, y: y0 + k, r: k * 0.35 }] };
    }
    case "register": {
      // Um banco de células: a caixa e as linhas, uma por posição guardada.
      const linhas = 8;
      const detalhes = Array.from({ length: linhas - 1 }, (_, i) => [P(x0 + w * 0.08, y0 + (h * (i + 1)) / linhas), P(x1 - w * 0.08, y0 + (h * (i + 1)) / linhas)]);
      return { contorno: retangulo(w, h, Math.min(w, h) * 0.06), detalhes, circulos: [] };
    }
    case "memory": {
      // Uma grade de palavras: memória é endereço × conteúdo.
      const det: Point[][] = [];
      for (let i = 1; i < 6; i += 1) det.push([P(x0 + w * 0.1, y0 + (h * i) / 6), P(x1 - w * 0.1, y0 + (h * i) / 6)]);
      det.push([P(x0 + w * 0.34, y0 + h * 0.08), P(x0 + w * 0.34, y1 - h * 0.08)]);
      return { contorno: retangulo(w, h, Math.min(w, h) * 0.05), detalhes: det, circulos: [] };
    }
    case "stack":
      return { contorno: retangulo(w, h, 6), detalhes: [], circulos: [] };
    default:
      return { contorno: retangulo(w, h, Math.min(8, w / 4, h / 4)), detalhes: [], circulos: [] };
  }
}

export function contornoD(pontos: readonly Point[], fechado = true): string {
  const f = (n: number) => Math.round(n * 1000) / 1000;
  return pontos.map((p, i) => `${i === 0 ? "M" : "L"}${f(p.x)} ${f(p.y)}`).join("") + (fechado ? "Z" : "");
}
