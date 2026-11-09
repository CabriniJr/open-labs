/**
 * O que é um grafo: pontos e as ligações entre eles. Só isso.
 *
 * Um mapa é um grafo (esquinas e ruas), uma rede social é um grafo (pessoas e
 * amizades), a internet é um grafo (roteadores e cabos). O lab começa com dois
 * pontos e uma linha, e tudo o que vem depois — peso, direção, caminho — é uma
 * propriedade a mais nessa mesma estrutura.
 *
 * As duas representações que um programa usa (lista e matriz de adjacência)
 * são DERIVADAS daqui, nunca guardadas à parte: o leitor mexe no desenho e as
 * duas mudam juntas, porque são a mesma coisa vista de dois jeitos.
 */
export interface No {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly rotulo: string;
}

export interface Aresta {
  readonly de: string;
  readonly para: string;
  readonly peso: number;
}

export interface Grafo {
  readonly nos: readonly No[];
  readonly arestas: readonly Aresta[];
  /** Dirigido: a aresta vai de `de` para `para` e não volta. */
  readonly dirigido: boolean;
  /** Com peso: o número da aresta conta (distância, tempo, custo). */
  readonly ponderado: boolean;
}

export class ErroDeGrafo extends Error {}

export const MAIOR_GRAFO = 16;

export const vazio = (dirigido = false, ponderado = false): Grafo => ({ nos: [], arestas: [], dirigido, ponderado });

const mesmoPar = (g: Grafo, a: Aresta, de: string, para: string) => (a.de === de && a.para === para) || (!g.dirigido && a.de === para && a.para === de);

export function temNo(g: Grafo, id: string): boolean {
  return g.nos.some((n) => n.id === id);
}

/** O próximo rótulo livre: A, B, C… */
export function proximoRotulo(g: Grafo): string {
  for (let k = 0; k < 26; k += 1) {
    const r = String.fromCharCode(65 + k);
    if (!g.nos.some((n) => n.rotulo === r)) return r;
  }
  return `N${g.nos.length + 1}`;
}

export function adicionarNo(g: Grafo, x: number, y: number, rotulo = proximoRotulo(g)): Grafo {
  if (g.nos.length >= MAIOR_GRAFO) throw new ErroDeGrafo(`this lab keeps graphs to ${MAIOR_GRAFO} points so every label stays readable`);
  const id = rotulo;
  if (temNo(g, id)) throw new ErroDeGrafo(`there is already a point called ${rotulo}`);
  return { ...g, nos: [...g.nos, { id, x, y, rotulo }] };
}

export function removerNo(g: Grafo, id: string): Grafo {
  return { ...g, nos: g.nos.filter((n) => n.id !== id), arestas: g.arestas.filter((a) => a.de !== id && a.para !== id) };
}

/**
 * Liga dois pontos. Recusa o que não é uma aresta deste lab: ponto que não
 * existe, um ponto ligado a ele mesmo, a mesma ligação duas vezes, ou um peso
 * que não é número positivo.
 */
export function adicionarAresta(g: Grafo, de: string, para: string, peso = 1): Grafo {
  if (!temNo(g, de) || !temNo(g, para)) throw new ErroDeGrafo(`both ends must be existing points (${de} → ${para})`);
  if (de === para) throw new ErroDeGrafo(`${de} cannot be linked to itself in this lab — a loop is a real thing, but it is not what this lab is about`);
  if (g.arestas.some((a) => mesmoPar(g, a, de, para))) throw new ErroDeGrafo(`${de} and ${para} are already linked`);
  if (!Number.isFinite(peso) || peso <= 0) throw new ErroDeGrafo(`a weight must be a positive number, got ${peso}`);
  return { ...g, arestas: [...g.arestas, { de, para, peso }] };
}

export function removerAresta(g: Grafo, de: string, para: string): Grafo {
  return { ...g, arestas: g.arestas.filter((a) => !mesmoPar(g, a, de, para)) };
}

export function pesar(g: Grafo, de: string, para: string, peso: number): Grafo {
  if (!Number.isFinite(peso) || peso <= 0) throw new ErroDeGrafo(`a weight must be a positive number, got ${peso}`);
  return { ...g, arestas: g.arestas.map((a) => (mesmoPar(g, a, de, para) ? { ...a, peso } : a)) };
}

/** Troca dirigido/não dirigido. Ao virar não dirigido, duas setas opostas viram uma linha só. */
export function comDirecao(g: Grafo, dirigido: boolean): Grafo {
  if (dirigido === g.dirigido) return g;
  if (dirigido) return { ...g, dirigido };
  const arestas: Aresta[] = [];
  for (const a of g.arestas) if (!arestas.some((b) => (b.de === a.para && b.para === a.de) || (b.de === a.de && b.para === a.para))) arestas.push(a);
  return { ...g, dirigido, arestas };
}

export interface Vizinho {
  readonly para: string;
  readonly peso: number;
}

/** A lista de adjacência, na ordem dos nós e das arestas. */
export function listaDeAdjacencia(g: Grafo): Map<string, Vizinho[]> {
  const lista = new Map<string, Vizinho[]>(g.nos.map((n) => [n.id, []]));
  for (const a of g.arestas) {
    lista.get(a.de)?.push({ para: a.para, peso: a.peso });
    if (!g.dirigido) lista.get(a.para)?.push({ para: a.de, peso: a.peso });
  }
  return lista;
}

/** A matriz de adjacência: `celulas[i][j]` é o peso de i → j, ou `null` sem ligação. */
export function matrizDeAdjacencia(g: Grafo): { ids: string[]; celulas: (number | null)[][] } {
  const ids = g.nos.map((n) => n.id);
  const pos = new Map(ids.map((id, k) => [id, k]));
  const celulas = ids.map(() => ids.map((): number | null => null));
  for (const a of g.arestas) {
    const i = pos.get(a.de)!;
    const j = pos.get(a.para)!;
    celulas[i]![j] = a.peso;
    if (!g.dirigido) celulas[j]![i] = a.peso;
  }
  return { ids, celulas };
}

export interface Graus {
  readonly entra: number;
  readonly sai: number;
}

export function graus(g: Grafo): Map<string, Graus> {
  const m = new Map<string, { entra: number; sai: number }>(g.nos.map((n) => [n.id, { entra: 0, sai: 0 }]));
  for (const a of g.arestas) {
    m.get(a.de)!.sai += 1;
    m.get(a.para)!.entra += 1;
    if (!g.dirigido) {
      m.get(a.para)!.sai += 1;
      m.get(a.de)!.entra += 1;
    }
  }
  return m;
}

/** Quantos pedaços soltos o grafo tem, ignorando a direção. */
export function componentes(g: Grafo): string[][] {
  const vizinhos = listaDeAdjacencia({ ...g, dirigido: false });
  const visto = new Set<string>();
  const pedacos: string[][] = [];
  for (const n of g.nos) {
    if (visto.has(n.id)) continue;
    const pedaco: string[] = [];
    const pilha = [n.id];
    visto.add(n.id);
    while (pilha.length > 0) {
      const at = pilha.pop()!;
      pedaco.push(at);
      for (const v of vizinhos.get(at) ?? []) {
        if (!visto.has(v.para)) {
          visto.add(v.para);
          pilha.push(v.para);
        }
      }
    }
    pedacos.push(pedaco);
  }
  return pedacos;
}

/** Tem ciclo? (Não dirigido: alguma aresta fecha um laço; dirigido: alguma volta ao começo.) */
export function temCiclo(g: Grafo): boolean {
  if (!g.dirigido) {
    // Floresta tem exatamente n − c arestas; qualquer aresta a mais fecha um ciclo.
    return g.arestas.length > g.nos.length - componentes(g).length;
  }
  const lista = listaDeAdjacencia(g);
  const cor = new Map<string, 0 | 1 | 2>(g.nos.map((n) => [n.id, 0]));
  const visita = (id: string): boolean => {
    cor.set(id, 1);
    for (const v of lista.get(id) ?? []) {
      const c = cor.get(v.para);
      if (c === 1) return true;
      if (c === 0 && visita(v.para)) return true;
    }
    cor.set(id, 2);
    return false;
  };
  return g.nos.some((n) => cor.get(n.id) === 0 && visita(n.id));
}

/** Um nome para o que o leitor montou, quando ele tem nome. */
export function oQueE(g: Grafo): string {
  const n = g.nos.length;
  const m = g.arestas.length;
  if (n === 0) return "nothing yet — add a point";
  if (n === 1) return "a single point: a graph with no edges";
  if (m === 0) return `${n} points and no edges: a graph, just not a connected one`;
  const pedacos = componentes(g).length;
  if (pedacos > 1) return `${pedacos} separate pieces: no path joins them`;
  const completo = m === (n * (n - 1)) / 2 && !g.dirigido;
  if (completo && n > 2) return `a complete graph: every point linked to every other (${m} edges)`;
  if (!temCiclo(g)) return n === 2 ? "two points and one edge: the smallest graph that says something" : `a tree: connected, no cycles, exactly ${n - 1} edges`;
  return g.dirigido ? "a directed graph with a cycle: you can walk in a circle" : "a connected graph with a cycle: there is more than one way between some points";
}

const N = (rotulo: string, x: number, y: number): No => ({ id: rotulo, x, y, rotulo });
const A = (de: string, para: string, peso = 1): Aresta => ({ de, para, peso });

/** Pontos de partida. O primeiro é a tese do lab: dois pontos e uma linha. */
export const EXEMPLOS: Readonly<Record<string, { readonly titulo: string; readonly grafo: Grafo }>> = {
  "two-points": { titulo: "Two points", grafo: { nos: [N("A", 220, 200), N("B", 520, 200)], arestas: [A("A", "B", 5)], dirigido: false, ponderado: true } },
  triangle: { titulo: "Triangle", grafo: { nos: [N("A", 180, 300), N("B", 560, 300), N("C", 370, 80)], arestas: [A("A", "B", 7), A("B", "C", 3), A("C", "A", 3)], dirigido: false, ponderado: true } },
  tree: {
    titulo: "Tree",
    grafo: { nos: [N("A", 370, 60), N("B", 200, 180), N("C", 540, 180), N("D", 120, 320), N("E", 280, 320), N("F", 620, 320)], arestas: [A("A", "B"), A("A", "C"), A("B", "D"), A("B", "E"), A("C", "F")], dirigido: false, ponderado: false },
  },
  "one-way": {
    titulo: "One-way streets",
    grafo: { nos: [N("A", 160, 200), N("B", 370, 80), N("C", 580, 200), N("D", 370, 320)], arestas: [A("A", "B", 2), A("B", "C", 2), A("C", "D", 2), A("D", "A", 2), A("A", "C", 5)], dirigido: true, ponderado: true },
  },
};

/** A largura e a altura do desenho em que os exemplos e o editor vivem. */
export const LARGURA_DO_GRAFO = 740;
export const ALTURA_DO_GRAFO = 400;
