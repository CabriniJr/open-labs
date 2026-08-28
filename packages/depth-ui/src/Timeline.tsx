export interface TimelineProps {
  readonly tick: number;
  readonly maxTick: number;
  readonly playing: boolean;
  readonly onSeek: (tick: number) => void;
  readonly onTogglePlay: () => void;
}

/** A linha do tempo é compartilhada por todos os níveis de profundidade. */
export function Timeline({ tick, maxTick, playing, onSeek, onTogglePlay }: TimelineProps) {
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
    </div>
  );
}
