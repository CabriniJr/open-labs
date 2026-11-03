import { edge, line, loop, pt, type Box, type Path, type Point } from "./geometry.js";

/**
 * Ferramentas de diagramação. Nenhuma é obrigatória: o palco aceita qualquer
 * caixa em qualquer lugar. Elas existem para as formas que voltam sempre — o
 * diagrama de sequência, a grade, o anel — e para que a próxima coreografia não
 * precise reinventar a conta.
 */

export interface SequenceOptions {
  /** Ids das linhas de vida, da esquerda para a direita. */
  readonly lanes: readonly string[];
  readonly width: number;
  /** Onde a cabeça das linhas fica. */
  readonly top?: number;
  readonly headWidth?: number;
  readonly headHeight?: number;
  /** Margem lateral. */
  readonly margin?: number;
  /** Onde a primeira mensagem passa, abaixo das cabeças. */
  readonly firstRow?: number;
  /** Distância entre mensagens. */
  readonly rowHeight?: number;
}

export interface Sequence {
  readonly x: (lane: string) => number;
  readonly head: (lane: string) => Box;
  readonly row: (index: number) => number;
  /** A mensagem da linha `from` à linha `to`, na altura da linha `row`. */
  readonly message: (from: string, to: string, row: number, inset?: number) => Path;
  readonly self: (lane: string, row: number) => Path;
  /** A barra de ativação de uma linha de vida, da linha `from` à linha `to`. */
  readonly activation: (lane: string, fromRow: number, toRow: number, width?: number) => Box;
  readonly bottom: (rows: number) => number;
}

export function sequence(options: SequenceOptions): Sequence {
  const { lanes, width } = options;
  const top = options.top ?? 24;
  const hw = options.headWidth ?? 128;
  const hh = options.headHeight ?? 54;
  const margin = options.margin ?? 24;
  const firstRow = options.firstRow ?? top + hh + 46;
  const rowHeight = options.rowHeight ?? 56;
  const usable = width - margin * 2 - hw;
  const step = lanes.length > 1 ? usable / (lanes.length - 1) : 0;
  const index = (lane: string) => {
    const i = lanes.indexOf(lane);
    if (i === -1) throw new Error(`Unknown lane "${lane}".`);
    return i;
  };
  const x = (lane: string) => margin + hw / 2 + index(lane) * step;
  const row = (i: number) => firstRow + i * rowHeight;
  return {
    x,
    head: (lane) => ({ x: x(lane) - hw / 2, y: top, w: hw, h: hh }),
    row,
    message: (from, to, r, inset = 7) => {
      const a = x(from);
      const b = x(to);
      const s = Math.sign(b - a) || 1;
      return line(pt(a + s * inset, row(r)), pt(b - s * inset, row(r)));
    },
    self: (lane, r) => loop(pt(x(lane) + 7, row(r)), 52, rowHeight * 0.55),
    activation: (lane, fromRow, toRow, w = 12) => ({ x: x(lane) - w / 2, y: row(fromRow) - 8, w, h: row(toRow) - row(fromRow) + 16 }),
    bottom: (rows) => row(rows) + 10,
  };
}

/** Caixas numa grade: `columns` por linha, a partir de `origin`. */
export function grid(count: number, options: { origin: Point; columns: number; cell: { w: number; h: number }; gap?: number }): Box[] {
  const gap = options.gap ?? 16;
  return Array.from({ length: count }, (_, i) => ({
    x: options.origin.x + (i % options.columns) * (options.cell.w + gap),
    y: options.origin.y + Math.floor(i / options.columns) * (options.cell.h + gap),
    w: options.cell.w,
    h: options.cell.h,
  }));
}

/** Centros distribuídos num anel, começando no topo e girando no sentido horário. */
export function ring(count: number, centerPoint: Point, radius: number): Point[] {
  return Array.from({ length: count }, (_, i) => {
    const a = -Math.PI / 2 + (i / count) * Math.PI * 2;
    return pt(centerPoint.x + Math.cos(a) * radius, centerPoint.y + Math.sin(a) * radius);
  });
}

/** Uma caixa de tamanho `w × h` centrada em `p`. */
export function boxAt(p: Point, w: number, h: number): Box {
  return { x: p.x - w / 2, y: p.y - h / 2, w, h };
}

/** A ligação reta entre as bordas de duas caixas. */
export function connect(a: Box, b: Box, gap = 4): Path {
  const ca = pt(a.x + a.w / 2, a.y + a.h / 2);
  const cb = pt(b.x + b.w / 2, b.y + b.h / 2);
  const pa = edge(a, cb);
  const pb = edge(b, ca);
  const len = Math.hypot(pb.x - pa.x, pb.y - pa.y) || 1;
  const ux = (pb.x - pa.x) / len;
  const uy = (pb.y - pa.y) / len;
  return line(pt(pa.x + ux * gap, pa.y + uy * gap), pt(pb.x - ux * gap, pb.y - uy * gap));
}
