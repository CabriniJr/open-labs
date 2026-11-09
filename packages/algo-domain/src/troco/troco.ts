/**
 * Dar troco com o menor número de moedas: o caso em que o guloso acerta, o
 * caso em que ele erra, e a tabela que nunca erra.
 *
 * O guloso pega sempre a maior moeda que cabe. Com as moedas do real (1, 5,
 * 10, 25, 50 centavos, R$ 1) isso é ótimo — o sistema é "canônico". Com
 * moedas {1, 3, 4} e troco 6, o guloso dá 4+1+1 (três moedas) quando 3+3 (duas)
 * existia. A Inglaterra antes de 1971 tinha um sistema assim (1, 3, 6, 12, 24,
 * 30 pence): para 48 pence o guloso dá 30+12+6, e o ótimo é 24+24.
 *
 * A programação dinâmica resolve todos os valores de 0 até o pedido, cada um
 * usando os anteriores, e guarda a resposta numa tabela — o mesmo trabalho
 * nunca é feito duas vezes. Ela custa `valor × moedas` passos; o guloso custa
 * `moedas`. É a troca que o lab põe lado a lado.
 */
export class ErroDeTroco extends Error {}

export const MAIOR_VALOR = 500;
export const MAIS_MOEDAS = 8;

export interface SistemaDeMoedas {
  readonly id: string;
  readonly nome: string;
  readonly moedas: readonly number[];
  readonly nota: string;
}

export const SISTEMAS: readonly SistemaDeMoedas[] = [
  { id: "brl", nome: "Brazilian real (cents)", moedas: [1, 5, 10, 25, 50, 100], nota: "Canonical: greedy is always optimal." },
  { id: "pre-decimal", nome: "Britain before 1971 (pence)", moedas: [1, 3, 6, 12, 24, 30], nota: "Not canonical: greedy misses for 48." },
  { id: "toy", nome: "Toy coins", moedas: [1, 3, 4], nota: "The smallest classic counter-example: 6." },
  { id: "no-one", nome: "No 1-cent coin", moedas: [5, 7], nota: "Some amounts cannot be paid at all." },
];

export function lerMoedas(texto: string): number[] {
  const partes = texto.split(/[\s,;]+/u).filter((p) => p !== "");
  if (partes.length === 0) throw new ErroDeTroco("type at least one coin value, like 1 5 10");
  if (partes.length > MAIS_MOEDAS) throw new ErroDeTroco(`at most ${MAIS_MOEDAS} coin values, got ${partes.length}`);
  const vistas = new Set<number>();
  return partes
    .map((p, k) => {
      if (!/^\d+$/u.test(p)) throw new ErroDeTroco(`coin ${k + 1} (“${p}”) is not a whole number`);
      const v = Number(p);
      if (v < 1 || v > MAIOR_VALOR) throw new ErroDeTroco(`coin ${k + 1} must be between 1 and ${MAIOR_VALOR}`);
      if (vistas.has(v)) throw new ErroDeTroco(`coin ${v} appears twice`);
      vistas.add(v);
      return v;
    })
    .sort((a, b) => a - b);
}

const conferirValor = (valor: number) => {
  if (!Number.isInteger(valor) || valor < 1 || valor > MAIOR_VALOR) throw new ErroDeTroco(`the amount must be a whole number from 1 to ${MAIOR_VALOR}, got ${valor}`);
};

export interface Troco {
  /** As moedas dadas, na ordem em que foram escolhidas. `null` quando não fecha. */
  readonly moedas: readonly number[] | null;
  /** Passos de decisão: cada moeda examinada (guloso) ou cada célula×moeda (tabela). */
  readonly passos: number;
  /** Quanto faltou, quando não fechou. */
  readonly sobra: number;
}

export interface PassoGuloso {
  readonly moeda: number;
  readonly restante: number;
}

export function guloso(moedas: readonly number[], valor: number): Troco & { readonly historia: readonly PassoGuloso[] } {
  conferirValor(valor);
  const desc = [...moedas].sort((a, b) => b - a);
  const dadas: number[] = [];
  const historia: PassoGuloso[] = [];
  let resto = valor;
  let passos = 0;
  for (const m of desc) {
    passos += 1;
    while (resto >= m) {
      resto -= m;
      dadas.push(m);
      historia.push({ moeda: m, restante: resto });
    }
  }
  return { moedas: resto === 0 ? dadas : null, passos, sobra: resto, historia };
}

export interface Tabela {
  /** `minimo[v]` = menor número de moedas para v, ou `Infinity`. */
  readonly minimo: readonly number[];
  /** A moeda usada por último na melhor resposta de v. */
  readonly ultima: readonly (number | null)[];
}

/** A tabela de baixo para cima, de 0 até `valor`. */
export function tabela(moedas: readonly number[], valor: number): Tabela & { readonly passos: number } {
  conferirValor(valor);
  const minimo: number[] = [0];
  const ultima: (number | null)[] = [null];
  let passos = 0;
  for (let v = 1; v <= valor; v += 1) {
    let melhor = Number.POSITIVE_INFINITY;
    let escolha: number | null = null;
    for (const m of moedas) {
      passos += 1;
      if (m <= v && minimo[v - m]! + 1 < melhor) {
        melhor = minimo[v - m]! + 1;
        escolha = m;
      }
    }
    minimo.push(melhor);
    ultima.push(escolha);
  }
  return { minimo, ultima, passos };
}

export function otimo(moedas: readonly number[], valor: number): Troco & { readonly tabela: Tabela } {
  const t = tabela(moedas, valor);
  if (!Number.isFinite(t.minimo[valor]!)) return { moedas: null, passos: t.passos, sobra: valor, tabela: t };
  const dadas: number[] = [];
  for (let v = valor; v > 0; v -= t.ultima[v]!) dadas.push(t.ultima[v]!);
  dadas.sort((a, b) => b - a);
  return { moedas: dadas, passos: t.passos, sobra: 0, tabela: t };
}

/**
 * O menor valor em que o guloso usa mais moedas que o ótimo (ou não fecha
 * quando o ótimo fecha). `null` se não há até `limite` — o sistema é canônico
 * nesse trecho.
 */
export function menorContraexemplo(moedas: readonly number[], limite = MAIOR_VALOR): number | null {
  const t = tabela(moedas, limite);
  for (let v = 1; v <= limite; v += 1) {
    const g = guloso(moedas, v);
    const o = t.minimo[v]!;
    if (!Number.isFinite(o)) continue;
    if (g.moedas === null || g.moedas.length > o) return v;
  }
  return null;
}
