import { filmeDaViagem, type CodificacaoDaViagem, type DetalheDaViagem } from "@ovh/otel-domain";
import { MotionPlayer, type MotionView } from "@ovh/motion/react";
import { lazy, Suspense, useMemo, useState } from "react";
import { ModosDoLab } from "./ModosDoLab";
import { ProtobufLab } from "./ProtobufLab";

const IsoStage = lazy(() => import("@ovh/stage3d").then((m) => ({ default: m.IsoStage })));

const VISTAS: readonly MotionView<DetalheDaViagem>[] = [
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

const NIVEIS = ["apps", "the span", "one field"];

/**
 * O showcase: o span é um papelzinho que pula de app em app, e a tela ao lado
 * soma o que cada um fez com ele, em verbos. A codificação e um atributo a mais
 * são do leitor, e refazem o filme: é ali que se vê o que pesa.
 */
function Viagem() {
  const [codificacao, setCodificacao] = useState<CodificacaoDaViagem>("protobuf");
  const [extra, setExtra] = useState(false);
  const filme = useMemo(() => filmeDaViagem({ codificacao, atributoExtra: extra }), [codificacao, extra]);
  return (
    <MotionPlayer
      film={filme}
      testId="protobuf-showcase"
      views={VISTAS}
      flatLabel="Flat"
      packetsTitle="What crossed the wire"
      packetLegend={[{ label: "checkout", tone: "conduit" }, { label: "payments", tone: "kind-3" }]}
      label="A span travels from the checkout app through the OpenTelemetry SDK and the Collector to the backend, and the screen lists what each one did with it."
      controls={
        <>
          <div className="deplab-modes" role="radiogroup" aria-label="Encoding">
            {(["protobuf", "json"] as const).map((c) => (
              <button key={c} type="button" role="radio" aria-checked={codificacao === c} onClick={() => setCodificacao(c)}>
                {c === "protobuf" ? "Protobuf" : "JSON"}
              </button>
            ))}
          </div>
          <label className="ctxlab-switch" htmlFor="pb-extra">
            <input id="pb-extra" type="checkbox" role="switch" checked={extra} onChange={(e) => setExtra(e.target.checked)} />
            <span className="ctxlab-switch__track" aria-hidden="true">
              <span />
            </span>
            <span>Add a user.id attribute</span>
          </label>
        </>
      }
      renderDetail={(frame, clock) => {
        const d = frame.detail;
        if (d === undefined) return null;
        return (
          <div className="pbtela">
            <ol className="pbtela__niveis mono" aria-label="Level">
              {NIVEIS.map((n, i) => (
                <li key={n} data-on={i === d.nivel ? "" : undefined}>
                  {n}
                </li>
              ))}
            </ol>
            <ol className="pbtela__diario" aria-label="What happened to the span">
              {d.diario.map((l, i) => (
                <li key={`${l.capitulo}:${l.verbo}`} data-tone={l.tom} data-novo={i === d.diario.length - 1 ? "" : undefined}>
                  <button type="button" onClick={() => clock.seek(filme.chapters[l.capitulo]!.start)}>
                    <b>{l.quem}</b> <span className="pbtela__verbo">{l.verbo}</span> <span className="mono">{l.resto}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        );
      }}
    />
  );
}

export function ProtobufModos() {
  return <ModosDoLab showcase={() => <Viagem />} simulation={() => <ProtobufLab />} />;
}
