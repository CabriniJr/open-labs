import type { Chapter, Film, Packet, Step } from "./choreography.js";
import { CAMERA, initialState, type Animatable, type CameraState, type EntitySpec } from "./scene.js";

/**
 * Um quadro: o filme inteiro resolvido num instante. É o que o renderizador
 * desenha, e é a única coisa que ele precisa saber.
 */
export interface ResolvedEntity {
  readonly spec: EntitySpec;
  readonly state: Readonly<Animatable>;
}

export interface Frame<D> {
  readonly t: number;
  readonly entities: readonly ResolvedEntity[];
  readonly camera: CameraState;
  readonly chapterIndex: number;
  readonly chapter: Chapter<D> | undefined;
  /** O passo de narração em vigor, se o capítulo tem passos. */
  readonly step: Step<D> | undefined;
  /** O detalhe em vigor: o do último passo que tinha um. */
  readonly detail: D | undefined;
  /** Avanço dentro do capítulo, 0–1. */
  readonly local: number;
  /** Quantos pacotes do registro já saíram neste instante. */
  readonly sent: number;
  /** O último pacote a sair, se algum já saiu. */
  readonly packet: Packet | undefined;
}

const PROPS = ["opacity", "dx", "dy", "scale", "glow", "ping", "progress", "dim", "label", "sublabel", "tone"] as const;

export function chapterAt<D>(film: Film<D>, t: number): number {
  let index = 0;
  film.chapters.forEach((c, i) => {
    if (t >= c.start) index = i;
  });
  return index;
}

export function frameAt<D>(film: Film<D>, t: number): Frame<D> {
  const { timeline } = film;
  const entities = film.entities.map((spec) => {
    const base = initialState(spec) as unknown as Record<string, number | string>;
    const state = { ...base };
    for (const prop of PROPS) state[prop] = timeline.sample(spec.id, prop, t, base[prop]!);
    return { spec, state: state as unknown as Animatable };
  });
  const camera: CameraState = {
    cx: Number(timeline.sample(CAMERA, "cx", t, film.camera.cx)),
    cy: Number(timeline.sample(CAMERA, "cy", t, film.camera.cy)),
    zoom: Number(timeline.sample(CAMERA, "zoom", t, film.camera.zoom)),
  };
  const chapterIndex = chapterAt(film, t);
  const chapter = film.chapters[chapterIndex];
  let step: Step<D> | undefined;
  let detail: D | undefined;
  // Os passos de capítulos anteriores também valem: o painel não esvazia entre capítulos.
  for (const c of film.chapters.slice(0, chapterIndex + 1)) {
    for (const s of c.steps) {
      if (s.t > t) continue;
      if (c === chapter) step = s;
      if (s.detail !== undefined) detail = s.detail;
    }
  }
  const local = chapter === undefined ? 0 : Math.min(1, Math.max(0, (t - chapter.start) / Math.max(1, chapter.end - chapter.start)));
  let sent = 0;
  while (sent < film.packets.length && film.packets[sent]!.t <= t) sent += 1;
  return { t, entities, camera, chapterIndex, chapter, step, detail, local, sent, packet: film.packets[sent - 1] };
}

/** O retângulo visível para uma câmera, na proporção do palco. */
export function viewBox(film: Pick<Film, "width" | "height">, camera: CameraState): { x: number; y: number; w: number; h: number } {
  const w = film.width / camera.zoom;
  const h = film.height / camera.zoom;
  return { x: camera.cx - w / 2, y: camera.cy - h / 2, w, h };
}
