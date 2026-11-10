// locale: skip-file — SQL e saída do Oracle: não se traduzem.
import { DADOS } from "./dados.js";
import { constraintsDe, TABELAS, type TipoDeConstraint } from "./esquema.js";
import { apagar, bancoInicial, consulta1, consulta2, consulta3, inserir, type Resultado } from "./motor.js";
import { TENTATIVAS_ERRADAS } from "./simulacao.js";
import { sqlDoInsert } from "./filme.js";

/**
 * O passo a passo no Oracle de verdade: as consultas que conferem cada
 * requisito da disciplina dentro do banco (as tabelas existem, as chaves
 * estão lá, as linhas entraram) e o que o SQL Developer deve mostrar. Os
 * números saem do esquema e do motor, nunca escritos à mão: se uma tabela
 * mudar, o guia muda junto.
 */

export interface Conferencia {
  readonly sql: string;
  readonly esperado: Resultado;
}

const T = "'T\\_%' ESCAPE '\\'";

/** As 10 tabelas criadas pelo 01-ddl.sql. */
export const CONFERIR_TABELAS: Conferencia = {
  sql: `SELECT table_name\n  FROM user_tables\n WHERE table_name LIKE ${T}\n ORDER BY table_name;`,
  esperado: { colunas: ["TABLE_NAME"], linhas: [...TABELAS].map((t) => [t.nome]).sort((a, b) => (String(a[0]) < String(b[0]) ? -1 : 1)) },
};

/** As constraints com nome, por tipo: P = chave primária, R = estrangeira, U = única, C = CHECK. */
export function conferirConstraints(): Conferencia {
  const conta: Record<TipoDeConstraint, number> = { PK: 0, FK: 0, UK: 0, CK: 0 };
  for (const t of TABELAS) for (const k of constraintsDe(t)) conta[k.tipo] += 1;
  return {
    sql: `SELECT constraint_type, COUNT(*) AS qt\n  FROM user_constraints\n WHERE table_name LIKE ${T}\n   AND constraint_name NOT LIKE 'SYS\\_%' ESCAPE '\\'\n GROUP BY constraint_type\n ORDER BY constraint_type;`,
    esperado: {
      colunas: ["CONSTRAINT_TYPE", "QT"],
      linhas: [
        ["C", conta.CK],
        ["P", conta.PK],
        ["R", conta.FK],
        ["U", conta.UK],
      ],
    },
  };
}

/** Os relacionamentos: cada chave estrangeira, de qual tabela para qual. */
export function conferirRelacionamentos(): Conferencia {
  const linhas = TABELAS.flatMap((t) => constraintsDe(t).filter((k) => k.tipo === "FK").map((k) => [t.nome, k.nome, k.referencia?.tabela ?? null] as const));
  linhas.sort((a, b) => (a[0] + a[1] < b[0] + b[1] ? -1 : 1));
  return {
    sql: `SELECT f.table_name      AS tabela_filha,\n       f.constraint_name AS chave_estrangeira,\n       p.table_name      AS tabela_pai\n  FROM user_constraints f\n  JOIN user_constraints p\n    ON p.constraint_name = f.r_constraint_name\n WHERE f.constraint_type = 'R'\n   AND f.table_name LIKE ${T}\n ORDER BY f.table_name, f.constraint_name;`,
    esperado: { colunas: ["TABELA_FILHA", "CHAVE_ESTRANGEIRA", "TABELA_PAI"], linhas },
  };
}

/** Quantas linhas o 02-dml.sql pôs em cada tabela. */
export function conferirLinhas(): Conferencia {
  return {
    sql: TABELAS.map((t, i) => `${i === 0 ? "" : "UNION ALL\n"}SELECT '${t.nome}' AS tabela, COUNT(*) AS qt FROM ${t.nome}`).join("\n") + ";",
    esperado: { colunas: ["TABELA", "QT"], linhas: TABELAS.map((t) => [t.nome, DADOS[t.nome].linhas.length]) },
  };
}

/** O que a aba Script Output mostra depois do 01-ddl.sql (F5). */
export function saidaDoDdl(): string[] {
  const alter = TABELAS.reduce((n, t) => n + constraintsDe(t).length, 0);
  const comentarios = TABELAS.reduce((n, t) => n + 1 + t.colunas.length, 0);
  return [
    "PL/SQL procedure successfully completed.",
    "",
    ...TABELAS.map((t) => `Table ${t.nome} created.`),
    "",
    `Table T_… altered.   (${alter} times: PK, UK, CHECK and FK)`,
    "",
    `Comment created.     (${comentarios} times)`,
  ];
}

/** O que a aba Script Output mostra depois do 02-dml.sql (F5). */
export function saidaDoDml(): string[] {
  const total = TABELAS.reduce((n, t) => n + DADOS[t.nome].linhas.length, 0);
  return [`1 row inserted.      (${total} times)`, "", "Commit complete."];
}

export interface ResultadoDaConsulta {
  readonly id: "consulta1" | "consulta2" | "consulta3";
  readonly esperado: Resultado;
}

/** O que cada consulta do 03-dql.sql devolve sobre os dados do 02-dml.sql. */
export function resultadosDoDql(): readonly ResultadoDaConsulta[] {
  const b = bancoInicial();
  return [
    { id: "consulta1", esperado: consulta1(b) },
    { id: "consulta2", esperado: consulta2(b) },
    { id: "consulta3", esperado: consulta3(b) },
  ];
}

export interface ProvaDaRegra {
  readonly rotulo: string;
  readonly sql: string;
  /** A mensagem que o Oracle devolve. */
  readonly erro: string;
}

/** Três escritas erradas para colar no SQL Developer e ver o banco dizer não. */
export function provasDasRegras(): readonly ProvaDaRegra[] {
  const b = bancoInicial();
  return ["nota", "pai", "apagar"].flatMap((id) => {
    const e = TENTATIVAS_ERRADAS.find((x) => x.id === id);
    if (e === undefined) return [];
    const v = e.valores(b);
    if (e.operacao === "delete") {
      const [col, val] = Object.entries(v)[0] ?? ["", null];
      const r = apagar(b, e.tabela, val);
      return [{ rotulo: e.rotulo, sql: `DELETE FROM ${e.tabela}\n WHERE ${col} = ${String(val)};`, erro: r.ok ? r.mensagem : r.recusa.mensagem }];
    }
    const r = inserir(b, e.tabela, v);
    return [{ rotulo: e.rotulo, sql: sqlDoInsert(e.tabela, v), erro: r.ok ? r.mensagem : r.recusa.mensagem }];
  });
}
