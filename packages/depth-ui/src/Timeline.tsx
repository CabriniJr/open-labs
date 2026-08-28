export interface TimelineProps {
  readonly tick: number;
  readonly maxTick: number;
  readonly playing: boolean;
  readonly onSeek: (tick: number) => void;
  readonly onTogglePlay: () => void;
  /** Multiplicador de velocidade atual. Omitido = sem controle de velocidade. */
  readonly speed?: number;
  /** Multiplicadores oferecidos ao leitor, em ordem. */
  readonly speeds?: readonly number[];
  readonly onChangeSpeed?: (speed: number) => void;
}

/** A linha do tempo é compartilhada por todos os níveis de profundidade. */
export function Timeline({
  tick,
  maxTick,
  playing,
  onSeek,
  onTogglePlay,
  speed,
  speeds,
  onChangeSpeed,
}: TimelineProps) {
  const showSpeed = speeds !== undefined && onChangeSpeed !== undefined;

  return (
    <div className="dui-timeline">
      <button type="button" className="dui-timeline__play" onClick={onTogglePlay}>
        {playing ? "Pause" : "Play"}
      </button>
      <button type="button" onClick={() => onSeek(Math.max(0, tick - 1))}>
        Step back
      </button>
      <input
        className="dui-timeline__scrub"
        type="range"
        min={0}
        max={maxTick}
        value={tick}
        aria-label="Timeline"
        onChange={(event) => onSeek(Number(event.target.value))}
      />
      <span className="dui-timeline__tick mono">
        {tick}/{maxTick}
      </span>

      {showSpeed ? (
        <div className="dui-timeline__speed" role="group" aria-label="Speed">
          {speeds.map((option) => (
            <button
              key={option}
              type="button"
              className="dui-timeline__speed-option mono"
              aria-pressed={option === speed}
              onClick={() => onChangeSpeed(option)}
            >
              {option}&times;
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
