import { filmeDaVitrine } from "@ovh/cpu-domain";
import { useMemo } from "react";
import { VitrineLab } from "./VitrineLab";

/** O modo showcase da CPU: do chip às portas de um bit, sobre a execução real. */
export function CpuVitrine() {
  const filme = useMemo(() => filmeDaVitrine(), []);
  return (
    <VitrineLab
      film={filme}
      testId="cpu-showcase"
      niveis={["board", "die", "datapath", "ALU", "adder", "gates"]}
      label="One add instruction, followed from the board down to the logic gates of one adder bit."
      tituloDosPacotes="What crossed each level"
      legenda={[
        { label: "instruction / result", tone: "kind-1" },
        { label: "register values", tone: "kind-2" },
        { label: "bits that are 1", tone: "high" },
      ]}
    />
  );
}
