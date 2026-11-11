import { connect, film, pt, type Box, type Director, type Film } from "@ovh/motion";
import { ICONES_ALGO } from "../icones.js";
import { emOrdem, rodarFila, type PassoDaFila, type Politica, type RodadaDaFila } from "./fila.js";

/**
 * O filme da fila, derivado de `rodarFila()`. Os mesmos pedidos chegam a duas
 * filas de 8 vagas no mesmo relógio: em cima o anel, que só anda a cabeça; embaixo
 * o vetor, que empurra todo mundo uma casa a cada atendimento. A barra de cada
 * uma é a conta de operações do modelo. Quando a fila enche, a política decide
 * quem se perde — e trocar a política refaz o filme.
 */
export interface DetalheDaFila {
  readonly politica: Politica;
  readonly tick: number;
  readonly vagas: number;
  /** A fila, a cabeça primeiro. */
  readonly fila: readonly number[];
  readonly atendidos: readonly number[];
  readonly perdidos: readonly number[];
  readonly opsAnel: number;
  readonly opsVetor: number;
  readonly frase: string;
}

export const LARGURA_DA_FILA = 1280;
export const ALTURA_DA_FILA = 720;
/** As chegadas do filme, tick a tick: uma rajada que passa do que o atendente aguenta. */
export const CHEGADAS_DO_FILME: readonly number[] = [2, 1, 2, 1, 2, 2, 1, 2];
export const VAGAS_DO_FILME = 8;

const X0 = 260;
const LADO = 80;
const PASSO = 92;
const Y_ANEL = 80;
const Y_VETOR = 370;
const ALTURA_FAIXA = 250;

type Qual = "a" | "v";
const yDe = (q: Qual) => (q === "a" ? Y_ANEL : Y_VETOR);
const caixaDaVaga = (q: Qual, i: number): Box => ({ x: X0 + i * PASSO, y: yDe(q) + 40, w: LADO, h: 70 });
const caixaDaMarca = (q: Qual, qual: "cab" | "cau"): Box => ({ x: X0, y: yDe(q) + (qual === "cab" ? 118 : 148), w: LADO, h: 24 });
const rotulo = (id: number) => `#${id + 1}`;

interface Evento {
  readonly passo: PassoDaFila;
  readonly moves: readonly PassoDaFila[];
}

/** Agrupa os passos por acontecimento: cada um com os empurrões que ele causou. */
function eventos(r: RodadaDaFila): Evento[] {
  const saida: { passo: PassoDaFila; moves: PassoDaFila[] }[] = [];
  for (const p of r.passos) {
    if (p.t === "move") saida.at(-1)!.moves.push(p);
    else saida.push({ passo: p, moves: [] });
  }
  return saida;
}

export function filmeDaFila(politica: Politica = "recusar"): Film<DetalheDaFila> {
  const opcoes = { politica, carga: "burst", semente: 1, vagas: VAGAS_DO_FILME, servico: 2, chegadas: CHEGADAS_DO_FILME } as const;
  const anel = rodarFila({ ...opcoes, estrutura: "anel" });
  const vetor = rodarFila({ ...opcoes, estrutura: "vetor" });
  const evA = eventos(anel);
  const evV = eventos(vetor);
  if (evA.length !== evV.length) throw new Error("as duas filas deveriam contar os mesmos acontecimentos");
  const N = VAGAS_DO_FILME;
  const maiorOps = Math.max(vetor.ops, 1);

  const f = film<DetalheDaFila>({ width: LARGURA_DA_FILA, height: ALTURA_DA_FILA, gap: 350, maxZoom: 1.5 });

  // ------------------------------------------------------------ o cenário
  const fonte: Box = { x: 40, y: 300, w: 160, h: 80 };
  const atendente: Box = { x: 1060, y: 300, w: 180, h: 80 };
  const lixo: Box = { x: 1060, y: 560, w: 180, h: 80 };
  f.add({ type: "node", id: "fonte", box: fonte, label: "requests", sublabel: `${anel.chegaram} arrive`, tone: "kind-3", icon: ICONES_ALGO.chegada });
  f.add({ type: "node", id: "atendente", box: atendente, label: "server", sublabel: "1 every 2 ticks", tone: "conduit", icon: ICONES_ALGO.atendente });
  f.add({ type: "node", id: "lixo", box: lixo, label: "lost", sublabel: "0", tone: "muted", icon: ICONES_ALGO.descarte });

  const nomes: Record<Qual, string> = {
    a: "ring buffer: only head and size move; slot 7 wraps to slot 0",
    v: "shifting array: the head is always slot 0, so everyone moves up",
  };
  for (const q of ["a", "v"] as const) {
    f.add({ type: "region", id: `faixa:${q}`, box: { x: X0 - 24, y: yDe(q), w: (N - 1) * PASSO + LADO + 48, h: ALTURA_FAIXA }, label: nomes[q], tone: q === "a" ? "processor" : "controller", icon: ICONES_ALGO.fila });
    for (let i = 0; i < N; i += 1) f.add({ type: "node", id: `vaga:${q}:${i}`, box: caixaDaVaga(q, i), label: "", sublabel: `slot ${i}`, tone: "muted" });
    f.add({ type: "node", id: `cab:${q}`, box: caixaDaMarca(q, "cab"), shape: "pill", label: "head", tone: "ink" });
    f.add({ type: "node", id: `cau:${q}`, box: caixaDaMarca(q, "cau"), shape: "pill", label: "tail", tone: "muted" });
    f.add({ type: "note", id: `ops:${q}`, at: pt(X0, yDe(q) + 200), align: "start", label: "0 operations", tone: "ink", width: 600 });
    f.add({ type: "bar", id: `barra:${q}`, box: { x: X0, y: yDe(q) + 216, w: (N - 1) * PASSO + LADO, h: 14 }, grow: "right", tone: q === "a" ? "processor" : "controller" });
  }
  f.add({ type: "note", id: "placar", at: pt(LARGURA_DA_FILA / 2, 40), label: `${N} slots, one server, ${anel.chegaram} requests in a burst`, tone: "ink", width: 1000 });

  // As fichas de cada acontecimento.
  evA.forEach((ea, k) => {
    const ev = evV[k]!;
    const p = ea.passo;
    if (p.t === "chega") {
      f.add({ type: "token", id: `in:a:${k}`, path: connect(fonte, caixaDaVaga("a", p.vaga), 2), label: rotulo(p.id), tone: "kind-3", hidden: true, size: 5 });
      f.add({ type: "token", id: `in:v:${k}`, path: connect(fonte, caixaDaVaga("v", ev.passo.vaga), 2), label: rotulo(p.id), tone: "kind-3", hidden: true, size: 5 });
    } else if (p.t === "recusa") {
      f.add({ type: "token", id: `lost:${k}`, path: connect(fonte, lixo, 2), label: rotulo(p.id), tone: "live", hidden: true, size: 5 });
    } else {
      const destino = p.t === "atende" ? atendente : lixo;
      const tom = p.t === "atende" ? "conduit" : "live";
      f.add({ type: "token", id: `out:a:${k}`, path: connect(caixaDaVaga("a", p.vaga), destino, 2), label: rotulo(p.id), tone: tom, hidden: true, size: 5 });
      f.add({ type: "token", id: `out:v:${k}`, path: connect(caixaDaVaga("v", ev.passo.vaga), destino, 2), label: rotulo(p.id), tone: tom, hidden: true, size: 5 });
    }
  });

  // ------------------------------------------------------------ o detalhe, acompanhando
  let atual: PassoDaFila | undefined;
  let opsVetor = 0;
  const atendidos: number[] = [];
  const perdidos: number[] = [];
  let frase = "Nothing has arrived yet.";
  const detalhe = (): DetalheDaFila => ({
    politica,
    tick: atual?.tick ?? 0,
    vagas: N,
    fila: atual === undefined ? [] : emOrdem(atual.vagas, atual.cabeca, atual.tamanho),
    atendidos: [...atendidos],
    perdidos: [...perdidos],
    opsAnel: atual?.ops ?? 0,
    opsVetor,
    frase,
  });

  const fraseDe = (p: PassoDaFila): string =>
    p.t === "chega"
      ? `${rotulo(p.id)} takes a slot (${p.tamanho} of ${N})`
      : p.t === "atende"
        ? `${rotulo(p.id)} is served`
        : p.t === "recusa"
          ? `Full: ${rotulo(p.id)} is turned away`
          : `Full: the oldest, ${rotulo(p.id)}, is dropped`;

  const marcar = (d: Director<DetalheDaFila>, q: Qual, p: PassoDaFila): void => {
    const cauda = q === "a" ? (p.cabeca + p.tamanho) % N : p.tamanho;
    d.to(`cab:${q}`, { dx: p.cabeca * PASSO }, { dur: 220, wait: false });
    d.to(`cau:${q}`, { dx: Math.min(cauda, N - 1) * PASSO }, { dur: 220, wait: false });
    d.set(`cau:${q}`, { label: p.tamanho === N ? "full" : "tail", tone: p.tamanho === N ? "live" : "muted" });
    d.set(`ops:${q}`, { label: `${p.ops} operations${q === "a" ? " · 1 per enqueue, 1 per dequeue" : " · 1 per enqueue, 1 per dequeue, 1 per shift"}` });
    d.to(`barra:${q}`, { progress: p.ops / maiorOps }, { dur: 200, wait: false });
  };

  const encher = (d: Director<DetalheDaFila>, q: Qual, i: number, id: number): void => {
    d.set(`vaga:${q}:${i}`, id < 0 ? { label: "", tone: "muted" } : { label: rotulo(id), tone: q === "a" ? "processor" : "controller" });
  };

  /** Um acontecimento numa das filas: a ficha, a vaga, e (no vetor) os empurrões. */
  const trilha = (d: Director<DetalheDaFila>, q: Qual, k: number, e: Evento): void => {
    const p = e.passo;
    if (p.t === "chega") {
      d.send(`in:${q}:${k}`, { dur: 420 });
      encher(d, q, p.vaga, p.id);
      d.ping(`vaga:${q}:${p.vaga}`);
      marcar(d, q, p);
      return;
    }
    if (p.t === "recusa") {
      d.wait(420);
      marcar(d, q, p);
      return;
    }
    encher(d, q, p.vaga, -1);
    d.send(`out:${q}:${k}`, { dur: 420 });
    marcar(d, q, p);
    for (const m of e.moves) {
      encher(d, q, m.vaga, m.id);
      encher(d, q, m.vaga + 1, -1);
      d.ping(`vaga:${q}:${m.vaga}`, { dur: 300 });
      marcar(d, q, m);
      d.wait(110);
    }
  };

  const contar = (d: Director<DetalheDaFila>, k: number): void => {
    const p = evA[k]!.passo;
    const ev = evV[k]!;
    if (p.t === "chega") {
      d.together(
        (x) => trilha(x, "a", k, evA[k]!),
        (x) => trilha(x, "v", k, ev),
      );
    } else if (p.t === "recusa") {
      d.together(
        (x) => x.send(`lost:${k}`, { dur: 420 }),
        (x) => trilha(x, "a", k, evA[k]!),
        (x) => trilha(x, "v", k, ev),
      );
    } else {
      d.together(
        (x) => trilha(x, "a", k, evA[k]!),
        (x) => trilha(x, "v", k, ev),
      );
    }
    atual = p;
    opsVetor = (ev.moves.at(-1) ?? ev.passo).ops;
    if (p.t === "atende") {
      atendidos.push(p.id);
      d.set("atendente", { sublabel: `served ${atendidos.length}` }).ping("atendente");
    } else if (p.t !== "chega") {
      perdidos.push(p.id);
      d.set("lixo", { sublabel: `${perdidos.length}: ${perdidos.map(rotulo).join(" ")}`, tone: "live" }).ping("lixo");
    }
    frase = fraseDe(p);
    d.set("placar", { label: `tick ${p.tick} · ${p.tamanho}/${N} waiting · served ${atendidos.length} · lost ${perdidos.length}` });
    d.beat({ title: frase, detail: detalhe() });
    d.wait(120);
  };

  const primeiraPerda = evA.findIndex((e) => e.passo.t === "recusa" || e.passo.t === "expulsa");
  const ultimaChegada = evA.reduce((u, e, k) => (e.passo.tick < CHEGADAS_DO_FILME.length && e.passo.t !== "atende" ? k : u), 0);

  f.chapter(
    {
      id: "ask",
      title: "Same requests, two queues",
      body: `${anel.chegaram} requests arrive in ${CHEGADAS_DO_FILME.length} ticks; the server takes 2 ticks each. Both queues have ${N} slots and serve in arrival order. Watch what each one has to move.`,
      detail: detalhe(),
    },
    (d) => {
      // A barra nasce cheia no motor; aqui ela é a conta, e a conta começa em zero.
      d.set("barra:a", { progress: 0 }).set("barra:v", { progress: 0 });
      d.camera({ at: { cx: LARGURA_DA_FILA / 2, cy: ALTURA_DA_FILA / 2, zoom: 1 } });
      d.ping(["fonte", "faixa:a", "faixa:v", "atendente"]);
      d.wait(1800);
    },
  );

  f.chapter(
    {
      id: "fill",
      title: "Filling up",
      body: "Arriving costs one write in both. Serving is where they differ: the ring moves its head one slot; the array takes slot 0 and shifts every waiting request up by one.",
      detail: detalhe(),
    },
    (d) => {
      for (let k = 0; k < primeiraPerda; k += 1) contar(d, k);
      d.wait(600);
    },
  );

  f.chapter(
    {
      id: "full",
      title: politica === "recusar" ? "Full: the newest is turned away" : "Full: the oldest is dropped",
      body:
        politica === "recusar"
          ? "No free slot. Whoever is already waiting keeps their place, and the request that just arrived is lost without ever waiting."
          : "No free slot. The request that waited longest is thrown out so the newest can enter — and in the array, dropping the head is one more shift of everyone.",
      detail: detalhe(),
    },
    (d) => {
      for (let k = primeiraPerda; k <= ultimaChegada; k += 1) contar(d, k);
      d.wait(600);
    },
  );

  f.chapter(
    {
      id: "drain",
      title: "Draining: same order, different price",
      body: `No more arrivals. Both queues serve the same ${anel.atendidos} requests in the same order and lose the same ${anel.perdidos}. The ring did ${anel.ops} operations; the array did ${vetor.ops}.`,
      detail: detalhe(),
    },
    (d) => {
      for (let k = ultimaChegada + 1; k < evA.length; k += 1) contar(d, k);
      frase = `Ring ${anel.ops} operations, array ${vetor.ops}. Same queue, same order.`;
      d.set("placar", { label: `served ${anel.atendidos} · lost ${anel.perdidos} · ring ${anel.ops} ops · array ${vetor.ops} ops` });
      d.glow(["barra:a", "barra:v"]);
      d.beat({ title: "The bill", detail: detalhe() });
      d.wait(2200);
    },
  );

  return f.build();
}
