// locale: skip-file — esquema, dados, SQL e mensagens do Oracle: identificadores e saída do banco, que não se traduzem.
import { DADOS, type Valor } from "./dados.js";
import { constraintsDe, tabela, TABELAS, type Coluna, type Constraint, type NomeDaTabela, type Tabela } from "./esquema.js";
import { avaliar } from "./expressao.js";

/**
 * Um banco relacional pequeno, que roda no navegador com o esquema e os dados
 * de `esquema.ts` e `dados.ts`, e recusa o que o Oracle recusaria, com o mesmo
 * código de erro. É o que o lab mostra e o que a simulação deixa o leitor
 * quebrar.
 *
 * Não interpreta SQL. Cada operação (inserir, apagar, as três consultas) é uma
 * função, e o texto SQL equivalente fica ao lado, em `consultas.ts`. O que importa aqui é
 * a regra: o que faz o banco dizer não, e em que ordem.
 *
 * Imutável: inserir devolve um banco novo, e o antigo continua valendo.
 */
export type Linha = Readonly<Record<string, Valor>>;

export interface Banco {
  readonly tabelas: ReadonlyMap<NomeDaTabela, readonly Linha[]>;
}

/** O usuário (schema) que aparece nas mensagens de erro, como no Oracle da FIAP aparece o RM. */
export const ESQUEMA = "OPENLABS";

export type CodigoOracle = "ORA-00001" | "ORA-00904" | "ORA-01400" | "ORA-01438" | "ORA-01722" | "ORA-01861" | "ORA-02290" | "ORA-02291" | "ORA-02292" | "ORA-12899";

export interface Recusa {
  readonly codigo: CodigoOracle;
  /** A mensagem como o SQL Developer mostra. */
  readonly mensagem: string;
  /** A regra que recusou: nome da constraint, ou o tipo da coluna. */
  readonly regra: string;
  readonly tipo: "NOT NULL" | "TIPO" | "PK" | "UK" | "CK" | "FK" | "COLUNA";
  readonly coluna?: string;
  /** FK: a tabela-pai (insert) ou a tabela-filha (delete). */
  readonly outra?: NomeDaTabela;
}

export type Escrita = { readonly ok: true; readonly banco: Banco; readonly linha: Linha; readonly mensagem: string } | { readonly ok: false; readonly recusa: Recusa };

/** Linha de `dados.ts` (posicional) → objeto coluna → valor. */
const comoObjeto = (t: Tabela, valores: readonly Valor[]): Linha => Object.fromEntries(t.colunas.map((c, i) => [c.nome, valores[i] ?? null]));

export function bancoInicial(): Banco {
  return { tabelas: new Map(TABELAS.map((t) => [t.nome, DADOS[t.nome].linhas.map((v) => comoObjeto(t, v))])) };
}

export const linhasDe = (b: Banco, nome: NomeDaTabela): readonly Linha[] => b.tabelas.get(nome) ?? [];

// ------------------------------------------------------------------ tipos

interface TipoLido {
  readonly base: "NUMBER" | "VARCHAR2" | "CHAR" | "DATE";
  readonly tamanho: number;
  readonly escala: number;
}

export function lerTipo(tipo: string): TipoLido {
  const m = /^(NUMBER|VARCHAR2|CHAR|DATE)(?:\((\d+)(?:,(\d+))?\))?$/u.exec(tipo.replace(/\s/gu, ""));
  if (m === null) throw new Error(`tipo desconhecido: ${tipo}`);
  return { base: m[1] as TipoLido["base"], tamanho: Number(m[2] ?? 0), escala: Number(m[3] ?? 0) };
}

const aspas = (t: Tabela, c: string) => `"${ESQUEMA}"."${t.nome}"."${c.toUpperCase()}"`;

/** Converte o valor para o tipo da coluna, ou diz por que não dá. */
function converter(t: Tabela, c: Coluna, v: Valor): { ok: true; v: Valor } | { ok: false; recusa: Recusa } {
  if (v === null) return { ok: true, v };
  const tipo = lerTipo(c.tipo);
  const recusa = (codigo: CodigoOracle, mensagem: string): { ok: false; recusa: Recusa } => ({ ok: false, recusa: { codigo, mensagem: `${codigo}: ${mensagem}`, regra: c.tipo, tipo: "TIPO", coluna: c.nome } });
  if (tipo.base === "NUMBER") {
    const n = typeof v === "number" ? v : Number(String(v).trim().replace(",", "."));
    if (String(v).trim() === "" || !Number.isFinite(n)) return recusa("ORA-01722", "invalid number");
    const arredondado = Math.round(n * 10 ** tipo.escala) / 10 ** tipo.escala;
    if (Math.abs(Math.trunc(arredondado)).toString().length > tipo.tamanho - tipo.escala && Math.trunc(arredondado) !== 0) {
      return recusa("ORA-01438", "value larger than specified precision allowed for this column");
    }
    return { ok: true, v: arredondado };
  }
  if (tipo.base === "DATE") {
    const s = String(v).trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(s);
    const valida = m !== null && Number(m[2]) >= 1 && Number(m[2]) <= 12 && Number(m[3]) >= 1 && Number(m[3]) <= new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate();
    return valida ? { ok: true, v: s } : recusa("ORA-01861", "literal does not match format string");
  }
  const s = String(v);
  if (s.length > tipo.tamanho) return recusa("ORA-12899", `value too large for column ${aspas(t, c.nome)} (actual: ${s.length}, maximum: ${tipo.tamanho})`);
  return { ok: true, v: s };
}

// ------------------------------------------------------------------ escrever

const igual = (a: Linha, b: Linha, colunas: readonly string[]) => colunas.every((c) => a[c] !== null && a[c] === b[c]);

/**
 * INSERT INTO <nome> (…) VALUES (…). As verificações vêm na ordem em que o
 * leitor as encontra: coluna que não existe, NOT NULL, tipo e tamanho, chave
 * primária e UNIQUE, CHECK e, por último, chave estrangeira — a única que
 * precisa olhar outra tabela.
 */
export function inserir(b: Banco, nome: NomeDaTabela, valores: Readonly<Record<string, Valor>>): Escrita {
  const t = tabela(nome);
  for (const k of Object.keys(valores)) {
    if (!t.colunas.some((c) => c.nome === k)) {
      return { ok: false, recusa: { codigo: "ORA-00904", mensagem: `ORA-00904: "${k.toUpperCase()}": invalid identifier`, regra: k, tipo: "COLUNA", coluna: k } };
    }
  }
  const linha: Record<string, Valor> = {};
  for (const c of t.colunas) {
    let v: Valor = valores[c.nome] === undefined ? null : (valores[c.nome] ?? null);
    if (valores[c.nome] === undefined && c.padrao !== undefined) v = c.padrao.replace(/^'(.*)'$/u, "$1");
    if (typeof v === "string" && v === "" ) v = null; // no Oracle, texto vazio é NULL
    if (v === null && c.nulo !== true) {
      return { ok: false, recusa: { codigo: "ORA-01400", mensagem: `ORA-01400: cannot insert NULL into (${aspas(t, c.nome)})`, regra: "NOT NULL", tipo: "NOT NULL", coluna: c.nome } };
    }
    const r = converter(t, c, v);
    if (!r.ok) return r;
    linha[c.nome] = r.v;
  }
  const existentes = linhasDe(b, nome);
  for (const k of constraintsDe(t)) {
    const r = violada(b, t, k, linha, existentes);
    if (r !== null) return { ok: false, recusa: r };
  }
  const tabelas = new Map(b.tabelas);
  tabelas.set(nome, [...existentes, linha]);
  return { ok: true, banco: { tabelas }, linha, mensagem: "1 row inserted." };
}

function violada(b: Banco, t: Tabela, k: Constraint, linha: Linha, existentes: readonly Linha[]): Recusa | null {
  const nome = `${ESQUEMA}.${k.nome}`;
  if (k.tipo === "PK" || k.tipo === "UK") {
    if (existentes.some((x) => igual(x, linha, k.colunas))) {
      return { codigo: "ORA-00001", mensagem: `ORA-00001: unique constraint (${nome}) violated`, regra: k.nome, tipo: k.tipo, coluna: k.colunas.join(", ") };
    }
    return null;
  }
  if (k.tipo === "CK") {
    // Só FALSO recusa. Desconhecido (uma coluna NULL na regra) passa.
    if (avaliar(k.expressao ?? "", linha) === false) {
      return { codigo: "ORA-02290", mensagem: `ORA-02290: check constraint (${nome}) violated`, regra: k.nome, tipo: "CK", ...(k.colunas[0] === undefined ? {} : { coluna: k.colunas[0] }) };
    }
    return null;
  }
  const ref = k.referencia;
  const coluna = k.colunas[0];
  if (ref === undefined || coluna === undefined) return null;
  const v = linha[coluna] ?? null;
  if (v !== null && !linhasDe(b, ref.tabela).some((p) => p[ref.coluna] === v)) {
    return { codigo: "ORA-02291", mensagem: `ORA-02291: integrity constraint (${nome}) violated - parent key not found`, regra: k.nome, tipo: "FK", coluna, outra: ref.tabela };
  }
  return null;
}

/** DELETE FROM <nome> WHERE <pk> = <id>. Recusa se alguma linha-filha ainda aponta para esta. */
export function apagar(b: Banco, nome: NomeDaTabela, id: Valor): Escrita {
  const t = tabela(nome);
  const alvo = linhasDe(b, nome).find((x) => x[t.pk] === id);
  if (alvo === undefined) return { ok: true, banco: b, linha: {}, mensagem: "0 rows deleted." };
  for (const filha of TABELAS) {
    for (const k of constraintsDe(filha)) {
      if (k.tipo !== "FK" || k.referencia?.tabela !== nome) continue;
      const coluna = k.colunas[0] ?? "";
      if (linhasDe(b, filha.nome).some((x) => x[coluna] === id)) {
        return {
          ok: false,
          recusa: { codigo: "ORA-02292", mensagem: `ORA-02292: integrity constraint (${ESQUEMA}.${k.nome}) violated - child record found`, regra: k.nome, tipo: "FK", coluna, outra: filha.nome },
        };
      }
    }
  }
  const tabelas = new Map(b.tabelas);
  tabelas.set(
    nome,
    linhasDe(b, nome).filter((x) => x !== alvo),
  );
  return { ok: true, banco: { tabelas }, linha: alvo, mensagem: "1 row deleted." };
}

// ------------------------------------------------------------------ consultar

export interface Resultado {
  readonly colunas: readonly string[];
  readonly linhas: readonly (readonly Valor[])[];
}

export type Juncao = "inner" | "left";

/** Um par da junção: a linha da esquerda e a da direita (null quando o LEFT JOIN não achou par). */
export interface Par {
  readonly esq: Linha;
  readonly dir: Linha | null;
}

/** Junta duas listas de linhas pela condição. INNER descarta quem não tem par; LEFT o mantém, com a direita NULL. */
export function juntar(esq: readonly Linha[], dir: readonly Linha[], on: (a: Linha, b: Linha) => boolean, tipo: Juncao): Par[] {
  const pares: Par[] = [];
  for (const a of esq) {
    const achados = dir.filter((b) => on(a, b));
    for (const b of achados) pares.push({ esq: a, dir: b });
    if (achados.length === 0 && tipo === "left") pares.push({ esq: a, dir: null });
  }
  return pares;
}

const ordem = new Intl.Collator("pt-BR");
const cmp = (a: Valor, b: Valor): number => (typeof a === "number" && typeof b === "number" ? a - b : ordem.compare(String(a ?? ""), String(b ?? "")));

/** Consulta 1 — INNER JOIN: cada aluno com o telecentro dele. */
export function consulta1(b: Banco): Resultado {
  const pares = juntar(linhasDe(b, "T_ALUNO"), linhasDe(b, "T_TELECENTRO"), (a, t) => t.id_telecentro === a.id_telecentro, "inner");
  pares.sort((x, y) => cmp(x.dir?.nm_telecentro ?? null, y.dir?.nm_telecentro ?? null) || cmp(x.esq.nm_aluno ?? null, y.esq.nm_aluno ?? null));
  return {
    colunas: ["ID_ALUNO", "NM_ALUNO", "NM_TELECENTRO", "NM_BAIRRO", "NM_CIDADE", "DT_CADASTRO"],
    linhas: pares.map(({ esq: a, dir: t }) => [a.id_aluno ?? null, a.nm_aluno ?? null, t?.nm_telecentro ?? null, t?.nm_bairro ?? null, t?.nm_cidade ?? null, a.dt_cadastro ?? null]),
  };
}

/** Consulta 2 — INNER JOIN + GROUP BY: alunos ativos por telecentro, com o primeiro e o último cadastro. */
export function consulta2(b: Banco): Resultado {
  const pares = juntar(linhasDe(b, "T_TELECENTRO"), linhasDe(b, "T_ALUNO"), (t, a) => a.id_telecentro === t.id_telecentro, "inner").filter((p) => p.dir?.st_ativo === "S");
  const grupos = new Map<string, { nome: Valor; cidade: Valor; datas: string[] }>();
  for (const { esq: t, dir: a } of pares) {
    const chave = `${String(t.nm_telecentro)}|${String(t.nm_cidade)}`;
    const g = grupos.get(chave) ?? { nome: t.nm_telecentro ?? null, cidade: t.nm_cidade ?? null, datas: [] };
    g.datas.push(String(a?.dt_cadastro));
    grupos.set(chave, g);
  }
  const linhas = [...grupos.values()].map((g) => {
    const datas = [...g.datas].sort();
    return [g.nome, g.cidade, g.datas.length, datas[0] ?? null, datas.at(-1) ?? null] as const;
  });
  linhas.sort((x, y) => y[2] - x[2] || cmp(x[0], y[0]));
  return { colunas: ["NM_TELECENTRO", "NM_CIDADE", "QT_ALUNOS_ATIVOS", "DT_PRIMEIRO_CADASTRO", "DT_ULTIMO_CADASTRO"], linhas };
}

/**
 * Consulta 3 — LEFT OUTER JOIN + WHERE + ORDER BY: alunos ativos sem nenhuma
 * tentativa. Com `inner`, a mesma consulta volta vazia: o INNER JOIN já
 * descartou justamente os alunos sem par, e o `IS NULL` não tem o que achar.
 */
export function consulta3(b: Banco, tipo: Juncao = "left"): Resultado {
  const pares = juntar(linhasDe(b, "T_ALUNO"), linhasDe(b, "T_TENTATIVA"), (a, te) => te.id_aluno === a.id_aluno, tipo).filter((p) => p.esq.st_ativo === "S" && (p.dir?.id_tentativa ?? null) === null);
  pares.sort((x, y) => cmp(x.esq.dt_cadastro ?? null, y.esq.dt_cadastro ?? null) || cmp(x.esq.nm_aluno ?? null, y.esq.nm_aluno ?? null));
  return { colunas: ["ID_ALUNO", "NM_ALUNO", "DS_EMAIL", "DT_CADASTRO"], linhas: pares.map(({ esq: a }) => [a.id_aluno ?? null, a.nm_aluno ?? null, a.ds_email ?? null, a.dt_cadastro ?? null]) };
}

/** Próximo id livre da tabela: o que uma SEQUENCE daria. */
export function proximoId(b: Banco, nome: NomeDaTabela): number {
  const pk = tabela(nome).pk;
  return Math.max(0, ...linhasDe(b, nome).map((x) => Number(x[pk] ?? 0))) + 1;
}
