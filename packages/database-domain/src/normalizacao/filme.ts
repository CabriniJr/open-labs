import { connect, film, pt, type Box, type Film } from "@ovh/motion";
import { ICONE_APP, ICONES_BANCO } from "../icones.js";
import { DADOS } from "../telecentro/dados.js";
import type { NomeDaTabela } from "../telecentro/esquema.js";
import { TOM_DA_FICHA, TOM_DO_GRUPO, type ResultadoNoPainel } from "../telecentro/filme.js";
import { bancoInicial, inserir } from "../telecentro/motor.js";
import { anomaliasDa, AVALIACAO_DO_EXEMPLO, createTable, tabelasDa, TELECENTRO_DO_EXEMPLO, type Etapa, type TabelaDaEtapa } from "./modelo.js";

/**
 * O filme da normalização, derivado de `modelo.ts`: cada capítulo é uma etapa
 * (a planilha, 1FN, 2FN, 3FN) e as três anomalias medidas nela; o último leva
 * as tabelas da 3FN ao servidor — o CREATE TABLE do 01-ddl.sql e a API Java,
 * cujo POST o motor do banco responde com o id que a IDENTITY dá.
 */
export interface DetalheDaNormalizacao {
  readonly sql?: string;
  readonly linhas: readonly (readonly [string, string])[];
  readonly resultado?: ResultadoNoPainel;
}

export const CAPITULOS_DA_NORMALIZACAO = ["planilha", "1fn", "2fn", "3fn", "servidor"] as const;
export const LARGURA_DA_NORMALIZACAO = 1280;
export const ALTURA_DA_NORMALIZACAO = 720;

const PLANILHA: Box = { x: 240, y: 230, w: 800, h: 210 };
const POS_2FN: Readonly<Record<string, Box>> = {
  ALUNO_2FN: { x: 50, y: 260, w: 320, h: 140 },
  TENTATIVA_2FN: { x: 480, y: 260, w: 320, h: 140 },
  AVALIACAO_2FN: { x: 910, y: 260, w: 320, h: 140 },
};
// Duas fileiras com vãos largos: o rótulo de cada chave estrangeira (a coluna)
// cabe no fio entre as caixas, sem encostar nelas.
const POS_3FN: Readonly<Record<string, Box>> = {
  T_TELECENTRO: { x: 40, y: 170, w: 220, h: 110 },
  T_ALUNO: { x: 40, y: 440, w: 220, h: 110 },
  T_TENTATIVA: { x: 380, y: 440, w: 220, h: 110 },
  T_AVALIACAO: { x: 720, y: 440, w: 220, h: 110 },
  T_LAB: { x: 1040, y: 440, w: 220, h: 110 },
  T_FASE: { x: 1040, y: 170, w: 220, h: 110 },
  T_HANDBOOK: { x: 720, y: 170, w: 220, h: 110 },
};
const API: Box = { x: 360, y: 170, w: 260, h: 90 };

/** Na 2FN, cada tabela nova vem destas colunas da planilha; na 3FN, de qual tabela da 2FN. */
const ORIGEM_3FN: Readonly<Record<string, string>> = {
  T_TELECENTRO: "ALUNO_2FN",
  T_ALUNO: "ALUNO_2FN",
  T_TENTATIVA: "TENTATIVA_2FN",
  T_AVALIACAO: "AVALIACAO_2FN",
  T_LAB: "AVALIACAO_2FN",
  T_FASE: "AVALIACAO_2FN",
  T_HANDBOOK: "AVALIACAO_2FN",
};

const resumo = (t: TabelaDaEtapa) => `${t.linhas.length} rows · key (${t.chave.join(", ")})`;

function painel(t: TabelaDaEtapa): ResultadoNoPainel {
  return { titulo: t.nome, colunas: t.colunas.map((c) => c.toUpperCase()), linhas: t.linhas, total: t.linhas.length };
}

function linhasDasAnomalias(e: Etapa): (readonly [string, string])[] {
  const a = anomaliasDa(e);
  return [
    [`rename ${TELECENTRO_DO_EXEMPLO}`, a.renomear === 1 ? "1 cell to change" : `${a.renomear} cells to change`],
    ["a telecentre with no learners yet", a.telecentroSemAluno ? "has its own row" : "nowhere to put it"],
    [`delete the attempts at assessment ${AVALIACAO_DO_EXEMPLO}`, a.perdidos.length === 0 ? "nothing else is lost" : `also loses ${a.perdidos.length} names`],
    ["learners the tables can hold", `${a.alunos} of 12`],
  ];
}

export function filmeDaNormalizacao(): Film<DetalheDaNormalizacao> {
  const f = film<DetalheDaNormalizacao>({ width: LARGURA_DA_NORMALIZACAO, height: ALTURA_DA_NORMALIZACAO, gap: 300, maxZoom: 1.6 });
  const [planilha] = tabelasDa("planilha");
  const [primeira] = tabelasDa("1fn");
  const segunda = tabelasDa("2fn");
  const terceira = tabelasDa("3fn");
  if (planilha === undefined || primeira === undefined) throw new Error("etapas vazias");

  // ------------------------------------------------------------ o cenário
  f.add({ type: "note", id: "titulo", at: pt(LARGURA_DA_NORMALIZACAO / 2, 40), label: "One spreadsheet, kept by hand", tone: "ink", width: 900 });
  f.add({ type: "node", id: "sheet", box: PLANILHA, label: "the monitor's spreadsheet", sublabel: resumo(planilha), tone: "muted" });
  for (const t of segunda) f.add({ type: "node", id: t.nome, box: POS_2FN[t.nome]!, label: t.nome, sublabel: resumo(t), tone: t.nome.startsWith("TENTATIVA") ? TOM_DO_GRUPO.acompanhamento : t.nome.startsWith("ALUNO") ? TOM_DO_GRUPO.cadastro : TOM_DO_GRUPO.catalogo, hidden: true });
  for (const t of segunda) {
    for (const fk of t.fks ?? []) f.add({ type: "link", id: `fk2:${t.nome}:${fk.coluna}`, path: connect(POS_2FN[t.nome]!, POS_2FN[fk.tabela]!, 6), arrow: true, label: fk.coluna, tone: TOM_DA_FICHA.chave, hidden: true });
    f.add({ type: "token", id: `mv2:${t.nome}`, path: connect(PLANILHA, POS_2FN[t.nome]!, 4), label: t.colunas.length > 4 ? `${t.colunas.length} columns` : t.colunas.join(", "), tone: TOM_DA_FICHA.escrita, hidden: true });
  }
  for (const t of terceira) {
    const nome = t.real as NomeDaTabela;
    const grupo = nome === "T_TENTATIVA" ? TOM_DO_GRUPO.acompanhamento : nome === "T_TELECENTRO" || nome === "T_ALUNO" ? TOM_DO_GRUPO.cadastro : TOM_DO_GRUPO.catalogo;
    f.add({ type: "node", id: nome, box: POS_3FN[nome]!, label: nome, sublabel: resumo(t), tone: grupo, icon: ICONES_BANCO[nome], hidden: true });
    f.add({ type: "token", id: `mv3:${nome}`, path: connect(POS_2FN[ORIGEM_3FN[nome]!]!, POS_3FN[nome]!, 4), label: t.colunas.slice(1).join(", "), tone: TOM_DA_FICHA.escrita, hidden: true });
  }
  for (const t of terceira) for (const fk of t.fks ?? []) f.add({ type: "link", id: `fk3:${t.nome}:${fk.coluna}`, path: connect(POS_3FN[t.nome]!, POS_3FN[fk.tabela]!, 6), arrow: true, label: fk.coluna, tone: TOM_DA_FICHA.chave, hidden: true });
  f.add({ type: "node", id: "api", box: API, label: "Java API (Spring Boot)", sublabel: "GET · POST · PUT · DELETE /alunos", tone: "controller", icon: ICONE_APP, hidden: true });
  f.add({ type: "link", id: "api:aluno", path: connect(API, POS_3FN.T_ALUNO!, 6), arrow: true, label: "JDBC · Oracle", tone: TOM_DA_FICHA.juncao, hidden: true });
  f.add({ type: "token", id: "post", path: connect(API, POS_3FN.T_ALUNO!, 6), label: "POST /alunos", tone: TOM_DA_FICHA.escrita, hidden: true });

  // ------------------------------------------------------------ a planilha
  const aP = anomaliasDa("planilha");
  f.chapter(
    {
      id: "planilha",
      title: "One spreadsheet, kept by hand",
      body: `This is what a telecentre monitor would keep without a database: one row per learner, with the telecentre written out and every assessment crammed into one cell. It works until it changes. The name ${TELECENTRO_DO_EXEMPLO} is typed ${aP.renomear} times, and the "tentativas" cell is a list — a column that holds many values is not a column the database can check, join or count.`,
      detail: { linhas: linhasDasAnomalias("planilha"), resultado: painel(planilha) },
    },
    (d) => {
      d.camera({ box: { x: 120, y: 20, w: 1040, h: 560 } });
      d.ping("sheet");
      d.wait(2600);
    },
  );

  // ------------------------------------------------------------ 1FN
  const a1 = anomaliasDa("1fn");
  f.chapter(
    {
      id: "1fn",
      title: "First normal form: one value per cell",
      body: `Unpack the list: one row per attempt, every cell a single value. The key becomes (id_aluno, id_avaliacao, dt_envio). The cost shows at once: a learner who never took an assessment has no row — ${12 - a1.alunos} of 12 vanish — and the telecentre name is now typed ${a1.renomear} times. Delete the only attempt at assessment ${AVALIACAO_DO_EXEMPLO}, and ${a1.perdidos.length} names leave the data with it, the lab and its handbook included.`,
      detail: { linhas: linhasDasAnomalias("1fn"), resultado: painel(primeira) },
    },
    (d) => {
      d.set("titulo", { label: "1NF · one value per cell" });
      d.set("sheet", { label: "TENTATIVA_1FN", sublabel: resumo(primeira), tone: TOM_DA_FICHA.recusa });
      d.ping("sheet");
      d.beat({ title: `${12 - a1.alunos} learners have nowhere to go`, detail: { linhas: linhasDasAnomalias("1fn"), resultado: painel(primeira) } });
      d.wait(2600);
    },
  );

  // ------------------------------------------------------------ 2FN
  const a2 = anomaliasDa("2fn");
  f.chapter(
    {
      id: "2fn",
      title: "Second normal form: depend on the whole key",
      body: `nm_aluno depends on id_aluno alone, not on the whole key; nm_avaliacao, the lab and the handbook depend on id_avaliacao alone. Each goes to a table keyed by what it depends on. Every learner has a row again (${a2.alunos} of 12), and deleting attempts no longer erases the catalogue. But the telecentre is still typed ${a2.renomear} times inside ALUNO_2FN.`,
      detail: { linhas: linhasDasAnomalias("2fn"), resultado: painel(segunda[0]!) },
    },
    (d) => {
      d.set("titulo", { label: "2NF · every column depends on the whole key" });
      d.camera({ box: { x: 0, y: 140, w: 1280, h: 400 } }, { dur: 700 });
      d.together(...segunda.map((t) => (x: typeof d) => x.send(`mv2:${t.nome}`, { dur: 900 })));
      d.hide("sheet", { dur: 400 });
      d.show(segunda.map((t) => t.nome), { dur: 400 });
      d.draw(segunda.flatMap((t) => (t.fks ?? []).map((fk) => `fk2:${t.nome}:${fk.coluna}`)), { dur: 700 });
      d.wait(2400);
    },
  );

  // ------------------------------------------------------------ 3FN
  const a3 = anomaliasDa("3fn");
  const ids3 = terceira.map((t) => t.nome);
  const tentativa3 = terceira.find((t) => t.nome === "T_TENTATIVA")!;
  f.chapter(
    {
      id: "3fn",
      title: "Third normal form: depend on the key and nothing else",
      body: `In ALUNO_2FN, nm_bairro depends on the telecentre, which depends on the learner: a fact about a fact. Same chain in AVALIACAO_2FN: assessment → lab → phase → handbook. Each link becomes its own table, keyed by its own id, and the foreign keys hold the chain together. These are ${terceira.length} of the OpenLabs tables, exactly as 01-ddl.sql creates them. Renaming the telecentre is ${a3.renomear} cell; a telecentre with no learners has its own row.`,
      detail: { linhas: linhasDasAnomalias("3fn"), resultado: painel(terceira[0]!) },
    },
    (d) => {
      d.set("titulo", { label: "3NF · every fact depends on the key, the whole key, and nothing but the key" });
      d.camera({ box: { x: 0, y: 120, w: 1280, h: 470 } }, { dur: 900 });
      d.together(...ids3.map((n) => (x: typeof d) => x.send(`mv3:${n}`, { dur: 900 })));
      d.hide(segunda.map((t) => t.nome), { dur: 400 });
      d.hide(segunda.flatMap((t) => (t.fks ?? []).map((fk) => `fk2:${t.nome}:${fk.coluna}`)), { dur: 300 });
      d.show(ids3, { dur: 400 });
      d.draw(terceira.flatMap((t) => (t.fks ?? []).map((fk) => `fk3:${t.nome}:${fk.coluna}`)), { dur: 900 });
      d.beat({ title: "Rename the telecentre: 1 cell", detail: { linhas: linhasDasAnomalias("3fn"), resultado: painel(terceira[0]!) } });
      d.glow("T_TELECENTRO", 1).ping("T_TELECENTRO");
      d.wait(1400);
      d.beat({ title: "Assessment attempts: the associative table", detail: { linhas: linhasDasAnomalias("3fn"), resultado: painel(tentativa3) } });
      d.glow("T_TELECENTRO", 0);
      d.glow("T_TENTATIVA", 1).ping("T_TENTATIVA");
      d.wait(1600);
      d.glow("T_TENTATIVA", 0);
    },
  );

  // ------------------------------------------------------------ do modelo ao servidor
  const proximo = Math.max(...DADOS.T_ALUNO.linhas.map((l) => Number(l[0]))) + 1;
  const post = inserir(bancoInicial(), "T_ALUNO", { id_telecentro: 1, nm_aluno: "Nina Prado Lopes", dt_nascimento: "2009-02-02", ds_email: null, dt_cadastro: "2026-11-01" });
  const idGerado = post.ok ? String(post.linha.id_aluno) : "—";
  f.chapter(
    {
      id: "servidor",
      title: "From the logical model to the server",
      body: `The 3NF tables are the logical model: drawn in Oracle Data Modeler, they become the relational diagram — tables, keys, relationships and cardinalities. CREATE TABLE makes them physical — and every primary key is an IDENTITY, so the Java API never invents an id. POST /alunos sends a learner without id_aluno; the database answers with ${idGerado}. The API reads and writes these same tables: one database for both.`,
      detail: {
        sql: createTable("T_ALUNO", proximo),
        linhas: [
          ["logical model", `${terceira.length} tables, ${terceira.reduce((n, t) => n + (t.fks?.length ?? 0), 0)} foreign keys`],
          ["POST /alunos", post.ok ? `${post.mensagem} id_aluno = ${idGerado}` : "refused"],
          ["GET /alunos/{id}", "SELECT … WHERE id_aluno = :id"],
        ],
      },
    },
    (d) => {
      d.set("titulo", { label: "logical model → CREATE TABLE → the API" });
      d.camera({ box: { x: 0, y: 120, w: 1280, h: 470 } }, { dur: 900 });
      d.show("api", { dur: 400 });
      d.draw("api:aluno", { dur: 600 });
      d.send("post", { dur: 1000 });
      d.set("T_ALUNO", { sublabel: `${DADOS.T_ALUNO.linhas.length + 1} rows · id ${idGerado} by IDENTITY` });
      d.glow("T_ALUNO", 1).ping("T_ALUNO");
      d.wait(2400);
    },
  );

  return f.build();
}
