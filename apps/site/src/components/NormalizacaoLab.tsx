import {
  anomaliasDa,
  AVALIACAO_DO_EXEMPLO,
  createTable,
  DADOS,
  ENDPOINTS_DO_ALUNO,
  ETAPAS,
  fatosIniciais,
  filmeDaNormalizacao,
  tabelasDa,
  TELECENTRO_DO_EXEMPLO,
  type DetalheDaNormalizacao,
  type Etapa,
  type TabelaDaEtapa,
  type Valor,
} from "@ovh/database-domain";
import { MotionPlayer } from "@ovh/motion/react";
import { useMemo, useState } from "react";
import { celula, TabelaDeResultado } from "./BancoTabela";
import { ModosDoLab } from "./ModosDoLab";

function Painel({ d }: { d: DetalheDaNormalizacao }) {
  return (
    <div className="cpuvit-detail bdlab-detalhe">
      {d.sql === undefined ? null : (
        <pre className="mono bdlab-sql" aria-label="SQL statement" translate="no">
          {d.sql}
        </pre>
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
  const filme = useMemo(() => filmeDaNormalizacao(), []);
  return (
    <div className="cpuvit bdlab" data-testid="normalize-showcase">
      <MotionPlayer
        film={filme}
        label="The spreadsheet a telecentre monitor would keep, split step by step: first normal form, second, third — until the tables are the OpenLabs tables. Each step measures three anomalies; the last one takes the tables to the server and the Java API."
        renderDetail={(frame) => (frame.detail === undefined ? null : <Painel d={frame.detail} />)}
      />
    </div>
  );
}

const ROTULO: Readonly<Record<Etapa, string>> = { planilha: "Spreadsheet", "1fn": "1NF", "2fn": "2NF", "3fn": "3NF" };

/** O que cada etapa fez, e a dependência que motivou o corte. */
const POR_QUE: Readonly<Record<Etapa, string>> = {
  planilha: "One row per learner, written the way a monitor would. The telecentre is typed on every row, and every attempt is crammed into one cell — a list, not a value.",
  "1fn": "First normal form: one value per cell. The list is unpacked into one row per attempt, and the key becomes (id_aluno, id_avaliacao, dt_envio).",
  "2fn": "Second normal form: no column depends on only part of the key. nm_aluno depends on id_aluno alone; the assessment, lab and handbook depend on id_avaliacao alone. Each goes to a table keyed by what it depends on.",
  "3fn": "Third normal form: no column depends on another non-key column. nm_bairro depends on the telecentre, not on the learner; the handbook depends on the phase, the phase on the lab. Each link gets its own table — and these are the OpenLabs tables.",
};

const NOVO_TELECENTRO = { id_telecentro: 6, nm_telecentro: "Telecentro Novo Horizonte", nm_bairro: "Pirituba", nm_cidade: "São Paulo", sg_uf: "SP", nr_computadores: 8, ds_faixa_rede: "192.168.15.0/24", dt_inauguracao: "2026-12-01" };

type Acao = "nenhuma" | "renomear" | "inserir" | "apagar";

function Grade({ t, acender }: { t: TabelaDaEtapa; acender: (v: Valor, coluna: string, linha: number) => boolean }) {
  const fks = new Map((t.fks ?? []).map((f) => [f.coluna, f.tabela]));
  return (
    <div className="bdlab-resultado bdn-grade">
      <table>
        <caption className="mono" translate="no">
          {t.nome} · {t.linhas.length} rows
        </caption>
        <thead translate="no">
          <tr>
            {t.colunas.map((c) => (
              <th key={c} scope="col" className="mono" data-chave={t.chave.includes(c) ? "" : undefined}>
                {c}
                {t.chave.includes(c) ? <b className="bdlab-sigla">PK</b> : null}
                {fks.has(c) ? <b className="bdlab-sigla">FK</b> : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody translate="no">
          {t.linhas.map((l, i) => (
            <tr key={i} data-aceso={acender(null, "*", i) ? "" : undefined}>
              {l.map((v, j) => (
                <td key={j} data-nulo={v === null ? "" : undefined} data-longo={String(v ?? "").length > 40 ? "" : undefined} data-marca={acender(v, t.colunas[j] ?? "", i) ? "" : undefined}>
                  {celula(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Simulacao() {
  const [etapa, setEtapa] = useState<Etapa>("planilha");
  const [acao, setAcao] = useState<Acao>("nenhuma");
  const fatos = useMemo(() => fatosIniciais(), []);
  const comNovo = useMemo(() => ({ ...fatos, telecentros: [...fatos.telecentros, NOVO_TELECENTRO] }), [fatos]);
  const anomalias = anomaliasDa(etapa);
  const tabelas = acao === "inserir" && anomalias.telecentroSemAluno ? tabelasDa(etapa, comNovo) : tabelasDa(etapa, fatos);

  const acender =
    (t: TabelaDaEtapa) =>
    (v: Valor, coluna: string, linha: number): boolean => {
      if (acao === "renomear") return coluna !== "*" && v !== null && (v === TELECENTRO_DO_EXEMPLO || (coluna === "tentativas" && String(v).includes(TELECENTRO_DO_EXEMPLO)));
      if (acao === "inserir") return coluna === "*" && t.nome === "T_TELECENTRO" && t.linhas[linha]?.[0] === NOVO_TELECENTRO.id_telecentro;
      if (acao === "apagar") {
        const i = t.colunas.indexOf("id_avaliacao");
        return coluna === "*" && i >= 0 && t.linhas[linha]?.[i] === AVALIACAO_DO_EXEMPLO && (t.nome.startsWith("TENTATIVA") || t.nome === "T_TENTATIVA");
      }
      return false;
    };

  const veredito =
    acao === "renomear"
      ? {
          ok: anomalias.renomear === 1,
          texto:
            anomalias.renomear === 1
              ? `Rename ${TELECENTRO_DO_EXEMPLO}: 1 cell. The name lives in one place.`
              : `Rename ${TELECENTRO_DO_EXEMPLO}: ${anomalias.renomear} cells must change together. Miss one and the data contradicts itself.`,
        }
      : acao === "inserir"
        ? {
            ok: anomalias.telecentroSemAluno,
            texto: anomalias.telecentroSemAluno
              ? "A new telecentre, before its first learner: one row in T_TELECENTRO. Nothing else is needed."
              : "There is nowhere to put a telecentre with no learners: every row here is a learner (or an attempt). You would have to invent one, or leave its columns NULL.",
          }
        : acao === "apagar"
          ? {
              ok: anomalias.perdidos.length === 0,
              texto:
                anomalias.perdidos.length === 0
                  ? `Delete the attempts at assessment ${AVALIACAO_DO_EXEMPLO}: only the attempts go. The assessment, the lab and the handbook stay in their own tables.`
                  : `Delete the attempts at assessment ${AVALIACAO_DO_EXEMPLO}, and these names leave the data with them: ${anomalias.perdidos.map((p) => p.split("=")[1]).join(" · ")}.`,
            }
          : null;

  return (
    <div className="bdlab-sim bdn" data-testid="normalize-simulation">
      <div className="bdlab-abas" role="tablist" aria-label="Normal form">
        {ETAPAS.map((e) => (
          <button
            key={e}
            type="button"
            role="tab"
            aria-selected={etapa === e}
            className="bdlab-aba"
            onClick={() => {
              setEtapa(e);
              setAcao("nenhuma");
            }}
          >
            {ROTULO[e]}
          </button>
        ))}
      </div>
      <p className="bdn-porque">{POR_QUE[etapa]}</p>
      <dl className="bdn-medidas mono">
        <div>
          <dt>tables</dt>
          <dd>{tabelasDa(etapa).length}</dd>
        </div>
        <div>
          <dt>learners it can hold</dt>
          <dd>{anomalias.alunos} of 12</dd>
        </div>
        <div>
          <dt>cells to rename a telecentre</dt>
          <dd>{anomalias.renomear}</dd>
        </div>
      </dl>
      <div className="bdlab-erros">
        <p className="bdlab-h">Try an anomaly</p>
        <div>
          <button type="button" className="bdlab-erro" aria-pressed={acao === "renomear"} onClick={() => setAcao("renomear")}>
            Rename {TELECENTRO_DO_EXEMPLO}
          </button>
          <button type="button" className="bdlab-erro" aria-pressed={acao === "inserir"} onClick={() => setAcao("inserir")}>
            Open a telecentre with no learners
          </button>
          <button type="button" className="bdlab-erro" aria-pressed={acao === "apagar"} onClick={() => setAcao("apagar")}>
            Delete the attempts at assessment {AVALIACAO_DO_EXEMPLO}
          </button>
        </div>
      </div>
      {veredito === null ? null : (
        <p className="bdlab-resposta" data-ok={veredito.ok ? "" : undefined} role="status">
          {veredito.texto}
        </p>
      )}
      <div className="bdn-tabelas">
        {tabelas.map((t) => (
          <Grade key={t.nome} t={t} acender={acender(t)} />
        ))}
      </div>
      {etapa === "3fn" ? (
        <section className="bdn-servidor" aria-labelledby="bdn-servidor">
          <h3 id="bdn-servidor" className="bdlab-h">
            From the logical model to the server
          </h3>
          <p>
            The 3NF tables are the logical model. <code translate="no">CREATE TABLE</code> makes them physical; every primary key is an <code translate="no">IDENTITY</code>, so the Java API
            sends a POST without an id and the database answers with the next one. The API reads and writes these same tables:
          </p>
          <pre className="mono bdlab-sql" translate="no">
            {createTable("T_ALUNO", Math.max(...DADOS.T_ALUNO.linhas.map((l) => Number(l[0]))) + 1)}
          </pre>
          <div className="bdlab-resultado">
            <table>
              <caption className="mono">The Java API over T_ALUNO</caption>
              <thead>
                <tr>
                  <th scope="col">HTTP</th>
                  <th scope="col">Route</th>
                  <th scope="col">SQL</th>
                </tr>
              </thead>
              <tbody translate="no">
                {ENDPOINTS_DO_ALUNO.map((e) => (
                  <tr key={`${e.metodo} ${e.rota}`}>
                    <td className="mono">{e.metodo}</td>
                    <td className="mono">{e.rota}</td>
                    <td className="mono">{e.sql}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function NormalizacaoModos() {
  return <ModosDoLab showcase={() => <Vitrine />} simulation={() => <Simulacao />} inicial="showcase" />;
}
