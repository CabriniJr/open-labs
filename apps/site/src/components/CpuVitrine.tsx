import { filmeDaVitrine, type DetalheDaVitrine } from "@ovh/cpu-domain";
import { MotionPlayer, type MotionView } from "@ovh/motion/react";
import { lazy, Suspense, useMemo } from "react";

const IsoStage = lazy(() => import("@ovh/stage3d").then((m) => ({ default: m.IsoStage })));

const VISTAS: readonly MotionView<DetalheDaVitrine>[] = [
  {
    id: "iso",
    label: "Iso",
    render: ({ film, t, frame, label }) => (
      <Suspense fallback={<div className="iso-stage" aria-busy="true" />}>
        <IsoStage film={film} t={t} frame={frame} label={label} />
      </Suspense>
    ),
  },
];

const NIVEIS = ["board", "datapath", "ALU", "adder", "gates"];

/** O modo showcase da CPU: o filme do mergulho, com o painel do nível em que a câmera está. */
export function CpuVitrine() {
  const filme = useMemo(() => filmeDaVitrine(), []);
  return (
    <div className="cpuvit" data-testid="cpu-showcase">
      <MotionPlayer
        film={filme}
        views={VISTAS}
        label="One add instruction, followed from the board down to the logic gates of one adder bit."
        packetsTitle="What crossed each level"
        packetLegend={[
          { label: "instruction / result", tone: "kind-1" },
          { label: "register values", tone: "kind-2" },
          { label: "bits that are 1", tone: "high" },
        ]}
        renderDetail={(frame) => {
          const d = frame.detail;
          if (d === undefined) return null;
          return (
            <div className="cpuvit-detail">
              <ol className="cpuvit-niveis mono" aria-label="Level">
                {NIVEIS.map((n, i) => (
                  <li key={n} data-on={i === d.nivel ? "" : undefined} data-done={i < d.nivel ? "" : undefined}>
                    {n}
                  </li>
                ))}
              </ol>
              <dl className="cpuvit-linhas mono">
                {d.linhas.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        }}
      />
    </div>
  );
}
