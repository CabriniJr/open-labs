import type { EaseName } from "./ease.js";
import { bounds, pathBox, type Box } from "./geometry.js";
import {
  CAMERA,
  boxOf,
  initialState,
  type Animatable,
  type CameraState,
  type EntitySpec,
  type Prop,
  type PropValue,
  type Tone,
} from "./scene.js";
import { Timeline } from "./timeline.js";

/**
 * A coreografia: as ferramentas para escrever um filme do palco.
 *
 * Quem escreve declara peças e depois conta, capítulo a capítulo, o que
 * acontece com elas. Cada verbo (`show`, `send`, `draw`, `camera`…) avança um
 * cursor de tempo; `together` roda trilhas em paralelo, e `{ wait: false }`
 * dispara sem esperar. O resultado é um `Film`: dado puro, amostrável em
 * qualquer instante, que qualquer renderizador pode desenhar.
 *
 * O detalhe (`D`) é do autor. O palco só o carrega até quem desenha o painel
 * ao lado — é por ele que um cabeçalho, uma tabela ou um bloco de bytes acompanha
 * o momento do filme sem que o motor saiba o que é nenhum deles.
 */
export interface Step<D> {
  readonly t: number;
  readonly title?: string;
  readonly body?: string;
  readonly detail?: D;
}

/**
 * Um pacote no registro do filme: o que atravessou o fio, de onde, para onde.
 * É o que vira a tabela de pacotes e o cartão do pacote no player — o palco
 * mostra a ficha andando, o registro diz o que ela era.
 */
export interface Packet {
  readonly t: number;
  readonly tag: string;
  readonly tone: Tone;
  readonly from: string;
  readonly to: string;
  readonly protocol: string;
  readonly payload: string;
  /** Tamanho em bytes, quando o domínio sabe dizer. */
  readonly bytes?: number;
}

export interface Chapter<D> {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly start: number;
  readonly end: number;
  readonly steps: readonly Step<D>[];
}

export interface Film<D = unknown> {
  readonly width: number;
  readonly height: number;
  readonly entities: readonly EntitySpec[];
  readonly timeline: Timeline;
  readonly chapters: readonly Chapter<D>[];
  readonly duration: number;
  readonly camera: CameraState;
  /** Os pacotes que o filme registrou, em ordem de tempo. */
  readonly packets: readonly Packet[];
}

export interface Timing {
  /** Duração em ms. */
  readonly dur?: number;
  /** Espera antes de começar, em ms. */
  readonly delay?: number;
  readonly ease?: EaseName;
  /** `false`: começa agora e não segura o cursor. */
  readonly wait?: boolean;
}

export interface CameraTarget {
  /** Enquadra estas peças (a união das caixas delas). */
  readonly focus?: readonly string[];
  /** Ou enquadra esta caixa. */
  readonly box?: Box;
  /** Folga em volta do enquadramento, em unidades do palco. */
  readonly pad?: number;
  /** Ou diga a câmera direto. */
  readonly at?: Partial<CameraState>;
  /** O máximo de aproximação; sem isso, um alvo pequeno enche a tela. */
  readonly maxZoom?: number;
}

export interface ChapterInput<D> {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly detail?: D;
}

export class Director<D> {
  #cursor: number;
  #reach: number;
  readonly #film: FilmBuilder<D>;
  readonly #steps: Step<D>[];

  constructor(film: FilmBuilder<D>, start: number, steps: Step<D>[]) {
    this.#film = film;
    this.#cursor = start;
    this.#reach = start;
    this.#steps = steps;
  }

  /** O instante em que o próximo verbo começa. */
  get now(): number {
    return this.#cursor;
  }

  /** Até onde este diretor já escreveu. */
  get reach(): number {
    return Math.max(this.#reach, this.#cursor);
  }

  /** Avança o cursor sem fazer nada. */
  wait(ms: number): this {
    this.#cursor += ms;
    return this;
  }

  /** Registra um pacote neste instante (ver `Packet`). Não move nada no palco. */
  packet(p: Omit<Packet, "t">): this {
    this.#film.registrar({ ...p, t: this.#cursor });
    return this;
  }

  /** Um passo da narração: o painel e o texto mudam neste instante. */
  beat(step: Omit<Step<D>, "t">): this {
    this.#steps.push({ ...step, t: this.#cursor });
    return this;
  }

  /** Muda uma propriedade de uma peça, partindo do valor que ela tem no início. */
  tween(id: string, prop: Prop, to: PropValue, timing: Timing = {}): this {
    return this.to(id, { [prop]: to } as Partial<Animatable>, timing);
  }

  /** Várias propriedades de uma vez, com o mesmo tempo. */
  to(id: string, props: Partial<Animatable> | Partial<CameraState>, timing: Timing = {}): this {
    const dur = timing.dur ?? 450;
    const start = this.#cursor + (timing.delay ?? 0);
    for (const [prop, value] of Object.entries(props) as [string, PropValue][]) {
      this.#film.animate(id, prop, value, start, dur, timing.ease);
    }
    return this.#advance(start + dur, timing);
  }

  /** Troca instantânea, sem curva: texto, tom, estado. */
  set(id: string, props: Partial<Animatable>, timing: Pick<Timing, "delay"> = {}): this {
    const at = this.#cursor + (timing.delay ?? 0);
    for (const [prop, value] of Object.entries(props) as [Prop, PropValue][]) this.#film.jump(id, prop, value, at);
    this.#reach = Math.max(this.#reach, at);
    return this;
  }

  show(ids: string | readonly string[], timing: Timing = {}): this {
    return this.#each(ids, timing, 450, (id, start, dur) => {
      const type = this.#film.typeOf(id);
      if (Number(this.#film.valueAt(id, "opacity", start)) < 0.5) this.#film.jump(id, "scale", 0.86, start);
      this.#film.animate(id, "opacity", 1, start, dur, "out");
      this.#film.animate(id, "scale", 1, start, dur, timing.ease ?? "outBack");
      if (type === "link" || type === "bar") this.#film.animate(id, "progress", 1, start, dur, "inOut");
    });
  }

  hide(ids: string | readonly string[], timing: Timing = {}): this {
    return this.#each(ids, timing, 300, (id, start, dur) => this.#film.animate(id, "opacity", 0, start, dur, timing.ease ?? "in"));
  }

  /** Desenha uma ligação ou faz uma barra crescer, do zero. */
  draw(ids: string | readonly string[], timing: Timing = {}): this {
    return this.#each(ids, timing, 600, (id, start, dur) => {
      this.#film.jump(id, "progress", 0, start);
      this.#film.jump(id, "opacity", 1, start);
      this.#film.animate(id, "progress", 1, start, dur, timing.ease ?? "inOut");
    });
  }

  /**
   * Faz uma ficha percorrer o caminho dela: aparece na origem, viaja, e some
   * no destino — a não ser que `keep` a deixe lá.
   */
  send(id: string, timing: Timing & { readonly keep?: boolean } = {}): this {
    const dur = timing.dur ?? 900;
    const start = this.#cursor + (timing.delay ?? 0);
    this.#film.jump(id, "progress", 0, start);
    this.#film.animate(id, "opacity", 1, start, Math.min(160, dur / 4), "out");
    this.#film.animate(id, "progress", 1, start, dur, timing.ease ?? "inOut");
    if (timing.keep !== true) this.#film.animate(id, "opacity", 0, start + dur, 220, "in");
    return this.#advance(start + dur, timing);
  }

  /** Uma onda que sai da peça: "aconteceu aqui". Não segura o cursor. */
  ping(ids: string | readonly string[], timing: Timing = {}): this {
    return this.#each(ids, { wait: false, ...timing }, 700, (id, start, dur) => {
      this.#film.jump(id, "ping", 0, start);
      this.#film.animate(id, "ping", 1, start, dur, "out");
      this.#film.jump(id, "ping", 0, start + dur);
    });
  }

  /** Acende a peça (1) ou apaga o destaque (0). Não segura o cursor. */
  glow(ids: string | readonly string[], level = 1, timing: Timing = {}): this {
    return this.#each(ids, { wait: false, ...timing }, 300, (id, start, dur) => this.#film.animate(id, "glow", level, start, dur, timing.ease));
  }

  /** Rebaixa as peças para o fundo; `level = 0` as traz de volta. Não segura o cursor. */
  dim(ids: string | readonly string[], level = 1, timing: Timing = {}): this {
    return this.#each(ids, { wait: false, ...timing }, 350, (id, start, dur) => this.#film.animate(id, "dim", level, start, dur, timing.ease));
  }

  camera(target: CameraTarget, timing: Timing = {}): this {
    return this.to(CAMERA, this.#film.frame(target, this.#cursor + (timing.delay ?? 0)), { dur: 900, ease: "outExpo", ...timing });
  }

  /**
   * Trilhas em paralelo: cada função é uma sequência própria, e todas começam
   * no mesmo instante. O cursor vai para o fim da mais longa.
   */
  together(...tracks: readonly ((d: Director<D>) => void)[]): this {
    let end = this.#cursor;
    for (const track of tracks) {
      const branch = new Director<D>(this.#film, this.#cursor, this.#steps);
      track(branch);
      end = Math.max(end, branch.reach);
    }
    return this.#advance(end, {});
  }

  /** Um bloco por item, cada um começando `gap` ms depois do anterior. */
  stagger<T>(items: readonly T[], gap: number, block: (d: Director<D>, item: T, index: number) => void): this {
    let end = this.#cursor;
    items.forEach((item, i) => {
      const branch = new Director<D>(this.#film, this.#cursor + i * gap, this.#steps);
      block(branch, item, i);
      end = Math.max(end, branch.reach);
    });
    return this.#advance(end, {});
  }

  #each(
    ids: string | readonly string[],
    timing: Timing,
    fallback: number,
    run: (id: string, start: number, dur: number) => void,
  ): this {
    const dur = timing.dur ?? fallback;
    const start = this.#cursor + (timing.delay ?? 0);
    for (const id of typeof ids === "string" ? [ids] : ids) run(id, start, dur);
    return this.#advance(start + dur, timing);
  }

  #advance(end: number, timing: Timing): this {
    this.#reach = Math.max(this.#reach, end);
    if (timing.wait !== false) this.#cursor = Math.max(this.#cursor, end);
    return this;
  }
}

export interface FilmOptions {
  readonly width: number;
  readonly height: number;
  /** Silêncio entre capítulos, em ms. */
  readonly gap?: number;
  /** Teto de aproximação da câmera para o filme inteiro. */
  readonly maxZoom?: number;
}

export class FilmBuilder<D = unknown> {
  readonly #options: FilmOptions;
  readonly #entities = new Map<string, EntitySpec>();
  readonly #timeline = new Timeline();
  readonly #chapters: Chapter<D>[] = [];
  readonly #packets: Packet[] = [];
  #cursor = 0;

  constructor(options: FilmOptions) {
    this.#options = options;
  }

  /** Declara uma peça. Ela existe desde o instante 0, visível a não ser que `hidden`. */
  add<S extends EntitySpec>(spec: S): this {
    if (spec.id === CAMERA) throw new Error(`"${CAMERA}" is reserved for the camera.`);
    if (this.#entities.has(spec.id)) throw new Error(`Entity "${spec.id}" was declared twice.`);
    this.#entities.set(spec.id, spec);
    return this;
  }

  has(id: string): boolean {
    return this.#entities.has(id);
  }

  typeOf(id: string): string | undefined {
    return this.#entities.get(id)?.type;
  }

  /** A caixa de uma peça; com `t`, deslocada para onde ela estará naquele instante. */
  boxOf(id: string, t?: number): Box {
    const spec = this.#entities.get(id);
    if (spec === undefined) throw new Error(`Unknown entity "${id}".`);
    const box = boxOf(spec) ?? pathBox(spec.type === "link" || spec.type === "token" ? spec.path : { from: { x: 0, y: 0 }, segments: [] });
    if (t === undefined) return box;
    return { ...box, x: box.x + Number(this.valueAt(id, "dx", t)), y: box.y + Number(this.valueAt(id, "dy", t)) };
  }

  chapter(input: ChapterInput<D>, block: (d: Director<D>) => void): this {
    const steps: Step<D>[] = [];
    if (input.detail !== undefined) steps.push({ t: this.#cursor, detail: input.detail });
    const director = new Director<D>(this, this.#cursor, steps);
    block(director);
    const end = Math.max(director.reach, this.#cursor + 1);
    // Trilhas paralelas escrevem passos fora de ordem; a narração lê em ordem de tempo.
    steps.sort((a, b) => a.t - b.t);
    this.#chapters.push({ id: input.id, title: input.title, body: input.body, start: this.#cursor, end, steps });
    this.#cursor = end + (this.#options.gap ?? 350);
    return this;
  }

  registrar(p: Packet): void {
    this.#packets.push(p);
  }

  /** Valor de uma propriedade num instante, levando em conta o que já foi escrito. */
  valueAt(id: string, prop: Prop | keyof CameraState, t: number): PropValue {
    return this.#timeline.sample(id, prop, t, this.#initial(id, prop));
  }

  animate(id: string, prop: string, to: PropValue, start: number, dur: number, curve?: EaseName): void {
    this.#check(id);
    const from = this.#timeline.sample(id, prop, start, this.#initial(id, prop));
    this.#timeline.add(id, prop, { t: start, v: from, ease: "step" });
    if (typeof to === "string" || dur <= 0) {
      this.#timeline.add(id, prop, { t: start + Math.max(dur, 0), v: to, ease: "step" });
      return;
    }
    this.#timeline.add(id, prop, curve === undefined ? { t: start + dur, v: to } : { t: start + dur, v: to, ease: curve });
  }

  jump(id: string, prop: string, to: PropValue, at: number): void {
    this.#check(id);
    const from = this.#timeline.sample(id, prop, at, this.#initial(id, prop));
    this.#timeline.add(id, prop, { t: at, v: from, ease: "step" });
    this.#timeline.add(id, prop, { t: at, v: to, ease: "step" });
  }

  /** O enquadramento que mostra o alvo inteiro, na proporção do palco. */
  frame(target: CameraTarget, t?: number): CameraState {
    const { width, height } = this.#options;
    if (target.at !== undefined) return { cx: width / 2, cy: height / 2, zoom: 1, ...target.at };
    const box = target.box ?? bounds((target.focus ?? []).map((id) => this.boxOf(id, t)));
    const pad = target.pad ?? 40;
    const w = Math.max(box.w + pad * 2, 1);
    const h = Math.max(box.h + pad * 2, 1);
    const zoom = Math.max(1, Math.min(width / w, height / h, target.maxZoom ?? this.#options.maxZoom ?? 4));
    return { cx: box.x + box.w / 2, cy: box.y + box.h / 2, zoom };
  }

  build(): Film<D> {
    const { width, height } = this.#options;
    const last = this.#chapters.at(-1);
    return {
      width,
      height,
      entities: [...this.#entities.values()].sort((a, b) => (a.layer ?? 0) - (b.layer ?? 0)),
      timeline: this.#timeline,
      chapters: [...this.#chapters],
      duration: Math.max(last?.end ?? 0, this.#timeline.end),
      camera: { cx: width / 2, cy: height / 2, zoom: 1 },
      packets: [...this.#packets].sort((a, b) => a.t - b.t),
    };
  }

  #check(id: string): void {
    if (id !== CAMERA && !this.#entities.has(id)) throw new Error(`Unknown entity "${id}".`);
  }

  #initial(id: string, prop: string): PropValue {
    if (id === CAMERA) {
      const { width, height } = this.#options;
      return ({ cx: width / 2, cy: height / 2, zoom: 1 } as Record<string, number>)[prop] ?? 0;
    }
    const spec = this.#entities.get(id);
    if (spec === undefined) return 0;
    return (initialState(spec) as unknown as Record<string, PropValue>)[prop] ?? 0;
  }
}

export function film<D = unknown>(options: FilmOptions): FilmBuilder<D> {
  return new FilmBuilder<D>(options);
}
