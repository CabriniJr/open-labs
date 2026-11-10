-- =====================================================================
-- OpenLabs no Telecentro — Script DQL (Oracle)
-- Global Solution 2026.2 · Database Design
--
-- Três consultas, cada uma respondendo uma pergunta real de quem opera
-- um telecentro. Rodar depois de 01-ddl.sql e 02-dml.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Consulta 1 — INNER JOIN entre duas tabelas
-- Pergunta: quem são os alunos cadastrados, e em qual telecentro cada um
-- estuda?
-- O INNER JOIN traz só as linhas que têm par nas duas tabelas: todo aluno
-- tem um telecentro (a chave estrangeira garante), então todos aparecem.
-- ---------------------------------------------------------------------
SELECT a.id_aluno,
       a.nm_aluno,
       t.nm_telecentro,
       t.nm_bairro,
       t.nm_cidade,
       a.dt_cadastro
  FROM T_ALUNO a
 INNER JOIN T_TELECENTRO t
    ON t.id_telecentro = a.id_telecentro
 ORDER BY t.nm_telecentro, a.nm_aluno;

-- ---------------------------------------------------------------------
-- Consulta 2 — INNER JOIN entre duas tabelas, com agrupamento
-- Pergunta: quantos alunos ativos cada telecentro atende, e desde quando?
-- É o indicador de impacto da CitizenTech. COUNT conta os alunos de cada
-- grupo; MIN e MAX mostram o primeiro e o último cadastro; GROUP BY forma
-- um grupo por telecentro.
-- ---------------------------------------------------------------------
SELECT t.nm_telecentro,
       t.nm_cidade,
       COUNT(a.id_aluno)  AS qt_alunos_ativos,
       MIN(a.dt_cadastro) AS dt_primeiro_cadastro,
       MAX(a.dt_cadastro) AS dt_ultimo_cadastro
  FROM T_TELECENTRO t
 INNER JOIN T_ALUNO a
    ON a.id_telecentro = t.id_telecentro
 WHERE a.st_ativo = 'S'
 GROUP BY t.nm_telecentro, t.nm_cidade
 ORDER BY qt_alunos_ativos DESC, t.nm_telecentro;

-- ---------------------------------------------------------------------
-- Consulta 3 — LEFT OUTER JOIN entre duas tabelas, com WHERE e ORDER BY
-- Pergunta: quais alunos ativos ainda não fizeram nenhuma avaliação?
-- É a lista que o monitor usa para chamar quem pode estar com dificuldade.
-- O LEFT OUTER JOIN mantém todos os alunos, inclusive os que não têm
-- nenhuma tentativa — para esses, as colunas de T_TENTATIVA vêm NULL. O
-- WHERE fica só com os ativos que vieram sem tentativa, e o ORDER BY põe
-- primeiro quem está há mais tempo cadastrado.
-- ---------------------------------------------------------------------
SELECT a.id_aluno,
       a.nm_aluno,
       a.ds_email,
       a.dt_cadastro
  FROM T_ALUNO a
  LEFT OUTER JOIN T_TENTATIVA te
    ON te.id_aluno = a.id_aluno
 WHERE a.st_ativo = 'S'
   AND te.id_tentativa IS NULL
 ORDER BY a.dt_cadastro, a.nm_aluno;
