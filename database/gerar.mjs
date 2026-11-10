#!/usr/bin/env node
// Gera, a partir de esquema.mjs:
//   01-ddl.sql             — o script DDL (create table + alter table) para o Oracle
//   MODELO.md              — o diagrama entidade-relacionamento, para conferir no GitHub
//   entrega/documento.html — o documento de entrega (itens 1 e 2 da disciplina)
//   entrega/GS-Database-Design.pdf — o mesmo documento em PDF (com --pdf)
//
// Uso: node database/gerar.mjs [--pdf]
// 02-dml.sql e 03-dql.sql são escritos à mão: dados e perguntas não se geram.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { nomeDaConstraint, TABELAS } from "./esquema.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const semPrefixo = (coluna) => coluna.replace(/^(id|nm|ds|dt|nr|st|vl|cd|sg|tp|pc)_/u, "");

// ------------------------------------------------------------------ constraints

function constraints(t) {
  const lista = [{ nome: nomeDaConstraint("PK", t.nome), sql: `PRIMARY KEY (${t.pk})`, tipo: "PK" }];
  for (const c of t.colunas) {
    if (c.unico) lista.push({ nome: nomeDaConstraint("UK", t.nome, semPrefixo(c.nome)), sql: `UNIQUE (${c.nome})`, tipo: "UK" });
    if (c.check) lista.push({ nome: nomeDaConstraint("CK", t.nome, semPrefixo(c.nome)), sql: `CHECK (${c.check})`, tipo: "CK" });
  }
  for (const u of t.unicos ?? []) {
    const juntos = u.map(semPrefixo).join("_");
    const nome = `UK_${t.nome.replace(/^T_/u, "")}_${juntos}`.length <= 30 ? nomeDaConstraint("UK", t.nome, juntos) : nomeDaConstraint("UK", t.nome, semPrefixo(u.at(-1)));
    lista.push({ nome, sql: `UNIQUE (${u.join(", ")})`, tipo: "UK" });
  }
  for (const k of t.checks ?? []) lista.push({ nome: k.nome, sql: `CHECK (${k.expressao})`, tipo: "CK" });
  for (const f of t.fks ?? []) lista.push({ nome: nomeDaConstraint("FK", t.nome, f.tabela.replace(/^T_/u, "")), sql: `FOREIGN KEY (${f.coluna}) REFERENCES ${f.tabela} (${TABELAS.find((x) => x.nome === f.tabela).pk})`, tipo: "FK" });
  return lista;
}

// ------------------------------------------------------------------ 01-ddl.sql

function ddl() {
  const linhas = [
    "-- =====================================================================",
    "-- OpenLabs no Telecentro — Script DDL (Oracle)",
    "-- Global Solution 2026.2 · Database Design",
    "--",
    "-- Gerado por database/gerar.mjs a partir de database/esquema.mjs.",
    "-- Ordem de execução: 01-ddl.sql → 02-dml.sql → 03-dql.sql.",
    "-- =====================================================================",
    "",
    "-- Apaga as tabelas de uma execução anterior, para o script poder rodar de novo.",
    "-- Na primeira execução elas não existem, e o erro ORA-00942 é ignorado.",
    "BEGIN",
    ...[...TABELAS].reverse().map((t) => `  BEGIN EXECUTE IMMEDIATE 'DROP TABLE ${t.nome} CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF; END;`),
    "END;",
    "/",
    "",
    "-- ---------------------------------------------------------------------",
    "-- 1. Tabelas (CREATE TABLE): colunas, tipos, obrigatoriedade e padrões",
    "-- ---------------------------------------------------------------------",
  ];
  for (const t of TABELAS) {
    linhas.push("", `-- ${t.descricao}`, `CREATE TABLE ${t.nome} (`);
    const largura = Math.max(...t.colunas.map((c) => c.nome.length));
    t.colunas.forEach((c, i) => {
      const partes = [c.nome.padEnd(largura), c.tipo];
      if (c.padrao) partes.push(`DEFAULT ${c.padrao}`);
      partes.push(c.nulo ? "NULL" : "NOT NULL");
      linhas.push(`  ${partes.join(" ")}${i < t.colunas.length - 1 ? "," : ""}`);
    });
    linhas.push(");");
  }
  linhas.push("", "-- ---------------------------------------------------------------------", "-- 2. Restrições (ALTER TABLE): chaves primárias, únicas e regras de valor", "-- ---------------------------------------------------------------------");
  for (const t of TABELAS) {
    const cs = constraints(t).filter((c) => c.tipo !== "FK");
    linhas.push("");
    for (const c of cs) linhas.push(`ALTER TABLE ${t.nome} ADD CONSTRAINT ${c.nome} ${c.sql};`);
  }
  linhas.push("", "-- ---------------------------------------------------------------------", "-- 3. Relacionamentos (ALTER TABLE): chaves estrangeiras", "-- ---------------------------------------------------------------------");
  for (const t of TABELAS) {
    const fks = constraints(t).filter((c) => c.tipo === "FK");
    if (fks.length === 0) continue;
    linhas.push("");
    t.fks.forEach((f, i) => linhas.push(`-- ${f.cardinalidade}`, `ALTER TABLE ${t.nome} ADD CONSTRAINT ${fks[i].nome} ${fks[i].sql};`));
  }
  const aspas = (s) => s.replaceAll("'", "''");
  linhas.push("", "-- ---------------------------------------------------------------------", "-- 4. Comentários: o dicionário de dados dentro do próprio banco", "--    (o Oracle Data Modeler os importa junto com as tabelas)", "-- ---------------------------------------------------------------------");
  for (const t of TABELAS) {
    linhas.push("", `COMMENT ON TABLE ${t.nome} IS '${aspas(t.descricao)}';`);
    for (const c of t.colunas) linhas.push(`COMMENT ON COLUMN ${t.nome}.${c.nome} IS '${aspas(c.descricao)}';`);
  }
  return linhas.join("\n") + "\n";
}

// ------------------------------------------------------------------ MODELO.md

function modelo() {
  const rel = [];
  for (const t of TABELAS) for (const f of t.fks ?? []) {
    const minimo = /tem 1 ou muit/u.test(f.cardinalidade) ? "|{" : "o{";
    rel.push(`  ${f.tabela} ||--${minimo} ${t.nome} : "${semPrefixo(f.coluna)}"`);
  }
  const entidades = TABELAS.map((t) => {
    const fks = new Set((t.fks ?? []).map((f) => f.coluna));
    const cols = t.colunas.map((c) => `    ${c.tipo.replace(/\(.*$/u, "")} ${c.nome}${c.nome === t.pk ? " PK" : fks.has(c.nome) ? " FK" : c.unico ? " UK" : ""}`);
    return [`  ${t.nome} {`, ...cols, "  }"].join("\n");
  });
  return [
    "# Modelo do banco do OpenLabs no Telecentro",
    "",
    "Gerado por `database/gerar.mjs` a partir de `database/esquema.mjs`. É um diagrama de",
    "**conferência**: o diagrama entregue na disciplina é o do Oracle Data Modeler (veja",
    "`README.md`, seção 2). Os dois têm de mostrar as mesmas tabelas e ligações.",
    "",
    "```mermaid",
    "erDiagram",
    ...rel,
    ...entidades,
    "```",
    "",
  ].join("\n");
}

// ------------------------------------------------------------------ documento de entrega

const esc = (s) => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const marca = (s) => `<mark>${esc(s)}</mark>`;

function documento() {
  const relacoes = TABELAS.flatMap((t) => (t.fks ?? []).map((f) => `<tr><td><code>${f.tabela}</code></td><td><code>${t.nome}</code></td><td>1 : N</td><td>${esc(f.cardinalidade)}</td></tr>`)).join("");
  const dicionario = TABELAS.map((t) => {
    const cs = constraints(t);
    const fkCols = new Map((t.fks ?? []).map((f) => [f.coluna, f.tabela]));
    const linhas = t.colunas.map((c) => {
      const chave = [c.nome === t.pk ? "PK" : "", fkCols.has(c.nome) ? `FK → ${fkCols.get(c.nome)}` : "", c.unico ? "UK" : ""].filter(Boolean).join(", ");
      const regra = [c.padrao ? `padrão ${c.padrao}` : "", c.check ? `CHECK ${c.check}` : ""].filter(Boolean).join("; ");
      return `<tr><td><code>${c.nome}</code></td><td><code>${c.tipo}</code></td><td>${c.nulo ? "sim" : "não"}</td><td>${esc(chave)}</td><td>${esc(c.descricao)}${regra ? `<br><small><code>${esc(regra)}</code></small>` : ""}</td></tr>`;
    }).join("");
    const extras = cs.filter((c) => (c.tipo === "UK" && c.sql.includes(",")) || (c.tipo === "CK" && !t.colunas.some((col) => col.check && c.sql.includes(col.check))));
    return `<section class="tabela"><h3><code>${t.nome}</code></h3><p>${esc(t.descricao)}</p>
<table><thead><tr><th>Coluna</th><th>Tipo</th><th>Nulo</th><th>Chave</th><th>Descrição</th></tr></thead><tbody>${linhas}</tbody></table>
${extras.length ? `<p class="extra">Regras da tabela: ${extras.map((c) => `<code>${c.nome}</code> ${esc(c.sql)}`).join("; ")}.</p>` : ""}</section>`;
  }).join("\n");

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Database Design — OpenLabs no Telecentro</title>
<style>
  @page { size: A4; margin: 16mm 15mm 18mm; }
  body { font: 10.5pt/1.5 "Segoe UI", system-ui, sans-serif; color: #1b1f24; margin: 0; }
  h1 { font-size: 26pt; margin: 0 0 4pt; } h2 { font-size: 15pt; margin: 22pt 0 6pt; padding-bottom: 3pt; border-bottom: 2px solid #0e7490; }
  h3 { font-size: 11.5pt; margin: 14pt 0 4pt; } p { margin: 4pt 0 6pt; }
  table { width: 100%; border-collapse: collapse; margin: 6pt 0 10pt; font-size: 9pt; } th, td { border: 1px solid #c9d1d9; padding: 3pt 5pt; text-align: left; vertical-align: top; }
  th { background: #e6f2f5; } code { font: 8.8pt "Cascadia Mono", Consolas, monospace; } h3 code { font-size: 11.5pt; font-weight: 700; } mark { background: #fde68a; padding: 0 2pt; }
  .capa { height: 245mm; display: flex; flex-direction: column; justify-content: center; } .capa .topo { color: #57606a; text-transform: uppercase; letter-spacing: .08em; font-size: 9pt; }
  .capa .sol { font-size: 15pt; color: #0e7490; margin-bottom: 24pt; } .capa table { width: auto; min-width: 60%; font-size: 10.5pt; }
  .quebra { break-before: page; } .tabela, .print, tr { break-inside: avoid; }
  .print { border: 2px dashed #8c959f; border-radius: 6pt; padding: 60pt 10pt; text-align: center; margin: 8pt 0; }
  .sumario li { margin: 2pt 0; } .extra { font-size: 9pt; color: #424a53; } .nota { color: #57606a; font-size: 9.5pt; }
</style></head><body>

<section class="capa">
  <p class="topo">FIAP · Global Solution 2026.2 · CitizenTech · Engenharia de Software</p>
  <h1>Database Design</h1>
  <p class="sol">Solução: OpenLabs no Telecentro ${marca("(confirmar o nome da CitizenTech)")}</p>
  <table>
    <tr><th>Equipe</th><td>${marca("[Nome da equipe]")} · nº 10</td></tr>
    <tr><th>Integrantes (ordem alfabética)</th><td>${marca("[Nome completo — RM]")}<br>${marca("[Nome completo — RM]")}<br>${marca("[Nome completo — RM]")}<br>${marca("[Nome completo — RM]")}<br>${marca("[Nome completo — RM]")}</td></tr>
    <tr><th>Arquivos</th><td>este PDF · <code>01-ddl.sql</code> · <code>02-dml.sql</code> · <code>03-dql.sql</code></td></tr>
  </table>
</section>

<section class="quebra">
<h2>Sumário</h2>
<ol class="sumario">
  <li>Objetivo e escopo do projeto</li>
  <li>Principais funcionalidades da solução</li>
  <li>Como o banco de dados do OpenLabs funciona</li>
  <li>Modelo lógico (Oracle Data Modeler)</li>
  <li>Relacionamentos e cardinalidades</li>
  <li>Dicionário de dados</li>
  <li>Scripts entregues</li>
</ol>

<h2>1. Objetivo e escopo do projeto</h2>
<p><b>Problema.</b> O ensino de tecnologia prático e gratuito não chega a quem não tem computador nem internet em casa. A CitizenTech da equipe leva o <b>OpenLabs</b> — laboratórios interativos de tecnologia, em que o aluno vê um protocolo de rede ou um sistema funcionando e consegue “quebrá-lo” para entender — para <b>telecentros comunitários</b>, que oferecem computadores e Wi-Fi gratuitos.</p>
<p><b>Objetivo.</b> Projetar e implementar o banco de dados relacional que permite a um telecentro operar o OpenLabs: cadastrar o telecentro, seus monitores, seus alunos e seus equipamentos de rede; publicar o catálogo de cursos (handbooks, fases e labs); e registrar o que cada aluno fez — os labs iniciados e concluídos e as notas das avaliações.</p>
<p><b>Escopo.</b> O banco cobre o cadastro (telecentros, monitores, alunos, computadores), o catálogo (handbooks, fases, labs, avaliações) e o acompanhamento (progresso por lab e tentativas de avaliação). Ficam fora deste escopo: autenticação e senhas (responsabilidade da API Java), o conteúdo dos labs (que continua no site) e pagamentos — o serviço é gratuito. Os dados de exemplo são simulados: nenhum dado pessoal real foi usado.</p>

<h2>2. Principais funcionalidades da solução</h2>
<ul>
  <li><b>Cadastro de telecentros</b> com bairro, cidade, número de computadores e a faixa de rede local (a mesma projetada na disciplina de redes).</li>
  <li><b>Cadastro de alunos e monitores</b>, cada um ligado ao seu telecentro; o e-mail do aluno é opcional, porque nem todo aluno tem um.</li>
  <li><b>Inventário de rede:</b> os computadores e servidores de cada telecentro, com hostname, IP e VLAN.</li>
  <li><b>Catálogo de cursos:</b> handbooks divididos em fases, e labs em cada fase, com tipo de interação e tempo estimado.</li>
  <li><b>Acompanhamento do aluno:</b> quando começou e quando concluiu cada lab, e as notas das avaliações de fim de lab.</li>
  <li><b>Indicadores de impacto:</b> alunos ativos por telecentro, labs concluídos, média de notas — o que a equipe apresenta como resultado da CitizenTech.</li>
</ul>
</section>

<section class="quebra">
<h2>3. Como o banco de dados do OpenLabs funciona</h2>
<p>Um <b>banco de dados relacional</b> guarda as informações em <b>tabelas</b>. Cada tabela descreve um tipo de coisa — um telecentro, um aluno, um lab —, cada <b>linha</b> é uma ocorrência dessa coisa e cada <b>coluna</b> é uma característica dela, sempre do mesmo tipo de dado. No OpenLabs, a tabela <code>T_ALUNO</code> tem uma linha por aluno, e as colunas guardam o nome, a data de nascimento, o e-mail e se ele está ativo.</p>
<p><b>Chave primária (PK).</b> Toda tabela tem uma coluna que identifica cada linha sem ambiguidade e nunca se repete: <code>id_aluno</code>, <code>id_lab</code>, <code>id_telecentro</code>. Dois alunos podem ter o mesmo nome; nunca o mesmo <code>id_aluno</code>.</p>
<p><b>Chave estrangeira (FK) e relacionamento.</b> As tabelas se ligam por valores: <code>T_ALUNO.id_telecentro</code> guarda o identificador do telecentro do aluno. O banco garante que esse valor exista em <code>T_TELECENTRO</code> — não dá para cadastrar um aluno num telecentro inexistente, nem apagar um telecentro que ainda tem alunos. É isso que mantém os dados coerentes sem depender de cada programa lembrar da regra.</p>
<p><b>Cardinalidade.</b> Diz quantas linhas de uma tabela se ligam a quantas da outra. Um telecentro tem muitos alunos e cada aluno é de um telecentro só: <b>1 para N</b>. Já um aluno faz muitos labs e um lab é feito por muitos alunos: <b>N para N</b>. O modelo relacional não guarda N para N diretamente; ele cria uma <b>tabela associativa</b> no meio. No OpenLabs são duas: <code>T_PROGRESSO</code> (aluno × lab, com as datas de início e de conclusão) e <code>T_TENTATIVA</code> (aluno × avaliação, com a nota).</p>
<p><b>Restrições (constraints).</b> Além das chaves, o banco recusa dados que não fazem sentido: nota fora de 0 a 10 (<code>CHECK</code>), VLAN diferente de 10, 20 ou 30, data de conclusão anterior à de início, o mesmo aluno com dois registros de progresso para o mesmo lab (<code>UNIQUE</code>), e-mail repetido.</p>
<p><b>Normalização.</b> Cada informação mora num lugar só: o nome do telecentro está em <code>T_TELECENTRO</code>, não repetido em cada aluno; o nome do lab está em <code>T_LAB</code>, não em cada progresso. Assim, corrigir um nome é mudar uma linha. As tabelas estão na terceira forma normal: toda coluna depende da chave da sua tabela, e só dela.</p>
<p><b>As três linguagens do SQL usadas aqui.</b> O <b>DDL</b> (<code>CREATE TABLE</code>, <code>ALTER TABLE</code>) cria a estrutura; o <b>DML</b> (<code>INSERT</code>) põe os dados; o <b>DQL</b> (<code>SELECT</code>) faz as perguntas — por exemplo, quantos alunos ativos cada telecentro tem.</p>
</section>

<section class="quebra">
<h2>4. Modelo lógico (Oracle Data Modeler)</h2>
<p>Diagrama com todas as tabelas, atributos, chaves primárias, chaves estrangeiras, relacionamentos e cardinalidades, feito no Oracle SQL Developer Data Modeler a partir do script DDL entregue.</p>
<div class="print">${marca("[Imagem do diagrama exportada do Oracle Data Modeler]")}</div>

<h2>5. Relacionamentos e cardinalidades</h2>
<table><thead><tr><th>Tabela “1”</th><th>Tabela “N”</th><th>Tipo</th><th>Leitura</th></tr></thead><tbody>${relacoes}</tbody></table>
<p class="nota">Os relacionamentos N : N — aluno × lab e aluno × avaliação — são resolvidos pelas tabelas associativas <code>T_PROGRESSO</code> e <code>T_TENTATIVA</code>, cada uma ligada por 1 : N aos dois lados.</p>
</section>

<section class="quebra">
<h2>6. Dicionário de dados</h2>
<p class="nota">PK = chave primária · FK = chave estrangeira · UK = valor único. As descrições também estão dentro do banco, como <code>COMMENT ON</code> no script DDL.</p>
${dicionario}
</section>

<section class="quebra">
<h2>7. Scripts entregues</h2>
<table><thead><tr><th>Arquivo</th><th>Conteúdo</th></tr></thead><tbody>
<tr><td><code>01-ddl.sql</code></td><td>${TABELAS.length} tabelas (<code>CREATE TABLE</code>) e todas as restrições (<code>ALTER TABLE</code>): chaves primárias, únicas, regras de valor e chaves estrangeiras, além dos comentários das tabelas e colunas.</td></tr>
<tr><td><code>02-dml.sql</code></td><td>Dados de exemplo (<code>INSERT</code>), com pelo menos cinco linhas em cada tabela. Os dados são simulados.</td></tr>
<tr><td><code>03-dql.sql</code></td><td>Três consultas: (1) <b>INNER JOIN</b> — cada aluno com o seu telecentro; (2) <b>INNER JOIN com GROUP BY</b> — quantos alunos ativos cada telecentro atende e desde quando, o indicador de impacto; (3) <b>LEFT OUTER JOIN com WHERE e ORDER BY</b> — alunos ativos que ainda não fizeram nenhuma avaliação, para o monitor procurar.</td></tr>
</tbody></table>
<p>Ordem de execução no Oracle (SQL Developer, “Executar Script”, F5): <code>01-ddl.sql</code> → <code>02-dml.sql</code> → <code>03-dql.sql</code>.</p>
</section>
</body></html>`;
}

// ------------------------------------------------------------------ escrever

writeFileSync(join(AQUI, "01-ddl.sql"), ddl());
// A mesma estrutura sem o bloco PL/SQL de limpeza: é o arquivo que se importa no
// Oracle Data Modeler (File → Import → DDL File), que só precisa das tabelas.
mkdirSync(join(AQUI, "entrega"), { recursive: true });
writeFileSync(
  join(AQUI, "entrega", "ddl-para-o-data-modeler.sql"),
  ddl().replace(/-- Apaga as tabelas[\s\S]*?^\/\n/mu, "-- Cópia de 01-ddl.sql sem o bloco de limpeza, para importar no Oracle Data Modeler.\n"),
);
writeFileSync(join(AQUI, "MODELO.md"), modelo());
mkdirSync(join(AQUI, "entrega"), { recursive: true });
const html = join(AQUI, "entrega", "documento.html");
writeFileSync(html, documento());
console.log("✓ 01-ddl.sql, MODELO.md e entrega/documento.html gerados");

if (process.argv.includes("--pdf")) {
  const require = createRequire(join(AQUI, "..", "apps", "site", "package.json"));
  const { chromium } = require("@playwright/test");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(html).href, { waitUntil: "load" });
    const pdf = join(AQUI, "entrega", "GS-Database-Design.pdf");
    await page.pdf({ path: pdf, format: "A4", printBackground: true, preferCSSPageSize: true });
    console.log(`✓ ${pdf}`);
  } finally {
    await browser.close();
  }
}
