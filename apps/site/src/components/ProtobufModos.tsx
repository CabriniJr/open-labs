import { filmeDoProtobuf } from "@ovh/otel-domain";
import { useMemo } from "react";
import { ModosDoLab } from "./ModosDoLab";
import { ProtobufLab } from "./ProtobufLab";
import { VitrineLab } from "./VitrineLab";

/** O showcase do protobuf: um span, do objeto aos bytes do fio. */
function ProtobufVitrine() {
  const filme = useMemo(() => filmeDoProtobuf(), []);
  return (
    <VitrineLab
      film={filme}
      testId="protobuf-showcase"
      niveis={["object", "keys", "values", "nesting", "wire"]}
      label="One span encoded as OTLP protobuf, field by field: keys, varints, raw ids, fixed timestamps and nested messages."
      tituloDosPacotes="What was written"
      legenda={[
        { label: "text", tone: "kind-1" },
        { label: "raw bytes (ids)", tone: "kind-2" },
        { label: "varint", tone: "high" },
        { label: "fixed64", tone: "kind-4" },
        { label: "message header", tone: "conduit" },
      ]}
    />
  );
}

export function ProtobufModos() {
  return <ModosDoLab showcase={() => <ProtobufVitrine />} simulation={() => <ProtobufLab />} />;
}
