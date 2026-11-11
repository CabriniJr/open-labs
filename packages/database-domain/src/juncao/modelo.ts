// locale: skip-file — ids, SQL e nomes de coluna: identificadores que não se traduzem. A prosa em inglês fica em `labels.ts`.
import type { Valor } from "../telecentro/dados.js";
import { bancoInicial, linhasDe, type Linha, type Resultado } from "../telecentro/motor.js";

/**
 * Juntar à mão: o que um JOIN faz com as linhas de duas tabelas, e para onde
 * vão as que não têm par. As tabelas são as do banco do OpenLabs — T_ALUNO e
 * T_TENTATIVA, as mesmas do 02-dml.sql —, e a pergunta é a do monitor do
 * telecentro: quem fez qual avaliação, e quem ainda não fez nenhuma.
 *
 * Três decisões mudam o resultado, e cada uma é um mal-entendido clássico:
 * - INNER ou LEFT: o INNER descarta quem não tem par; o LEFT o mantém, com NULL;
 * - onde mora o filtro da nota: no WHERE ele roda depois da junção e descarta
 *   as linhas com NULL (o LEFT vira INNER); no ON ele só escolhe o par;
 * - COUNT(*) ou COUNT(te.id_tentativa): no LEFT JOIN, quem não tem tentativa
 *   ainda ocupa uma linha, e COUNT(*) a conta.
 *
 * Nada aqui escreve um resultado à mão: o filme, a simulação e os testes
 * perguntam a estas funções.
 */

export type TipoDeJuncao = "inner" | "left";
/** Onde o filtro da nota fica: em lugar nenhum, no WHERE ou no ON. */
export type OndeFiltrar = "sem" | "where" | "on";
/** COUNT(*) conta linhas; COUNT(te.id_tentativa) conta tentativas (ignora NULL). */
export type Contagem = "estrela" | "coluna";

export interface OpcoesDaJuncao {
  readonly tipo: TipoDeJuncao;
  readonly filtro: OndeFiltrar;
  /** Com contagem, a consulta agrupa por aluno. */
  readonly contagem?: Contagem;
}

export const OPCOES_DA_JUNCAO: OpcoesDaJuncao = { tipo: "left", filtro: "sem" };

/** A nota mínima do filtro: `te.vl_nota >= 7`. */
export const NOTA_MINIMA = 7;

const banco = bancoInicial();
export const ALUNOS: readonly Linha[] = linhasDe(banco, "T_ALUNO");
export const TENTATIVAS: readonly Linha[] = linhasDe(banco, "T_TENTATIVA");

const nota = (te: Linha): number => Number(te.vl_nota);

/** A condição do ON: a chave estrangeira bate e, com o filtro no ON, a nota passa. */
export function casa(a: Linha, te: Linha, o: Pick<OpcoesDaJuncao, "filtro">): boolean {
  return te.id_aluno === a.id_aluno && (o.filtro !== "on" || nota(te) >= NOTA_MINIMA);
}

/** Uma linha do resultado: o aluno e a tentativa dele (null quando o LEFT JOIN não achou par). */
export interface LinhaDaJuncao {
  readonly aluno: Linha;
  readonly tentativa: Linha | null;
}

/**
 * FROM T_ALUNO a [INNER|LEFT] JOIN T_TENTATIVA te ON … [WHERE …]. A junção
 * primeiro, linha a linha; o WHERE depois, sobre o que a junção produziu. Com
 * o filtro no WHERE, `NULL >= 7` é desconhecido — e desconhecido não passa.
 */
export function linhasDaJuncao(o: OpcoesDaJuncao): LinhaDaJuncao[] {
  const linhas: LinhaDaJuncao[] = [];
  for (const a of ALUNOS) {
    const pares = TENTATIVAS.filter((te) => casa(a, te, o));
    for (const te of pares) linhas.push({ aluno: a, tentativa: te });
    if (pares.length === 0 && o.tipo === "left") linhas.push({ aluno: a, tentativa: null });
  }
  return o.filtro === "where" ? linhas.filter((l) => l.tentativa !== null && nota(l.tentativa) >= NOTA_MINIMA) : linhas;
}

/** Os alunos que nenhuma tentativa satisfaz: o INNER os descarta, o LEFT os mantém com NULL. */
export function semPar(o: Pick<OpcoesDaJuncao, "filtro">): Linha[] {
  return ALUNOS.filter((a) => !TENTATIVAS.some((te) => casa(a, te, o)));
}

export interface Grupo {
  readonly aluno: Linha;
  readonly qt: number;
}

/** GROUP BY a.id_aluno, a.nm_aluno: uma linha por aluno, com a contagem escolhida. */
export function grupos(o: OpcoesDaJuncao): Grupo[] {
  const contagem = o.contagem ?? "coluna";
  const porAluno = new Map<Valor, { aluno: Linha; qt: number }>();
  for (const l of linhasDaJuncao(o)) {
    const g = porAluno.get(l.aluno.id_aluno ?? null) ?? { aluno: l.aluno, qt: 0 };
    if (contagem === "estrela" || l.tentativa !== null) g.qt += 1;
    porAluno.set(l.aluno.id_aluno ?? null, g);
  }
  return [...porAluno.values()];
}

const fmtNota = (v: Valor): Valor => (v === null ? null : Number(v).toFixed(2));

/** O que o SQL Developer mostraria. */
export function resultadoDaJuncao(o: OpcoesDaJuncao): Resultado {
  if (o.contagem !== undefined) {
    return {
      colunas: ["ID_ALUNO", "NM_ALUNO", "QT_TENTATIVAS"],
      linhas: grupos(o).map((g) => [g.aluno.id_aluno ?? null, g.aluno.nm_aluno ?? null, g.qt]),
    };
  }
  return {
    colunas: ["ID_ALUNO", "NM_ALUNO", "ID_TENTATIVA", "VL_NOTA"],
    linhas: linhasDaJuncao(o).map((l) => [l.aluno.id_aluno ?? null, l.aluno.nm_aluno ?? null, l.tentativa?.id_tentativa ?? null, fmtNota(l.tentativa?.vl_nota ?? null)]),
  };
}

/** O texto SQL da consulta, como roda no Oracle. */
export function sqlDaJuncao(o: OpcoesDaJuncao): string {
  const join = o.tipo === "left" ? "  LEFT OUTER JOIN T_TENTATIVA te" : " INNER JOIN T_TENTATIVA te";
  const on = `    ON te.id_aluno = a.id_aluno${o.filtro === "on" ? `\n   AND te.vl_nota >= ${NOTA_MINIMA}` : ""}`;
  const where = o.filtro === "where" ? `\n WHERE te.vl_nota >= ${NOTA_MINIMA}` : "";
  if (o.contagem !== undefined) {
    const conta = o.contagem === "estrela" ? "COUNT(*)" : "COUNT(te.id_tentativa)";
    return `SELECT a.id_aluno,\n       a.nm_aluno,\n       ${conta} AS qt_tentativas\n  FROM T_ALUNO a\n${join}\n${on}${where}\n GROUP BY a.id_aluno, a.nm_aluno\n ORDER BY a.id_aluno;`;
  }
  return `SELECT a.id_aluno,\n       a.nm_aluno,\n       te.id_tentativa,\n       te.vl_nota\n  FROM T_ALUNO a\n${join}\n${on}${where}\n ORDER BY a.id_aluno, te.id_tentativa;`;
}

/** Uma comparação do ON: o banco olha cada par aluno × tentativa (laço aninhado). */
export interface Comparacao {
  readonly aluno: number;
  readonly tentativa: number;
  readonly casou: boolean;
}

export function comparacoes(o: Pick<OpcoesDaJuncao, "filtro">): Comparacao[] {
  return ALUNOS.flatMap((a) => TENTATIVAS.map((te) => ({ aluno: Number(a.id_aluno), tentativa: Number(te.id_tentativa), casou: casa(a, te, o) })));
}

// ------------------------------------------------------------------ juntar à mão

/** Um par que o leitor ligou: aluno → tentativa. */
export interface Ligacao {
  readonly aluno: number;
  readonly tentativa: number;
}

export type MotivoDaRecusa = "outro-aluno" | "nota-baixa" | "ja-ligada";

export type TentativaDeLigar = { readonly ok: true; readonly ligacoes: readonly Ligacao[] } | { readonly ok: false; readonly motivo: MotivoDaRecusa };

const aluno = (id: number): Linha | undefined => ALUNOS.find((a) => a.id_aluno === id);
const tentativa = (id: number): Linha | undefined => TENTATIVAS.find((te) => te.id_tentativa === id);

/**
 * O leitor liga um aluno a uma tentativa. O ON decide: a tentativa tem de ser
 * daquele aluno e, com o filtro no ON, ter nota suficiente. Uma tentativa tem
 * um dono só (id_aluno é uma coluna, não uma lista), então não liga duas vezes.
 */
export function ligar(ligacoes: readonly Ligacao[], idAluno: number, idTentativa: number, o: Pick<OpcoesDaJuncao, "filtro">): TentativaDeLigar {
  const a = aluno(idAluno);
  const te = tentativa(idTentativa);
  if (a === undefined || te === undefined) return { ok: false, motivo: "outro-aluno" };
  if (ligacoes.some((l) => l.tentativa === idTentativa)) return { ok: false, motivo: "ja-ligada" };
  if (te.id_aluno !== a.id_aluno) return { ok: false, motivo: "outro-aluno" };
  if (!casa(a, te, o)) return { ok: false, motivo: "nota-baixa" };
  return { ok: true, ligacoes: [...ligacoes, { aluno: idAluno, tentativa: idTentativa }] };
}

export interface Andamento {
  /** Pares que o ON aceita. */
  readonly total: number;
  readonly feitas: number;
  /** O resultado que as ligações do leitor formam (com os NULL do LEFT, se for o caso). */
  readonly linhas: readonly LinhaDaJuncao[];
  /** As ligações do leitor formam exatamente o resultado do banco? */
  readonly completo: boolean;
}

/** O que as ligações do leitor já formam, comparado com o que o banco formaria. */
export function andamento(ligacoes: readonly Ligacao[], o: OpcoesDaJuncao): Andamento {
  const total = comparacoes(o).filter((c) => c.casou).length;
  const linhas: LinhaDaJuncao[] = [];
  for (const a of ALUNOS) {
    const minhas = ligacoes.filter((l) => l.aluno === a.id_aluno).map((l) => tentativa(l.tentativa)).filter((x): x is Linha => x !== undefined);
    for (const te of minhas) linhas.push({ aluno: a, tentativa: te });
    if (minhas.length === 0 && o.tipo === "left" && !TENTATIVAS.some((te) => casa(a, te, o))) linhas.push({ aluno: a, tentativa: null });
  }
  const filtradas = o.filtro === "where" ? linhas.filter((l) => l.tentativa !== null && nota(l.tentativa) >= NOTA_MINIMA) : linhas;
  const feitas = ligacoes.length;
  return { total, feitas, linhas: filtradas, completo: feitas === total };
}

/** O resultado no formato do SQL Developer, a partir das linhas (do banco ou do leitor). */
export function comoResultado(linhas: readonly LinhaDaJuncao[]): Resultado {
  return {
    colunas: ["ID_ALUNO", "NM_ALUNO", "ID_TENTATIVA", "VL_NOTA"],
    linhas: linhas.map((l) => [l.aluno.id_aluno ?? null, l.aluno.nm_aluno ?? null, l.tentativa?.id_tentativa ?? null, fmtNota(l.tentativa?.vl_nota ?? null)]),
  };
}
