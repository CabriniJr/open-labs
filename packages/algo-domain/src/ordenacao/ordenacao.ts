import { embaralhado, gerador, inteiroEntre } from "../semente.js";

/**
 * Cinco jeitos de ordenar o mesmo vetor, e o que cada um custa.
 *
 * Nenhum algoritmo aqui devolve só o vetor ordenado. Cada um roda sobre um
 * vetor **instrumentado**: toda leitura comparada e toda escrita passam por
 * ele e viram uma operação na fita (`ops`). A corrida do lab, o filme e o
 * gráfico de crescimento leem essa fita — nenhum deles recalcula o algoritmo
 * por conta própria, então os três nunca discordam.
 *
 * A unidade de custo é uma operação primitiva: comparar dois itens, trocar dois
 * itens, ou escrever um valor numa posição (o merge escreve; os outros trocam).
 * Uma troca conta como UMA operação, não duas escritas — é o que o leitor vê
 * acontecer na tela, e o lab escreve isso em vez de fingir que é óbvio.
 */
export type Algoritmo = "bubble" | "insertion" | "selection" | "merge" | "quick";
export const ALGORITMOS: readonly Algoritmo[] = ["bubble", "insertion", "selection", "merge", "quick"];

/** Como o vetor de entrada nasce. O formato é a manopla que mais muda o resultado. */
export type Formato = "random" | "sorted" | "reversed" | "few-unique";
export const FORMATOS: readonly Formato[] = ["random", "sorted", "reversed", "few-unique"];

export type Operacao =
  | { readonly tipo: "compare"; readonly i: number; readonly j: number }
  | { readonly tipo: "swap"; readonly i: number; readonly j: number }
  /** Escreve `valor` na posição `i`. Só o merge escreve, a partir da fita auxiliar. */
  | { readonly tipo: "write"; readonly i: number; readonly valor: number };

/**
 * Um marco: onde começa uma passada, uma intercalação ou uma partição. NÃO é
 * operação e não custa nada — é a fronteira que o filme usa para dividir a
 * fita em capítulos. `passo` é o tamanho da fita quando o marco foi posto.
 */
export interface Fase {
  readonly passo: number;
  readonly rotulo: string;
  readonly ini: number;
  readonly fim: number;
}

export interface Traco {
  readonly algoritmo: Algoritmo;
  readonly fases: readonly Fase[];
  readonly entrada: readonly number[];
  readonly saida: readonly number[];
  readonly ops: readonly Operacao[];
  readonly comparacoes: number;
  readonly trocas: number;
  readonly escritas: number;
  /** Quantas posições de memória extra o algoritmo chegou a usar ao mesmo tempo. */
  readonly memoriaExtra: number;
}

export interface FichaDoAlgoritmo {
  readonly nome: string;
  /** A classe no caso médio, e no pior quando é diferente. */
  readonly medio: string;
  readonly pior: string;
  readonly melhor: string;
  readonly memoria: string;
  /** Uma frase: quem decide o próximo par. É a tese do lab. */
  readonly regra: string;
}

export const FICHAS: Readonly<Record<Algoritmo, FichaDoAlgoritmo>> = {
  bubble: { nome: "Bubble sort", medio: "O(n²)", pior: "O(n²)", melhor: "O(n)", memoria: "O(1)", regra: "Compare each neighbour pair, swap if out of order, and repeat the pass until a pass swaps nothing." },
  insertion: { nome: "Insertion sort", medio: "O(n²)", pior: "O(n²)", melhor: "O(n)", memoria: "O(1)", regra: "Take the next item and slide it left until it sits after a smaller one." },
  selection: { nome: "Selection sort", medio: "O(n²)", pior: "O(n²)", melhor: "O(n²)", memoria: "O(1)", regra: "Scan the rest for the smallest item and swap it into the next place — always the full scan." },
  merge: { nome: "Merge sort", medio: "O(n log n)", pior: "O(n log n)", melhor: "O(n log n)", memoria: "O(n)", regra: "Split in half until each half has one item, then merge sorted halves by always taking the smaller head." },
  quick: { nome: "Quicksort", medio: "O(n log n)", pior: "O(n²)", melhor: "O(n log n)", memoria: "O(log n)", regra: "Pick the last item as pivot, move everything smaller to its left, and sort both sides." },
};

export const FORMATO_ROTULO: Readonly<Record<Formato, string>> = {
  random: "random",
  sorted: "already sorted",
  reversed: "reversed",
  "few-unique": "few distinct values",
};

/** O maior vetor que a corrida desenha; medir vai bem além (ver `crescimento`). */
export const MAIOR_NA_TELA = 64;
export const MAIOR_MEDIDO = 4096;

export class ErroDeVetor extends Error {}

/** O vetor de entrada, determinístico pela semente. Valores de 1 a n (ou 1 a 4). */
export function entrada(formato: Formato, n: number, semente = 1): number[] {
  if (!Number.isInteger(n) || n < 1) throw new ErroDeVetor(`n must be a whole number of at least 1, got ${n}`);
  if (n > MAIOR_MEDIDO) throw new ErroDeVetor(`n is limited to ${MAIOR_MEDIDO} so the page stays responsive, got ${n}`);
  const r = gerador(semente);
  const crescente = Array.from({ length: n }, (_, i) => i + 1);
  switch (formato) {
    case "sorted":
      return crescente;
    case "reversed":
      return crescente.reverse();
    case "random":
      return embaralhado(crescente, r);
    case "few-unique":
      return Array.from({ length: n }, () => inteiroEntre(r, 1, 4));
  }
}

/**
 * Lê um vetor que o leitor digitou. Recusa onde o erro aparece, com a posição
 * contada de 1: um vetor vazio, um item que não é número inteiro, ou mais itens
 * do que a corrida consegue desenhar.
 */
export function lerVetor(texto: string): number[] {
  const partes = texto.split(/[\s,;]+/u).filter((p) => p !== "");
  if (partes.length === 0) throw new ErroDeVetor("the list is empty: type a few whole numbers, like 5 3 8 1");
  if (partes.length > MAIOR_NA_TELA) throw new ErroDeVetor(`at most ${MAIOR_NA_TELA} items fit in the race, got ${partes.length}`);
  return partes.map((p, k) => {
    if (!/^-?\d+$/u.test(p)) throw new ErroDeVetor(`item ${k + 1} (“${p}”) is not a whole number`);
    const v = Number(p);
    if (Math.abs(v) > 9999) throw new ErroDeVetor(`item ${k + 1} is outside −9999…9999`);
    return v;
  });
}

/** O vetor instrumentado: o único caminho para ler, comparar e escrever. */
class Vetor {
  readonly v: number[];
  readonly ops: Operacao[] = [];
  readonly fases: Fase[] = [];
  comparacoes = 0;
  trocas = 0;
  escritas = 0;
  constructor(entrada: readonly number[], private readonly gravar: boolean) {
    this.v = [...entrada];
  }
  /** `v[i] > v[j]`, contado. */
  maior(i: number, j: number): boolean {
    this.comparacoes += 1;
    if (this.gravar) this.ops.push({ tipo: "compare", i, j });
    return this.v[i]! > this.v[j]!;
  }
  marcar(rotulo: string, ini: number, fim: number): void {
    if (this.gravar) this.fases.push({ passo: this.ops.length, rotulo, ini, fim });
  }
  /** Conta uma comparação feita fora do vetor (as cabeças do merge, na auxiliar). */
  contarComparacao(i: number, j: number): void {
    this.comparacoes += 1;
    if (this.gravar) this.ops.push({ tipo: "compare", i, j });
  }
  trocar(i: number, j: number): void {
    this.trocas += 1;
    if (this.gravar) this.ops.push({ tipo: "swap", i, j });
    const t = this.v[i]!;
    this.v[i] = this.v[j]!;
    this.v[j] = t;
  }
  escrever(i: number, valor: number): void {
    this.escritas += 1;
    if (this.gravar) this.ops.push({ tipo: "write", i, valor });
    this.v[i] = valor;
  }
}

function bolha(a: Vetor): number {
  const n = a.v.length;
  for (let fim = n - 1; fim > 0; fim -= 1) {
    a.marcar(`pass ${n - fim}: bubble the largest of 1–${fim + 1} to the end`, 0, fim);
    let trocou = false;
    for (let i = 0; i < fim; i += 1) {
      if (a.maior(i, i + 1)) {
        a.trocar(i, i + 1);
        trocou = true;
      }
    }
    // A saída antecipada é o que dá à bolha o melhor caso O(n) num vetor já ordenado.
    if (!trocou) break;
  }
  return 0;
}

function insercao(a: Vetor): number {
  for (let i = 1; i < a.v.length; i += 1) {
    a.marcar(`insert item ${i + 1} into the sorted left part`, 0, i);
    for (let j = i; j > 0 && a.maior(j - 1, j); j -= 1) a.trocar(j - 1, j);
  }
  return 0;
}

function selecao(a: Vetor): number {
  const n = a.v.length;
  for (let i = 0; i < n - 1; i += 1) {
    a.marcar(`find the smallest of ${i + 1}–${n} for place ${i + 1}`, i, n - 1);
    let menor = i;
    for (let j = i + 1; j < n; j += 1) if (a.maior(menor, j)) menor = j;
    if (menor !== i) a.trocar(i, menor);
  }
  return 0;
}

/**
 * Merge de cima para baixo. A fita auxiliar guarda as duas metades; a escrita
 * de volta é a operação que o leitor vê. O pico de memória é `n`.
 */
function intercalacao(a: Vetor): number {
  let pico = 0;
  const auxiliar: number[] = [];
  const ordenar = (ini: number, fim: number): void => {
    if (fim - ini < 1) return;
    const meio = Math.floor((ini + fim) / 2);
    ordenar(ini, meio);
    ordenar(meio + 1, fim);
    a.marcar(`merge ${ini + 1}–${meio + 1} with ${meio + 2}–${fim + 1}`, ini, fim);
    auxiliar.length = 0;
    for (let k = ini; k <= fim; k += 1) auxiliar.push(a.v[k]!);
    pico = Math.max(pico, auxiliar.length);
    // A comparação é entre as cabeças das duas metades, que moram na auxiliar —
    // contada como comparação do mesmo jeito, com os índices de onde elas vieram.
    let e = 0;
    let d = meio + 1 - ini;
    const tamE = meio + 1 - ini;
    const tam = fim - ini + 1;
    for (let k = ini; k <= fim; k += 1) {
      let pegaEsquerda: boolean;
      if (e >= tamE) pegaEsquerda = false;
      else if (d >= tam) pegaEsquerda = true;
      else {
        a.contarComparacao(ini + e, ini + d);
        pegaEsquerda = auxiliar[e]! <= auxiliar[d]!;
      }
      a.escrever(k, pegaEsquerda ? auxiliar[e++]! : auxiliar[d++]!);
    }
  };
  ordenar(0, a.v.length - 1);
  return pico;
}

/** Quicksort de Lomuto com o ÚLTIMO item como pivô — o que faz o vetor ordenado ser o pior caso. */
function rapida(a: Vetor): number {
  let profundidade = 0;
  let pico = 0;
  const ordenar = (ini: number, fim: number): void => {
    if (ini >= fim) return;
    a.marcar(`partition ${ini + 1}–${fim + 1} around pivot ${a.v[fim]}`, ini, fim);
    profundidade += 1;
    pico = Math.max(pico, profundidade);
    let i = ini;
    for (let j = ini; j < fim; j += 1) {
      // v[j] < pivô  ⇔  pivô > v[j]
      if (a.maior(fim, j)) {
        if (i !== j) a.trocar(i, j);
        i += 1;
      }
    }
    if (i !== fim) a.trocar(i, fim);
    ordenar(ini, i - 1);
    ordenar(i + 1, fim);
    profundidade -= 1;
  };
  ordenar(0, a.v.length - 1);
  return pico;
}

const RODAR: Readonly<Record<Algoritmo, (a: Vetor) => number>> = { bubble: bolha, insertion: insercao, selection: selecao, merge: intercalacao, quick: rapida };

/**
 * Roda o algoritmo sobre uma cópia da entrada. `gravar: false` conta sem
 * guardar a fita — é o modo de medir vetores grandes sem encher a memória.
 */
export function ordenar(algoritmo: Algoritmo, v: readonly number[], gravar = true): Traco {
  const a = new Vetor(v, gravar);
  const memoriaExtra = RODAR[algoritmo](a);
  return { algoritmo, fases: a.fases, entrada: [...v], saida: a.v, ops: a.ops, comparacoes: a.comparacoes, trocas: a.trocas, escritas: a.escritas, memoriaExtra };
}

/** O custo total na unidade da corrida: cada comparação, troca ou escrita vale um passo. */
export const custo = (t: Pick<Traco, "comparacoes" | "trocas" | "escritas">): number => t.comparacoes + t.trocas + t.escritas;

export interface Instante {
  readonly v: readonly number[];
  /** A operação que acabou de acontecer (ou nenhuma, no passo 0). */
  readonly op: Operacao | undefined;
  readonly comparacoes: number;
  readonly trocas: number;
  readonly escritas: number;
  readonly terminou: boolean;
}

/** O vetor depois de `passo` operações da fita. Determinístico: voltar dá o mesmo quadro. */
export function instante(t: Traco, passo: number): Instante {
  const k = Math.max(0, Math.min(t.ops.length, Math.floor(passo)));
  const v = [...t.entrada];
  let comparacoes = 0;
  let trocas = 0;
  let escritas = 0;
  for (let p = 0; p < k; p += 1) {
    const op = t.ops[p]!;
    if (op.tipo === "compare") comparacoes += 1;
    else if (op.tipo === "swap") {
      trocas += 1;
      const x = v[op.i]!;
      v[op.i] = v[op.j]!;
      v[op.j] = x;
    } else {
      escritas += 1;
      v[op.i] = op.valor;
    }
  }
  return { v, op: k === 0 ? undefined : t.ops[k - 1], comparacoes, trocas, escritas, terminou: k === t.ops.length };
}

export interface Colocacao {
  readonly algoritmo: Algoritmo;
  readonly custo: number;
  readonly lugar: number;
}

/** O pódio da corrida: menor custo primeiro; empate divide o lugar. */
export function podio(tracos: readonly Traco[]): Colocacao[] {
  const ordenados = [...tracos].sort((a, b) => custo(a) - custo(b));
  let lugar = 0;
  let anterior = -1;
  return ordenados.map((t, k) => {
    const c = custo(t);
    if (c !== anterior) lugar = k + 1;
    anterior = c;
    return { algoritmo: t.algoritmo, custo: c, lugar };
  });
}
