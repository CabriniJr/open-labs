import { useEffect, useState, type ReactNode } from "react";

/**
 * Os dois modos de um lab: SHOWCASE, o filme que conta o mecanismo com
 * câmera e narração, e SIMULATION, o modelo que o leitor desmonta. São duas
 * mídias do mesmo assunto, e nenhuma substitui a outra: o filme mostra o
 * caminho; a simulação deixa errar nele.
 *
 * A simulação abre por padrão (é ela que a suíte de desenho mede); `#showcase`
 * na URL abre o filme. Um modo aberto continua montado ao trocar, para a
 * simulação não perder o estado em que o leitor a deixou.
 */
export function ModosDoLab({ showcase, simulation, inicial = "simulation" }: { showcase: () => ReactNode; simulation: () => ReactNode; inicial?: "showcase" | "simulation" }) {
  const [modo, setModo] = useState(inicial);
  const [visto, setVisto] = useState<ReadonlySet<string>>(new Set([inicial]));
  useEffect(() => {
    if (window.location.hash === "#showcase") {
      setModo("showcase");
      setVisto((v) => new Set([...v, "showcase"]));
    }
  }, []);
  const escolher = (m: "showcase" | "simulation") => {
    setModo(m);
    setVisto((v) => new Set([...v, m]));
    try {
      history.replaceState(null, "", m === "showcase" ? "#showcase" : window.location.pathname + window.location.search);
    } catch {
      // Sem história, a escolha vale só nesta visita.
    }
  };
  return (
    <div className="modos" data-modo={modo}>
      <div className="modos__barra" role="tablist" aria-label="Lab mode">
        <button type="button" role="tab" aria-selected={modo === "showcase"} className="modos__aba" onClick={() => escolher("showcase")}>
          <span className="modos__icone" aria-hidden="true">▶</span>
          <span>
            <b>Showcase</b>
            <small>watch it run, level by level</small>
          </span>
        </button>
        <button type="button" role="tab" aria-selected={modo === "simulation"} className="modos__aba" onClick={() => escolher("simulation")}>
          <span className="modos__icone" aria-hidden="true">⚙</span>
          <span>
            <b>Simulation</b>
            <small>run your own program</small>
          </span>
        </button>
      </div>
      {visto.has("showcase") ? <div hidden={modo !== "showcase"}>{showcase()}</div> : null}
      {visto.has("simulation") ? <div hidden={modo !== "simulation"}>{simulation()}</div> : null}
    </div>
  );
}
