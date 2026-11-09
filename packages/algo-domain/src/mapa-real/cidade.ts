/**
 * Uma cidade de verdade, como grafo: os cruzamentos são os vértices, os
 * trechos de rua entre dois cruzamentos são as arestas dirigidas, e o peso é o
 * tempo de viagem. Os dados vêm do OpenStreetMap por `scripts/osm-mapa-cidade.py`
 * e chegam aqui como arrays planos — 2 mil cruzamentos cabem numa estrutura CSR
 * (vizinhos contíguos), que é o que uma implementação de verdade usa.
 *
 * Unidades: posição em metros (x para leste, y para o SUL, como numa tela),
 * peso em décimos de segundo, comprimento em metros.
 */
export interface DadosDaCidade {
  readonly cidade: string;
  readonly credito: string;
  readonly licenca: string;
  readonly recorte: readonly number[];
  readonly largura: number;
  readonly altura: number;
  readonly tipos: readonly string[];
  readonly velocidades: readonly number[];
  /** x, y em decímetros, intercalados. */
  readonly nos: readonly number[];
  /** de, para, peso (ds), metros, nome, tipo — seis por aresta. */
  readonly arestas: readonly number[];
  /** Os pontos do meio de cada aresta, em decímetros, intercalados. */
  readonly geometria: readonly (readonly number[])[];
  readonly nomes: readonly string[];
  readonly pois: readonly { readonly nome: string; readonly x: number; readonly y: number; readonly no: number }[];
}

export interface PontoDeInteresse {
  readonly id: string;
  readonly nome: string;
  readonly x: number;
  readonly y: number;
  /** O cruzamento mais perto, onde a busca começa ou termina. */
  readonly no: number;
}

export interface Cidade {
  readonly nome: string;
  readonly credito: string;
  readonly licenca: string;
  readonly largura: number;
  readonly altura: number;
  readonly n: number;
  readonly m: number;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly de: Int32Array;
  readonly para: Int32Array;
  /** Décimos de segundo. */
  readonly peso: Float64Array;
  readonly metros: Float64Array;
  readonly nomeDaRua: readonly string[];
  readonly tipo: Uint8Array;
  readonly tipos: readonly string[];
  /** Pontos do meio de cada aresta, em metros, intercalados. */
  readonly geometria: readonly Float64Array[];
  /** CSR de saída: as arestas que saem de v são `saida[inicioSaida[v] .. inicioSaida[v+1])`. */
  readonly inicioSaida: Int32Array;
  readonly saida: Int32Array;
  /** CSR de entrada: o grafo ao contrário, para a busca bidirecional. */
  readonly inicioEntrada: Int32Array;
  readonly entrada: Int32Array;
  /** Metros por décimo de segundo na via mais rápida — o que mantém o A* honesto. */
  readonly velocidadeMaxima: number;
  readonly pois: readonly PontoDeInteresse[];
}

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");

function csr(n: number, chave: Int32Array): { inicio: Int32Array; lista: Int32Array } {
  const inicio = new Int32Array(n + 1);
  for (const v of chave) inicio[v + 1]! += 1;
  for (let v = 0; v < n; v += 1) inicio[v + 1]! += inicio[v]!;
  const pos = inicio.slice(0, n);
  const lista = new Int32Array(chave.length);
  chave.forEach((v, e) => {
    lista[pos[v]!] = e;
    pos[v]! += 1;
  });
  return { inicio, lista };
}

export function cidadeDe(d: DadosDaCidade): Cidade {
  const n = d.nos.length / 2;
  const m = d.arestas.length / 6;
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  for (let v = 0; v < n; v += 1) {
    x[v] = d.nos[2 * v]! / 10;
    y[v] = d.nos[2 * v + 1]! / 10;
  }
  const de = new Int32Array(m);
  const para = new Int32Array(m);
  const peso = new Float64Array(m);
  const metros = new Float64Array(m);
  const tipo = new Uint8Array(m);
  const nomeDaRua: string[] = [];
  let velocidadeMaxima = 0;
  for (let e = 0; e < m; e += 1) {
    de[e] = d.arestas[6 * e]!;
    para[e] = d.arestas[6 * e + 1]!;
    peso[e] = Math.max(1, d.arestas[6 * e + 2]!);
    metros[e] = d.arestas[6 * e + 3]!;
    nomeDaRua.push(d.nomes[d.arestas[6 * e + 4]!] ?? "");
    tipo[e] = d.arestas[6 * e + 5]!;
    // A linha reta entre as pontas nunca é mais longa que a rua: dividir por ela
    // dá a velocidade "em linha reta" mais alta, e o h que nunca superestima.
    const reta = Math.hypot(x[para[e]!]! - x[de[e]!]!, y[para[e]!]! - y[de[e]!]!);
    velocidadeMaxima = Math.max(velocidadeMaxima, reta / peso[e]!);
  }
  const s = csr(n, de);
  const en = csr(n, para);
  const geometria = d.geometria.map((g) => Float64Array.from(g, (c) => c / 10));
  const usados = new Set<string>();
  const pois = d.pois.map((p) => {
    let id = slug(p.nome);
    while (usados.has(id)) id += "-2";
    usados.add(id);
    return { id, nome: p.nome, x: p.x / 10, y: p.y / 10, no: p.no };
  });
  return {
    nome: d.cidade,
    credito: d.credito,
    licenca: d.licenca,
    largura: d.largura / 10,
    altura: d.altura / 10,
    n,
    m,
    x,
    y,
    de,
    para,
    peso,
    metros,
    nomeDaRua,
    tipo,
    tipos: d.tipos,
    geometria,
    inicioSaida: s.inicio,
    saida: s.lista,
    inicioEntrada: en.inicio,
    entrada: en.lista,
    velocidadeMaxima: velocidadeMaxima > 0 ? velocidadeMaxima : 1,
    pois,
  };
}

/** O cruzamento mais perto de um ponto do mapa (um clique, um POI). */
export function maisPerto(c: Cidade, px: number, py: number): number {
  let melhor = 0;
  let d = Number.POSITIVE_INFINITY;
  for (let v = 0; v < c.n; v += 1) {
    const dd = (c.x[v]! - px) ** 2 + (c.y[v]! - py) ** 2;
    if (dd < d) {
      d = dd;
      melhor = v;
    }
  }
  return melhor;
}

/** A linha reta entre dois cruzamentos, em metros. */
export const linhaReta = (c: Cidade, a: number, b: number): number => Math.hypot(c.x[a]! - c.x[b]!, c.y[a]! - c.y[b]!);

/** Os pontos de uma aresta, de ponta a ponta, em metros — o que se pinta. */
export function tracado(c: Cidade, e: number): number[] {
  const a = c.de[e]!;
  const b = c.para[e]!;
  return [c.x[a]!, c.y[a]!, ...c.geometria[e]!, c.x[b]!, c.y[b]!];
}

/** Segundos, em texto curto: "4 min 20 s". */
export function tempoEmTexto(decimos: number): string {
  if (!Number.isFinite(decimos)) return "—";
  const s = Math.round(decimos / 10);
  const min = Math.floor(s / 60);
  return min === 0 ? `${s} s` : `${min} min ${String(s % 60).padStart(2, "0")} s`;
}
