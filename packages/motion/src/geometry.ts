import { lerp } from "./ease.js";

/**
 * Geometria do palco: pontos, caminhos e a posição de algo que anda por eles.
 *
 * Um caminho é dado, não desenho: o mesmo valor serve para traçar a linha, para
 * o pacote percorrê-la e para a câmera enquadrá-la. A parametrização é por
 * comprimento de arco — sem isso uma ficha andando numa curva aceleraria nas
 * partes em que os pontos de controle se espremem.
 */
export interface Point {
  readonly x: number;
  readonly y: number;
}

export type Segment =
  | { readonly type: "line"; readonly to: Point }
  | { readonly type: "quad"; readonly c: Point; readonly to: Point }
  | { readonly type: "cubic"; readonly c1: Point; readonly c2: Point; readonly to: Point };

export interface Path {
  readonly from: Point;
  readonly segments: readonly Segment[];
}

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface Pose extends Point {
  /** Direção da tangente, em graus, no sentido do SVG. */
  readonly angle: number;
}

export const pt = (x: number, y: number): Point => ({ x, y });

export function line(a: Point, b: Point): Path {
  return { from: a, segments: [{ type: "line", to: b }] };
}

/** Uma curva suave de `a` a `b`, envergada para o lado esquerdo do trajeto. */
export function arc(a: Point, b: Point, bend = 0.25): Path {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return { from: a, segments: [{ type: "quad", c: { x: mx - dy * bend, y: my + dx * bend }, to: b }] };
}

/** Caminho ortogonal: sai na horizontal, dobra no meio, chega na horizontal. */
export function elbow(a: Point, b: Point, radius = 14): Path {
  const mx = (a.x + b.x) / 2;
  const r = Math.min(radius, Math.abs(b.y - a.y) / 2, Math.abs(mx - a.x));
  if (r < 1) return line(a, b);
  const sx = Math.sign(b.x - a.x) || 1;
  const sy = Math.sign(b.y - a.y) || 1;
  return {
    from: a,
    segments: [
      { type: "line", to: pt(mx - sx * r, a.y) },
      { type: "quad", c: pt(mx, a.y), to: pt(mx, a.y + sy * r) },
      { type: "line", to: pt(mx, b.y - sy * r) },
      { type: "quad", c: pt(mx, b.y), to: pt(mx + sx * r, b.y) },
      { type: "line", to: b },
    ],
  };
}

/** Uma volta que sai e retorna ao mesmo eixo vertical: a mensagem para si mesmo. */
export function loop(a: Point, width = 46, height = 26): Path {
  return {
    from: a,
    segments: [{ type: "cubic", c1: pt(a.x + width, a.y), c2: pt(a.x + width, a.y + height), to: pt(a.x, a.y + height) }],
  };
}

export function through(points: readonly Point[]): Path {
  const [first, ...rest] = points;
  if (first === undefined) throw new Error("A path needs at least one point.");
  return { from: first, segments: rest.map((to) => ({ type: "line" as const, to })) };
}

/** O ponto da borda de uma caixa na direção de `toward`. */
export function edge(box: Box, toward: Point): Point {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  if (dx === 0 && dy === 0) return pt(cx, cy);
  const sx = Math.abs(dx) / (box.w / 2 || 1);
  const sy = Math.abs(dy) / (box.h / 2 || 1);
  const s = Math.max(sx, sy);
  return pt(cx + dx / s, cy + dy / s);
}

export function center(box: Box): Point {
  return pt(box.x + box.w / 2, box.y + box.h / 2);
}

export function pathD(path: Path): string {
  const f = (n: number) => Math.round(n * 100) / 100;
  let d = `M${f(path.from.x)} ${f(path.from.y)}`;
  for (const s of path.segments) {
    if (s.type === "line") d += `L${f(s.to.x)} ${f(s.to.y)}`;
    else if (s.type === "quad") d += `Q${f(s.c.x)} ${f(s.c.y)} ${f(s.to.x)} ${f(s.to.y)}`;
    else d += `C${f(s.c1.x)} ${f(s.c1.y)} ${f(s.c2.x)} ${f(s.c2.y)} ${f(s.to.x)} ${f(s.to.y)}`;
  }
  return d;
}

function at(start: Point, s: Segment, u: number): Point {
  if (s.type === "line") return pt(lerp(start.x, s.to.x, u), lerp(start.y, s.to.y, u));
  const v = 1 - u;
  if (s.type === "quad") {
    return pt(v * v * start.x + 2 * v * u * s.c.x + u * u * s.to.x, v * v * start.y + 2 * v * u * s.c.y + u * u * s.to.y);
  }
  return pt(
    v ** 3 * start.x + 3 * v * v * u * s.c1.x + 3 * v * u * u * s.c2.x + u ** 3 * s.to.x,
    v ** 3 * start.y + 3 * v * v * u * s.c1.y + 3 * v * u * u * s.c2.y + u ** 3 * s.to.y,
  );
}

interface Table {
  readonly points: readonly Point[];
  readonly lengths: readonly number[];
  readonly total: number;
}

const TABLES = new WeakMap<Path, Table>();

function table(path: Path): Table {
  const cached = TABLES.get(path);
  if (cached !== undefined) return cached;
  const points: Point[] = [path.from];
  let start = path.from;
  for (const s of path.segments) {
    const n = s.type === "line" ? 1 : 24;
    for (let i = 1; i <= n; i += 1) points.push(at(start, s, i / n));
    start = s.to;
  }
  const lengths = [0];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    lengths.push(lengths[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const t = { points, lengths, total: lengths.at(-1) ?? 0 };
  TABLES.set(path, t);
  return t;
}

export function pathLength(path: Path): number {
  return table(path).total;
}

/** Onde está quem percorreu a fração `u` do comprimento do caminho. */
export function poseAt(path: Path, u: number): Pose {
  const { points, lengths, total } = table(path);
  const target = Math.min(Math.max(u, 0), 1) * total;
  let lo = 0;
  let hi = lengths.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (lengths[mid]! < target) lo = mid;
    else hi = mid;
  }
  const a = points[lo]!;
  const b = points[hi] ?? a;
  const span = lengths[hi]! - lengths[lo]!;
  const k = span > 0 ? (target - lengths[lo]!) / span : 0;
  return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI };
}

export function pathBox(path: Path): Box {
  const { points } = table(path);
  return bounds(points.map((p) => ({ x: p.x, y: p.y, w: 0, h: 0 })));
}

export function bounds(boxes: readonly Box[]): Box {
  if (boxes.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const b of boxes) {
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w);
    y1 = Math.max(y1, b.y + b.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
