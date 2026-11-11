// locale: skip-file — esquema, dados, SQL e mensagens do Oracle: identificadores e saída do banco, que não se traduzem.
// As três consultas pedidas pela disciplina, com o texto SQL que roda no
// Oracle. Daqui saem database/03-dql.sql e o painel do lab; a semântica de
// cada uma está em `motor.ts` (consulta1, consulta2, consulta3), e um teste
// confere os resultados dos dois lados.
// Sem imports: `database/gerar.mjs` lê este arquivo direto com o Node.
// A pergunta e a explicação de cada consulta, em inglês para o site, ficam em
// `labels.ts` (SOBRE_A_CONSULTA): este arquivo não entra no catálogo de tradução.

export interface Consulta {
  readonly id: "consulta1" | "consulta2" | "consulta3";
  /** O que a disciplina pede, como aparece no cabeçalho do script. */
  readonly titulo: string;
  /** O comentário do script, em português (o script é entregue em português). */
  readonly comentario: readonly string[];
  readonly sql: string;
}

export const CONSULTAS: readonly Consulta[] = [
  {
    id: "consulta1",
    titulo: "Consulta 1 — INNER JOIN entre duas tabelas",
    comentario: [
      "Pergunta: quem são os alunos cadastrados, e em qual telecentro cada um",
      "estuda?",
      "O INNER JOIN traz só as linhas que têm par nas duas tabelas: todo aluno",
      "tem um telecentro (a chave estrangeira garante), então todos aparecem.",
    ],
    sql: `SELECT a.id_aluno,
       a.nm_aluno,
       t.nm_telecentro,
       t.nm_bairro,
       t.nm_cidade,
       a.dt_cadastro
  FROM T_ALUNO a
 INNER JOIN T_TELECENTRO t
    ON t.id_telecentro = a.id_telecentro
 ORDER BY t.nm_telecentro, a.nm_aluno;`,
  },
  {
    id: "consulta2",
    titulo: "Consulta 2 — INNER JOIN entre duas tabelas, com agrupamento",
    comentario: [
      "Pergunta: quantos alunos ativos cada telecentro atende, e desde quando?",
      "É o indicador de impacto da CitizenTech. COUNT conta os alunos de cada",
      "grupo; MIN e MAX mostram o primeiro e o último cadastro; GROUP BY forma",
      "um grupo por telecentro.",
    ],
    sql: `SELECT t.nm_telecentro,
       t.nm_cidade,
       COUNT(a.id_aluno)  AS qt_alunos_ativos,
       MIN(a.dt_cadastro) AS dt_primeiro_cadastro,
       MAX(a.dt_cadastro) AS dt_ultimo_cadastro
  FROM T_TELECENTRO t
 INNER JOIN T_ALUNO a
    ON a.id_telecentro = t.id_telecentro
 WHERE a.st_ativo = 'S'
 GROUP BY t.nm_telecentro, t.nm_cidade
 ORDER BY qt_alunos_ativos DESC, t.nm_telecentro;`,
  },
  {
    id: "consulta3",
    titulo: "Consulta 3 — LEFT OUTER JOIN entre duas tabelas, com WHERE e ORDER BY",
    comentario: [
      "Pergunta: quais alunos ativos ainda não fizeram nenhuma avaliação?",
      "É a lista que o monitor usa para chamar quem pode estar com dificuldade.",
      "O LEFT OUTER JOIN mantém todos os alunos, inclusive os que não têm",
      "nenhuma tentativa — para esses, as colunas de T_TENTATIVA vêm NULL. O",
      "WHERE fica só com os ativos que vieram sem tentativa, e o ORDER BY põe",
      "primeiro quem está há mais tempo cadastrado.",
    ],
    sql: `SELECT a.id_aluno,
       a.nm_aluno,
       a.ds_email,
       a.dt_cadastro
  FROM T_ALUNO a
  LEFT OUTER JOIN T_TENTATIVA te
    ON te.id_aluno = a.id_aluno
 WHERE a.st_ativo = 'S'
   AND te.id_tentativa IS NULL
 ORDER BY a.dt_cadastro, a.nm_aluno;`,
  },
];

/** A consulta 3 com INNER JOIN no lugar do LEFT OUTER JOIN: o "quebre isto" do lab. */
export const CONSULTA3_COM_INNER = CONSULTAS[2]?.sql.replace("  LEFT OUTER JOIN T_TENTATIVA te", " INNER JOIN T_TENTATIVA te") ?? "";
