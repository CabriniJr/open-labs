import { embaralhado, gerador, inteiroEntre } from "../semente.js";

/**
 * Oito jeitos de ordenar o mesmo vetor, em três classes, e o que cada um custa.
 *
 * Nenhum algoritmo aqui devolve só o vetor ordenado. Cada um roda sobre um
 * vetor **instrumentado**: toda leitura, comparação e escrita passa por ele e
 * vira uma operação na fita (`ops`), com a linha do pseudocódigo que a fez. A
 * corrida, o som, o pseudocódigo aceso e o gráfico de crescimento leem essa
 * fita — nenhum deles recalcula o algoritmo, então nunca discordam.
 *
 * A unidade de custo é uma operação primitiva: comparar dois itens, trocar dois
 * itens, escrever um valor numa posição, ou ler um valor para decidir onde ele
 * vai (o counting e o radix leem em vez de comparar). Uma troca conta como UMA
 * operação — é o que o leitor vê acontecer na tela.
 */
export type Algoritmo = "bubble" | "insertion" | "selection" | "merge" | "quick" | "heap" | "counting" | "radix";
export const ALGORITMOS: readonly Algoritmo[] = ["bubble", "insertion", "selection", "merge", "quick", "heap", "counting", "radix"];

/** As classes que competem entre si: dentro de uma, a disputa é de constantes; entre elas, de expoente. */
export type ClasseDeOrdenacao = "quadratic" | "linearithmic" | "linear";
export const CLASSES_DE_ORDENACAO: Readonly<Record<ClasseDeOrdenacao, { readonly nome: string; readonly notacao: string; readonly algoritmos: readonly Algoritmo[]; readonly tese: string }>> = {
  quadratic: { nome: "Quadratic", notacao: "O(n²)", algoritmos: ["bubble", "insertion", "selection"], tese: "All three compare neighbours or scan the rest. Double n and each one does about four times the work — the race is about constants." },
  linearithmic: { nome: "Linearithmic", notacao: "O(n log n)", algoritmos: ["merge", "quick", "heap"], tese: "Divide, partition or heap: each item is touched about log n times. The fastest comparison sorts possible, up to a constant." },
  linear: { nome: "Linear (no comparisons)", notacao: "O(n + k)", algoritmos: ["counting", "radix"], tese: "They never compare two items. They read each value and put it where it belongs — which only works because the values are small whole numbers." },
};

/** Como o vetor de entrada nasce. O formato é a manopla que mais muda o resultado. */
export type Formato = "random" | "sorted" | "reversed" | "few-unique" | "nearly-sorted";
export const FORMATOS: readonly Formato[] = ["random", "sorted", "reversed", "nearly-sorted", "few-unique"];

export type Operacao =
  | { readonly tipo: "compare"; readonly i: number; readonly j: number; readonly linha: number }
  | { readonly tipo: "swap"; readonly i: number; readonly j: number; readonly linha: number }
  /** Escreve `valor` na posição `i` (merge, counting e radix escrevem a partir da memória extra). */
  | { readonly tipo: "write"; readonly i: number; readonly valor: number; readonly linha: number }
  /** Lê `v[i]` para decidir onde ele vai — sem comparar com outro item. */
  | { readonly tipo: "read"; readonly i: number; readonly linha: number };

/**
 * Um marco: onde começa uma passada, uma intercalação ou uma partição. NÃO é
 * operação e não custa nada — é a fronteira que o showcase usa para narrar.
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
  readonly leituras: number;
  /** Quantas posições de memória extra o algoritmo chegou a usar ao mesmo tempo. */
  readonly memoriaExtra: number;
}

export interface FichaDoAlgoritmo {
  readonly nome: string;
  readonly classe: ClasseDeOrdenacao;
  readonly medio: string;
  readonly pior: string;
  readonly melhor: string;
  readonly memoria: string;
  /** Uma frase: quem decide o próximo par. */
  readonly regra: string;
  /** Pseudocódigo no estilo dos livros-texto (vetores contados de 1, como lá). */
  readonly pseudo: readonly string[];
}

const PSEUDO: Readonly<Record<Algoritmo, readonly string[]>> = {
  bubble: ["BUBBLE-SORT(A, n)", "1  for end = n downto 2", "2      swapped = FALSE", "3      for i = 1 to end − 1", "4          if A[i] > A[i + 1]", "5              exchange A[i] with A[i + 1]", "6              swapped = TRUE", "7      if swapped == FALSE", "8          return"],
  insertion: ["INSERTION-SORT(A, n)", "1  for i = 2 to n", "2      j = i", "3      while j > 1 and A[j − 1] > A[j]", "4          exchange A[j − 1] with A[j]", "5          j = j − 1"],
  selection: ["SELECTION-SORT(A, n)", "1  for i = 1 to n − 1", "2      min = i", "3      for j = i + 1 to n", "4          if A[min] > A[j]", "5              min = j", "6      if min ≠ i", "7          exchange A[i] with A[min]"],
  merge: ["MERGE-SORT(A, p, r)", "1  if p < r", "2      q = ⌊(p + r) / 2⌋", "3      MERGE-SORT(A, p, q)", "4      MERGE-SORT(A, q + 1, r)", "5      MERGE(A, p, q, r)", "MERGE(A, p, q, r)", "6  copy A[p..r] into B          ▹ extra memory", "7  i = p,  j = q + 1", "8  for k = p to r", "9      if j > r or (i ≤ q and B[i] ≤ B[j])", "10         A[k] = B[i],  i = i + 1", "11     else A[k] = B[j],  j = j + 1"],
  quick: ["QUICKSORT(A, p, r)", "1  if p < r", "2      q = PARTITION(A, p, r)", "3      QUICKSORT(A, p, q − 1)", "4      QUICKSORT(A, q + 1, r)", "PARTITION(A, p, r)", "5  x = A[r]                      ▹ the pivot: the last item", "6  i = p", "7  for j = p to r − 1", "8      if A[j] < x", "9          exchange A[i] with A[j]", "10         i = i + 1", "11 exchange A[i] with A[r]", "12 return i"],
  heap: ["HEAPSORT(A, n)", "1  BUILD-MAX-HEAP(A, n)", "2  for end = n downto 2", "3      exchange A[1] with A[end]   ▹ the largest goes last", "4      MAX-HEAPIFY(A, 1, end − 1)", "MAX-HEAPIFY(A, i, size)", "5  l = 2i,  r = 2i + 1,  largest = i", "6  if l ≤ size and A[l] > A[largest]", "7      largest = l", "8  if r ≤ size and A[r] > A[largest]", "9      largest = r", "10 if largest ≠ i", "11     exchange A[i] with A[largest]", "12     MAX-HEAPIFY(A, largest, size)"],
  counting: ["COUNTING-SORT(A, n)", "1  lo = min(A),  hi = max(A)     ▹ one read per item", "2  C[lo..hi] = 0                 ▹ extra memory: one counter per value", "3  for i = 1 to n", "4      C[A[i]] = C[A[i]] + 1", "5  k = 1", "6  for v = lo to hi", "7      repeat C[v] times", "8          A[k] = v,  k = k + 1"],
  radix: ["RADIX-SORT(A, n, d)              ▹ least significant digit first", "1  for digit = 1 to d", "2      B[0..9] = ten empty buckets", "3      for i = 1 to n", "4          append A[i] to B[that digit of A[i]]", "5      k = 1", "6      for b = 0 to 9", "7          for each x in B[b], in order", "8              A[k] = x,  k = k + 1"],
};

export const FICHAS: Readonly<Record<Algoritmo, FichaDoAlgoritmo>> = {
  bubble: { nome: "Bubble sort", classe: "quadratic", medio: "O(n²)", pior: "O(n²)", melhor: "O(n)", memoria: "O(1)", regra: "Compare each neighbour pair, swap if out of order, and repeat the pass until a pass swaps nothing.", pseudo: PSEUDO.bubble },
  insertion: { nome: "Insertion sort", classe: "quadratic", medio: "O(n²)", pior: "O(n²)", melhor: "O(n)", memoria: "O(1)", regra: "Take the next item and slide it left until it sits after a smaller one.", pseudo: PSEUDO.insertion },
  selection: { nome: "Selection sort", classe: "quadratic", medio: "O(n²)", pior: "O(n²)", melhor: "O(n²)", memoria: "O(1)", regra: "Scan the rest for the smallest item and swap it into the next place — always the full scan.", pseudo: PSEUDO.selection },
  merge: { nome: "Merge sort", classe: "linearithmic", medio: "O(n log n)", pior: "O(n log n)", melhor: "O(n log n)", memoria: "O(n)", regra: "Split in half until each half has one item, then merge sorted halves by always taking the smaller head.", pseudo: PSEUDO.merge },
  quick: { nome: "Quicksort", classe: "linearithmic", medio: "O(n log n)", pior: "O(n²)", melhor: "O(n log n)", memoria: "O(log n)", regra: "Pick the last item as pivot, move everything smaller to its left, and sort both sides.", pseudo: PSEUDO.quick },
  heap: { nome: "Heapsort", classe: "linearithmic", medio: "O(n log n)", pior: "O(n log n)", melhor: "O(n log n)", memoria: "O(1)", regra: "Arrange the array as a max-heap, then repeatedly swap the largest to the end and repair the heap.", pseudo: PSEUDO.heap },
  counting: { nome: "Counting sort", classe: "linear", medio: "O(n + k)", pior: "O(n + k)", melhor: "O(n + k)", memoria: "O(k)", regra: "Count how many times each value appears, then write the values back in order — no item is ever compared with another.", pseudo: PSEUDO.counting },
  radix: { nome: "Radix sort (LSD)", classe: "linear", medio: "O(d·(n + 10))", pior: "O(d·(n + 10))", melhor: "O(d·(n + 10))", memoria: "O(n)", regra: "Deal the items into ten buckets by their last digit, gather them, and repeat for each digit to the left.", pseudo: PSEUDO.radix },
};

export const FORMATO_ROTULO: Readonly<Record<Formato, string>> = {
  random: "random",
  sorted: "already sorted",
  reversed: "reversed",
  "nearly-sorted": "nearly sorted",
  "few-unique": "few distinct values",
};

/** O maior vetor que a corrida desenha; medir vai bem além (ver `crescimento`). */
export const MAIOR_NA_TELA = 256;
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
    case "nearly-sorted": {
      // Ordenado, com ~5 % dos itens trocados com um vizinho próximo.
      const v = crescente;
      for (let k = 0; k < Math.max(1, Math.round(n / 20)); k += 1) {
        const i = Math.floor(r() * n);
        const j = Math.min(n - 1, i + 1 + Math.floor(r() * 3));
        [v[i], v[j]] = [v[j]!, v[i]!];
      }
      return v;
    }
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
  leituras = 0;
  constructor(
    entrada: readonly number[],
    private readonly gravar: boolean,
  ) {
    this.v = [...entrada];
  }
  /** `v[i] > v[j]`, contado. */
  maior(i: number, j: number, linha: number): boolean {
    this.comparacoes += 1;
    if (this.gravar) this.ops.push({ tipo: "compare", i, j, linha });
    return this.v[i]! > this.v[j]!;
  }
  marcar(rotulo: string, ini: number, fim: number): void {
    if (this.gravar) this.fases.push({ passo: this.ops.length, rotulo, ini, fim });
  }
  /** Conta uma comparação feita fora do vetor (as cabeças do merge, na auxiliar). */
  contarComparacao(i: number, j: number, linha: number): void {
    this.comparacoes += 1;
    if (this.gravar) this.ops.push({ tipo: "compare", i, j, linha });
  }
  ler(i: number, linha: number): number {
    this.leituras += 1;
    if (this.gravar) this.ops.push({ tipo: "read", i, linha });
    return this.v[i]!;
  }
  trocar(i: number, j: number, linha: number): void {
    this.trocas += 1;
    if (this.gravar) this.ops.push({ tipo: "swap", i, j, linha });
    const t = this.v[i]!;
    this.v[i] = this.v[j]!;
    this.v[j] = t;
  }
  escrever(i: number, valor: number, linha: number): void {
    this.escritas += 1;
    if (this.gravar) this.ops.push({ tipo: "write", i, valor, linha });
    this.v[i] = valor;
  }
}

function bolha(a: Vetor): number {
  const n = a.v.length;
  for (let fim = n - 1; fim > 0; fim -= 1) {
    a.marcar(`pass ${n - fim}: bubble the largest of 1–${fim + 1} to the end`, 0, fim);
    let trocou = false;
    for (let i = 0; i < fim; i += 1) {
      if (a.maior(i, i + 1, 4)) {
        a.trocar(i, i + 1, 5);
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
    for (let j = i; j > 0 && a.maior(j - 1, j, 3); j -= 1) a.trocar(j - 1, j, 4);
  }
  return 0;
}

function selecao(a: Vetor): number {
  const n = a.v.length;
  for (let i = 0; i < n - 1; i += 1) {
    a.marcar(`find the smallest of ${i + 1}–${n} for place ${i + 1}`, i, n - 1);
    let menor = i;
    for (let j = i + 1; j < n; j += 1) if (a.maior(menor, j, 4)) menor = j;
    if (menor !== i) a.trocar(i, menor, 7);
  }
  return 0;
}

/** Merge de cima para baixo. A auxiliar guarda o trecho; a escrita de volta é o que o leitor vê. Pico de memória: `n`. */
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
    let e = 0;
    let d = meio + 1 - ini;
    const tamE = meio + 1 - ini;
    const tam = fim - ini + 1;
    for (let k = ini; k <= fim; k += 1) {
      let pegaEsquerda: boolean;
      if (e >= tamE) pegaEsquerda = false;
      else if (d >= tam) pegaEsquerda = true;
      else {
        a.contarComparacao(ini + e, ini + d, 9);
        pegaEsquerda = auxiliar[e]! <= auxiliar[d]!;
      }
      if (pegaEsquerda) a.escrever(k, auxiliar[e++]!, 10);
      else a.escrever(k, auxiliar[d++]!, 11);
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
      if (a.maior(fim, j, 8)) {
        if (i !== j) a.trocar(i, j, 9);
        i += 1;
      }
    }
    if (i !== fim) a.trocar(i, fim, 11);
    ordenar(ini, i - 1);
    ordenar(i + 1, fim);
    profundidade -= 1;
  };
  ordenar(0, a.v.length - 1);
  return pico;
}

function monte(a: Vetor): number {
  const n = a.v.length;
  const descer = (i0: number, tamanho: number) => {
    let i = i0;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let maior = i;
      if (l < tamanho && a.maior(l, maior, 6)) maior = l;
      if (r < tamanho && a.maior(r, maior, 8)) maior = r;
      if (maior === i) return;
      a.trocar(i, maior, 11);
      i = maior;
    }
  };
  a.marcar("build the max-heap: every parent larger than its children", 0, n - 1);
  for (let i = Math.floor(n / 2) - 1; i >= 0; i -= 1) descer(i, n);
  for (let fim = n - 1; fim > 0; fim -= 1) {
    if (fim === n - 1 || fim % Math.max(1, Math.floor(n / 8)) === 0) a.marcar(`move the largest of 1–${fim + 1} to place ${fim + 1}`, 0, fim);
    a.trocar(0, fim, 3);
    descer(0, fim);
  }
  return 0;
}

function contagem(a: Vetor): number {
  const n = a.v.length;
  if (n === 0) return 0;
  a.marcar("find the smallest and largest value", 0, n - 1);
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < n; i += 1) {
    const x = a.ler(i, 1);
    lo = Math.min(lo, x);
    hi = Math.max(hi, x);
  }
  a.marcar("count each value", 0, n - 1);
  const contador = new Array<number>(hi - lo + 1).fill(0);
  for (let i = 0; i < n; i += 1) contador[a.ler(i, 4) - lo]! += 1;
  a.marcar("write the values back, in order", 0, n - 1);
  let k = 0;
  for (let v = lo; v <= hi; v += 1) for (let c = contador[v - lo]!; c > 0; c -= 1) a.escrever(k++, v, 8);
  return contador.length;
}

function raiz(a: Vetor): number {
  const n = a.v.length;
  if (n === 0) return 0;
  const lo = Math.min(...a.v);
  const hi = Math.max(...a.v);
  // Valores negativos são deslocados para começar em 0; o radix só conhece dígitos.
  const digitos = Math.max(1, String(hi - lo).length);
  for (let d = 0, base = 1; d < digitos; d += 1, base *= 10) {
    a.marcar(`deal by the ${["ones", "tens", "hundreds", "thousands", "ten-thousands"][d] ?? `${d + 1}th`} digit, then gather`, 0, n - 1);
    const baldes: number[][] = Array.from({ length: 10 }, () => []);
    for (let i = 0; i < n; i += 1) {
      const x = a.ler(i, 4);
      baldes[Math.floor((x - lo) / base) % 10]!.push(x);
    }
    let k = 0;
    for (const balde of baldes) for (const x of balde) a.escrever(k++, x, 8);
  }
  return n + 10;
}

const RODAR: Readonly<Record<Algoritmo, (a: Vetor) => number>> = { bubble: bolha, insertion: insercao, selection: selecao, merge: intercalacao, quick: rapida, heap: monte, counting: contagem, radix: raiz };

/**
 * Roda o algoritmo sobre uma cópia da entrada. `gravar: false` conta sem
 * guardar a fita — é o modo de medir vetores grandes sem encher a memória.
 */
export function ordenar(algoritmo: Algoritmo, v: readonly number[], gravar = true): Traco {
  const a = new Vetor(v, gravar);
  const memoriaExtra = RODAR[algoritmo](a);
  return { algoritmo, fases: a.fases, entrada: [...v], saida: a.v, ops: a.ops, comparacoes: a.comparacoes, trocas: a.trocas, escritas: a.escritas, leituras: a.leituras, memoriaExtra };
}

/** O custo total na unidade da corrida: cada comparação, troca, escrita ou leitura vale um passo. */
export const custo = (t: Pick<Traco, "comparacoes" | "trocas" | "escritas"> & { readonly leituras?: number }): number => t.comparacoes + t.trocas + t.escritas + (t.leituras ?? 0);

export interface Instante {
  readonly v: readonly number[];
  /** A operação que acabou de acontecer (ou nenhuma, no passo 0). */
  readonly op: Operacao | undefined;
  readonly comparacoes: number;
  readonly trocas: number;
  readonly escritas: number;
  readonly leituras: number;
  readonly terminou: boolean;
}

/** Aplica uma operação a um vetor — o que a corrida faz quadro a quadro, sem refazer a fita. */
export function aplicar(v: number[], op: Operacao): void {
  if (op.tipo === "swap") {
    const x = v[op.i]!;
    v[op.i] = v[op.j]!;
    v[op.j] = x;
  } else if (op.tipo === "write") v[op.i] = op.valor;
}

/** O vetor depois de `passo` operações da fita. Determinístico: voltar dá o mesmo quadro. */
export function instante(t: Traco, passo: number): Instante {
  const k = Math.max(0, Math.min(t.ops.length, Math.floor(passo)));
  const v = [...t.entrada];
  let comparacoes = 0;
  let trocas = 0;
  let escritas = 0;
  let leituras = 0;
  for (let p = 0; p < k; p += 1) {
    const op = t.ops[p]!;
    if (op.tipo === "compare") comparacoes += 1;
    else if (op.tipo === "swap") trocas += 1;
    else if (op.tipo === "write") escritas += 1;
    else leituras += 1;
    aplicar(v, op);
  }
  return { v, op: k === 0 ? undefined : t.ops[k - 1], comparacoes, trocas, escritas, leituras, terminou: k === t.ops.length };
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

/** Trabalho contado em vários tamanhos, para o gráfico de Big-O embaixo da corrida. */
export function curvaDeOrdenacao(algoritmo: Algoritmo, formato: Formato, tamanhos: readonly number[], semente = 1): { n: number; custo: number }[] {
  return tamanhos.map((n) => ({ n, custo: custo(ordenar(algoritmo, entrada(formato, n, semente), false)) }));
}
