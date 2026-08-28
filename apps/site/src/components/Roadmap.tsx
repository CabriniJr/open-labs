import { useEffect, useState } from "react";
import {
  ANNEX_W,
  ANNEX_X,
  LEFT_X,
  MAP_HEIGHT,
  MAP_WIDTH,
  NODE_W,
  PHASE_W,
  PHASE_X,
  RIGHT_X,
  SPINE_X,
  annexes,
  labs,
  phases,
  type RoadmapAnnex,
  type RoadmapLab,
} from "../data/roadmap.js";

const STORAGE_KEY = "ovh:progress:v1";

function readProgress(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeProgress(ids: readonly string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Modo privado ou storage cheio: o mapa segue funcionando sem memória.
  }
}

const pct = (value: number, total: number): string => `${(value / total) * 100}%`;

/**
 * A ordem do array `labs` já agrupa por fase (as fases estão em ordem crescente
 * de `phase` e os labs de cada fase aparecem contíguos), e cada anexo se prende
 * a um lab específico via `afterLab`. Para o desktop isso não importa — os nós
 * são posicionados em % pelas coordenadas x/y. Mas no mobile o mapa vira uma
 * lista empilhada na ordem do DOM, e essa ordem precisa ser a ordem de leitura:
 * fase 1, seus labs (com os anexos logo após o lab a que se prendem), fase 2,
 * seus labs, ... Por isso montamos aqui uma única sequência de itens tipados
 * (fase | lab | anexo) em vez de renderizar três `.map` separados.
 */
type RoadmapItem =
  | { kind: "phase"; phase: (typeof phases)[number] }
  | { kind: "lab"; lab: RoadmapLab }
  | { kind: "annex"; annex: RoadmapAnnex };

function buildReadingOrder(): RoadmapItem[] {
  const annexesByLab = new Map<string, RoadmapAnnex[]>();
  for (const annex of annexes) {
    const bucket = annexesByLab.get(annex.afterLab) ?? [];
    bucket.push(annex);
    annexesByLab.set(annex.afterLab, bucket);
  }

  const items: RoadmapItem[] = [];
  for (const phase of phases) {
    items.push({ kind: "phase", phase });
    for (const lab of labs) {
      if (lab.phase !== phase.number) continue;
      items.push({ kind: "lab", lab });
      for (const annex of annexesByLab.get(lab.id) ?? []) {
        items.push({ kind: "annex", annex });
      }
    }
  }
  return items;
}

const readingOrder = buildReadingOrder();

export function Roadmap() {
  // Lido só depois da hidratação: o HTML do servidor não conhece o progresso
  // do leitor, e ler no render causaria divergência de hidratação.
  const [done, setDone] = useState<readonly string[]>([]);

  useEffect(() => {
    setDone(readProgress());
  }, []);

  const toggle = (id: string): void => {
    const next = done.includes(id) ? done.filter((d) => d !== id) : [...done, id];
    setDone(next);
    writeProgress(next);
  };

  const total = labs.length;
  const completed = done.length;

  return (
    <div className="roadmap">
      <div className="roadmap__progress">
        <span className="roadmap__progress-label mono">Your progress</span>
        <span className="roadmap__progress-count mono">
          {completed} of {total}
        </span>
        <div className="roadmap__progress-track">
          <div
            className="roadmap__progress-fill"
            style={{ width: pct(completed, total) }}
          />
        </div>
      </div>

      <div className="roadmap__map">
        <svg
          className="roadmap__wires"
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          aria-hidden="true"
          focusable="false"
        >
          <line x1={SPINE_X} y1={31} x2={SPINE_X} y2={814} />
          {labs.map((lab) => (
            <line
              key={lab.id}
              x1={SPINE_X}
              y1={lab.y}
              x2={lab.side === "left" ? LEFT_X + NODE_W : RIGHT_X}
              y2={lab.y}
            />
          ))}
          {annexes.map((annex) => (
            <line
              key={annex.id}
              className="roadmap__wire--annex"
              x1={LEFT_X}
              y1={annex.y}
              x2={ANNEX_X + ANNEX_W}
              y2={annex.y}
            />
          ))}
        </svg>

        <div className="roadmap__nodes">
          {readingOrder.map((item) => {
            if (item.kind === "phase") {
              const phase = item.phase;
              return (
                <p
                  key={`phase-${phase.number}`}
                  className="roadmap__phase mono"
                  style={{
                    left: pct(PHASE_X, MAP_WIDTH),
                    top: pct(phase.y, MAP_HEIGHT),
                    width: pct(PHASE_W, MAP_WIDTH),
                  }}
                >
                  Phase {phase.number} · {phase.title}
                </p>
              );
            }

            if (item.kind === "annex") {
              const annex = item.annex;
              return (
                <p
                  key={annex.id}
                  className="roadmap__annex mono"
                  style={{
                    left: pct(ANNEX_X, MAP_WIDTH),
                    top: pct(annex.y, MAP_HEIGHT),
                    width: pct(ANNEX_W, MAP_WIDTH),
                  }}
                >
                  {annex.title}
                </p>
              );
            }

            const lab = item.lab;
            const isDone = done.includes(lab.id);
            const status = lab.status === "coming" ? "coming" : isDone ? "done" : "available";
            return (
              <div
                key={lab.id}
                className="roadmap__node"
                data-status={status}
                style={{
                  left: pct(lab.side === "left" ? LEFT_X : RIGHT_X, MAP_WIDTH),
                  top: pct(lab.y, MAP_HEIGHT),
                  width: pct(NODE_W, MAP_WIDTH),
                }}
              >
                {lab.status === "coming" ? (
                  <span className="roadmap__node-title">{lab.title}</span>
                ) : (
                  <a className="roadmap__node-title" href={lab.href}>
                    {lab.title}
                  </a>
                )}
                {lab.status === "coming" ? null : (
                  <button
                    type="button"
                    className="roadmap__check"
                    aria-pressed={isDone}
                    aria-label={`Mark ${lab.title} as done`}
                    onClick={() => toggle(lab.id)}
                  >
                    <svg viewBox="0 0 14 14" aria-hidden="true" focusable="false">
                      <path d="M3 7.2 L5.6 9.8 L11 4.2" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <ul className="roadmap__legend mono">
        <li data-status="done">done</li>
        <li data-status="available">where you are</li>
        <li data-status="coming">not written yet</li>
        <li data-status="annex">The Wire · reference, not a step</li>
      </ul>
    </div>
  );
}
