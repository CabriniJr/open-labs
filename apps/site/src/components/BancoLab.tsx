import {
  apagar,
  bancoInicial,
  consulta1,
  consulta2,
  consulta3,
  CONSULTA3_COM_INNER,
  CONSULTAS,
  EXPLICACAO_DO_ERRO,
  inserir,
  linhaValida,
  linhasDe,
  SOBRE_A_CONSULTA,
  SOBRE_A_TABELA,
  sqlDoInsert,
  tabela,
  TABELAS,
  TENTATIVAS_ERRADAS,
  type Banco,
  type Juncao,
  type NomeDaTabela,
  type Tentativa,
  type Valor,
} from "@ovh/database-domain";
import { useMemo, useState } from "react";
import { TabelaDeResultado } from "./BancoTabela";

/**
 * A simulação: o banco do telecentro rodando no navegador, com o mesmo esquema
 * e os mesmos dados dos scripts da entrega. O leitor escreve uma linha, tenta
 * os erros clássicos, olha as tabelas e roda as três consultas sobre o banco
 * que ele mesmo mudou. Nada vai para servidor nenhum: recarregar a página volta
 * ao estado do 02-dml.sql.
 */

type Formulario = Record<string, string>;

interface Saida {
  readonly n: number;
  readonly sql: string;
  readonly ok: boolean;
  readonly texto: string;
  readonly explicacao?: string;
}

const paraTexto = (v: Valor | undefined) => (v === null || v === undefined ? "" : String(v));

function formularioDe(b: Banco, nome: NomeDaTabela, valores?: Readonly<Record<string, Valor>>): Formulario {
  const v = valores ?? linhaValida(b, nome);
  return Object.fromEntries(tabela(nome).colunas.map((c) => [c.nome, paraTexto(v[c.nome])]));
}

/** Do formulário para valores: vazio é NULL (como no Oracle); número só onde a coluna é NUMBER e o texto é número. */
function valoresDe(nome: NomeDaTabela, f: Formulario): Record<string, Valor> {
  return Object.fromEntries(
    tabela(nome).colunas.map((c) => {
      const s = f[c.nome] ?? "";
      if (s === "") return [c.nome, null];
      if (c.tipo.startsWith("NUMBER") && /^-?\d+(\.\d+)?$/u.test(s.trim())) return [c.nome, Number(s)];
      return [c.nome, s];
    }),
  );
}

export function BancoLab() {
  const [banco, setBanco] = useState<Banco>(bancoInicial);
  const [nome, setNome] = useState<NomeDaTabela>("T_ALUNO");
  const [form, setForm] = useState<Formulario>(() => formularioDe(bancoInicial(), "T_ALUNO"));
  const [saidas, setSaidas] = useState<readonly Saida[]>([]);
  const [novas, setNovas] = useState<ReadonlySet<string>>(new Set());
  const [vendo, setVendo] = useState<NomeDaTabela>("T_ALUNO");
  const [consulta, setConsulta] = useState(0);
  const [juncao, setJuncao] = useState<Juncao>("left");

  const t = tabela(nome);
  const valores = useMemo(() => valoresDe(nome, form), [nome, form]);
  const sql = sqlDoInsert(nome, valores);

  const registrar = (s: Omit<Saida, "n">) => setSaidas((xs) => [{ ...s, n: (xs[0]?.n ?? 0) + 1 }, ...xs].slice(0, 6));

  const trocarTabela = (n: NomeDaTabela) => {
    setNome(n);
    setForm(formularioDe(banco, n));
  };

  const executar = (alvo: NomeDaTabela, v: Readonly<Record<string, Valor>>, texto: string) => {
    const r = inserir(banco, alvo, v);
    if (r.ok) {
      setBanco(r.banco);
      setNovas((s) => new Set([...s, `${alvo}:${String(r.linha[tabela(alvo).pk])}`]));
      setVendo(alvo);
      setForm(formularioDe(r.banco, alvo));
      registrar({ sql: texto, ok: true, texto: r.mensagem });
    } else {
      registrar({ sql: texto, ok: false, texto: r.recusa.mensagem, explicacao: EXPLICACAO_DO_ERRO[r.recusa.codigo] });
    }
  };

  const tentar = (e: Tentativa) => {
    const v = e.valores(banco);
    if (e.operacao === "delete") {
      const pk = tabela(e.tabela).pk;
      const texto = `DELETE FROM ${e.tabela}\n WHERE ${pk} = ${paraTexto(v[pk])};`;
      const r = apagar(banco, e.tabela, v[pk] ?? null);
      if (r.ok) {
        setBanco(r.banco);
        registrar({ sql: texto, ok: true, texto: r.mensagem });
      } else registrar({ sql: texto, ok: false, texto: r.recusa.mensagem, explicacao: EXPLICACAO_DO_ERRO[r.recusa.codigo] });
      return;
    }
    setNome(e.tabela);
    setForm(formularioDe(banco, e.tabela, v));
    executar(e.tabela, v, sqlDoInsert(e.tabela, v));
  };

  const recomecar = () => {
    const b = bancoInicial();
    setBanco(b);
    setNovas(new Set());
    setSaidas([]);
    setForm(formularioDe(b, nome));
  };

  const linhas = linhasDe(banco, vendo);
  const tv = tabela(vendo);
  const q = CONSULTAS[consulta];
  const resultado = consulta === 0 ? consulta1(banco) : consulta === 1 ? consulta2(banco) : consulta3(banco, juncao);
  const sqlDaConsulta = consulta === 2 && juncao === "inner" ? CONSULTA3_COM_INNER : (q?.sql ?? "");

  return (
    <div className="bdlab-sim" data-testid="database-simulation">
      <section className="bdlab-bloco" aria-labelledby="bd-escrever">
        <h3 id="bd-escrever" className="bdlab-h">
          1 · Write a row (INSERT)
        </h3>
        <div className="bdlab-escrever">
          <div className="bdlab-form">
            <label className="bdlab-campo bdlab-campo--tabela">
              <span>Table</span>
              <select value={nome} onChange={(e) => trocarTabela(e.target.value as NomeDaTabela)}>
                {TABELAS.map((x) => (
                  <option key={x.nome} value={x.nome} translate="no">
                    {x.nome}
                  </option>
                ))}
              </select>
            </label>
            {t.colunas.map((c) => (
              <label key={c.nome} className="bdlab-campo">
                <span className="mono" translate="no">
                  {c.nome}
                  {c.nome === t.pk ? <b className="bdlab-sigla">PK</b> : null}
                  {(t.fks ?? []).some((f) => f.coluna === c.nome) ? <b className="bdlab-sigla">FK</b> : null}
                  <small>
                    {c.tipo}
                    {c.nulo === true ? "" : " · NOT NULL"}
                  </small>
                </span>
                <input className="mono" value={form[c.nome] ?? ""} placeholder={c.nulo === true ? "NULL" : ""} onChange={(e) => setForm((f) => ({ ...f, [c.nome]: e.target.value }))} />
              </label>
            ))}
          </div>
          <div className="bdlab-acao">
            <pre className="mono bdlab-sql" aria-label="The INSERT that will run">
              {sql}
            </pre>
            <div className="bdlab-botoes">
              <button type="button" className="bdlab-executar" onClick={() => executar(nome, valores, sql)}>
                Run INSERT
              </button>
              <button type="button" className="bdlab-secundario" onClick={() => setForm(formularioDe(banco, nome))}>
                Fill a valid row
              </button>
              <button type="button" className="bdlab-secundario" onClick={recomecar}>
                Reset database
              </button>
            </div>
            <div className="bdlab-erros">
              <p className="bdlab-h">Try a mistake</p>
              <div>
                {TENTATIVAS_ERRADAS.map((e) => (
                  <button key={e.id} type="button" className="bdlab-erro" onClick={() => tentar(e)}>
                    {e.rotulo}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="bdlab-console" role="log" aria-live="polite" aria-label="Script output">
          {saidas.length === 0 ? <p className="bdlab-vazio">Script output appears here, like in SQL Developer.</p> : null}
          {saidas.map((s) => (
            <div key={s.n} className="bdlab-saida" data-ok={s.ok ? "" : undefined}>
              <pre className="mono">{s.sql}</pre>
              <p className="mono">{s.texto}</p>
              {s.explicacao === undefined ? null : <p className="bdlab-explica">{s.explicacao}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="bdlab-bloco" aria-labelledby="bd-ver">
        <h3 id="bd-ver" className="bdlab-h">
          2 · Look inside a table (SELECT *)
        </h3>
        <div className="bdlab-abas" role="tablist" aria-label="Table">
          {TABELAS.map((x) => (
            <button key={x.nome} type="button" role="tab" aria-selected={vendo === x.nome} className="bdlab-aba mono" translate="no" onClick={() => setVendo(x.nome)}>
              {x.nome} <small>{linhasDe(banco, x.nome).length}</small>
            </button>
          ))}
        </div>
        <p className="bdlab-descricao">{SOBRE_A_TABELA[vendo]}</p>
        <TabelaDeResultado
          r={{
            colunas: tv.colunas.map((c) => c.nome.toUpperCase()),
            linhas: linhas.map((l) => tv.colunas.map((c) => l[c.nome] ?? null)),
            destaque: linhas.flatMap((l, i) => (novas.has(`${vendo}:${String(l[tv.pk])}`) ? [i] : [])),
          }}
          legenda={`SELECT * FROM ${vendo}; · ${linhas.length} rows`}
        />
      </section>

      <section className="bdlab-bloco" aria-labelledby="bd-perguntar">
        <h3 id="bd-perguntar" className="bdlab-h">
          3 · Ask a question (three queries)
        </h3>
        <div className="bdlab-abas" role="tablist" aria-label="Query">
          {CONSULTAS.map((c, i) => (
            <button key={c.id} type="button" role="tab" aria-selected={consulta === i} className="bdlab-aba" onClick={() => setConsulta(i)}>
              Query {i + 1}
            </button>
          ))}
        </div>
        <p className="bdlab-pergunta">{q === undefined ? null : SOBRE_A_CONSULTA[q.id].pergunta}</p>
        {consulta === 2 ? (
          <label className="ctxlab-switch" htmlFor="bd-sim-left">
            <input id="bd-sim-left" type="checkbox" role="switch" checked={juncao === "left"} onChange={(e) => setJuncao(e.target.checked ? "left" : "inner")} />
            <span className="ctxlab-switch__track" aria-hidden="true">
              <span />
            </span>
            <span>LEFT OUTER JOIN (off: INNER JOIN)</span>
          </label>
        ) : null}
        <div className="bdlab-consulta">
          <pre className="mono bdlab-sql" aria-label="Query SQL">
            {sqlDaConsulta}
          </pre>
          <TabelaDeResultado r={resultado} legenda={`${resultado.linhas.length} rows`} />
        </div>
        <p className="bdlab-descricao">{q === undefined ? null : SOBRE_A_CONSULTA[q.id].juncao}</p>
      </section>
    </div>
  );
}
