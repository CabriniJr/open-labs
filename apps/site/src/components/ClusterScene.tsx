import { filmeDaTransicao, type ClusterState } from "@ovh/kubernetes-domain";
import type { Film } from "@ovh/motion";
import { MotionStage } from "@ovh/motion/react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { clusterResourceIds } from "../lib/cluster-inspector.js";

const IsoStage = lazy(() => import("@ovh/stage3d").then((m) => ({ default: m.IsoStage })));

/**
 * O cluster no espaço, plano ou isométrico, a partir do MESMO estado do lab.
 *
 * Cada passo do modelo vira um filme curto de antes para depois; o relógio
 * aqui só o toca. Voltar no histórico também é uma transição — do estado que
 * estava na tela para o que o leitor escolheu —, então nada pula.
 */
function useTransicao(state: Readonly<ClusterState>): { filme: Film<null>; t: number } {
  const anterior = useRef<Readonly<ClusterState> | null>(null);
  const filme = useMemo(() => {
    const f = filmeDaTransicao(anterior.current, state);
    return f;
  }, [state]);
  useEffect(() => { anterior.current = state; }, [state]);
  const [clock, setClock] = useState({ film: filme, t: filme.duration });
  const setT = (t: number) => setClock({ film: filme, t });
  const t = clock.film === filme ? clock.t : 0;
  useEffect(() => {
    let reduzido = false;
    try {
      reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      reduzido = false;
    }
    if (reduzido || filme.duration <= 1) {
      setT(filme.duration);
      return;
    }
    setT(0);
    const inicio = performance.now();
    let id = requestAnimationFrame(function passo(agora) {
      const dt = agora - inicio;
      setT(Math.min(dt, filme.duration));
      if (dt < filme.duration) id = requestAnimationFrame(passo);
    });
    return () => cancelAnimationFrame(id);
  }, [filme]);
  return { filme, t };
}

export function ClusterScene({ state, modo, selected, onSelect }: { state: Readonly<ClusterState>; modo: "flat" | "iso" | "3d"; selected: string | null; onSelect: (id: string) => void }) {
  const { filme, t } = useTransicao(state);
  const rotulo = "Cluster view: control plane, pending queue and two nodes with their Pods and reserved requests";
  const selectedId = state.pods.some(p => p.uid === selected) ? `pod:${selected}` : selected;
  const selectableIds = useMemo(() => clusterResourceIds(state), [state]);
  const select = (id: string) => {
    if (id.startsWith("pod:")) { const uid = id.slice(4); if (state.pods.some(p => p.uid === uid)) onSelect(uid); }
    else if (["plano", "fila", "controlador", "escalonador"].includes(id) || id.startsWith("no:")) onSelect(id);
  };
  return (
    <div className="podlab-cluster" data-testid="cluster-scene" data-modo={modo}>
      {modo !== "flat" ? (
        <Suspense fallback={<div className="iso-stage" aria-busy="true" />}>
          <IsoStage film={filme} t={t} label={rotulo} projection={modo === "3d" ? "perspective" : "orthographic"} selected={selectedId} onSelect={select} selectableIds={selectableIds} />
        </Suspense>
      ) : (
        <MotionStage film={filme} t={t} label={rotulo} selected={selectedId} onSelect={select} spatialControls={false} />
      )}
    </div>
  );
}
