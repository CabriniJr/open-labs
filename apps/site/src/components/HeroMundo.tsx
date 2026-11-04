import { frameAt } from "@ovh/motion";
import { MotionStage, useClock } from "@ovh/motion/react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { filmeDoMundo } from "../lib/mundo";
import { url } from "../lib/urls";

const IsoStage = lazy(() => import("@ovh/stage3d").then((m) => ({ default: m.IsoStage })));

/**
 * O topo da página: o mesmo motor nos três assuntos, em laço. Abre no plano
 * (SVG, imediato) e passa para o isométrico quando o three.js chega — quem não
 * tem WebGL fica no plano e não perde nada do que importa.
 */
export function HeroMundo() {
  const filme = useMemo(() => filmeDoMundo(), []);
  const clock = useClock({ duration: filme.duration, autoplay: true, loop: true });
  const [tresD, setTresD] = useState(false);
  useEffect(() => setTresD(true), []);
  const quadro = frameAt(filme, clock.t);
  const rotulo = "OpenTelemetry, Kubernetes and a CPU, on one isometric floor: spans reach a Collector, a Pod is scheduled, and a chip's lid lifts to show the silicon.";
  const plano = <MotionStage film={filme} t={clock.t} frame={quadro} label={rotulo} />;
  return (
    <div className="hero-mundo" data-testid="hero-mundo">
      <div className="hero-mundo__palco">{tresD ? <Suspense fallback={plano}><IsoStage film={filme} t={clock.t} frame={quadro} label={rotulo} /></Suspense> : plano}</div>
      <ul className="hero-mundo__ilhas">
        {[
          { id: "otel", nome: "OpenTelemetry", linha: "Where the Collector lives, and who holds a whole trace", href: "labs/agent-or-gateway" },
          { id: "k8s", nome: "Kubernetes", linha: "Declare it; watch the cluster keep it running", href: "labs/pod-lifecycle" },
          { id: "cpu", nome: "CPU", linha: "Lift the lid and follow one add down to five gates", href: "labs/cpu#showcase" },
        ].map((i) => (
          <li key={i.id} data-on={quadro.chapter?.id === i.id ? "" : undefined}>
            <a href={url(i.href)}>
              <b>{i.nome}</b>
              <span>{i.linha}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
