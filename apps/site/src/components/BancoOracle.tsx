import {
  CONFERIR_TABELAS,
  conferirConstraints,
  conferirLinhas,
  conferirRelacionamentos,
  CONSULTAS,
  provasDasRegras,
  resultadosDoDql,
  saidaDoDdl,
  saidaDoDml,
  SOBRE_A_CONSULTA,
  type Conferencia,
} from "@ovh/database-domain";
import { useState, type ReactNode } from "react";
import { localeReady } from "../lib/i18n";
import { url } from "../lib/urls";
import { TabelaDeResultado } from "./BancoTabela";

/**
 * O passo a passo para montar o banco no Oracle de verdade (o da FIAP), com
 * o SQL Developer e o Data Modeler: conectar, criar, conferir cada requisito
 * da disciplina com uma consulta, inserir, consultar, ver as regras recusando
 * e desenhar o diagrama. O que a tela deve mostrar vem do mesmo modelo que
 * gera os scripts (`oracle.ts`), então o guia não desatualiza.
 */

function Copiar({ texto }: { texto: string }) {
  const [estado, setEstado] = useState<"pronto" | "copiado" | "falhou">("pronto");
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setEstado("copiado");
    } catch {
      setEstado("falhou");
    }
    window.setTimeout(() => setEstado("pronto"), 2500);
  };
  return (
    <button type="button" className="bdo-copiar" onClick={() => void copiar()}>
      {estado === "copiado" ? "Copied" : estado === "falhou" ? "Select the text and press Ctrl+C" : "Copy"}
    </button>
  );
}

function Codigo({ sql, rotulo }: { sql: string; rotulo: string }) {
  return (
    <div className="bdo-codigo">
      <Copiar texto={sql} />
      <pre className="mono bdlab-sql" aria-label={rotulo}>
        {sql}
      </pre>
    </div>
  );
}

function Conferir({ c, titulo, legenda }: { c: Conferencia; titulo: string; legenda: string }) {
  return (
    <div className="bdo-conferir">
      <p className="bdo-subtitulo">{titulo}</p>
      <Codigo sql={c.sql} rotulo={titulo} />
      <TabelaDeResultado r={c.esperado} legenda={legenda} />
    </div>
  );
}

function Passo({ n, titulo, onde, children }: { n: number; titulo: string; onde?: string; children: ReactNode }) {
  return (
    <li className="bdo-passo">
      <div className="bdo-numero mono" aria-hidden="true">
        {n}
      </div>
      <div className="bdo-corpo">
        <h3>{titulo}</h3>
        {onde === undefined ? null : <p className="bdo-onde mono">{onde}</p>}
        {children}
      </div>
    </li>
  );
}

const Saida = ({ linhas, rotulo }: { linhas: readonly string[]; rotulo: string }) => (
  <div className="bdo-saida">
    <p className="bdo-subtitulo">{rotulo}</p>
    <pre className="mono">{linhas.join("\n")}</pre>
  </div>
);

export function BancoOracle({ trechoDoDdl }: { trechoDoDdl: string }) {
  const arquivos = ["01-ddl.sql", "02-dml.sql", "03-dql.sql", "ddl-para-o-data-modeler.sql"];
  const constraints = conferirConstraints();
  const resultados = resultadosDoDql();
  return (
    <section ref={localeReady} className="bdo" aria-labelledby="bdo-titulo" data-testid="database-oracle">
      <h2 id="bdo-titulo">Build it for real in Oracle, step by step</h2>
      <p className="bdo-intro">
        Everything above runs in your browser. Here you build the same database in a real Oracle server with Oracle SQL Developer, and check each part of the model on the way: the tables, their attributes, primary keys, foreign keys, relationships and cardinalities, the rows and the three queries.
      </p>
      <div className="bdo-baixar">
        <p className="bdo-subtitulo">The scripts (generated from the same model as this page)</p>
        <ul>
          {arquivos.map((a) => (
            <li key={a}>
              <a className="mono" href={url(`labs/telecentro-database/${a}`)} download={a}>
                {a}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <ol className="bdo-passos">
        <Passo n={1} titulo="Connect SQL Developer to the database" onde="SQL Developer → Connections panel → green “+” (New Database Connection)">
          <ul>
            <li>
              <b>Name:</b> anything that tells you which one it is, for example <code>openlabs</code>.
            </li>
            <li>
              <b>Username</b> and <b>Password:</b> your Oracle user, from whoever runs the server. Tick <b>Save Password</b>.
            </li>
            <li>
              <b>Connection Type:</b> Basic, with the <b>Hostname</b>, <b>Port</b> and <b>SID</b> or <b>Service name</b> of your server. For Oracle Database Express Edition installed on your own computer: <code>localhost</code>, <code>1521</code> and the service name <code>XEPDB1</code>.
            </li>
            <li>
              Click <b>Test</b>. The bottom left must say <b>Status: Success</b>. Then <b>Connect</b>: a SQL Worksheet opens, and that is where you paste or open the scripts.
            </li>
          </ul>
        </Passo>

        <Passo n={2} titulo="Create the tables and their rules (DDL)" onde="File → Open → 01-ddl.sql → Run Script (F5)">
          <p>
            DDL (Data Definition Language) builds the structure. <code>CREATE TABLE</code> makes each table with its attributes and types; <code>ALTER TABLE … ADD CONSTRAINT</code> adds the primary key, the unique values, the CHECK rules and, last, the foreign keys —
            which are the relationships. The comment above each foreign key gives its cardinality. This is how T_ALUNO is created:
          </p>
          <Codigo sql={trechoDoDdl} rotulo="T_ALUNO in 01-ddl.sql" />
          <p>
            Press <b>F5</b> (Run Script), not Ctrl+Enter: Ctrl+Enter runs only the statement under the cursor. The script begins by dropping the tables of an earlier run, so you can run it again whenever you want to start over.
          </p>
          <Saida linhas={saidaDoDdl()} rotulo="Script Output should show" />
        </Passo>

        <Passo n={3} titulo="Check the structure inside the database" onde="Same worksheet → paste each query → Ctrl+Enter → Query Result tab">
          <p>Oracle keeps a catalogue of everything you created. These three queries read it and show that each part of the model is really there.</p>
          <Conferir c={CONFERIR_TABELAS} titulo="The tables" legenda="10 rows" />
          <Conferir c={constraints} titulo="The keys and rules — P primary key, R foreign key (relationship), U unique, C CHECK" legenda="one line per kind of constraint" />
          <Conferir c={conferirRelacionamentos()} titulo="The relationships: which table each foreign key points to" legenda="10 rows — the 10 lines of the diagram" />
          <p>
            You can also see it with the mouse: in the Connections panel, open your connection → <b>Tables</b> (right-click → Refresh), click a table, and look at the <b>Columns</b> and <b>Constraints</b> tabs.
          </p>
        </Passo>

        <Passo n={4} titulo="Insert the sample rows (DML)" onde="File → Open → 02-dml.sql → Run Script (F5)">
          <p>
            DML (Data Manipulation Language) puts data in. The INSERTs go in foreign-key order — the tables that are pointed to first — and the script ends with <code>COMMIT</code>, which makes the rows permanent and visible to other sessions. Without
            it, closing SQL Developer throws them away.
          </p>
          <Saida linhas={saidaDoDml()} rotulo="Script Output should show" />
          <Conferir c={conferirLinhas()} titulo="How many rows each table has" legenda="10 rows" />
        </Passo>

        <Passo n={5} titulo="Ask the three questions (DQL)" onde="File → Open → 03-dql.sql → cursor inside a SELECT → Ctrl+Enter">
          <p>DQL (Data Query Language) is the SELECT. Put the cursor inside each query and press Ctrl+Enter; the answer appears in the Query Result tab. Names with accents may come in a slightly different order, depending on the server's sort setting.</p>
          {resultados.map((r, i) => (
            <div key={r.id} className="bdo-conferir">
              <p className="bdo-subtitulo">
                Query {i + 1} · {SOBRE_A_CONSULTA[r.id].pergunta}
              </p>
              <Codigo sql={CONSULTAS[i]?.sql ?? ""} rotulo={`Query ${i + 1}`} />
              <TabelaDeResultado r={r.esperado} legenda={`${r.esperado.linhas.length} rows`} />
            </div>
          ))}
        </Passo>

        <Passo n={6} titulo="Watch the rules refuse bad data" onde="Paste each statement → Ctrl+Enter → read the error">
          <p>Each of these breaks one rule. Oracle refuses it and nothing changes. In the message, your user appears where this page shows OPENLABS.</p>
          {provasDasRegras().map((p) => (
            <div key={p.rotulo} className="bdo-conferir">
              <p className="bdo-subtitulo">{p.rotulo}</p>
              <Codigo sql={p.sql} rotulo={p.rotulo} />
              <p className="mono bdlab-resposta">{p.erro}</p>
            </div>
          ))}
        </Passo>

        <Passo n={7} titulo="Draw the diagram in Oracle Data Modeler" onde="SQL Developer → File → Data Modeler → Import → Data Dictionary">
          <p>
            Oracle SQL Developer Data Modeler draws the diagram of the database: every table, attribute, primary key, foreign key, relationship and cardinality. It ships inside SQL Developer, and it can draw it from the tables you just created:
          </p>
          <ol>
            <li>
              <b>File → Data Modeler → Import → Data Dictionary</b>. Choose your connection → <b>Next</b>.
            </li>
            <li>
              Tick your user (schema) → <b>Next</b> → tick the 10 tables that start with <code>T_</code> → <b>Next</b> → <b>Finish</b>. The relational model opens with the tables, their columns, PK and FK, and one line per foreign key.
            </li>
            <li>
              No connection? <b>File → Data Modeler → Import → DDL File</b> → <code>ddl-para-o-data-modeler.sql</code> → choose Oracle Database 19c (or the closest) → <b>Next</b> → <b>Finish</b>. Same result.
            </li>
            <li>
              Tidy it: right-click the background → <b>Auto Layout</b>, then drag the tables until no line crosses a table. Group them as in the Diagram view above: registration, tracking, catalogue.
            </li>
            <li>
              For crow's feet with entities: the <b>Engineer to Logical Model</b> button (the double arrow on the toolbar) → <b>Engineer</b>. In the logical diagram, right-click the background → <b>Notation</b> → Information Engineering.
            </li>
            <li>
              Export: <b>File → Data Modeler → Print Diagram → To Image File</b> (PNG) or <b>To PDF File</b>, to keep it or share it.
            </li>
          </ol>
        </Passo>

      </ol>

      <div className="bdo-problemas">
        <h3>When something goes wrong</h3>
        <dl>
          <div>
            <dt className="mono">ORA-01017: invalid username/password</dt>
            <dd>User or password wrong in the connection. Edit it (right-click → Properties) and Test again.</dd>
          </div>
          <div>
            <dt className="mono">ORA-00942: table or view does not exist</dt>
            <dd>You ran the DML or the DQL before the DDL, or on another connection. Run 01-ddl.sql first.</dd>
          </div>
          <div>
            <dt className="mono">ORA-00955: name is already used by an existing object</dt>
            <dd>You ran only part of the DDL with Ctrl+Enter. Run the whole file with F5: its first block drops the old tables.</dd>
          </div>
          <div>
            <dt className="mono">ORA-00001 while running 02-dml.sql</dt>
            <dd>The rows are already there from an earlier run. Run 01-ddl.sql again (it starts from empty tables) and then 02-dml.sql.</dd>
          </div>
          <div>
            <dt>Accents come out garbled</dt>
            <dd>Tools → Preferences → Environment → Encoding: UTF-8, then reopen the file.</dd>
          </div>
          <div>
            <dt>The rows vanished after I closed SQL Developer</dt>
            <dd>The COMMIT did not run. Run the whole 02-dml.sql with F5 — it ends with COMMIT.</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
