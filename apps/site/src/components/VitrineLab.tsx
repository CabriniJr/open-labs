import type { Film, Tone } from "@ovh/motion";
import { MotionPlayer, type MotionView } from "@ovh/motion/react";
import { lazy, Suspense, type ReactNode } from "react";

const IsoStage = lazy(() => import("@ovh/stage3d").then((m) => ({ default: m.IsoStage })));

interface DetalheDeNivel {
  readonly nivel: number;
  readonly linhas: readonly (readonly [string, string])[];
}

/**
 * O modo showcase de qualquer lab: o filme do mergulho, com vistas plana e
 * isométrica e um painel que diz em que nível a câmera está. O filme é do
 * domínio; aqui só se escolhe como ele é tocado.
 */
export function VitrineLab<D extends DetalheDeNivel>({ film, niveis, label, legenda, testId, tituloDosPacotes, controles }: { film: Film<D>; niveis: readonly string[]; label: string; legenda: readonly { label: string; tone: Tone }[]; testId: string; tituloDosPacotes: string; /** Escolhas do leitor que refazem o filme. */ controles?: ReactNode }) {
  const vistas: readonly MotionView<D>[] = [
    {
      id: "iso",
      label: "Iso",
      render: ({ film: f, t, frame, label: l }) => (
        <Suspense fallback={<div className="iso-stage" aria-busy="true" />}>
          <IsoStage film={f} t={t} frame={frame} label={l} />
        </Suspense>
      ),
    },
  ];
  return (
    <div className="cpuvit" data-testid={testId}>
      <MotionPlayer
        film={film}
        views={vistas}
        label={label}
        packetsTitle={tituloDosPacotes}
        packetLegend={legenda}
        controls={controles}
        renderDetail={(frame) => {
          const d = frame.detail;
          if (d === undefined) return null;
          return (
            <div className="cpuvit-detail">
              <ol className="cpuvit-niveis mono" aria-label="Level">
                {niveis.map((n, i) => (
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
