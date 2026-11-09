import { entrada, ordenar } from "../ordenacao/ordenacao.js";
import { gerador } from "../semente.js";

/**
 * Seis classes de custo, cada uma representada por um algoritmo de verdade que
 * roda e conta o próprio trabalho.
 *
 * Não há fórmula aqui. `O(n²)` não é `n * n`: é a seleção rodando e contando
 * comparações. A curva que o lab desenha é a contagem medida, e a curva de
 * referência (a fórmula) fica ao lado, tracejada — o leitor vê as duas
 * coincidirem em vez de ser informado de que coincidem.
 *
 * O teste da duplicação é o instrumento: dobre `n` e divida. A razão
 * `ops(2n) / ops(n)` tende a 1 (constante), a pouco mais de 1 (logarítmica),
 * a 2 (linear), a pouco mais de 2 (n log n), a 4 (quadrática) — e explode na
 * exponencial. É assim que se descobre a classe de um código que ninguém
 * documentou: medindo.
 */
export type Classe = "constant" | "log" | "linear" | "nlogn" | "quadratic" | "exponential";
export const CLASSES: readonly Classe[] = ["constant", "log", "linear", "nlogn", "quadratic", "exponential"];

export interface FichaDaClasse {
  readonly notacao: string;
  readonly nome: string;
  /** O algoritmo que representa a classe, e o que ele conta. */
  readonly algoritmo: string;
  readonly conta: string;
  /** A razão da duplicação para onde a medida tende. */
  readonly razao: string;
  /** A fórmula de referência, para a curva tracejada. */
  readonly referencia: (n: number) => number;
  /** O maior n que vale a pena medir — a exponencial para cedo, e o lab diz por quê. */
  readonly ate: number;
}

export const FICHAS_DAS_CLASSES: Readonly<Record<Classe, FichaDaClasse>> = {
  constant: { notacao: "O(1)", nome: "constant", algoritmo: "Read item i of an array", conta: "memory reads", razao: "×1", referencia: () => 1, ate: 4096 },
  log: { notacao: "O(log n)", nome: "logarithmic", algoritmo: "Binary search in a sorted array", conta: "comparisons", razao: "+1 per doubling", referencia: (n) => Math.floor(Math.log2(n)) + 1, ate: 4096 },
  linear: { notacao: "O(n)", nome: "linear", algoritmo: "Linear search for a missing value", conta: "comparisons", razao: "×2", referencia: (n) => n, ate: 4096 },
  nlogn: { notacao: "O(n log n)", nome: "linearithmic", algoritmo: "Merge sort on a random array", conta: "comparisons", razao: "a bit over ×2", referencia: (n) => n * Math.log2(n), ate: 4096 },
  quadratic: { notacao: "O(n²)", nome: "quadratic", algoritmo: "Selection sort on a random array", conta: "comparisons", razao: "×4", referencia: (n) => (n * (n - 1)) / 2, ate: 4096 },
  exponential: { notacao: "O(2ⁿ)", nome: "exponential", algoritmo: "Try every subset to hit a target sum", conta: "subsets tried", razao: "squares, then explodes", referencia: (n) => 2 ** n, ate: 20 },
};

/** Os tamanhos medidos: dobrando de 2 a 4096. */
export const TAMANHOS: readonly number[] = Array.from({ length: 12 }, (_, k) => 2 ** (k + 1));

/** Ler a posição i: uma leitura, qualquer que seja n. */
export function lerPosicao(v: readonly number[], i: number): { valor: number | undefined; ops: number } {
  return { valor: v[i], ops: 1 };
}

/** Busca binária num vetor ordenado. Conta comparações de três vias como uma. */
export function buscaBinaria(v: readonly number[], alvo: number): { indice: number; ops: number } {
  let ini = 0;
  let fim = v.length - 1;
  let ops = 0;
  while (ini <= fim) {
    const meio = (ini + fim) >> 1;
    ops += 1;
    const x = v[meio]!;
    if (x === alvo) return { indice: meio, ops };
    if (x < alvo) ini = meio + 1;
    else fim = meio - 1;
  }
  return { indice: -1, ops };
}

export function buscaLinear(v: readonly number[], alvo: number): { indice: number; ops: number } {
  let ops = 0;
  for (let i = 0; i < v.length; i += 1) {
    ops += 1;
    if (v[i] === alvo) return { indice: i, ops };
  }
  return { indice: -1, ops };
}

/**
 * Força bruta: experimenta todo subconjunto procurando um que some `alvo`. Um
 * alvo impossível obriga a ver todos — 2ⁿ subconjuntos. Contado por subconjunto.
 */
export function somaDeSubconjunto(v: readonly number[], alvo: number): { achou: boolean; ops: number } {
  const n = v.length;
  if (n > FICHAS_DAS_CLASSES.exponential.ate) throw new RangeError(`2^${n} subsets is too many to try here`);
  let ops = 0;
  const total = 2 ** n;
  for (let mascara = 0; mascara < total; mascara += 1) {
    ops += 1;
    let soma = 0;
    for (let b = 0; b < n; b += 1) if ((mascara >> b) & 1) soma += v[b]!;
    if (soma === alvo) return { achou: true, ops };
  }
  return { achou: false, ops };
}

/**
 * A entrada da medida: o caso de que a classe fala, e não um caso feliz.
 * Busca por valor AUSENTE (o pior caso de ambas), ordenação sobre vetor
 * aleatório semeado, e a soma impossível para a exponencial.
 */
const memoria = new Map<string, number>();

export function medir(classe: Classe, n: number, semente = 1): number {
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`n must be a whole number ≥ 1, got ${n}`);
  // A medida é determinística (mesma classe, n e semente → mesma contagem), então
  // guardar é seguro — e a seleção com n = 4096 faz 8,4 milhões de comparações.
  const chave = `${classe}:${n}:${semente}`;
  const guardada = memoria.get(chave);
  if (guardada !== undefined) return guardada;
  const ops = medirSemGuardar(classe, n, semente);
  memoria.set(chave, ops);
  return ops;
}

function medirSemGuardar(classe: Classe, n: number, semente: number): number {
  switch (classe) {
    case "constant":
      return lerPosicao(entrada("sorted", n), n >> 1).ops;
    case "log":
      return buscaBinaria(entrada("sorted", n), n + 1).ops;
    case "linear":
      return buscaLinear(entrada("sorted", n), n + 1).ops;
    case "nlogn":
      return ordenar("merge", entrada("random", n, semente), false).comparacoes;
    case "quadratic":
      return ordenar("selection", entrada("random", n, semente), false).comparacoes;
    case "exponential": {
      const r = gerador(semente);
      // Itens pares e alvo ímpar: nenhuma soma chega lá, e todos os 2ⁿ são vistos.
      const v = Array.from({ length: n }, () => 2 * (1 + Math.floor(r() * 50)));
      return somaDeSubconjunto(v, 1).ops;
    }
  }
}

export interface Medida {
  readonly n: number;
  /** `undefined` quando a classe não é medida neste n (a exponencial passa de 20). */
  readonly ops: number | undefined;
  /** ops(n) / ops(n/2), quando os dois existem. */
  readonly razao: number | undefined;
}

/** A tabela inteira de uma classe, nos tamanhos dados. */
export function curva(classe: Classe, tamanhos: readonly number[] = TAMANHOS, semente = 1): Medida[] {
  const ate = FICHAS_DAS_CLASSES[classe].ate;
  let anterior: { n: number; ops: number } | undefined;
  return tamanhos.map((n) => {
    if (n > ate) {
      anterior = undefined;
      return { n, ops: undefined, razao: undefined };
    }
    const ops = medir(classe, n, semente);
    const razao = anterior !== undefined && anterior.n * 2 === n && anterior.ops > 0 ? ops / anterior.ops : undefined;
    anterior = { n, ops };
    return { n, ops, razao };
  });
}

/**
 * Quanto tempo uma classe levaria num computador que faz `porSegundo`
 * operações por segundo. É a tradução que torna a exponencial concreta:
 * "a 1 bilhão por segundo, n = 64 leva 585 anos".
 */
export function tempoEstimado(classe: Classe, n: number, porSegundo = 1e9): number {
  return FICHAS_DAS_CLASSES[classe].referencia(n) / porSegundo;
}

/** Um tempo em segundos, em palavras curtas e honestas na ordem de grandeza. */
export function duracao(segundos: number): string {
  if (!Number.isFinite(segundos)) return "longer than the universe has existed";
  if (segundos < 1e-6) return `${(segundos * 1e9).toFixed(0)} ns`;
  if (segundos < 1e-3) return `${(segundos * 1e6).toFixed(1)} µs`;
  if (segundos < 1) return `${(segundos * 1e3).toFixed(1)} ms`;
  if (segundos < 60) return `${segundos.toFixed(1)} s`;
  if (segundos < 3600) return `${(segundos / 60).toFixed(1)} min`;
  if (segundos < 86400) return `${(segundos / 3600).toFixed(1)} h`;
  const anos = segundos / (365.25 * 86400);
  if (segundos < 365.25 * 86400) return `${(segundos / 86400).toFixed(1)} days`;
  if (anos < 1e6) return `${Math.round(anos).toLocaleString("en-US")} years`;
  return `${anos.toExponential(1)} years`;
}
