import {
  CONCEITOS,
  constraintsDe,
  GRUPO,
  ICONES_BANCO,
  LIGACOES_DO_BANCO,
  SOBRE_A_COLUNA,
  SOBRE_A_TABELA,
  TABELAS,
  TOM_DO_GRUPO,
  type GrupoDeTabela,
  type IdDoConceito,
  type Tabela,
} from "@ovh/database-domain";
import type { ReactNode } from "react";
import { Icone, siglas } from "./BancoVistas";

/**
 * "O que é o quê": o vocabulário do modelo relacional, cada termo com um
 * desenho igual ao do diagrama e o exemplo do OpenLabs; depois cada tabela,
 * coluna por coluna, com o papel de cada uma (PK, FK → para onde, UK, nulo,
 * regra); e os relacionamentos com a cardinalidade. Tudo lido do esquema — o
 * mesmo que gera o DDL —, então o que está aqui é o que está no banco.
 */

const NOME_DO_GRUPO: Readonly<Record<GrupoDeTabela, string>> = { cadastro: "registration", catalogo: "catalogue", acompanhamento: "tracking (associative)" };

const garfo = (min: 0 | 1, x = 60) => (
  <g className="bd-pontas" transform={`translate(${x} 0)`}>
    <path d="M -40 0 H 0 M 0 -7 L -14 0 M 0 0 L -14 0 M 0 7 L -14 0" />
    {min === 0 ? <circle className="bd-zero" cx={-20} cy={0} r={4} /> : <path d="M -19 -7 V 7" />}
  </g>
);

/** Um desenho por conceito, com as mesmas marcas do diagrama. */
const DESENHO: Readonly<Record<IdDoConceito, () => ReactNode>> = {
  tabela: () => (
    <g>
      <rect className="bd-corpo" x={-40} y={-26} width={80} height={52} rx={6} />
      <path className="bd-cabeca" d="M -40 -20 a 6 6 0 0 1 6 -6 H 34 a 6 6 0 0 1 6 6 V -12 H -40 Z" />
      {[-4, 6, 16].map((y) => (
        <path key={y} className="bd-grade" d={`M -34 ${y} H 34`} />
      ))}
    </g>
  ),
  atributo: () => (
    <g>
      <rect className="bd-corpo" x={-40} y={-26} width={80} height={52} rx={6} />
      <rect className="bd-realce" x={-38} y={-3} width={76} height={12} rx={3} />
      <text className="bd-mini" x={-34} y={6}>nm_aluno</text>
    </g>
  ),
  pk: () => (
    <g>
      <text className="bd-sigla bd-mini-sigla" data-sigla="PK" x={-40} y={5}>PK</text>
      <text className="bd-mini bd-mini-pk" x={-16} y={5}>id_aluno</text>
    </g>
  ),
  fk: () => (
    <g>
      <text className="bd-sigla bd-mini-sigla" data-sigla="FK" x={-54} y={-6}>FK</text>
      <text className="bd-mini" x={-34} y={-6}>id_telecentro</text>
      <path className="bd-seta" d="M -40 0 V 22 H -24" />
      <text className="bd-mini bd-mini-pk" x={-20} y={26}>T_TELECENTRO</text>
    </g>
  ),
  uk: () => (
    <g>
      <text className="bd-sigla bd-mini-sigla" data-sigla="UK" x={-40} y={5}>UK</text>
      <text className="bd-mini" x={-16} y={5}>ds_email</text>
    </g>
  ),
  nulo: () => <text className="bd-mini" x={-34} y={5}>ds_email?</text>,
  check: () => <text className="bd-mini" x={-52} y={5}>0 ≤ vl_nota ≤ 10</text>,
  relacionamento: () => (
    <g>
      <rect className="bd-corpo" x={-46} y={-12} width={26} height={24} rx={4} />
      <rect className="bd-corpo" x={20} y={-12} width={26} height={24} rx={4} />
      <path className="bd-seta" d="M -20 0 H 20" />
    </g>
  ),
  cardinalidade: () => (
    <g>
      <g className="bd-pontas" transform="translate(-6 -14)">
        <path d="M -40 0 H 0 M -6 -7 V 7 M -12 -7 V 7" />
      </g>
      <text className="bd-mini" x={2} y={-10}>1</text>
      <g transform="translate(-6 2)">{garfo(0, 0)}</g>
      <text className="bd-mini" x={2} y={6}>0..N</text>
      <g transform="translate(-6 18)">{garfo(1, 0)}</g>
      <text className="bd-mini" x={2} y={22}>1..N</text>
    </g>
  ),
  associativa: () => (
    <g>
      <rect className="bd-corpo" x={-48} y={-10} width={22} height={20} rx={4} />
      <rect className="bd-corpo bd-corpo-meio" x={-11} y={-10} width={22} height={20} rx={4} />
      <rect className="bd-corpo" x={26} y={-10} width={22} height={20} rx={4} />
      <path className="bd-seta" d="M -11 0 H -26 M 11 0 H 26" />
    </g>
  ),
};

function Siglas({ t, coluna }: { t: Tabela; coluna: string }) {
  const fk = (t.fks ?? []).find((f) => f.coluna === coluna);
  return (
    <>
      {siglas(t, coluna).map((s) => (
        <span key={s} className="bdd-sigla" data-sigla={s}>
          {s}
        </span>
      ))}
      {fk === undefined ? null : (
        <span className="bdd-alvo mono" translate="no">
          → {fk.tabela}
        </span>
      )}
    </>
  );
}

function regraDe(t: Tabela, coluna: string): string {
  const c = t.colunas.find((x) => x.nome === coluna);
  return [c?.nome === t.pk ? "IDENTITY" : "", c?.padrao === undefined ? "" : `DEFAULT ${c.padrao}`, c?.check === undefined ? "" : `CHECK ${c.check}`].filter(Boolean).join(" · ");
}

function CartaoDaTabela({ t }: { t: Tabela }) {
  const grupo = GRUPO[t.nome];
  const extras = constraintsDe(t).filter((k) => (k.tipo === "UK" && k.colunas.length > 1) || (k.tipo === "CK" && k.colunas.length === 0));
  const saem = LIGACOES_DO_BANCO.filter((l) => l.filha === t.nome);
  const chegam = LIGACOES_DO_BANCO.filter((l) => l.pai === t.nome);
  return (
    <article className="bdd-tabela" data-tone={TOM_DO_GRUPO[grupo]} id={`bd-${t.nome}`}>
      <header>
        <svg viewBox="0 0 24 24" className="bdd-icone" aria-hidden="true">
          <Icone g={ICONES_BANCO[t.nome]} x={0} y={0} s={24} />
        </svg>
        <div>
          <h4 className="mono" translate="no">
            {t.nome}
          </h4>
          <p className="bdd-grupo">{NOME_DO_GRUPO[grupo]}</p>
        </div>
      </header>
      <p className="bdd-sobre">{SOBRE_A_TABELA[t.nome]}</p>
      <div className="bdd-rolagem">
        <table>
          <thead>
            <tr>
              <th scope="col">Key</th>
              <th scope="col">Attribute</th>
              <th scope="col">Type</th>
              <th scope="col">Null?</th>
              <th scope="col">What it holds</th>
            </tr>
          </thead>
          <tbody>
            {t.colunas.map((c) => {
              const regra = regraDe(t, c.nome);
              return (
                <tr key={c.nome} data-pk={c.nome === t.pk ? "" : undefined}>
                  <td className="bdd-chave">
                    <Siglas t={t} coluna={c.nome} />
                  </td>
                  <td className="mono" translate="no">
                    {c.nome}
                  </td>
                  <td className="mono" translate="no">
                    {c.tipo}
                  </td>
                  <td className="mono" translate="no">
                    {c.nulo === true ? "NULL" : "NOT NULL"}
                  </td>
                  <td>
                    {SOBRE_A_COLUNA[t.nome][c.nome]}
                    {regra === "" ? null : (
                      <code className="bdd-regra" translate="no">
                        {regra}
                      </code>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {extras.length === 0 ? null : (
        <p className="bdd-extra">
          Table rules:{" "}
          {extras.map((k) => (
            <code key={k.nome} translate="no">
              {k.sql}
            </code>
          ))}
        </p>
      )}
      <ul className="bdd-rels">
        {saem.map((l) => (
          <li key={l.id}>
            <span className="mono" translate="no">
              {l.coluna}
            </span>{" "}
            → <a href={`#bd-${l.pai}`}>{l.pai}</a> · <b>{l.minimo === 1 ? "1..N" : "0..N"} : 1</b>
          </li>
        ))}
        {chegam.map((l) => (
          <li key={l.id}>
            <a href={`#bd-${l.filha}`}>{l.filha}</a> points here · <b>1 : {l.minimo === 1 ? "1..N" : "0..N"}</b>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function BancoDicionario() {
  return (
    <section className="bd bdd" aria-labelledby="bdd-titulo">
      <h3 id="bdd-titulo" className="bdlab-h">
        What is what
      </h3>
      <ul className="bdd-conceitos">
        {CONCEITOS.map((c) => (
          <li key={c.id}>
            <svg viewBox="-56 -32 112 64" aria-hidden="true" className="bdd-mini">
              {DESENHO[c.id]()}
            </svg>
            <div>
              <b>{c.nome}</b>
              <p>{c.oQueE}</p>
              <p className="bdd-aqui">{c.aqui}</p>
            </div>
          </li>
        ))}
      </ul>

      <h3 className="bdlab-h bdd-sub">Relationships and cardinalities</h3>
      <p className="bdd-sobre">
        Every line in the diagram is one of these {LIGACOES_DO_BANCO.length} foreign keys. Read each row as: one row of the first table is pointed to by 0 or many (or 1 or many) rows of the second; each row of the second points to exactly one.
      </p>
      <div className="bdd-rolagem">
        <table className="bdd-relacoes">
          <thead>
            <tr>
              <th scope="col">“1” side (parent)</th>
              <th scope="col">Cardinality</th>
              <th scope="col">“N” side (child)</th>
              <th scope="col">Foreign key</th>
            </tr>
          </thead>
          <tbody>
            {LIGACOES_DO_BANCO.map((l) => (
              <tr key={l.id}>
                <td className="mono" translate="no">
                  <a href={`#bd-${l.pai}`}>{l.pai}</a>
                </td>
                <td>
                  <b className="mono">1 : {l.minimo === 1 ? "1..N" : "0..N"}</b>
                </td>
                <td className="mono" translate="no">
                  <a href={`#bd-${l.filha}`}>{l.filha}</a>
                </td>
                <td className="mono" translate="no">
                  {l.filha}.{l.coluna} → {l.pai}.{l.pk}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="bdd-sobre">
        The two many-to-many relationships — learner × lab and learner × assessment — become the associative tables <span className="mono">T_PROGRESSO</span> and <span className="mono">T_TENTATIVA</span>, each linked 1:N to both sides.
      </p>

      <h3 className="bdlab-h bdd-sub">Every table, attribute by attribute</h3>
      <p className="bdd-sobre">
        <span className="bdd-sigla" data-sigla="PK">PK</span> primary key · <span className="bdd-sigla" data-sigla="FK">FK</span> foreign key (the arrow says which table it points to) · <span className="bdd-sigla" data-sigla="UK">UK</span> unique. The same marks as in the diagram.
      </p>
      <div className="bdd-tabelas">
        {TABELAS.map((t) => (
          <CartaoDaTabela key={t.nome} t={t} />
        ))}
      </div>
    </section>
  );
}
