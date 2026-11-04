import { ease, lerp, type EaseName } from "./ease.js";
import type { PropValue } from "./scene.js";

/**
 * A linha do tempo: para cada peça e propriedade, uma lista ordenada de
 * quadros-chave. Amostrar é uma função pura do instante — voltar, pular e
 * avançar dão o mesmo quadro, porque não há estado escondido entre eles.
 */
export interface Keyframe {
  readonly t: number;
  readonly v: PropValue;
  /** A curva que leva do quadro anterior até este. */
  readonly ease?: EaseName;
}

export class Timeline {
  readonly #tracks = new Map<string, Keyframe[]>();

  static key(id: string, prop: string): string {
    return `${id}\u0000${prop}`;
  }

  add(id: string, prop: string, frame: Keyframe): void {
    const key = Timeline.key(id, prop);
    const track = this.#tracks.get(key) ?? [];
    // Inserção estável: dois quadros no mesmo instante ficam na ordem escrita,
    // e o último vence — é assim que um "salto" (valor novo no mesmo ms) funciona.
    let i = track.length;
    while (i > 0 && track[i - 1]!.t > frame.t) i -= 1;
    track.splice(i, 0, frame);
    this.#tracks.set(key, track);
  }

  has(id: string, prop: string): boolean {
    return this.#tracks.has(Timeline.key(id, prop));
  }

  /** O valor no instante `t`, ou `fallback` antes do primeiro quadro. */
  sample(id: string, prop: string, t: number, fallback: PropValue): PropValue {
    const track = this.#tracks.get(Timeline.key(id, prop));
    if (track === undefined || track.length === 0) return fallback;
    const first = track[0]!;
    if (t < first.t) return fallback;
    // Último quadro com instante <= t.
    let lo = 0;
    let hi = track.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (track[mid]!.t <= t) lo = mid;
      else hi = mid - 1;
    }
    const k0 = track[lo]!;
    const k1 = track[lo + 1];
    if (k1 === undefined || typeof k0.v !== "number" || typeof k1.v !== "number" || k1.t === k0.t) return k0.v;
    return lerp(k0.v, k1.v, ease(k1.ease, (t - k0.t) / (k1.t - k0.t)));
  }

  get end(): number {
    let end = 0;
    for (const track of this.#tracks.values()) end = Math.max(end, track.at(-1)?.t ?? 0);
    return end;
  }
}
