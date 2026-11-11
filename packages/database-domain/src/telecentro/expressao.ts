// locale: skip-file — esquema, dados, SQL e mensagens do Oracle: identificadores e saída do banco, que não se traduzem.
import type { Valor } from "./dados.js";

/**
 * O avaliador das expressões de CHECK do esquema, com a lógica de três valores
 * do SQL: uma comparação com NULL não é verdadeira nem falsa, é desconhecida.
 *
 * É o que explica por que `CHECK (vl_nota BETWEEN 0 AND 10)` aceita uma nota
 * NULL: o banco só recusa quando a regra dá FALSO. Desconhecido passa.
 *
 * A gramática cobre o que o esquema usa, e nada além:
 *   expr  := termo (OR termo)*
 *   termo := fator (AND fator)*
 *   fator := NOT fator | '(' expr ')' | valor IS [NOT] NULL
 *          | valor [NOT] IN '(' valor, … ')' | valor BETWEEN valor AND valor
 *          | valor (= | <> | != | < | <= | > | >=) valor
 *   valor := número | 'texto' | coluna
 */
export type Logico = boolean | null;

type Token = { readonly tipo: "num" | "txt" | "id" | "op" | "abre" | "fecha" | "virgula"; readonly v: string };

function tokens(expr: string): Token[] {
  const lista: Token[] = [];
  const re = /\s*(?:(\d+(?:\.\d+)?)|'((?:[^']|'')*)'|([A-Za-z_][A-Za-z0-9_]*)|(<=|>=|<>|!=|=|<|>)|(\()|(\))|(,))/gyu;
  let i = 0;
  while (i < expr.length) {
    re.lastIndex = i;
    const m = re.exec(expr);
    if (m === null) {
      if (expr.slice(i).trim() === "") break;
      throw new Error(`expressão inválida perto de: ${expr.slice(i)}`);
    }
    i = re.lastIndex;
    if (m[1] !== undefined) lista.push({ tipo: "num", v: m[1] });
    else if (m[2] !== undefined) lista.push({ tipo: "txt", v: m[2].replace(/''/gu, "'") });
    else if (m[3] !== undefined) lista.push({ tipo: "id", v: m[3] });
    else if (m[4] !== undefined) lista.push({ tipo: "op", v: m[4] });
    else if (m[5] !== undefined) lista.push({ tipo: "abre", v: "(" });
    else if (m[6] !== undefined) lista.push({ tipo: "fecha", v: ")" });
    else if (m[7] !== undefined) lista.push({ tipo: "virgula", v: "," });
  }
  return lista;
}

const e = (a: Logico, b: Logico): Logico => (a === false || b === false ? false : a === null || b === null ? null : true);
const ou = (a: Logico, b: Logico): Logico => (a === true || b === true ? true : a === null || b === null ? null : false);
const nao = (a: Logico): Logico => (a === null ? null : !a);

function comparar(a: Valor, op: string, b: Valor): Logico {
  if (a === null || b === null) return null;
  const c = typeof a === "number" && typeof b === "number" ? a - b : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
  switch (op) {
    case "=":
      return c === 0;
    case "<>":
    case "!=":
      return c !== 0;
    case "<":
      return c < 0;
    case "<=":
      return c <= 0;
    case ">":
      return c > 0;
    default:
      return c >= 0;
  }
}

/** Avalia `expr` sobre uma linha. Verdadeiro, falso ou desconhecido (null). */
export function avaliar(expr: string, linha: Readonly<Record<string, Valor>>): Logico {
  const ts = tokens(expr);
  let p = 0;
  const olha = (): Token | undefined => ts[p];
  const palavra = (w: string) => olha()?.tipo === "id" && olha()?.v.toUpperCase() === w;
  const espera = (tipo: Token["tipo"], w?: string) => {
    const t = ts[p];
    if (t === undefined || t.tipo !== tipo || (w !== undefined && t.v.toUpperCase() !== w)) throw new Error(`esperava ${w ?? tipo} em: ${expr}`);
    p += 1;
    return t;
  };
  const valor = (): Valor => {
    const t = ts[p];
    p += 1;
    if (t === undefined) throw new Error(`expressão incompleta: ${expr}`);
    if (t.tipo === "num") return Number(t.v);
    if (t.tipo === "txt") return t.v;
    if (t.tipo === "id") {
      if (t.v.toUpperCase() === "NULL") return null;
      if (!(t.v in linha)) throw new Error(`coluna ${t.v} não existe na linha`);
      return linha[t.v] ?? null;
    }
    throw new Error(`valor esperado em: ${expr}`);
  };
  const fator = (): Logico => {
    if (palavra("NOT")) {
      p += 1;
      return nao(fator());
    }
    if (olha()?.tipo === "abre") {
      p += 1;
      const r = ou_();
      espera("fecha");
      return r;
    }
    const a = valor();
    if (palavra("IS")) {
      p += 1;
      const negado = palavra("NOT");
      if (negado) p += 1;
      espera("id", "NULL");
      return negado ? a !== null : a === null;
    }
    const negado = palavra("NOT");
    if (negado) p += 1;
    if (palavra("IN")) {
      p += 1;
      espera("abre");
      let r: Logico = false;
      for (;;) {
        r = ou(r, comparar(a, "=", valor()));
        if (olha()?.tipo === "virgula") p += 1;
        else break;
      }
      espera("fecha");
      return negado ? nao(r) : r;
    }
    if (palavra("BETWEEN")) {
      p += 1;
      const lo = valor();
      espera("id", "AND");
      const hi = valor();
      const r = e(comparar(a, ">=", lo), comparar(a, "<=", hi));
      return negado ? nao(r) : r;
    }
    const op = espera("op").v;
    return comparar(a, op, valor());
  };
  const termo = (): Logico => {
    let r = fator();
    while (palavra("AND")) {
      p += 1;
      r = e(r, fator());
    }
    return r;
  };
  const ou_ = (): Logico => {
    let r = termo();
    while (palavra("OR")) {
      p += 1;
      r = ou(r, termo());
    }
    return r;
  };
  const r = ou_();
  if (p !== ts.length) throw new Error(`sobrou texto na expressão: ${expr}`);
  return r;
}
