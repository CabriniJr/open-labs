import type { Valor } from "./dados.js";
import { tabela, type NomeDaTabela } from "./esquema.js";
import { linhasDe, proximoId, type Banco, type CodigoOracle } from "./motor.js";

/**
 * O que a simulação oferece ao leitor: uma linha válida para começar, os erros
 * clássicos para tentar e o que cada código do Oracle quer dizer.
 */

/** O que cada erro quer dizer, em uma frase (em inglês: o site traduz pelo catálogo). */
export const EXPLICACAO_DO_ERRO: Readonly<Record<CodigoOracle, string>> = {
  "ORA-00001": "A primary key or UNIQUE value that already exists.",
  "ORA-00904": "There is no column with that name.",
  "ORA-01400": "A NOT NULL column got no value. In Oracle, empty text is NULL.",
  "ORA-01438": "The number has more digits than the column type allows.",
  "ORA-01722": "The column is a number, and the value is not.",
  "ORA-01861": "Not a real date — use YYYY-MM-DD.",
  "ORA-02290": "A CHECK rule came out FALSE.",
  "ORA-02291": "The foreign key points to a parent row that does not exist.",
  "ORA-02292": "Other rows still point to this one — delete them first.",
  "ORA-12899": "The text is longer than the column allows.",
};

/**
 * Uma linha que o banco aceita: a última da tabela, com a chave nova e os
 * valores únicos trocados por outros livres.
 */
export function linhaValida(b: Banco, nome: NomeDaTabela): Record<string, Valor> {
  const t = tabela(nome);
  const linhas = linhasDe(b, nome);
  const base: Record<string, Valor> = { ...(linhas.at(-1) ?? {}) };
  const id = proximoId(b, nome);
  base[t.pk] = id;
  for (const c of t.colunas) {
    if (c.unico !== true || c.nome === t.pk) continue;
    if (c.nulo === true) base[c.nome] = null;
    else if (c.nome === "ds_faixa_rede") base[c.nome] = `10.${id}.0.0/24`;
    else base[c.nome] = `${String(base[c.nome] ?? "novo").slice(0, 30)}-${id}`;
  }
  if (nome === "T_COMPUTADOR") base.nm_hostname = `PC-${id}`;
  // Uma aluna nova (simulada), e não a cópia do último aluno com outro id.
  if (nome === "T_ALUNO") Object.assign(base, { id_telecentro: 1, nm_aluno: "Nina Prado Lopes", dt_nascimento: "2009-02-02", ds_email: null, dt_cadastro: "2026-11-01", st_ativo: "S" });
  if (nome === "T_FASE") {
    const h = base.id_handbook;
    base.nr_ordem = Math.max(0, ...linhas.filter((l) => l.id_handbook === h).map((l) => Number(l.nr_ordem))) + 1;
  }
  if (nome === "T_PROGRESSO") {
    // Um par aluno × lab que ainda não existe.
    const usados = new Set(linhas.map((l) => `${String(l.id_aluno)}|${String(l.id_lab)}`));
    for (const a of linhasDe(b, "T_ALUNO")) {
      const lab = linhasDe(b, "T_LAB").find((l) => !usados.has(`${String(a.id_aluno)}|${String(l.id_lab)}`));
      if (lab !== undefined) {
        base.id_aluno = a.id_aluno ?? null;
        base.id_lab = lab.id_lab ?? null;
        break;
      }
    }
  }
  return base;
}

export interface Tentativa {
  readonly id: string;
  /** O rótulo do botão (em inglês). */
  readonly rotulo: string;
  readonly tabela: NomeDaTabela;
  /** INSERT: a linha a tentar. DELETE: a chave da linha a apagar. */
  readonly operacao: "insert" | "delete";
  readonly valores: (b: Banco) => Record<string, Valor>;
  /** O erro que o banco deve dar — a simulação não usa; o teste confere. */
  readonly espera: CodigoOracle;
}

const com = (nome: NomeDaTabela, mudanca: Record<string, Valor>) => (b: Banco) => ({ ...linhaValida(b, nome), ...mudanca });

/** Os erros clássicos, um botão cada. */
export const TENTATIVAS_ERRADAS: readonly Tentativa[] = [
  { id: "pai", rotulo: "A learner in telecentre 77", tabela: "T_ALUNO", operacao: "insert", valores: com("T_ALUNO", { id_telecentro: 77 }), espera: "ORA-02291" },
  { id: "nota", rotulo: "Grade 11", tabela: "T_TENTATIVA", operacao: "insert", valores: com("T_TENTATIVA", { vl_nota: 11 }), espera: "ORA-02290" },
  { id: "repetido", rotulo: "Same learner, same lab", tabela: "T_PROGRESSO", operacao: "insert", valores: com("T_PROGRESSO", { id_aluno: 1, id_lab: 1 }), espera: "ORA-00001" },
  { id: "datas", rotulo: "Finished before it started", tabela: "T_PROGRESSO", operacao: "insert", valores: com("T_PROGRESSO", { dt_inicio: "2026-11-10", dt_conclusao: "2026-11-01" }), espera: "ORA-02290" },
  { id: "vazio", rotulo: "A learner with an empty name", tabela: "T_ALUNO", operacao: "insert", valores: com("T_ALUNO", { nm_aluno: "" }), espera: "ORA-01400" },
  { id: "vlan", rotulo: "A computer on VLAN 40", tabela: "T_COMPUTADOR", operacao: "insert", valores: com("T_COMPUTADOR", { nr_vlan: 40 }), espera: "ORA-02290" },
  { id: "pk", rotulo: "Reuse learner id 1", tabela: "T_ALUNO", operacao: "insert", valores: com("T_ALUNO", { id_aluno: 1 }), espera: "ORA-00001" },
  { id: "data", rotulo: "February 30th", tabela: "T_ALUNO", operacao: "insert", valores: com("T_ALUNO", { dt_cadastro: "2026-02-30" }), espera: "ORA-01861" },
  { id: "apagar", rotulo: "Delete telecentre 1", tabela: "T_TELECENTRO", operacao: "delete", valores: () => ({ id_telecentro: 1 }), espera: "ORA-02292" },
];
