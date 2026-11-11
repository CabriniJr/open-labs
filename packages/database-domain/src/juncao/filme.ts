import { connect, film, pt, type Box, type Film } from "@ovh/motion";
import { ICONES_BANCO } from "../icones.js";
import type { Valor } from "../telecentro/dados.js";
import { TOM_DA_FICHA, TOM_DO_GRUPO, type ResultadoNoPainel } from "../telecentro/filme.js";
import type { Linha } from "../telecentro/motor.js";
import { ALUNOS, comparacoes, grupos, linhasDaJuncao, NOTA_MINIMA, resultadoDaJuncao, semPar, sqlDaJuncao, TENTATIVAS, type Contagem, type OpcoesDaJuncao, type TipoDeJuncao } from "./modelo.js";

/**
 * O filme do JOIN, derivado de `modelo.ts`: o palco só desenha o que
 * `linhasDaJuncao`, `semPar` e `grupos` respondem. Duas colunas de linhas —
 * T_ALUNO à esquerda, T_TENTATIVA à direita — e, no meio, o fio de cada par
 * que o ON aceitou. Quem não tem par ganha um NULL (LEFT) ou apaga (INNER).
 */
export interface DetalheDaJuncao {
  readonly sql: string;
  readonly linhas: readonly (readonly [string, string])[];
  readonly resultado?: ResultadoNoPainel;
}

export interface OpcoesDoFilmeDaJuncao {
  readonly tipo: TipoDeJuncao;
  /** Onde o filtro da nota fica no capítulo do filtro. */
  readonly filtro: "where" | "on";
  readonly contagem: Contagem;
}

export const OPCOES_DO_FILME_DA_JUNCAO: OpcoesDoFilmeDaJuncao = { tipo: "left", filtro: "where", contagem: "estrela" };

export const CAPITULOS_DA_JUNCAO = ["tabelas", "on", "multiplica", "sem-par", "filtro", "contar"] as const;

export const LARGURA_DA_JUNCAO = 1280;
export const ALTURA_DA_JUNCAO = 720;

const Y0 = 98;
const PASSO = 44;
const ALTURA = 34;
const caixaDoAluno = (i: number): Box => ({ x: 46, y: Y0 + i * PASSO, w: 330, h: ALTURA });
const caixaDaTentativa = (i: number): Box => ({ x: 904, y: Y0 + i * PASSO, w: 330, h: ALTURA });
const caixaDoNulo = (i: number): Box => ({ x: 430, y: Y0 + i * PASSO + 3, w: 104, h: ALTURA - 6 });

const idA = (a: Linha) => `a:${String(a.id_aluno)}`;
const idTe = (te: Linha) => `te:${String(te.id_tentativa)}`;
const idPar = (te: Linha) => `par:${String(te.id_tentativa)}`;
const idNulo = (a: Linha) => `nulo:${String(a.id_aluno)}`;

const nota = (v: Valor) => Number(v).toFixed(2);

function painel(titulo: string, o: OpcoesDaJuncao, destaque?: (linha: readonly Valor[]) => boolean): ResultadoNoPainel {
  const r = resultadoDaJuncao(o);
  const marcadas = destaque === undefined ? [] : r.linhas.flatMap((l, i) => (destaque(l) ? [i] : []));
  return { titulo, colunas: r.colunas, linhas: r.linhas, total: r.linhas.length, destaque: marcadas };
}

export function filmeDaJuncao(opcoes: Partial<OpcoesDoFilmeDaJuncao> = {}): Film<DetalheDaJuncao> {
  const o: OpcoesDoFilmeDaJuncao = { ...OPCOES_DO_FILME_DA_JUNCAO, ...opcoes };
  const f = film<DetalheDaJuncao>({ width: LARGURA_DA_JUNCAO, height: ALTURA_DA_JUNCAO, gap: 300, maxZoom: 1.6 });
  const base: OpcoesDaJuncao = { tipo: o.tipo, filtro: "sem" };
  const comFiltro: OpcoesDaJuncao = { tipo: o.tipo, filtro: o.filtro };
  const contando: OpcoesDaJuncao = { tipo: o.tipo, filtro: "sem", contagem: o.contagem };

  // ------------------------------------------------------------ o cenário
  const alturaDaColuna = ALUNOS.length * PASSO + 44;
  f.add({ type: "region", id: "T_ALUNO", box: { x: 30, y: 60, w: 362, h: alturaDaColuna }, label: "T_ALUNO a · 12 rows", tone: TOM_DO_GRUPO.cadastro, icon: ICONES_BANCO.T_ALUNO });
  f.add({ type: "region", id: "T_TENTATIVA", box: { x: 888, y: 60, w: 362, h: alturaDaColuna }, label: "T_TENTATIVA te · 12 rows", tone: TOM_DO_GRUPO.acompanhamento, icon: ICONES_BANCO.T_TENTATIVA });
  f.add({ type: "note", id: "sql", at: pt(LARGURA_DA_JUNCAO / 2, 34), label: "ON te.id_aluno = a.id_aluno", tone: "ink", width: 760 });
  ALUNOS.forEach((a, i) => {
    f.add({ type: "node", id: idA(a), box: caixaDoAluno(i), label: `${String(a.id_aluno)} · ${String(a.nm_aluno)}`, sublabel: `id_aluno = ${String(a.id_aluno)}`, tone: TOM_DO_GRUPO.cadastro });
    f.add({ type: "node", id: idNulo(a), box: caixaDoNulo(i), shape: "pill", label: "NULL", sublabel: "no partner", tone: TOM_DA_FICHA.nulo, hidden: true });
  });
  TENTATIVAS.forEach((te, i) => {
    f.add({ type: "node", id: idTe(te), box: caixaDaTentativa(i), label: `te ${String(te.id_tentativa)} · id_aluno ${String(te.id_aluno)}`, sublabel: `vl_nota ${nota(te.vl_nota ?? null)}`, tone: TOM_DO_GRUPO.acompanhamento });
    const ai = ALUNOS.findIndex((a) => a.id_aluno === te.id_aluno);
    f.add({ type: "link", id: idPar(te), path: connect(caixaDoAluno(ai), caixaDaTentativa(i), 6), tone: TOM_DA_FICHA.juncao, hidden: true });
  });

  const todos = { focus: ["T_ALUNO", "T_TENTATIVA"] };
  const pares = linhasDaJuncao({ tipo: "inner", filtro: "sem" });
  const porAluno = new Map<Valor, number>();
  for (const p of pares) porAluno.set(p.aluno.id_aluno ?? null, (porAluno.get(p.aluno.id_aluno ?? null) ?? 0) + 1);
  const repetidos = ALUNOS.filter((a) => (porAluno.get(a.id_aluno ?? null) ?? 0) > 1);
  const orfaos = semPar({ filtro: "sem" });

  // ------------------------------------------------------------ 1. as duas tabelas
  f.chapter(
    {
      id: "tabelas",
      title: "Two tables, one column in common",
      body: "T_ALUNO has the 12 learners of the telecentres. T_TENTATIVA has 12 assessment attempts, and each one carries the id_aluno of who answered it — the foreign key. A JOIN builds rows out of pairs: one learner, one attempt, wherever ON is true.",
      detail: { sql: sqlDaJuncao(base), linhas: [["T_ALUNO", "12 rows"], ["T_TENTATIVA", "12 rows"], ["ON", "te.id_aluno = a.id_aluno"]] },
    },
    (d) => {
      d.camera(todos);
      d.glow(["T_ALUNO", "T_TENTATIVA"], 0.6);
      d.wait(1800);
      d.glow(["T_ALUNO", "T_TENTATIVA"], 0);
    },
  );

  // ------------------------------------------------------------ 2. o ON em cada par
  const primeiro = ALUNOS[0]!;
  const doPrimeiro = TENTATIVAS.filter((te) => te.id_aluno === primeiro.id_aluno);
  const total = comparacoes({ filtro: "sem" });
  f.chapter(
    {
      id: "on",
      title: "ON is asked of every pair",
      body: `Learner 1 against each of the 12 attempts: ON is true for ${doPrimeiro.length}. The database asks the same of every learner — ${total.length} comparisons — and keeps the ${total.filter((c) => c.casou).length} that are true. (A real optimiser uses an index or a hash instead of trying them all; the pairs it finds are the same.)`,
      detail: { sql: sqlDaJuncao(base), linhas: [["learner 1 × 12 attempts", `${doPrimeiro.length} true`], ["12 × 12", `${total.length} comparisons`], ["pairs", String(total.filter((c) => c.casou).length)]] },
    },
    (d) => {
      d.camera({ focus: [idA(primeiro), ...TENTATIVAS.map(idTe)] }, { dur: 900 });
      d.glow(idA(primeiro), 1);
      d.stagger(TENTATIVAS, 140, (x, te) => {
        if (te.id_aluno === primeiro.id_aluno) x.glow(idTe(te), 1).ping(idTe(te));
        else x.dim(idTe(te), 0.5, { dur: 200 });
      });
      d.wait(300);
      d.draw(doPrimeiro.map(idPar), { dur: 700 });
      d.beat({ title: `${total.length} comparisons, ${total.filter((c) => c.casou).length} pairs`, detail: { sql: sqlDaJuncao(base), linhas: [["comparisons", String(total.length)], ["true", String(total.filter((c) => c.casou).length)]] } });
      d.together(
        (x) => x.dim(TENTATIVAS.map(idTe), 0, { dur: 400 }),
        (x) => x.glow([idA(primeiro), ...doPrimeiro.map(idTe)], 0, { dur: 400 }),
        (x) => x.camera(todos, { dur: 900 }),
      );
      d.draw(TENTATIVAS.filter((te) => te.id_aluno !== primeiro.id_aluno).map(idPar), { dur: 1100 });
      d.wait(1200);
    },
  );

  // ------------------------------------------------------------ 3. um aluno, tantas linhas quantos pares
  f.chapter(
    {
      id: "multiplica",
      title: "One learner, as many rows as partners",
      body: `A JOIN row is a pair, not a learner. ${repetidos.length} learners have two attempts each, so each of them comes out twice. The one-to-many relationship multiplies rows: 12 learners and 12 attempts give 12 pairs, but not one per learner.`,
      detail: { sql: sqlDaJuncao({ tipo: "inner", filtro: "sem" }), linhas: [["learners with 2 attempts", repetidos.map((a) => String(a.id_aluno)).join(", ")], ["pairs", String(pares.length)]], resultado: painel("INNER JOIN: pairs", { tipo: "inner", filtro: "sem" }, (l) => repetidos.some((a) => a.id_aluno === l[0])) },
    },
    (d) => {
      d.glow(repetidos.map(idA), 1);
      d.stagger(repetidos, 160, (x, a) => x.set(idA(a), { sublabel: "→ 2 rows" }).ping(idA(a)));
      d.wait(2200);
      d.glow(repetidos.map(idA), 0, { dur: 400 });
    },
  );

  // ------------------------------------------------------------ 4. quem não tem par
  const linhasBase = linhasDaJuncao(base);
  f.chapter(
    {
      id: "sem-par",
      title: o.tipo === "left" ? "LEFT JOIN keeps who has no partner, with NULL" : "INNER JOIN drops who has no partner",
      body:
        o.tipo === "left"
          ? `${orfaos.length} learners have no attempt at all. LEFT OUTER JOIN keeps every row of the table on the left, so each of them still comes out once, with the attempt's columns NULL. ${linhasBase.length} rows. This is query 3 of the database: who has not taken any assessment yet.`
          : `${orfaos.length} learners have no attempt at all. INNER JOIN only returns pairs, so they are not in the result — not as zero, not as NULL: they are gone. ${linhasBase.length} rows. Asking "who has not taken an assessment?" with INNER JOIN returns nobody.`,
      detail: { sql: sqlDaJuncao(base), linhas: [["learners without a partner", orfaos.map((a) => String(a.id_aluno)).join(", ")], ["rows", String(linhasBase.length)]], resultado: painel(o.tipo === "left" ? "LEFT OUTER JOIN" : "INNER JOIN", base, (l) => l[2] === null) },
    },
    (d) => {
      d.set(
        "sql",
        { label: o.tipo === "left" ? "T_ALUNO a LEFT OUTER JOIN T_TENTATIVA te" : "T_ALUNO a INNER JOIN T_TENTATIVA te" },
      );
      if (o.tipo === "left") {
        d.stagger(orfaos, 180, (x, a) => x.show(idNulo(a), { dur: 300 }).ping(idNulo(a)));
      } else {
        d.stagger(orfaos, 180, (x, a) => x.dim(idA(a), 0.85, { dur: 300 }));
      }
      d.wait(2200);
    },
  );

  // ------------------------------------------------------------ 5. o filtro da nota: WHERE ou ON
  const filtradas = linhasDaJuncao(comFiltro);
  const baixas = TENTATIVAS.filter((te) => Number(te.vl_nota) < NOTA_MINIMA);
  const semParNoOn = semPar({ filtro: "on" });
  const virouInner = o.tipo === "left" && o.filtro === "where";
  f.chapter(
    {
      id: "filtro",
      title: o.filtro === "where" ? `WHERE te.vl_nota >= ${NOTA_MINIMA} runs after the join` : `ON … AND te.vl_nota >= ${NOTA_MINIMA} only chooses the partner`,
      body:
        o.filtro === "where"
          ? `The WHERE clause looks at the rows the join already made. ${baixas.length} attempts are below ${NOTA_MINIMA}, and their rows go. ${o.tipo === "left" ? `The NULL rows go too: NULL >= ${NOTA_MINIMA} is not true, it is unknown — and unknown does not pass. The LEFT JOIN quietly became an INNER JOIN: ${filtradas.length} rows.` : `${filtradas.length} rows.`}`
          : `In the ON clause, the grade decides which attempt counts as a partner. ${baixas.length} low attempts stop matching. ${o.tipo === "left" ? `Learners left with no good attempt are still kept, with NULL — now ${semParNoOn.length} of them. ${filtradas.length} rows: everyone, and their good grades.` : `With INNER JOIN, ON and WHERE give the same ${filtradas.length} rows; the difference only exists for LEFT.`}`,
      detail: {
        sql: sqlDaJuncao(comFiltro),
        linhas: [
          [`attempts below ${NOTA_MINIMA}`, baixas.map((te) => String(te.id_tentativa)).join(", ")],
          ["rows", String(filtradas.length)],
          ...(virouInner ? ([["LEFT JOIN", "became INNER"]] as const) : []),
        ],
        resultado: painel(o.filtro === "where" ? "filter in WHERE" : "filter in ON", comFiltro, (l) => l[2] === null),
      },
    },
    (d) => {
      d.set("sql", { label: o.filtro === "where" ? `… WHERE te.vl_nota >= ${NOTA_MINIMA}` : `ON te.id_aluno = a.id_aluno AND te.vl_nota >= ${NOTA_MINIMA}` });
      d.stagger(baixas, 140, (x, te) => x.set(idTe(te), { tone: TOM_DA_FICHA.recusa }).dim(idPar(te), 0.85, { dur: 300 }));
      d.wait(500);
      const ficaram = new Set(filtradas.map((l) => l.aluno.id_aluno));
      if (o.filtro === "where") {
        if (o.tipo === "left") d.stagger(orfaos, 120, (x, a) => x.set(idNulo(a), { tone: TOM_DA_FICHA.recusa }).dim(idNulo(a), 0.85, { dur: 300 }));
        d.dim(ALUNOS.filter((a) => !ficaram.has(a.id_aluno)).map(idA), 0.85, { dur: 400 });
      } else if (o.tipo === "left") {
        d.stagger(semParNoOn.filter((a) => !orfaos.includes(a)), 160, (x, a) => x.show(idNulo(a), { dur: 300 }).ping(idNulo(a)));
      } else {
        d.dim(ALUNOS.filter((a) => !ficaram.has(a.id_aluno)).map(idA), 0.85, { dur: 400 });
      }
      d.wait(2400);
    },
  );

  // ------------------------------------------------------------ 6. contar por aluno
  const gs = grupos(contando);
  const conta = o.contagem === "estrela" ? "COUNT(*)" : "COUNT(te.id_tentativa)";
  const enganados = o.tipo === "left" && o.contagem === "estrela" ? orfaos : [];
  f.chapter(
    {
      id: "contar",
      title: `GROUP BY learner, ${conta}`,
      body:
        o.tipo === "inner"
          ? `With INNER JOIN, each group is a learner who has at least one attempt: ${gs.length} groups. The ${orfaos.length} learners without attempts are not counted as zero — they are not in the result at all.`
          : o.contagem === "estrela"
            ? `COUNT(*) counts rows. Each learner without an attempt still has one row — the NULL one — so ${orfaos.length} learners are reported with 1 attempt they never took. Count the column instead: COUNT(te.id_tentativa) skips NULL.`
            : `COUNT(te.id_tentativa) counts values, and skips NULL. The ${orfaos.length} learners without attempts get 0, which is the truth. ${gs.length} groups, one per learner.`,
      detail: { sql: sqlDaJuncao(contando), linhas: [["groups", String(gs.length)], ...(enganados.length > 0 ? ([["counted 1 by mistake", enganados.map((a) => String(a.id_aluno)).join(", ")]] as const) : [])], resultado: painel(`GROUP BY · ${conta}`, contando, (l) => enganados.some((a) => a.id_aluno === l[0])) },
    },
    (d) => {
      d.set("sql", { label: `SELECT a.nm_aluno, ${conta} … GROUP BY a.id_aluno, a.nm_aluno` });
      // De volta à junção sem filtro: os pares todos, os NULL de quem não tem nenhuma tentativa.
      d.dim([...ALUNOS.map(idA), ...ALUNOS.map(idNulo), ...TENTATIVAS.map(idPar)], 0, { dur: 400 });
      for (const te of TENTATIVAS) d.set(idTe(te), { tone: TOM_DO_GRUPO.acompanhamento });
      for (const a of ALUNOS) d.set(idNulo(a), { tone: TOM_DA_FICHA.nulo });
      d.hide(semParNoOn.filter((a) => !orfaos.includes(a)).map(idNulo), { dur: 300 });
      if (o.tipo === "inner") d.dim(orfaos.map(idA), 0.85, { dur: 300 });
      d.stagger(gs, 110, (x, g) => {
        const errado = enganados.includes(g.aluno);
        x.set(idA(g.aluno), { sublabel: `${conta} = ${g.qt}`, ...(errado ? { tone: TOM_DA_FICHA.recusa } : {}) }).ping(idA(g.aluno));
      });
      d.wait(2600);
    },
  );

  return f.build();
}
