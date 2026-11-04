import { filmeDaVitrineDaCardinalidade } from "@ovh/otel-domain";
import { useMemo, useState } from "react";
import { CardinalidadeLab } from "./CardinalidadeLab";
import { ModosDoLab } from "./ModosDoLab";
import { VitrineLab } from "./VitrineLab";

/**
 * O showcase da cardinalidade: o cubo de séries crescendo atributo a atributo,
 * e as chaves que cada ponto carrega no fio. O id do cliente refaz o filme.
 */
function Vitrine() {
  const [comCliente, setComCliente] = useState(true);
  const filme = useMemo(() => filmeDaVitrineDaCardinalidade({ comCliente }), [comCliente]);
  return (
    <VitrineLab
      film={filme}
      testId="cardinality-showcase"
      niveis={["one series", "row & grid", "cube", "wire"]}
      label="A latency histogram gains attributes one at a time; every attribute multiplies the series into a row, a grid and a cube, and an id attribute repeats the cube once per customer."
      tituloDosPacotes="Points"
      legenda={[
        { label: "series", tone: "kind-4" },
        { label: "per customer", tone: "live" },
      ]}
      controles={
        <label className="ctxlab-switch" htmlFor="cd-cliente">
          <input id="cd-cliente" type="checkbox" role="switch" checked={comCliente} onChange={(e) => setComCliente(e.target.checked)} />
          <span className="ctxlab-switch__track" aria-hidden="true">
            <span />
          </span>
          <span>Add enduser.id</span>
        </label>
      }
    />
  );
}

export function CardinalidadeModos() {
  return <ModosDoLab showcase={() => <Vitrine />} simulation={() => <CardinalidadeLab />} />;
}
