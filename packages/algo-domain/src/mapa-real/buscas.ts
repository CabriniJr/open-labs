import { linhaReta, type Cidade } from "./cidade.js";

/**
 * Seis jeitos de ir de um ponto a outro de São Paulo, sobre as ruas de verdade.
 *
 * Todos gravam o que fizeram, na ordem: cada cruzamento que saiu da fronteira
 * (`settle`) e cada rua examinada (`scan`), com a linha do pseudocódigo que
 * estava rodando. É essa fita que o lab pinta no mapa e que o painel de
 * pseudocódigo acompanha — o desenho nunca recalcula o algoritmo.
 *
 * As classes, que é o que se compara:
 *
 * - **exatos** (o menor tempo, garantido): Dijkstra, A*, Dijkstra bidirecional;
 * - **rápidos e sem garantia**: busca gulosa, A* com pressa (h × 2);
 * - **cego para o tempo**: BFS, que conta cruzamentos.
 */
export type BuscaReal = "dijkstra" | "astar" | "bidirectional" | "greedy" | "weighted" | "bfs";
export const BUSCAS_REAIS: readonly BuscaReal[] = ["dijkstra", "astar", "bidirectional", "greedy", "weighted", "bfs"];

export type ClasseDeBusca = "exact" | "fast" | "blind";

export interface FichaDaBuscaReal {
  readonly nome: string;
  readonly curto: string;
  readonly classe: ClasseDeBusca;
  readonly chave: string;
  readonly garante: string;
  readonly custo: string;
  /** Pseudocódigo no estilo dos livros-texto: nome do procedimento, linhas numeradas. */
  readonly pseudo: readonly string[];
}

export const CLASSES_DE_BUSCA: Readonly<Record<ClasseDeBusca, { readonly nome: string; readonly buscas: readonly BuscaReal[]; readonly tese: string }>> = {
  exact: { nome: "Exact: least time, guaranteed", buscas: ["dijkstra", "astar", "bidirectional"], tese: "Same answer, to the decisecond. What differs is how much of the city each one has to look at to be sure." },
  fast: { nome: "Fast, no guarantee", buscas: ["greedy", "weighted", "astar"], tese: "Trusting the straight line more than the clock looks at less of the city — and sometimes pays for it in minutes." },
  blind: { nome: "Blind to time", buscas: ["bfs", "dijkstra"], tese: "Counting corners is not counting minutes: a route with fewer turns can still be slower." },
};

const PSEUDO_DIJKSTRA = [
  "DIJKSTRA(G, w, s, t)",
  "1  for each vertex v ∈ G.V",
  "2      v.d = ∞,  v.π = NIL",
  "3  s.d = 0",
  "4  Q = {s}                 ▹ min-priority queue on d",
  "5  while Q ≠ ∅",
  "6      u = EXTRACT-MIN(Q)",
  "7      if u == t",
  "8          return PATH(t)",
  "9      for each edge (u, v) ∈ G.Adj[u]",
  "10         if v.d > u.d + w(u, v)",
  "11             v.d = u.d + w(u, v),  v.π = u",
  "12             DECREASE-KEY(Q, v, v.d)",
];

const PSEUDO_ASTAR = [
  "A-STAR(G, w, s, t, h)",
  "1  for each vertex v ∈ G.V",
  "2      v.d = ∞,  v.π = NIL",
  "3  s.d = 0",
  "4  Q = {s}                 ▹ min-priority queue on d + h",
  "5  while Q ≠ ∅",
  "6      u = EXTRACT-MIN(Q)",
  "7      if u == t",
  "8          return PATH(t)",
  "9      for each edge (u, v) ∈ G.Adj[u]",
  "10         if v.d > u.d + w(u, v)",
  "11             v.d = u.d + w(u, v),  v.π = u",
  "12             DECREASE-KEY(Q, v, v.d + h(v))",
];

const PSEUDO_WEIGHTED = PSEUDO_ASTAR.map((l, k) => (k === 0 ? "WEIGHTED-A-STAR(G, w, s, t, h, ε = 2)" : k === 4 ? "4  Q = {s}                 ▹ min-priority queue on d + ε·h" : k === 12 ? "12             DECREASE-KEY(Q, v, v.d + ε·h(v))" : l));

const PSEUDO_GREEDY = [
  "GREEDY-BEST-FIRST(G, s, t, h)",
  "1  for each vertex v ∈ G.V",
  "2      v.seen = FALSE,  v.π = NIL",
  "3  s.seen = TRUE",
  "4  Q = {s}                 ▹ min-priority queue on h only",
  "5  while Q ≠ ∅",
  "6      u = EXTRACT-MIN(Q)",
  "7      if u == t",
  "8          return PATH(t)",
  "9      for each edge (u, v) ∈ G.Adj[u]",
  "10         if v.seen == FALSE",
  "11             v.seen = TRUE,  v.π = u",
  "12             INSERT(Q, v, h(v))",
];

const PSEUDO_BFS = [
  "BFS(G, s, t)",
  "1  for each vertex v ∈ G.V",
  "2      v.d = ∞,  v.π = NIL",
  "3  s.d = 0",
  "4  Q = ⟨s⟩                 ▹ first-in, first-out queue",
  "5  while Q ≠ ∅",
  "6      u = DEQUEUE(Q)",
  "7      if u == t",
  "8          return PATH(t)",
  "9      for each edge (u, v) ∈ G.Adj[u]",
  "10         if v.d == ∞",
  "11             v.d = u.d + 1,  v.π = u",
  "12             ENQUEUE(Q, v)",
];

const PSEUDO_BIDIRECTIONAL = [
  "BIDIRECTIONAL-DIJKSTRA(G, w, s, t)",
  "1  run DIJKSTRA forward from s on G and backward from t on Gᵀ",
  "2  μ = ∞                   ▹ best s–t time seen so far",
  "3  while both queues are non-empty",
  "4      side = the queue with the smaller minimum",
  "5      u = EXTRACT-MIN(side.Q)",
  "6      if Q_f.min + Q_b.min ≥ μ",
  "7          return the path through the meeting vertex",
  "8      for each edge (u, v) on this side",
  "9          relax (u, v) as in DIJKSTRA",
  "10         if v was reached by the other side",
  "11             μ = min(μ, v.d_f + v.d_b)",
];

export const FICHAS_REAIS: Readonly<Record<BuscaReal, FichaDaBuscaReal>> = {
  dijkstra: { nome: "Dijkstra", curto: "Dijkstra", classe: "exact", chave: "time so far, d", garante: "least time", custo: "O((V + E) log V)", pseudo: PSEUDO_DIJKSTRA },
  astar: { nome: "A*", curto: "A*", classe: "exact", chave: "d + straight line at top speed, h", garante: "least time (h never overestimates)", custo: "O((V + E) log V), far fewer visits", pseudo: PSEUDO_ASTAR },
  bidirectional: { nome: "Bidirectional Dijkstra", curto: "Bidirectional", classe: "exact", chave: "d, from both ends at once", garante: "least time", custo: "O((V + E) log V), about half the area", pseudo: PSEUDO_BIDIRECTIONAL },
  greedy: { nome: "Greedy best-first", curto: "Greedy", classe: "fast", chave: "straight line to the goal, h", garante: "nothing", custo: "often tiny, never safe", pseudo: PSEUDO_GREEDY },
  weighted: { nome: "Weighted A* (ε = 2)", curto: "A* ×2", classe: "fast", chave: "d + 2·h", garante: "at most 2× the least time", custo: "fewer visits than A*", pseudo: PSEUDO_WEIGHTED },
  bfs: { nome: "Breadth-first search", curto: "BFS", classe: "blind", chave: "corners so far (a FIFO queue)", garante: "fewest corners — not least time", custo: "O(V + E)", pseudo: PSEUDO_BFS },
};

/** Um passo da fita. `lado` só existe na bidirecional: 0 = da origem, 1 = do destino. */
export type PassoDaBusca =
  | { readonly t: "settle"; readonly no: number; readonly d: number; readonly linha: number; readonly lado: 0 | 1 }
  | { readonly t: "scan"; readonly aresta: number; readonly melhorou: boolean; readonly linha: number; readonly lado: 0 | 1 };

export interface ResultadoReal {
  readonly busca: BuscaReal;
  readonly origem: number;
  readonly destino: number;
  /** Cruzamentos da rota, da origem ao destino. Vazio sem rota. */
  readonly rota: readonly number[];
  /** Arestas da rota, na ordem. */
  readonly arestas: readonly number[];
  /** Décimos de segundo. */
  readonly tempo: number;
  readonly metros: number;
  readonly resolvidos: number;
  readonly examinadas: number;
  readonly passos: readonly PassoDaBusca[];
}

/** Fila de prioridade binária com inserção preguiçosa: um nó pode entrar mais de uma vez; o que sai já resolvido é ignorado. */
class Heap {
  private chaves: number[] = [];
  private itens: number[] = [];
  private seq: number[] = [];
  private contador = 0;
  get tamanho(): number {
    return this.itens.length;
  }
  topo(): number {
    return this.chaves[0] ?? Number.POSITIVE_INFINITY;
  }
  por(item: number, chave: number): void {
    this.chaves.push(chave);
    this.itens.push(item);
    this.seq.push(this.contador++);
    let i = this.itens.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.menor(i, p)) break;
      this.trocar(i, p);
      i = p;
    }
  }
  tirar(): number {
    const item = this.itens[0]!;
    const ultimo = this.itens.length - 1;
    this.trocar(0, ultimo);
    this.chaves.pop();
    this.itens.pop();
    this.seq.pop();
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      if (l < this.itens.length && this.menor(l, m)) m = l;
      if (r < this.itens.length && this.menor(r, m)) m = r;
      if (m === i) break;
      this.trocar(i, m);
      i = m;
    }
    return item;
  }
  /** Empate sai em ordem de chegada: a busca é determinística. */
  private menor(a: number, b: number): boolean {
    return this.chaves[a]! < this.chaves[b]! || (this.chaves[a] === this.chaves[b] && this.seq[a]! < this.seq[b]!);
  }
  private trocar(a: number, b: number): void {
    [this.chaves[a], this.chaves[b]] = [this.chaves[b]!, this.chaves[a]!];
    [this.itens[a], this.itens[b]] = [this.itens[b]!, this.itens[a]!];
    [this.seq[a], this.seq[b]] = [this.seq[b]!, this.seq[a]!];
  }
}

function montarRota(c: Cidade, pai: Int32Array, destino: number, origem: number): { rota: number[]; arestas: number[] } {
  const arestas: number[] = [];
  let v = destino;
  while (v !== origem) {
    const e = pai[v]!;
    if (e < 0) return { rota: [], arestas: [] };
    arestas.unshift(e);
    v = c.de[e]!;
  }
  return { rota: [origem, ...arestas.map((e) => c.para[e]!)], arestas };
}

function somar(c: Cidade, arestas: readonly number[]): { tempo: number; metros: number } {
  let tempo = 0;
  let metros = 0;
  for (const e of arestas) {
    tempo += c.peso[e]!;
    metros += c.metros[e]!;
  }
  return { tempo, metros };
}

function umaPonta(c: Cidade, busca: Exclude<BuscaReal, "bidirectional">, origem: number, destino: number): ResultadoReal {
  const d = new Float64Array(c.n).fill(Number.POSITIVE_INFINITY);
  const pai = new Int32Array(c.n).fill(-1);
  const fechado = new Uint8Array(c.n);
  const h = (v: number) => linhaReta(c, v, destino) / c.velocidadeMaxima;
  const chave = (v: number): number => {
    switch (busca) {
      case "dijkstra":
        return d[v]!;
      case "astar":
        return d[v]! + h(v);
      case "weighted":
        return d[v]! + 2 * h(v);
      case "greedy":
        return h(v);
      case "bfs":
        return 0;
    }
  };
  const passos: PassoDaBusca[] = [];
  d[origem] = 0;
  // BFS usa uma fila de verdade; os outros, o heap.
  const fila: number[] = [origem];
  let cabeca = 0;
  const heap = new Heap();
  if (busca !== "bfs") heap.por(origem, chave(origem));
  let resolvidos = 0;
  let examinadas = 0;
  let achou = false;
  const reabre = busca === "dijkstra" || busca === "astar" || busca === "weighted";

  for (;;) {
    let u: number;
    if (busca === "bfs") {
      if (cabeca >= fila.length) break;
      u = fila[cabeca++]!;
    } else {
      if (heap.tamanho === 0) break;
      u = heap.tirar();
    }
    if (fechado[u]) continue;
    fechado[u] = 1;
    resolvidos += 1;
    passos.push({ t: "settle", no: u, d: d[u]!, linha: 6, lado: 0 });
    if (u === destino) {
      achou = true;
      break;
    }
    for (let k = c.inicioSaida[u]!; k < c.inicioSaida[u + 1]!; k += 1) {
      const e = c.saida[k]!;
      const v = c.para[e]!;
      if (fechado[v]) continue;
      examinadas += 1;
      const novo = d[u]! + c.peso[e]!;
      const melhorou = reabre ? novo < d[v]! : !Number.isFinite(d[v]!);
      passos.push({ t: "scan", aresta: e, melhorou, linha: melhorou ? 11 : 10, lado: 0 });
      if (!melhorou) continue;
      d[v] = novo;
      pai[v] = e;
      if (busca === "bfs") fila.push(v);
      else heap.por(v, chave(v));
    }
  }
  const { rota, arestas } = achou ? montarRota(c, pai, destino, origem) : { rota: [], arestas: [] };
  const { tempo, metros } = achou ? somar(c, arestas) : { tempo: Number.POSITIVE_INFINITY, metros: 0 };
  return { busca, origem, destino, rota, arestas, tempo, metros, resolvidos, examinadas, passos };
}

/** Dijkstra das duas pontas: para quando as duas fronteiras somadas já não podem bater o melhor encontro. */
function bidirecional(c: Cidade, origem: number, destino: number): ResultadoReal {
  const d = [new Float64Array(c.n).fill(Number.POSITIVE_INFINITY), new Float64Array(c.n).fill(Number.POSITIVE_INFINITY)] as const;
  const pai = [new Int32Array(c.n).fill(-1), new Int32Array(c.n).fill(-1)] as const;
  const fechado = [new Uint8Array(c.n), new Uint8Array(c.n)] as const;
  const heap = [new Heap(), new Heap()] as const;
  d[0][origem] = 0;
  d[1][destino] = 0;
  heap[0].por(origem, 0);
  heap[1].por(destino, 0);
  let mu = Number.POSITIVE_INFINITY;
  let encontro = -1;
  const passos: PassoDaBusca[] = [];
  let resolvidos = 0;
  let examinadas = 0;
  if (origem === destino) encontro = origem;
  while (heap[0].tamanho > 0 && heap[1].tamanho > 0 && encontro !== origem) {
    if (heap[0].topo() + heap[1].topo() >= mu) break;
    const lado: 0 | 1 = heap[0].topo() <= heap[1].topo() ? 0 : 1;
    const u = heap[lado].tirar();
    if (fechado[lado][u]) continue;
    fechado[lado][u] = 1;
    resolvidos += 1;
    passos.push({ t: "settle", no: u, d: d[lado][u]!, linha: 5, lado });
    const inicio = lado === 0 ? c.inicioSaida : c.inicioEntrada;
    const lista = lado === 0 ? c.saida : c.entrada;
    for (let k = inicio[u]!; k < inicio[u + 1]!; k += 1) {
      const e = lista[k]!;
      const v = lado === 0 ? c.para[e]! : c.de[e]!;
      if (fechado[lado][v]) continue;
      examinadas += 1;
      const novo = d[lado][u]! + c.peso[e]!;
      const melhorou = novo < d[lado][v]!;
      passos.push({ t: "scan", aresta: e, melhorou, linha: 9, lado });
      if (melhorou) {
        d[lado][v] = novo;
        pai[lado][v] = e;
        heap[lado].por(v, novo);
      }
      const outro = d[lado === 0 ? 1 : 0][v]!;
      if (Number.isFinite(outro) && d[lado][v]! + outro < mu) {
        mu = d[lado][v]! + outro;
        encontro = v;
      }
    }
  }
  if (encontro < 0) return { busca: "bidirectional", origem, destino, rota: [], arestas: [], tempo: Number.POSITIVE_INFINITY, metros: 0, resolvidos, examinadas, passos };
  const ida = montarRota(c, pai[0], encontro, origem);
  const volta: number[] = [];
  for (let v = encontro; v !== destino; ) {
    const e = pai[1][v]!;
    volta.push(e);
    v = c.para[e]!;
  }
  const arestas = [...ida.arestas, ...volta];
  const rota = [origem, ...arestas.map((e) => c.para[e]!)];
  const { tempo, metros } = somar(c, arestas);
  return { busca: "bidirectional", origem, destino, rota, arestas, tempo, metros, resolvidos, examinadas, passos };
}

export function buscarNaCidade(c: Cidade, busca: BuscaReal, origem: number, destino: number): ResultadoReal {
  if (!Number.isInteger(origem) || origem < 0 || origem >= c.n) throw new RangeError(`no intersection ${origem}`);
  if (!Number.isInteger(destino) || destino < 0 || destino >= c.n) throw new RangeError(`no intersection ${destino}`);
  return busca === "bidirectional" ? bidirecional(c, origem, destino) : umaPonta(c, busca, origem, destino);
}

/**
 * A medida de Big-O do mapa: quanto da cidade cada busca resolve conforme a
 * distância cresce. Dijkstra cobre um disco (área ∝ d²); o A* cobre um
 * corredor (∝ d). Pares sorteados com semente: o gráfico é o mesmo sempre.
 */
export function trabalhoPorDistancia(c: Cidade, buscas: readonly BuscaReal[], quantos = 60, semente = 7): { distancia: number; resolvidos: Record<string, number> }[] {
  let a = semente >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const saida: { distancia: number; resolvidos: Record<string, number> }[] = [];
  for (let k = 0; k < quantos; k += 1) {
    const o = Math.floor(r() * c.n);
    const dd = Math.floor(r() * c.n);
    const resolvidos: Record<string, number> = {};
    for (const b of buscas) resolvidos[b] = buscarNaCidade(c, b, o, dd).resolvidos;
    saida.push({ distancia: linhaReta(c, o, dd), resolvidos });
  }
  return saida.sort((x, y) => x.distancia - y.distancia);
}
