import { filmeDaVitrineOtel } from "@ovh/otel-domain";
import { useMemo } from "react";
import { VitrineLab } from "./VitrineLab";

/** O modo showcase do pipeline: dos serviços ao envelope OTLP que vai no fio. */
export function CollectorVitrine() {
  const filme = useMemo(() => filmeDaVitrineOtel(), []);
  return (
    <VitrineLab
      film={filme}
      testId="collector-showcase"
      niveis={["services", "pipeline", "batch", "envelope"]}
      label="Spans from two services, followed into the Collector's traces pipeline, the batch processor and the OTLP request it exports."
      tituloDosPacotes="Packet flow"
      legenda={[
        { label: "checkout spans", tone: "kind-1" },
        { label: "payments spans", tone: "kind-3" },
        { label: "Collector", tone: "conduit" },
      ]}
    />
  );
}
