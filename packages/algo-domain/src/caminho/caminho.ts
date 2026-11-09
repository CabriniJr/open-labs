import type { Aresta, Grafo, No } from "../grafo/grafo.js";
import { listaDeAdjacencia } from "../grafo/grafo.js";

/**
 * Quatro jeitos de ir de casa ao porto num mapa, e o que cada um sabe.
 *
 * Todos são o MESMO laço: tire o melhor da fronteira, olhe os vizinhos,
 * ponha-os na fronteira. O que muda entre eles é uma linha só — o que "melhor"
 * quer dizer:
 *
 * | algoritmo | escolhe pelo… | sabe o custo do que andou? | sabe para onde vai? |
 * |---|---|---|---|
 * | BFS | menor número de ruas | não | não |
 * | guloso | mais perto do destino em linha reta | não | sim |
 * | Dijkstra | menor custo andado (g) | sim | não |
 * | A* | g + linha reta até o destino (h) | sim | sim |
 *
 * Dijkstra é guloso também — e é aí que o lab amarra o tema: ser guloso no
 * critério certo (o custo já pago) dá a resposta ótima com pesos positivos;
 * ser guloso no critério errado (a aparência de estar perto) não dá.
 */
export type Busca = "bfs" | "greedy" | "dijkstra" | "astar";
export const BUSCAS: readonly Busca[] = ["bfs", "greedy", "dijkstra", "astar"];

export interface FichaDaBusca {
  readonly nome: string;
  readonly prioridade: string;
  readonly otimo: string;
  readonly classe: string;
}

export const FICHAS_DAS_BUSCAS: Readonly<Record<Busca, FichaDaBusca>> = {
  bfs: { nome: "Breadth-first search", prioridade: "fewest roads so far (a queue)", otimo: "fewest roads — not least time", classe: "O(V + E)" },
  greedy: { nome: "Greedy best-first", prioridade: "straight-line distance to the goal, h", otimo: "no guarantee", classe: "O(E log V), often much less" },
  dijkstra: { nome: "Dijkstra", prioridade: "time travelled so far, g", otimo: "least time, if no road is negative", classe: "O((V + E) log V)" },
  astar: { nome: "A*", prioridade: "g + h: time so far plus a never-too-high guess", otimo: "least time, if h never overestimates", classe: "O((V + E) log V), usually fewer visits" },
};

export class ErroDeBusca extends Error {}

/** Um evento da busca, na ordem em que aconteceu. */
export type Evento =
  /** Saiu da fronteira e foi examinado. `g` é o custo andado até ele. */
  | { readonly tipo: "expand"; readonly no: string; readonly g: number; readonly fronteira: readonly ItemDaFronteira[] }
  /** Olhou a rua de `de` a `para`. `melhorou`: achou caminho mais barato (ou o primeiro) até `para`. */
  | { readonly tipo: "relax"; readonly de: string; readonly para: string; readonly g: number; readonly prioridade: number; readonly melhorou: boolean };

export interface ItemDaFronteira {
  readonly no: string;
  readonly prioridade: number;
  readonly g: number;
}

export interface Resultado {
  readonly busca: Busca;
  readonly origem: string;
  readonly destino: string;
  /** Vazio quando não há caminho. */
  readonly caminho: readonly string[];
  /** A soma dos pesos do caminho achado. */
  readonly custo: number;
  readonly ruas: number;
  readonly expandidos: number;
  readonly relaxamentos: number;
  readonly eventos: readonly Evento[];
}

/** Linha reta entre dois nós, na unidade do desenho. */
export const reta = (a: No, b: No): number => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * A fila de prioridade, por inserção ordenada estável: empate sai na ordem em
 * que entrou. Um heap seria mais rápido; com 12 cruzamentos, a fila legível
 * (o painel mostra ela inteira) vale mais.
 */
class Fronteira {
  private readonly itens: ItemDaFronteira[] = [];
  constructor(private readonly fifo: boolean) {}
  get tamanho(): number {
    return this.itens.length;
  }
  por(item: ItemDaFronteira): void {
    // Uma entrada por nó: atualizar a prioridade é tirar a antiga.
    const k = this.itens.findIndex((i) => i.no === item.no);
    if (k >= 0) this.itens.splice(k, 1);
    if (this.fifo) {
      this.itens.push(item);
      return;
    }
    let pos = this.itens.findIndex((i) => i.prioridade > item.prioridade);
    if (pos < 0) pos = this.itens.length;
    this.itens.splice(pos, 0, item);
  }
  tirar(): ItemDaFronteira | undefined {
    return this.itens.shift();
  }
  foto(): ItemDaFronteira[] {
    return [...this.itens];
  }
}

export function buscar(busca: Busca, g: Grafo, origem: string, destino: string, velocidade = 1): Resultado {
  const porId = new Map(g.nos.map((n) => [n.id, n]));
  const alvo = porId.get(destino);
  if (!porId.has(origem)) throw new ErroDeBusca(`there is no place called ${origem}`);
  if (alvo === undefined) throw new ErroDeBusca(`there is no place called ${destino}`);
  if ((busca === "dijkstra" || busca === "astar") && g.arestas.some((a) => a.peso < 0)) {
    const a = g.arestas.find((x) => x.peso < 0)!;
    throw new ErroDeBusca(
      `${FICHAS_DAS_BUSCAS[busca].nome} refuses the road ${a.de}–${a.para} with weight ${a.peso}: once a place leaves the frontier its time is final, and a negative road could still make it cheaper. Bellman-Ford handles negative weights.`,
    );
  }
  const h = (id: string): number => reta(porId.get(id)!, alvo) / velocidade;
  const vizinhos = listaDeAdjacencia(g);
  const custoAte = new Map<string, number>([[origem, 0]]);
  const ruasAte = new Map<string, number>([[origem, 0]]);
  const veio = new Map<string, string>();
  const fechado = new Set<string>();
  const fronteira = new Fronteira(busca === "bfs");
  const prioridade = (id: string, gId: number, ruas: number): number => {
    switch (busca) {
      case "bfs":
        return ruas;
      case "greedy":
        return h(id);
      case "dijkstra":
        return gId;
      case "astar":
        return gId + h(id);
    }
  };
  fronteira.por({ no: origem, prioridade: prioridade(origem, 0, 0), g: 0 });
  const eventos: Evento[] = [];
  let expandidos = 0;
  let relaxamentos = 0;
  let achou = false;

  while (fronteira.tamanho > 0) {
    const atual = fronteira.tirar()!;
    if (fechado.has(atual.no)) continue;
    fechado.add(atual.no);
    expandidos += 1;
    eventos.push({ tipo: "expand", no: atual.no, g: custoAte.get(atual.no)!, fronteira: fronteira.foto() });
    if (atual.no === destino) {
      achou = true;
      break;
    }
    for (const v of vizinhos.get(atual.no) ?? []) {
      if (fechado.has(v.para)) continue;
      relaxamentos += 1;
      const novo = custoAte.get(atual.no)! + v.peso;
      const ruas = ruasAte.get(atual.no)! + 1;
      // BFS e guloso não reabrem: o primeiro caminho que tocou um nó é o dele.
      // Dijkstra e A* trocam quando o novo custo é menor.
      const conhecido = custoAte.get(v.para);
      const melhorou = conhecido === undefined || ((busca === "dijkstra" || busca === "astar") && novo < conhecido);
      const p = prioridade(v.para, novo, ruas);
      eventos.push({ tipo: "relax", de: atual.no, para: v.para, g: novo, prioridade: p, melhorou });
      if (!melhorou) continue;
      custoAte.set(v.para, novo);
      ruasAte.set(v.para, ruas);
      veio.set(v.para, atual.no);
      fronteira.por({ no: v.para, prioridade: p, g: novo });
    }
  }

  const caminho: string[] = [];
  if (achou) {
    for (let at: string | undefined = destino; at !== undefined; at = veio.get(at)) caminho.unshift(at);
  }
  const custo = achou ? custoAte.get(destino)! : Number.POSITIVE_INFINITY;
  return { busca, origem, destino, caminho, custo, ruas: Math.max(0, caminho.length - 1), expandidos, relaxamentos, eventos };
}

/** Busca com a velocidade do mapa, para h nunca superestimar (ver `velocidadeDe`). */
export function buscarNoMapa(busca: Busca, mapa: Mapa, origem = mapa.origem, destino = mapa.destino): Resultado {
  return buscar(busca, mapa.grafo, origem, destino, velocidadeDe(mapa.grafo));
}

/**
 * A maior velocidade em linha reta de qualquer rua: distância / minutos. Dividir
 * a linha reta por ela dá um h que nunca passa do tempo real — o que torna o A*
 * ótimo. Com uma velocidade inventada mais baixa, h superestima e o A* pode
 * errar; o lab deixa o leitor ver isso (`exagero`).
 */
export function velocidadeDe(g: Grafo): number {
  const porId = new Map(g.nos.map((n) => [n.id, n]));
  let v = 0;
  for (const a of g.arestas) if (a.peso > 0) v = Math.max(v, reta(porId.get(a.de)!, porId.get(a.para)!) / a.peso);
  return v > 0 ? v : 1;
}

// ------------------------------------------------------------------ o mapa

export interface Rua extends Aresta {
  readonly nome: string;
  /** Quanto mais lenta que uma rua livre ela é. 1 = livre. */
  readonly transito: number;
}

export interface Mapa {
  readonly grafo: Grafo;
  readonly ruas: readonly Rua[];
  readonly origem: string;
  readonly destino: string;
}

/** Minutos de uma rua: a distância a 40 unidades por minuto, vezes o trânsito. */
const MINUTO = 40;

export interface Lugar {
  readonly id: string;
  readonly rotulo: string;
  readonly x: number;
  readonly y: number;
}

export const LUGARES: readonly Lugar[] = [
  { id: "home", rotulo: "Home", x: 80, y: 300 },
  { id: "bakery", rotulo: "Bakery", x: 250, y: 300 },
  { id: "school", rotulo: "School", x: 230, y: 120 },
  { id: "station", rotulo: "Station", x: 240, y: 480 },
  { id: "square", rotulo: "Square", x: 440, y: 300 },
  { id: "park", rotulo: "Park", x: 450, y: 100 },
  { id: "stadium", rotulo: "Stadium", x: 450, y: 545 },
  { id: "market", rotulo: "Market", x: 640, y: 300 },
  { id: "museum", rotulo: "Museum", x: 680, y: 110 },
  { id: "hospital", rotulo: "Hospital", x: 660, y: 470 },
  { id: "pier", rotulo: "Pier", x: 830, y: 330 },
  { id: "harbor", rotulo: "Harbor", x: 940, y: 220 },
];

/** [de, para, nome, trânsito]. O centro é congestionado e a balsa é lenta: as duas armadilhas do guloso. */
const RUAS: readonly (readonly [string, string, string, number])[] = [
  ["home", "bakery", "Rua A", 1],
  ["home", "school", "School Rd", 1],
  ["home", "station", "Rail Rd", 1],
  ["bakery", "square", "Main Ave (traffic)", 3],
  ["bakery", "school", "Hill St", 1.2],
  ["bakery", "station", "Low St", 1.2],
  ["school", "park", "Park Way", 1],
  ["station", "stadium", "Stadium Rd", 1.1],
  ["station", "hospital", "Ring Expressway (jam)", 3],
  ["square", "park", "Garden St", 1.3],
  ["square", "stadium", "South St", 1.3],
  ["square", "market", "Main Ave (traffic)", 3],
  ["park", "museum", "North Ring", 1],
  ["stadium", "hospital", "South Ring", 1],
  ["market", "museum", "Gallery St", 1.2],
  ["market", "hospital", "Clinic St", 1.2],
  ["market", "pier", "Dock Rd", 1],
  ["pier", "harbor", "Ferry (slow)", 7],
  ["museum", "harbor", "Coast Rd", 1.1],
  ["hospital", "harbor", "Bay Rd", 1.6],
];

export function mapaDaCidade(congestionamento: Readonly<Record<string, number>> = {}): Mapa {
  const nos: No[] = LUGARES.map((l) => ({ id: l.id, x: l.x, y: l.y, rotulo: l.rotulo }));
  const porId = new Map(nos.map((n) => [n.id, n]));
  const ruas: Rua[] = RUAS.map(([de, para, nome, base]) => {
    const transito = congestionamento[`${de}-${para}`] ?? base;
    const peso = Math.ceil((reta(porId.get(de)!, porId.get(para)!) / MINUTO) * transito);
    return { de, para, peso, nome, transito };
  });
  return { grafo: { nos, arestas: ruas, dirigido: false, ponderado: true }, ruas, origem: "home", destino: "harbor" };
}

/** A chave de uma rua, na ordem em que ela foi declarada. */
export const chaveDaRua = (r: Pick<Aresta, "de" | "para">): string => `${r.de}-${r.para}`;

/** Achar a rua entre dois lugares, nas duas direções. */
export function ruaEntre(mapa: Mapa, a: string, b: string): Rua | undefined {
  return mapa.ruas.find((r) => (r.de === a && r.para === b) || (r.de === b && r.para === a));
}

/** O estado da busca depois de `k` eventos: o que já saiu, a fronteira, e o melhor custo de cada lugar. */
export interface FotoDaBusca {
  readonly fechados: readonly string[];
  readonly fronteira: readonly ItemDaFronteira[];
  readonly custo: ReadonlyMap<string, number>;
  readonly veio: ReadonlyMap<string, string>;
  readonly evento: Evento | undefined;
  readonly terminou: boolean;
}

export function fotoDaBusca(r: Resultado, k: number): FotoDaBusca {
  const ate = Math.max(0, Math.min(r.eventos.length, Math.floor(k)));
  const fechados: string[] = [];
  const custo = new Map<string, number>([[r.origem, 0]]);
  const veio = new Map<string, string>();
  const abertos = new Map<string, ItemDaFronteira>([[r.origem, { no: r.origem, prioridade: 0, g: 0 }]]);
  for (let i = 0; i < ate; i += 1) {
    const e = r.eventos[i]!;
    if (e.tipo === "expand") {
      fechados.push(e.no);
      abertos.clear();
      for (const f of e.fronteira) abertos.set(f.no, f);
    } else if (e.melhorou) {
      custo.set(e.para, e.g);
      veio.set(e.para, e.de);
      abertos.set(e.para, { no: e.para, prioridade: e.prioridade, g: e.g });
    }
  }
  const fronteira = [...abertos.values()].sort((a, b) => a.prioridade - b.prioridade);
  return { fechados, fronteira, custo, veio, evento: ate === 0 ? undefined : r.eventos[ate - 1], terminou: ate === r.eventos.length };
}
