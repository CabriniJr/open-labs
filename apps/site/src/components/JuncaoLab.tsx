import {
  ALUNOS,
  andamento,
  casa,
  comoResultado,
  filmeDaJuncao,
  ligar,
  NOTA_MINIMA,
  resultadoDaJuncao,
  sqlDaJuncao,
  TENTATIVAS,
  type Contagem,
  type DetalheDaJuncao,
  type Ligacao,
  type MotivoDaRecusa,
  type OndeFiltrar,
  type TipoDeJuncao,
} from "@ovh/database-domain";
import { MotionPlayer } from "@ovh/motion/react";
import { useMemo, useState } from "react";
import { TabelaDeResultado } from "./BancoTabela";
import { ModosDoLab } from "./ModosDoLab";

function Escolha<T extends string>({ legenda, nome, valor, opcoes, mudar }: { legenda: string; nome: string; valor: T; opcoes: readonly { id: T; rotulo: string }[]; mudar: (v: T) => void }) {
  return (
    <fieldset className="bdlab-escolha">
      <legend>{legenda}</legend>
      {opcoes.map((o) => (
        <label key={o.id}>
          <input type="radio" name={nome} value={o.id} checked={valor === o.id} onChange={() => mudar(o.id)} />
          <span translate="no">{o.rotulo}</span>
        </label>
      ))}
    </fieldset>
  );
}

const TIPOS: readonly { id: TipoDeJuncao; rotulo: string }[] = [
  { id: "left", rotulo: "LEFT OUTER JOIN" },
  { id: "inner", rotulo: "INNER JOIN" },
];
const CONTAGENS: readonly { id: Contagem; rotulo: string }[] = [
  { id: "estrela", rotulo: "COUNT(*)" },
  { id: "coluna", rotulo: "COUNT(te.id_tentativa)" },
];

function Painel({ d }: { d: DetalheDaJuncao }) {
  return (
    <div className="cpuvit-detail bdlab-detalhe">
      <pre className="mono bdlab-sql" aria-label="SQL statement" translate="no">
        {d.sql}
      </pre>
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
  const [tipo, setTipo] = useState<TipoDeJuncao>("left");
  const [filtro, setFiltro] = useState<"where" | "on">("where");
  const [contagem, setContagem] = useState<Contagem>("estrela");
  const filme = useMemo(() => filmeDaJuncao({ tipo, filtro, contagem }), [tipo, filtro, contagem]);
  return (
    <div className="cpuvit bdlab" data-testid="join-showcase">
      <MotionPlayer
        film={filme}
        label="Twelve learners in T_ALUNO and twelve attempts in T_TENTATIVA. The JOIN asks ON of every pair and draws a wire for each match; learners with no partner get NULL with LEFT JOIN or vanish with INNER JOIN; a grade filter in WHERE or in ON; and COUNT per learner."
        controls={
          <>
            <Escolha legenda="Join" nome="bdj-tipo" valor={tipo} opcoes={TIPOS} mudar={setTipo} />
            <Escolha
              legenda="Grade filter in"
              nome="bdj-filtro"
              valor={filtro}
              opcoes={[
                { id: "where", rotulo: "WHERE" },
                { id: "on", rotulo: "ON" },
              ]}
              mudar={setFiltro}
            />
            <Escolha legenda="Count" nome="bdj-conta" valor={contagem} opcoes={CONTAGENS} mudar={setContagem} />
          </>
        }
        renderDetail={(frame) => (frame.detail === undefined ? null : <Painel d={frame.detail} />)}
      />
    </div>
  );
}

const MOTIVO: Readonly<Record<MotivoDaRecusa, string>> = {
  "outro-aluno": "ON is false: that attempt belongs to another learner (look at its id_aluno).",
  "nota-baixa": `With the filter in ON, a grade below ${NOTA_MINIMA} is not a partner.`,
  "ja-ligada": "That attempt already has its partner: id_aluno holds one value, so an attempt belongs to one learner.",
};

function Simulacao() {
  const [tipo, setTipo] = useState<TipoDeJuncao>("left");
  const [filtro, setFiltro] = useState<OndeFiltrar>("sem");
  const [ligacoes, setLigacoes] = useState<readonly Ligacao[]>([]);
  const [escolhido, setEscolhido] = useState<number | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const o = { tipo, filtro };
  const a = andamento(ligacoes, o);
  const doBanco = resultadoDaJuncao(o);
  const meu = comoResultado(a.linhas);
  const iguais = a.completo && JSON.stringify(meu.linhas) === JSON.stringify(doBanco.linhas);

  const mudarFiltro = (f: OndeFiltrar) => {
    setFiltro(f);
    // Com o filtro no ON, um par de nota baixa deixa de ser par.
    setLigacoes((ls) => ls.filter((l) => casa(ALUNOS.find((x) => x.id_aluno === l.aluno)!, TENTATIVAS.find((x) => x.id_tentativa === l.tentativa)!, { filtro: f })));
    setAviso(null);
  };
  const tocarTentativa = (idTe: number) => {
    if (escolhido === null) {
      setAviso({ ok: false, texto: "Pick a learner on the left first." });
      return;
    }
    const r = ligar(ligacoes, escolhido, idTe, o);
    if (r.ok) {
      setLigacoes(r.ligacoes);
      setAviso({ ok: true, texto: `Pair: learner ${escolhido} ↔ attempt ${idTe}. ON is true.` });
    } else setAviso({ ok: false, texto: MOTIVO[r.motivo] });
  };
  const deixarOBanco = () => {
    let ls: readonly Ligacao[] = [];
    for (const al of ALUNOS)
      for (const te of TENTATIVAS) {
        const r = ligar(ls, Number(al.id_aluno), Number(te.id_tentativa), o);
        if (r.ok) ls = r.ligacoes;
      }
    setLigacoes(ls);
    setAviso({ ok: true, texto: "The database paired every row for which ON is true." });
  };

  return (
    <div className="bdlab-sim bdj" data-testid="join-simulation">
      <div className="bdj-controles">
        <Escolha legenda="Join" nome="bdj-sim-tipo" valor={tipo} opcoes={TIPOS} mudar={(t) => setTipo(t)} />
        <Escolha
          legenda={`Filter te.vl_nota >= ${NOTA_MINIMA}`}
          nome="bdj-sim-filtro"
          valor={filtro}
          opcoes={[
            { id: "sem", rotulo: "none" },
            { id: "where", rotulo: "in WHERE" },
            { id: "on", rotulo: "in ON" },
          ]}
          mudar={mudarFiltro}
        />
      </div>
      <p className="bdj-instrucao">
        Pair the rows yourself: pick a learner, then the attempts that are theirs. The database decides with <code translate="no">ON te.id_aluno = a.id_aluno</code>
        {filtro === "on" ? (
          <>
            {" "}
            <code translate="no">AND te.vl_nota &gt;= {NOTA_MINIMA}</code>
          </>
        ) : null}
        .
      </p>
      <p className="bdj-placar mono" aria-live="polite">
        {a.feitas} of {a.total} pairs found{a.completo ? " — complete" : ""}
      </p>
      {aviso === null ? null : (
        <p className="bdlab-resposta" data-ok={aviso.ok ? "" : undefined} role="status">
          {aviso.texto}
        </p>
      )}
      <div className="bdj-colunas">
        <section aria-labelledby="bdj-alunos">
          <h3 id="bdj-alunos" className="bdlab-h" translate="no">
            T_ALUNO a
          </h3>
          <ul className="bdj-lista">
            {ALUNOS.map((al) => {
              const id = Number(al.id_aluno);
              const minhas = ligacoes.filter((l) => l.aluno === id).map((l) => l.tentativa);
              return (
                <li key={id}>
                  <button type="button" className="bdj-linha" aria-pressed={escolhido === id} onClick={() => setEscolhido(id)} data-ligado={minhas.length > 0 ? "" : undefined}>
                    <span className="mono" translate="no">
                      {id} · {String(al.nm_aluno)}
                    </span>
                    <small className="mono" translate="no">
                      {minhas.length === 0 ? "—" : `→ te ${minhas.join(", te ")}`}
                    </small>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
        <section aria-labelledby="bdj-tentativas">
          <h3 id="bdj-tentativas" className="bdlab-h" translate="no">
            T_TENTATIVA te
          </h3>
          <ul className="bdj-lista">
            {TENTATIVAS.map((te) => {
              const id = Number(te.id_tentativa);
              const dono = ligacoes.find((l) => l.tentativa === id);
              return (
                <li key={id}>
                  <button type="button" className="bdj-linha bdj-linha--te" onClick={() => tocarTentativa(id)} data-ligado={dono === undefined ? undefined : ""} aria-label={`Attempt ${id}, id_aluno ${String(te.id_aluno)}, grade ${Number(te.vl_nota).toFixed(2)}`}>
                    <span className="mono" translate="no">
                      te {id} · id_aluno {String(te.id_aluno)}
                    </span>
                    <small className="mono" translate="no">
                      vl_nota {Number(te.vl_nota).toFixed(2)}
                      {dono === undefined ? "" : ` ← ${dono.aluno}`}
                    </small>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
      <div className="bdlab-botoes">
        <button type="button" className="bdlab-executar" onClick={deixarOBanco}>
          Let the database pair them
        </button>
        <button
          type="button"
          className="bdlab-secundario"
          onClick={() => {
            setLigacoes([]);
            setEscolhido(null);
            setAviso(null);
          }}
        >
          Start over
        </button>
      </div>
      <pre className="mono bdlab-sql" aria-label="The query" translate="no">
        {sqlDaJuncao(o)}
      </pre>
      <div className="bdj-resultados">
        <TabelaDeResultado r={meu} legenda={`Your result · ${meu.linhas.length} rows`} />
        <TabelaDeResultado r={doBanco} legenda={`The database's result · ${doBanco.linhas.length} rows`} />
      </div>
      <p className="bdlab-resposta" data-ok={iguais ? "" : undefined}>
        {iguais
          ? `Your rows are the database's rows: ${doBanco.linhas.length}.`
          : a.completo
            ? "All pairs found."
            : `${a.total - a.feitas} pairs still missing. Rows without a partner appear by themselves only with LEFT JOIN.`}
      </p>
    </div>
  );
}

export function JuncaoModos() {
  return <ModosDoLab showcase={() => <Vitrine />} simulation={() => <Simulacao />} inicial="showcase" />;
}
