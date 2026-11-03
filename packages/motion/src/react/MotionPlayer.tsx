import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import type { Film, Packet } from "../choreography.js";
import type { Tone } from "../scene.js";
import { chapterAt, frameAt, type Frame } from "../frame.js";
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
  /** Cabeçalho do domínio, no mesmo relógio do palco. */
  readonly renderHeader?: (frame: Frame<D>, clock: Clock) => ReactNode;
  /** Uma bancada de inspeção pode substituir o palco sem criar outro relógio. */
  readonly renderScreen?: ((frame: Frame<D>, clock: Clock) => ReactNode) | undefined;
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
  /** Título da tabela de pacotes (só aparece se o filme registrou pacotes). */
  readonly packetsTitle?: string;
  /**
   * O que a cor de um pacote quer dizer. Sem isto a legenda é por protocolo —
   * errada quando o lab pinta por outra coisa (um trace, um estado).
   */
  readonly packetLegend?: readonly { readonly label: string; readonly tone: Tone }[];
}

function PacketCard({ p, n, total }: { p: Packet; n: number; total: number }) {
  return (
    <div className="mo-packet" data-tone={p.tone}>
      <p className="mo-packet__route mono">
        <span className="mo-packet__tag">{p.tag}</span>
        <span>
          {p.from} → {p.to}
        </span>
      </p>
      <p className="mo-packet__payload mono">{p.payload}</p>
      <p className="mo-packet__meta mono">
        Packet {n} of {total} · {p.protocol}
        {p.bytes !== undefined ? ` · ${p.bytes} B` : ""}
      </p>
    </div>
  );
}

function PacketTable({ film, sent, chapterOf, title, legend }: { film: Film<unknown>; sent: number; chapterOf: (t: number) => number; title: string; legend: readonly { label: string; tone: Tone }[] | undefined }) {
  const protocolos = legend?.map((l) => [l.label, l.tone] as const) ?? [...new Map(film.packets.map((p) => [p.protocol, p.tone])).entries()];
  return (
    <section className="mo-packets" aria-label={title}>
      <header className="mo-packets__head">
        <h3 className="mo-packets__title">{title}</h3>
        <ul className="mo-packets__legend mono">
          {protocolos.map(([nome, tom]) => (
            <li key={nome} data-tone={tom}>
              {nome}
            </li>
          ))}
        </ul>
      </header>
      <div className="mo-packets__scroll">
        <table className="mono">
          <thead>
            <tr>
              <th>No.</th>
              <th>Step</th>
              <th>Source</th>
              <th>Destination</th>
              <th>Protocol</th>
              <th>Size</th>
              <th>Info</th>
            </tr>
          </thead>
          <tbody>
            {film.packets.map((p, i) => (
              <tr key={i} data-tone={p.tone} data-state={i < sent - 1 ? "sent" : i === sent - 1 ? "current" : "next"}>
                <td>
                  <span className="mo-packets__n">{i + 1}</span>
                </td>
                <td>{String(chapterOf(p.t) + 1).padStart(2, "0")}</td>
                <td>{p.from}</td>
                <td>{p.to}</td>
                <td>{p.protocol}</td>
                <td>{p.bytes === undefined ? "—" : `${p.bytes} B`}</td>
                <td className="mo-packets__info">{p.payload}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const CHAVE_DA_VISTA = "mo-view";

const SPEEDS = [0.5, 1, 1.5, 2] as const;

function fmt(ms: number): string {
  const s = Math.max(0, ms) / 1000;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export function MotionPlayer<D>({ film, label, renderDetail, renderHeader, renderScreen, controls, autoplay = false, className, testId, views = [], initialView, flatLabel = "Flat", packetsTitle = "Packet flow", packetLegend }: MotionPlayerProps<D>) {
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

  const goChapter = (i: number) => {
    const target = chapters[Math.min(Math.max(i, 0), chapters.length - 1)];
    if (target === undefined) return;
    // Com movimento reduzido, o capítulo se mostra pronto; senão ele toca do começo.
    clock.seek(clock.reduced ? target.end : target.start);
    if (!clock.reduced) clock.play();
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
    if ((e.target as HTMLElement).closest("button") !== null) return;
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
      <div className="mo-steps" aria-hidden="true">
        <span className="mo-steps__bars">
          {chapters.map((c, i) => (
            <span key={c.id} data-state={i < current ? "done" : i === current ? "current" : "next"} />
          ))}
        </span>
        <span className="mo-steps__label mono">
          Step {current + 1}/{chapters.length} · {chapter?.title}
        </span>
      </div>
      {controls !== undefined ? <div className="mo-player__controls">{controls}</div> : null}
      {renderHeader?.(frame, clock)}
      {renderScreen === undefined && views.length > 0 ? (
        <div className="mo-viewbar"><span className="mono">Scene view</span><div className="mo-views" role="radiogroup" aria-label="View">
            {[{ id: "flat", label: flatLabel }, ...views].map((v) => (
              <button key={v.id} type="button" role="radio" aria-checked={(alternativa?.id ?? "flat") === v.id} className="mo-views__opt" onClick={() => escolher(v.id)}>
                {v.label}
              </button>
            ))}
        </div></div>
      ) : null}

      <div className="mo-player__screen">
        {renderScreen !== undefined ? renderScreen(frame, clock) : alternativa === undefined ? <MotionStage film={film} t={t} frame={frame} label={label} /> : alternativa.render({ film, t, frame, label })}
        <p className="mo-player__hud mono" aria-hidden="true" hidden={renderScreen !== undefined}>
          <span>{String(current + 1).padStart(2, "0")}</span>
          <span className="mo-player__hud-sep">/</span>
          <span>{String(chapters.length).padStart(2, "0")}</span>
          <span className="mo-player__hud-title">{chapter?.title}</span>
        </p>
      </div>

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
          {frame.packet !== undefined ? <PacketCard p={frame.packet} n={frame.sent} total={film.packets.length} /> : null}
          <p className="mo-narration__keys mono" aria-hidden="true">space play · ←/→ chapter</p>
        </section>
        {renderDetail !== undefined ? <section className="mo-detail">{renderDetail(frame, clock)}</section> : null}
      </div>
      {film.packets.length > 0 ? (
        <PacketTable film={film as Film<unknown>} sent={frame.sent} title={packetsTitle} legend={packetLegend} chapterOf={(t) => chapterAt(film, t)} />
      ) : null}
    </div>
  );
}
