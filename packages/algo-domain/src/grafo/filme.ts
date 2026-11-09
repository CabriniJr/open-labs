import { film, line, pt, through, type Box, type Film } from "@ovh/motion";
import { adicionarAresta, adicionarNo, comDirecao, listaDeAdjacencia, matrizDeAdjacencia, oQueE, vazio, type Grafo } from "./grafo.js";

/**
 * O filme "o que é um grafo", derivado das operações do modelo: cada capítulo
 * é uma chamada a `adicionarNo`/`adicionarAresta`/`comDirecao`, e o painel
 * mostra a lista e a matriz de adjacência do grafo daquele instante — as duas
 * representações que um programa guarda, mudando junto com o desenho.
 */
export interface DetalheDoGrafo {
  readonly oQueE: string;
  readonly lista: readonly (readonly [string, string])[];
  readonly matriz: { readonly ids: readonly string[]; readonly celulas: readonly (readonly (number | null)[])[] };
  readonly dirigido: boolean;
}

export const LARGURA_DO_FILME_GRAFO = 1280;
export const ALTURA_DO_FILME_GRAFO = 720;

const R = 34;
const POS: Readonly<Record<string, { x: number; y: number }>> = { A: { x: 330, y: 470 }, B: { x: 950, y: 470 }, C: { x: 640, y: 170 } };
const caixa = (id: string): Box => ({ x: POS[id]!.x - R, y: POS[id]!.y - R, w: 2 * R, h: 2 * R });

/** Um traço que começa e termina na borda dos círculos, não no centro. */
function entre(a: string, b: string, folga = R + 6) {
  const pa = POS[a]!;
  const pb = POS[b]!;
  const d = Math.hypot(pb.x - pa.x, pb.y - pa.y);
  const ux = (pb.x - pa.x) / d;
  const uy = (pb.y - pa.y) / d;
  return line(pt(pa.x + ux * folga, pa.y + uy * folga), pt(pb.x - ux * folga, pb.y - uy * folga));
}

function detalheDe(g: Grafo): DetalheDoGrafo {
  const lista = [...listaDeAdjacencia(g)].map(([id, vs]) => [id, vs.length === 0 ? "—" : vs.map((v) => (g.ponderado ? `${v.para} (${v.peso})` : v.para)).join(", ")] as const);
  return { oQueE: oQueE(g), lista, matriz: matrizDeAdjacencia(g), dirigido: g.dirigido };
}

export function filmeDoGrafo(): Film<DetalheDoGrafo> {
  const f = film<DetalheDoGrafo>({ width: LARGURA_DO_FILME_GRAFO, height: ALTURA_DO_FILME_GRAFO, gap: 400, maxZoom: 1.6 });

  for (const id of ["A", "B", "C"]) f.add({ type: "node", id: `no:${id}`, box: caixa(id), shape: "circle", label: id, tone: "processor", hidden: true, textScale: 1.7 });
  f.add({ type: "link", id: "ab", textScale: 1.5, path: entre("A", "B"), tone: "conduit", hidden: true, label: "" });
  f.add({ type: "link", id: "ab:seta", textScale: 1.5, path: entre("A", "B"), tone: "conduit", hidden: true, arrow: true, label: "5 min, one way" });
  f.add({ type: "link", id: "bc", textScale: 1.5, path: entre("B", "C"), tone: "conduit", hidden: true, label: "3" });
  f.add({ type: "link", id: "ca", textScale: 1.5, path: entre("C", "A"), tone: "conduit", hidden: true, label: "3" });
  f.add({ type: "link", id: "ab:7", textScale: 1.5, path: entre("A", "B"), tone: "conduit", hidden: true, label: "7" });
  f.add({ type: "token", id: "volta", path: through([pt(POS.A!.x, POS.A!.y), pt(POS.C!.x, POS.C!.y), pt(POS.B!.x, POS.B!.y)]), tone: "live", hidden: true, label: "3 + 3 = 6", size: 6, trail: 4 });
  f.add({ type: "note", id: "nota", at: pt(760, 630), label: "", tone: "ink", width: 900, hidden: true, textScale: 1.5 });

  let g = vazio(false, false);
  g = adicionarNo(g, POS.A!.x, POS.A!.y, "A");
  g = adicionarNo(g, POS.B!.x, POS.B!.y, "B");
  f.chapter({ id: "points", title: "Two points", body: "A graph starts with points — vertices, or nodes. Two street corners, two people, two computers. On their own they say nothing about each other.", detail: detalheDe(g) }, (d) => {
    d.camera({ at: { cx: 640, cy: 400, zoom: 1 } });
    d.show(["no:A", "no:B"], { dur: 500 }).ping(["no:A", "no:B"]);
    d.show("nota").set("nota", { label: "points: {A, B} · edges: {}" }).wait(1800);
  });

  g = adicionarAresta(g, "A", "B");
  f.chapter({ id: "edge", title: "One edge", body: "An edge says these two are related: a street joins the corners, a friendship joins the people, a cable joins the computers. Now you can go from A to B — and, with no arrow, from B to A.", detail: detalheDe(g) }, (d) => {
    d.draw("ab", { dur: 900 });
    d.ping(["no:A", "no:B"]);
    d.set("nota", { label: "points: {A, B} · edges: {A–B}" }).wait(1800);
  });

  g = { ...g, ponderado: true, arestas: g.arestas.map((a) => ({ ...a, peso: 5 })) };
  f.chapter({ id: "weight", title: "A weight", body: "Give the edge a number and the graph can answer “how far?”, “how long?”, “how much?”. Here the street takes 5 minutes. The lists to the right store it next to the neighbour.", detail: detalheDe(g) }, (d) => {
    d.set("ab", { label: "5 min" }).ping("ab");
    d.wait(1800);
  });

  g = comDirecao(g, true);
  f.chapter({ id: "direction", title: "A direction", body: "Make the street one-way and the edge becomes an arrow. A → B is allowed, B → A is not. The matrix stops being symmetric: row A has a 5, row B does not.", detail: detalheDe(g) }, (d) => {
    d.together(
      (x) => x.hide("ab", { dur: 300 }),
      (x) => x.draw("ab:seta", { dur: 700 }),
    );
    d.set("nota", { label: "A → B: 5 · B → A: no edge" }).wait(1900);
  });

  g = comDirecao(g, false);
  g = adicionarNo(g, POS.C!.x, POS.C!.y, "C");
  g = { ...g, arestas: [{ de: "A", para: "B", peso: 7 }] };
  g = adicionarAresta(g, "B", "C", 3);
  g = adicionarAresta(g, "C", "A", 3);
  f.chapter({ id: "detour", title: "A third point, and the shortest way is not the straight one", body: "Add C, linked to both. The direct street A–B now takes 7 minutes; going round by C takes 3 + 3 = 6. A path is a sequence of edges, and its cost is their sum. Finding the cheapest one is what Dijkstra does — the next lab.", detail: detalheDe(g) }, (d) => {
    d.together(
      (x) => x.hide("ab:seta", { dur: 300 }),
      (x) => x.draw("ab:7", { dur: 600 }),
      (x) => x.show("no:C", { dur: 500 }).ping("no:C"),
    );
    d.draw(["ca", "bc"], { dur: 700 });
    d.set("nota", { label: "A → B direct: 7 · A → C → B: 6" });
    d.send("volta", { dur: 1600 }).ping("no:B");
    d.wait(1600);
  });

  f.chapter({ id: "everything", title: "Everything else is this, with more points", body: "A city map is corners and streets. A social network is people and friendships. The internet is routers and links. The algorithms in this handbook all walk the same structure: points, edges, and sometimes a weight or an arrow.", detail: detalheDe(g) }, (d) => {
    d.camera({ box: { x: 200, y: 100, w: 880, h: 480 } });
    d.stagger(["no:A", "no:C", "no:B"], 220, (x, id) => x.ping(id));
    d.set("nota", { label: "graph = (points, edges)" }).wait(2200);
  });

  return f.build();
}
