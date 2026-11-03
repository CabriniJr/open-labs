import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import type { Film } from "../choreography.js";
import { frameAt, type Frame } from "../frame.js";
import { MotionStage } from "./MotionStage.js";
import { useClock, type Clock } from "./useClock.js";

/**
 * O player: palco, transporte, capítulos, narração e o painel de detalhe.
 *
 * Um filme se assiste como um vídeo — tocar, pausar, arrastar — mas cada
 * capítulo é um degrau: as setas vão de um para o outro, e o painel ao lado
 * mostra o que está acontecendo *agora*, desenhado por quem escreveu o filme.
 */
/**
 * Uma vista alternativa do mesmo filme: outra mídia, mesmo tempo e mesmos
 * capítulos. O palco plano é sempre a primeira e não precisa ser declarado; o
 * player não sabe o que uma vista desenha — uma vista 3D entra por aqui sem que
 * este pacote dependa de WebGL.
 */
export interface MotionView<D> {
  readonly id: string;
  readonly label: string;
  readonly render: (args: { readonly film: Film<D>; readonly t: number; readonly frame: Frame<D>; readonly label: string }) => ReactNode;
}

export interface MotionPlayerProps<D> {
  readonly film: Film<D>;
  /** Rótulo acessível do palco. */
  readonly label: string;
  /** Desenha o painel de detalhe para o quadro em vigor. */
  readonly renderDetail?: (frame: Frame<D>, clock: Clock) => ReactNode;
  /** Controles do experimento, entre o transporte e o palco. */
  readonly controls?: ReactNode;
  readonly autoplay?: boolean;
  readonly className?: string;
  readonly testId?: string;
  /** Vistas além do palco plano. */
  readonly views?: readonly MotionView<D>[];
  /** Qual vista abre primeiro; lembrada por leitor quando o navegador deixa. */
  readonly initialView?: string;
  /** Como o seletor chama o palco plano. */
  readonly flatLabel?: string;
}

const CHAVE_DA_VISTA = "mo-view";

const SPEEDS = [0.5, 1, 1.5, 2] as const;

function fmt(ms: number): string {
  const s = Math.max(0, ms) / 1000;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export function MotionPlayer<D>({ film, label, renderDetail, controls, autoplay = false, className, testId, views = [], initialView, flatLabel = "Flat" }: MotionPlayerProps<D>) {
  const [vista, setVista] = useState(initialView ?? "flat");
  useEffect(() => {
    if (views.length === 0) return;
    try {
      const salva = localStorage.getItem(CHAVE_DA_VISTA);
      if (salva !== null && (salva === "flat" || views.some((v) => v.id === salva))) setVista(salva);
    } catch {
      // Armazenamento bloqueado: vale a vista inicial.
    }
  }, [views]);
  const escolher = (id: string) => {
    setVista(id);
    try {
      localStorage.setItem(CHAVE_DA_VISTA, id);
    } catch {
      // Sem armazenamento, a escolha vale só nesta visita.
    }
  };
  const alternativa = views.find((v) => v.id === vista);
  const marks = useMemo(() => film.chapters.map((c) => c.end), [film]);
  const clock = useClock({ duration: film.duration, marks, autoplay });
  const t = Math.min(clock.t, film.duration);
  const frame = useMemo(() => frameAt(film, t), [film, t]);
  const { chapters } = film;
  const current = frame.chapterIndex;
  const chapter = frame.chapter;
  const [selected, setSelected] = useState<string | null>(null);
  const part = frame.entities.find(e => e.spec.id === selected && e.state.opacity > .005);

  const goChapter = (i: number) => {
    const target = chapters[Math.min(Math.max(i, 0), chapters.length - 1)];
    if (target === undefined) return;
    // Com movimento reduzido, o capítulo se mostra pronto; senão ele toca do começo.
    clock.seek(clock.reduced ? target.end : target.start);
    if (!clock.reduced) clock.play();
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.defaultPrevented || (e.target instanceof Element && e.target.closest("input, select, textarea, button, a, [role='button']"))) return;
    if (e.key === " " || e.key === "k") {
      e.preventDefault();
      clock.toggle();
    } else if (e.key === "ArrowRight" || e.key === "l") {
      e.preventDefault();
      goChapter(current + 1);
    } else if (e.key === "ArrowLeft" || e.key === "j") {
      e.preventDefault();
      // Voltar reinicia o capítulo; voltar logo no começo dele vai para o anterior.
      goChapter(chapter !== undefined && t - chapter.start > 600 ? current : current - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      clock.pause();
      clock.seek(0);
    }
  };

  const narration = frame.step?.body ?? chapter?.body ?? "";
  const stepTitle = frame.step?.title;

  return (
    <div className={["mo-player", className].filter(Boolean).join(" ")} tabIndex={0} onKeyDown={onKey} data-testid={testId} data-playing={clock.playing ? "" : undefined}>
      {controls !== undefined ? <div className="mo-player__controls">{controls}</div> : null}
      <div className="mo-player__screen">
        {alternativa === undefined ? <MotionStage film={film} t={t} frame={frame} label={label} selected={selected} onSelect={id => setSelected(id === selected ? null : id)} /> : alternativa.render({ film, t, frame, label })}
        {views.length > 0 ? (
          <div className="mo-views" role="radiogroup" aria-label="View">
            {[{ id: "flat", label: flatLabel }, ...views].map((v) => (
              <button key={v.id} type="button" role="radio" aria-checked={(alternativa?.id ?? "flat") === v.id} className="mo-views__opt" onClick={() => escolher(v.id)}>
                {v.label}
              </button>
            ))}
          </div>
        ) : null}
        <p className="mo-player__hud mono" aria-hidden="true">
          <span>{String(current + 1).padStart(2, "0")}</span>
          <span className="mo-player__hud-sep">/</span>
          <span>{String(chapters.length).padStart(2, "0")}</span>
          <span className="mo-player__hud-title">{chapter?.title}</span>
        </p>
      </div>

      {part && <aside className="mo-selection" aria-live="polite"><div><span className="mono">SELECTED PART</span><strong>{part.state.label || part.spec.title || "Part"}</strong>{part.state.sublabel && <p>{part.state.sublabel}</p>}{part.spec.title && part.spec.title !== part.state.label && <p>{part.spec.title}</p>}</div><button type="button" aria-label="Clear selection" onClick={() => setSelected(null)}>×</button></aside>}

      <div className="mo-transport" role="group" aria-label="Playback">
        <button type="button" className="mo-btn" onClick={() => goChapter(current - 1)} aria-label="Previous chapter" disabled={current === 0 && t < 600}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3v10M13 3 6 8l7 5z" /></svg>
        </button>
        <button type="button" className="mo-btn mo-btn--primary" onClick={clock.toggle} aria-label={clock.playing ? "Pause" : "Play"}>
          {clock.playing ? (
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3v10M11 3v10" /></svg>
          ) : (
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3l8 5-8 5z" /></svg>
          )}
        </button>
        <button type="button" className="mo-btn" onClick={() => goChapter(current + 1)} aria-label="Next chapter" disabled={current >= chapters.length - 1}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M12 3v10M3 3l7 5-7 5z" /></svg>
        </button>

        <div className="mo-scrub">
          <div className="mo-scrub__track" aria-hidden="true">
            {chapters.map((c, i) => {
              const span = Math.max(1, c.end - c.start);
              const fill = Math.min(1, Math.max(0, (t - c.start) / span));
              return (
                <span key={c.id} className="mo-scrub__seg" data-current={i === current ? "" : undefined} style={{ flexGrow: span }}>
                  <span className="mo-scrub__fill" style={{ transform: `scaleX(${fill})` }} />
                </span>
              );
            })}
          </div>
          <input
            className="mo-scrub__input"
            type="range"
            min={0}
            max={Math.round(film.duration)}
            step={10}
            value={Math.round(t)}
            aria-label="Timeline"
            aria-valuetext={`${chapter?.title ?? ""}, ${fmt(t)} of ${fmt(film.duration)}`}
            onChange={(e) => {
              clock.pause();
              clock.seek(Number(e.target.value));
            }}
          />
        </div>
        <span className="mo-time mono" aria-hidden="true">
          {fmt(t)} / {fmt(film.duration)}
        </span>
        <label className="mo-speed mono">
          <span className="mo-visually-hidden">Speed</span>
          <select value={clock.speed} onChange={(e) => clock.setSpeed(Number(e.target.value))}>
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </label>
      </div>

      <ol className="mo-chapters" aria-label="Chapters">
        {chapters.map((c, i) => (
          <li key={c.id}>
            <button type="button" className="mo-chapter" data-state={i < current ? "done" : i === current ? "current" : "next"} aria-current={i === current ? "step" : undefined} onClick={() => goChapter(i)}>
              <span className="mo-chapter__n mono">{String(i + 1).padStart(2, "0")}</span>
              <span className="mo-chapter__title">{c.title}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="mo-player__below">
        <section className="mo-narration" aria-live="polite">
          <p className="mo-narration__eyebrow mono">{chapter?.title}</p>
          {stepTitle !== undefined ? <h3 className="mo-narration__title">{stepTitle}</h3> : null}
          <p className="mo-narration__body">{narration}</p>
          <p className="mo-narration__keys mono" aria-hidden="true">space play · ←/→ chapter</p>
        </section>
        {renderDetail !== undefined ? <section className="mo-detail">{renderDetail(frame, clock)}</section> : null}
      </div>
    </div>
  );
}
