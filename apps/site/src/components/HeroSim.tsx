import { Engine, diffStates } from "@ovh/depth-core";
import type { LevelId } from "@ovh/depth-core";
import { DepthShell, FlowDiagram, Inspector, Timeline } from "@ovh/depth-ui";
import type { FlowView } from "@ovh/depth-ui";
import { toOtlpJson } from "@ovh/otel-domain";
import { useEffect, useMemo, useRef, useState } from "react";
import { heroScenario } from "../labs/hero/scenario.js";
import type { HeroState } from "../labs/hero/scenario.js";

const MAX_TICK = 32;
/** Intervalo base por tick, em ms. Dividido pelo multiplicador de velocidade. */
const BASE_INTERVAL_MS = 190;
const SPEEDS = [0.5, 1, 2] as const;

const LEVEL_LABELS: Record<LevelId, string> = {
  flow: "Flow",
  mechanism: "Mechanism",
  wire: "Wire",
  payload: "Payload",
};

function toFlowView(state: HeroState, propagate: boolean): FlowView {
  const orphan = !propagate && state.spans.length >= 2;
  return {
    nodes: [
      { id: "client", label: "client", x: 55, y: 80, state: "idle" },
      { id: "api", label: "api", x: 200, y: 80, state: "active" },
      {
        id: "checkout",
        label: "checkout",
        // `exactOptionalPropertyTypes` proíbe atribuir undefined a prop opcional.
        ...(orphan ? { sublabel: "orphan trace" } : {}),
        x: 345,
        y: 80,
        state: orphan ? ("error" as const) : ("idle" as const),
      },
    ],
    edges: [
      {
        from: "client",
        to: "api",
        ...(state.hop === 0 ? { progress: state.progress } : {}),
      },
      {
        from: "api",
        to: "checkout",
        dropped: !propagate,
        ...(state.hop === 1 ? { progress: state.progress } : {}),
      },
    ],
  };
}

export function HeroSim() {
  const [propagate, setPropagate] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [level, setLevel] = useState<LevelId>("flow");
  const [tick, setTick] = useState(0);
  const [speed, setSpeed] = useState<number>(1);

  const engine = useMemo(() => new Engine(heroScenario, { propagate }), [propagate]);
  const frame = useRef<number | undefined>(undefined);

  useEffect(() => {
    setTick(0);
  }, [engine]);

  useEffect(() => {
    if (!playing) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    let last = performance.now();
    const loop = (now: number) => {
      if (now - last >= BASE_INTERVAL_MS / speed) {
        last = now;
        setTick((t) => (t + 1) % (MAX_TICK + 1));
      }
      frame.current = requestAnimationFrame(loop);
    };
    frame.current = requestAnimationFrame(loop);
    return () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    };
  }, [playing, engine, speed]);

  engine.seek(tick);
  const state = engine.state;
  const previous = engine.previousState;

  const payload = toOtlpJson({ attributes: [] }, state.spans);
  const previousPayload = previous
    ? toOtlpJson({ attributes: [] }, previous.spans)
    : payload;
  const changedPaths = diffStates(previousPayload, payload);

  return (
    <div className="hero-sim">
      <div className="hero-sim__controls">
        <label className="hero-sim__toggle">
          <input
            type="checkbox"
            checked={propagate}
            onChange={(event) => setPropagate(event.target.checked)}
          />
          Propagate <code>traceparent</code>
        </label>
        <p className="hero-sim__header mono">
          {state.header ?? "— no header on the wire —"}
        </p>
      </div>

      <DepthShell
        levels={engine.levels}
        activeLevel={level}
        onChangeLevel={setLevel}
        labels={LEVEL_LABELS}
        context={
          level === "flow" ? (
            <Inspector value={payload} changedPaths={changedPaths} label="OTLP payload" />
          ) : null
        }
      >
        {level === "flow" ? (
          <FlowDiagram view={toFlowView(state, propagate)} />
        ) : (
          <Inspector value={payload} changedPaths={changedPaths} label="OTLP payload" />
        )}
      </DepthShell>

      <Timeline
        tick={tick}
        maxTick={MAX_TICK}
        playing={playing}
        onSeek={(t) => {
          setPlaying(false);
          setTick(t);
        }}
        onTogglePlay={() => setPlaying((p) => !p)}
        speed={speed}
        speeds={SPEEDS}
        onChangeSpeed={setSpeed}
      />
    </div>
  );
}
