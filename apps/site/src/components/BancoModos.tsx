import { filmeDoBanco, TOM_DA_FICHA, type DetalheDoBanco, type ErroDoFilme, type Juncao } from "@ovh/database-domain";
import { MotionPlayer, type MotionView } from "@ovh/motion/react";
import { lazy, Suspense, useMemo, useState } from "react";
import { BancoDicionario } from "./BancoDicionario";
import { BancoLab } from "./BancoLab";
import { TabelaDeResultado } from "./BancoTabela";
import { VistaDiagrama } from "./BancoVistas";
import { ModosDoLab } from "./ModosDoLab";

const IsoStage = lazy(() => import("@ovh/stage3d").then((m) => ({ default: m.IsoStage })));

const ERROS: readonly { id: ErroDoFilme; rotulo: string }[] = [
  { id: "pai", rotulo: "telecentre 77" },
  { id: "nota", rotulo: "grade 11" },
  { id: "repetido", rotulo: "same lab twice" },
];

function Painel({ d }: { d: DetalheDoBanco }) {
  return (
    <div className="cpuvit-detail bdlab-detalhe">
      <pre className="mono bdlab-sql" aria-label="SQL statement">
        {d.sql}
      </pre>
      {d.resposta === undefined ? null : (
        <p className="mono bdlab-resposta" data-ok={d.resposta.ok ? "" : undefined}>
          {d.resposta.texto}
        </p>
      )}
      <dl className="cpuvit-linhas mono">
        {d.linhas.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {d.resultado === undefined ? null : <TabelaDeResultado r={d.resultado} legenda={`${d.resultado.titulo} · ${d.resultado.total} rows`} />}
    </div>
  );
}

function Vitrine() {
  const [erro, setErro] = useState<ErroDoFilme>("pai");
  const [juncao, setJuncao] = useState<Juncao>("left");
  const filme = useMemo(() => filmeDoBanco({ erro, juncao }), [erro, juncao]);
  // O diagrama abre primeiro: é o desenho que a disciplina pede (tabelas,
  // chaves, cardinalidade). Blocks e 3D contam a mesma história no mesmo relógio.
  const vistas: readonly MotionView<DetalheDoBanco>[] = [
    { id: "diagrama", label: "Diagram", render: ({ film: f, frame, label }) => <VistaDiagrama film={f} frame={frame} label={label} /> },
    {
      id: "iso",
      label: "3D",
      render: ({ film: f, t, frame, label }) => (
        <Suspense fallback={<div className="iso-stage" aria-busy="true" />}>
          <IsoStage film={f} t={t} frame={frame} label={label} />
        </Suspense>
      ),
    },
  ];
  return (
    <div className="cpuvit bdlab" data-testid="database-showcase">
      <MotionPlayer
        film={filme}
        views={vistas}
        initialView="diagrama"
        flatLabel="Blocks"
        label="The OpenLabs database in a community telecentre: ten tables linked by foreign keys. A learner signs up and her row passes every rule; a bad write is refused; then three queries run — INNER JOIN, GROUP BY and LEFT OUTER JOIN."
        packetsTitle="Statements"
        packetLegend={[
          { label: "INSERT (DML)", tone: TOM_DA_FICHA.escrita },
          { label: "foreign key lookup", tone: TOM_DA_FICHA.chave },
          { label: "JOIN (DQL)", tone: TOM_DA_FICHA.juncao },
          { label: "GROUP BY", tone: TOM_DA_FICHA.grupo },
          { label: "refused", tone: TOM_DA_FICHA.recusa },
        ]}
        controls={
          <>
            <fieldset className="bdlab-escolha">
              <legend>Bad write</legend>
              {ERROS.map((e) => (
                <label key={e.id}>
                  <input type="radio" name="bd-erro" value={e.id} checked={erro === e.id} onChange={() => setErro(e.id)} />
                  <span>{e.rotulo}</span>
                </label>
              ))}
            </fieldset>
            <label className="ctxlab-switch" htmlFor="bd-left">
              <input id="bd-left" type="checkbox" role="switch" checked={juncao === "left"} onChange={(e) => setJuncao(e.target.checked ? "left" : "inner")} />
              <span className="ctxlab-switch__track" aria-hidden="true">
                <span />
              </span>
              <span>LEFT OUTER JOIN in query 3</span>
            </label>
          </>
        }
        renderDetail={(frame) => (frame.detail === undefined ? null : <Painel d={frame.detail} />)}
      />
    </div>
  );
}

export function BancoModos() {
  return (
    <>
      <ModosDoLab showcase={() => <Vitrine />} simulation={() => <BancoLab />} inicial="showcase" />
      <BancoDicionario />
    </>
  );
}
