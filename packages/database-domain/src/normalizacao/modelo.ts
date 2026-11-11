// locale: skip-file — nomes de tabela e coluna, ids e SQL: identificadores que não se traduzem. A prosa em inglês fica em `labels.ts`.
import type { Valor } from "../telecentro/dados.js";
import { tabela, type NomeDaTabela } from "../telecentro/esquema.js";
import { bancoInicial, linhasDe, type Linha } from "../telecentro/motor.js";

/**
 * Da planilha às dez tabelas: por que o OpenLabs não guarda tudo numa
 * planilha só. O ponto de partida é a planilha que um monitor de telecentro
 * faria à mão — uma linha por aluno, com as tentativas numa célula —, montada
 * a partir dos MESMOS dados do 02-dml.sql. Cada forma normal quebra a planilha
 * onde uma dependência não é da chave, e a última etapa são as tabelas reais
 * do banco (as colunas que vieram da planilha).
 *
 * As anomalias não são texto: cada uma é medida sobre as tabelas da etapa.
 * - atualizar: quantas células mudam para renomear um telecentro;
 * - inserir: se existe lugar para um telecentro que ainda não tem aluno;
 * - apagar: que fatos somem do banco quando as tentativas de uma avaliação são apagadas.
 */

export const ETAPAS = ["planilha", "1fn", "2fn", "3fn"] as const;
export type Etapa = (typeof ETAPAS)[number];

export interface TabelaDaEtapa {
  readonly nome: string;
  /** A chave primária: as colunas que identificam uma linha. */
  readonly chave: readonly string[];
  readonly colunas: readonly string[];
  readonly linhas: readonly (readonly Valor[])[];
  /** Chaves estrangeiras: coluna → tabela. */
  readonly fks?: readonly { readonly coluna: string; readonly tabela: string }[];
  /** A tabela real do banco a que esta corresponde (só na 3FN). */
  readonly real?: NomeDaTabela;
}

/** Os dados de partida: as entidades e as tentativas. Apagar tentativas é filtrar esta lista. */
export interface Fatos {
  readonly telecentros: readonly Linha[];
  readonly alunos: readonly Linha[];
  readonly handbooks: readonly Linha[];
  readonly fases: readonly Linha[];
  readonly labs: readonly Linha[];
  readonly avaliacoes: readonly Linha[];
  readonly tentativas: readonly Linha[];
}

export function fatosIniciais(): Fatos {
  const b = bancoInicial();
  return {
    telecentros: linhasDe(b, "T_TELECENTRO"),
    alunos: linhasDe(b, "T_ALUNO"),
    handbooks: linhasDe(b, "T_HANDBOOK"),
    fases: linhasDe(b, "T_FASE"),
    labs: linhasDe(b, "T_LAB"),
    avaliacoes: linhasDe(b, "T_AVALIACAO"),
    tentativas: linhasDe(b, "T_TENTATIVA"),
  };
}

const por = (ls: readonly Linha[], col: string, v: Valor): Linha => {
  const l = ls.find((x) => x[col] === v);
  if (l === undefined) throw new Error(`${col} = ${String(v)} não existe`);
  return l;
};
const nota = (v: Valor) => (v === null ? null : Number(v).toFixed(2));

/** Uma tentativa com tudo o que a planilha repete ao lado dela. */
function desnormalizar(f: Fatos, te: Linha): Record<string, Valor> {
  const a = por(f.alunos, "id_aluno", te.id_aluno ?? null);
  const t = por(f.telecentros, "id_telecentro", a.id_telecentro ?? null);
  const av = por(f.avaliacoes, "id_avaliacao", te.id_avaliacao ?? null);
  const lab = por(f.labs, "id_lab", av.id_lab ?? null);
  const fase = por(f.fases, "id_fase", lab.id_fase ?? null);
  const hb = por(f.handbooks, "id_handbook", fase.id_handbook ?? null);
  return {
    id_aluno: a.id_aluno ?? null,
    nm_aluno: a.nm_aluno ?? null,
    ds_email: a.ds_email ?? null,
    nm_telecentro: t.nm_telecentro ?? null,
    nm_bairro: t.nm_bairro ?? null,
    nm_cidade: t.nm_cidade ?? null,
    id_avaliacao: av.id_avaliacao ?? null,
    nm_avaliacao: av.nm_avaliacao ?? null,
    nm_lab: lab.nm_lab ?? null,
    nm_fase: fase.nm_fase ?? null,
    nm_handbook: hb.nm_handbook ?? null,
    dt_envio: te.dt_envio ?? null,
    vl_nota: nota(te.vl_nota ?? null),
  };
}

const projetar = (ls: readonly Linha[], cols: readonly string[]): Valor[][] => ls.map((l) => cols.map((c) => (c === "vl_nota" ? nota(l[c] ?? null) : (l[c] ?? null))));

const COLUNAS_1FN = ["id_aluno", "nm_aluno", "ds_email", "nm_telecentro", "nm_bairro", "nm_cidade", "id_avaliacao", "nm_avaliacao", "nm_lab", "nm_fase", "nm_handbook", "dt_envio", "vl_nota"] as const;

/** As tabelas de cada etapa, a partir dos mesmos fatos. */
export function tabelasDa(etapa: Etapa, f: Fatos = fatosIniciais()): readonly TabelaDaEtapa[] {
  const linhas1fn = f.tentativas.map((te) => desnormalizar(f, te));
  if (etapa === "planilha") {
    // Uma linha por aluno, como a lista de chamada do monitor; as tentativas numa célula só.
    return [
      {
        nome: "PLANILHA_DO_MONITOR",
        chave: ["id_aluno"],
        colunas: ["id_aluno", "nm_aluno", "ds_email", "nm_telecentro", "nm_bairro", "nm_cidade", "tentativas"],
        linhas: f.alunos.map((a) => {
          const t = por(f.telecentros, "id_telecentro", a.id_telecentro ?? null);
          const minhas = linhas1fn.filter((l) => l.id_aluno === a.id_aluno);
          const lista = minhas.map((l) => `${String(l.nm_avaliacao)} · ${String(l.nm_lab)} · ${String(l.nm_handbook)} · ${String(l.dt_envio)} · ${String(l.vl_nota)}`).join("; ");
          return [a.id_aluno ?? null, a.nm_aluno ?? null, a.ds_email ?? null, t.nm_telecentro ?? null, t.nm_bairro ?? null, t.nm_cidade ?? null, lista === "" ? null : lista];
        }),
      },
    ];
  }
  if (etapa === "1fn") {
    return [{ nome: "TENTATIVA_1FN", chave: ["id_aluno", "id_avaliacao", "dt_envio"], colunas: COLUNAS_1FN, linhas: linhas1fn.map((l) => COLUNAS_1FN.map((c) => l[c] ?? null)) }];
  }
  if (etapa === "2fn") {
    const aluno = f.alunos.map((a) => {
      const t = por(f.telecentros, "id_telecentro", a.id_telecentro ?? null);
      return [a.id_aluno ?? null, a.nm_aluno ?? null, a.ds_email ?? null, t.nm_telecentro ?? null, t.nm_bairro ?? null, t.nm_cidade ?? null];
    });
    const avaliacao = f.avaliacoes.map((av) => {
      const lab = por(f.labs, "id_lab", av.id_lab ?? null);
      const fase = por(f.fases, "id_fase", lab.id_fase ?? null);
      const hb = por(f.handbooks, "id_handbook", fase.id_handbook ?? null);
      return [av.id_avaliacao ?? null, av.nm_avaliacao ?? null, lab.nm_lab ?? null, fase.nm_fase ?? null, hb.nm_handbook ?? null];
    });
    return [
      { nome: "ALUNO_2FN", chave: ["id_aluno"], colunas: ["id_aluno", "nm_aluno", "ds_email", "nm_telecentro", "nm_bairro", "nm_cidade"], linhas: aluno },
      {
        nome: "TENTATIVA_2FN",
        chave: ["id_aluno", "id_avaliacao", "dt_envio"],
        colunas: ["id_aluno", "id_avaliacao", "dt_envio", "vl_nota"],
        linhas: projetar(f.tentativas, ["id_aluno", "id_avaliacao", "dt_envio", "vl_nota"]),
        fks: [
          { coluna: "id_aluno", tabela: "ALUNO_2FN" },
          { coluna: "id_avaliacao", tabela: "AVALIACAO_2FN" },
        ],
      },
      { nome: "AVALIACAO_2FN", chave: ["id_avaliacao"], colunas: ["id_avaliacao", "nm_avaliacao", "nm_lab", "nm_fase", "nm_handbook"], linhas: avaliacao },
    ];
  }
  // 3FN: cada fato depende da chave da sua tabela, e só dela. São as tabelas
  // reais do banco, com as colunas que vieram da planilha.
  const real = (nome: NomeDaTabela, ls: readonly Linha[], cols: readonly string[]): TabelaDaEtapa => {
    const t = tabela(nome);
    return { nome, real: nome, chave: [t.pk], colunas: cols, linhas: projetar(ls, cols), fks: (t.fks ?? []).filter((fk) => cols.includes(fk.coluna)).map((fk) => ({ coluna: fk.coluna, tabela: fk.tabela })) };
  };
  return [
    real("T_TELECENTRO", f.telecentros, ["id_telecentro", "nm_telecentro", "nm_bairro", "nm_cidade"]),
    real("T_ALUNO", f.alunos, ["id_aluno", "id_telecentro", "nm_aluno", "ds_email"]),
    real("T_TENTATIVA", f.tentativas, ["id_tentativa", "id_aluno", "id_avaliacao", "dt_envio", "vl_nota"]),
    real("T_AVALIACAO", f.avaliacoes, ["id_avaliacao", "id_lab", "nm_avaliacao"]),
    real("T_LAB", f.labs, ["id_lab", "id_fase", "nm_lab"]),
    real("T_FASE", f.fases, ["id_fase", "id_handbook", "nm_fase"]),
    real("T_HANDBOOK", f.handbooks, ["id_handbook", "nm_handbook"]),
  ];
}

// ------------------------------------------------------------------ anomalias, medidas

/** O telecentro dos exemplos: o da equipe, com mais alunos. */
export const TELECENTRO_DO_EXEMPLO = "Telecentro Jardim Ângela";
/** A avaliação cujas tentativas o exemplo apaga: a única de Splunk. */
export const AVALIACAO_DO_EXEMPLO = 6;

/** Atualizar: quantas células guardam este valor — todas precisam mudar juntas. */
export function celulasARenomear(tabelas: readonly TabelaDaEtapa[], coluna: string, valor: Valor): number {
  let n = 0;
  for (const t of tabelas) {
    const i = t.colunas.indexOf(coluna);
    if (i >= 0) n += t.linhas.filter((l) => l[i] === valor).length;
    // Na planilha, o mesmo nome pode estar dentro da célula da lista.
    const lista = t.colunas.indexOf("tentativas");
    if (lista >= 0 && typeof valor === "string") n += t.linhas.filter((l) => String(l[lista] ?? "").includes(valor)).length;
  }
  return n;
}

/**
 * Inserir: um fato só pode ser guardado sozinho se alguma tabela tem como
 * chave o identificador dele. Um telecentro novo, sem aluno nenhum, precisa de
 * uma tabela cuja chave seja id_telecentro.
 */
export function cabeSozinho(tabelas: readonly TabelaDaEtapa[], chave: string): boolean {
  return tabelas.some((t) => t.chave.length === 1 && t.chave[0] === chave);
}

/** Os nomes que o banco conhece numa etapa: cada coluna nm_* com o valor dela. */
function nomesConhecidos(tabelas: readonly TabelaDaEtapa[]): Set<string> {
  const s = new Set<string>();
  for (const t of tabelas) {
    t.colunas.forEach((c, i) => {
      if (!c.startsWith("nm_")) return;
      for (const l of t.linhas) if (l[i] !== null) s.add(`${c}=${String(l[i])}`);
    });
    const lista = t.colunas.indexOf("tentativas");
    if (lista < 0) continue;
    // Na planilha, avaliação, lab e handbook só existem dentro da lista.
    for (const l of t.linhas) {
      for (const item of String(l[lista] ?? "").split("; ").filter(Boolean)) {
        const [av, lab, hb] = item.split(" · ");
        if (av !== undefined) s.add(`nm_avaliacao=${av}`);
        if (lab !== undefined) s.add(`nm_lab=${lab}`);
        if (hb !== undefined) s.add(`nm_handbook=${hb}`);
      }
    }
  }
  return s;
}

/**
 * Apagar: as tentativas de uma avaliação saem. O que mais some junto? Os nomes
 * que só estavam guardados ao lado delas — numa planilha, o nome do lab e do
 * handbook moram na linha da tentativa.
 */
export function perdidosAoApagar(etapa: Etapa, idAvaliacao: number = AVALIACAO_DO_EXEMPLO, f: Fatos = fatosIniciais()): string[] {
  const antes = nomesConhecidos(tabelasDa(etapa, f));
  const depois = nomesConhecidos(tabelasDa(etapa, { ...f, tentativas: f.tentativas.filter((te) => te.id_avaliacao !== idAvaliacao) }));
  return [...antes].filter((x) => !depois.has(x)).sort();
}

export interface Anomalias {
  readonly renomear: number;
  readonly telecentroSemAluno: boolean;
  readonly perdidos: readonly string[];
  /** Alunos que a etapa consegue guardar (na 1FN, quem nunca tentou some). */
  readonly alunos: number;
}

export function anomaliasDa(etapa: Etapa, f: Fatos = fatosIniciais()): Anomalias {
  const ts = tabelasDa(etapa, f);
  const alunos = new Set<Valor>();
  for (const t of ts) {
    const i = t.colunas.indexOf("id_aluno");
    if (i >= 0 && (t.chave.includes("id_aluno") || t.nome === "TENTATIVA_1FN")) for (const l of t.linhas) alunos.add(l[i] ?? null);
  }
  return { renomear: celulasARenomear(ts, "nm_telecentro", TELECENTRO_DO_EXEMPLO), telecentroSemAluno: cabeSozinho(ts, "id_telecentro"), perdidos: perdidosAoApagar(etapa, AVALIACAO_DO_EXEMPLO, f), alunos: alunos.size };
}

// ------------------------------------------------------------------ do modelo ao servidor

/** O CREATE TABLE de uma tabela real, como o 01-ddl.sql escreve (um teste confere). */
export function createTable(nome: NomeDaTabela, primeiroId: number): string {
  const t = tabela(nome);
  const largura = Math.max(...t.colunas.map((c) => c.nome.length));
  const linhas = t.colunas.map((c) => {
    const partes = [c.nome.padEnd(largura), c.tipo];
    if (c.nome === t.pk) partes.push(`GENERATED BY DEFAULT ON NULL AS IDENTITY (START WITH ${primeiroId})`);
    if (c.padrao !== undefined) partes.push(`DEFAULT ${c.padrao}`);
    partes.push(c.nulo === true ? "NULL" : "NOT NULL");
    return `  ${partes.join(" ")}`;
  });
  return `CREATE TABLE ${nome} (\n${linhas.join(",\n")}\n);`;
}

/** Os endpoints que a API Java expõe sobre T_ALUNO, e o SQL que cada um vira. */
export const ENDPOINTS_DO_ALUNO: readonly { readonly metodo: "GET" | "POST" | "PUT" | "DELETE"; readonly rota: string; readonly sql: string }[] = [
  { metodo: "GET", rota: "/alunos", sql: "SELECT * FROM T_ALUNO ORDER BY id_aluno" },
  { metodo: "GET", rota: "/alunos/{id}", sql: "SELECT * FROM T_ALUNO WHERE id_aluno = :id" },
  { metodo: "POST", rota: "/alunos", sql: "INSERT INTO T_ALUNO (id_telecentro, nm_aluno, dt_nascimento, ds_email, dt_cadastro) VALUES (…)" },
  { metodo: "PUT", rota: "/alunos/{id}", sql: "UPDATE T_ALUNO SET nm_aluno = :nm, ds_email = :email WHERE id_aluno = :id" },
  { metodo: "DELETE", rota: "/alunos/{id}", sql: "DELETE FROM T_ALUNO WHERE id_aluno = :id" },
];
