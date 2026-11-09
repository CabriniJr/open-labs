import { film, pt, type Box, type Director, type Film } from "@ovh/motion";
import { ICONES_ALGO } from "../icones.js";
import { entrada, FICHAS, ordenar, type Algoritmo, type Formato, type Operacao, type Traco } from "./ordenacao.js";

/**
 * O filme da ordenação, derivado de `ordenar()`. Oito barras numa estante;
 * cada operação da fita vira um gesto — comparar acende as duas, trocar as faz
 * cruzar, e o merge desce a metade para a fita auxiliar e sobe item por item.
 *
 * Um capítulo por fase da fita (passada, intercalação, partição): o mesmo
 * algoritmo, contado no ritmo em que ele decide. Mudar o algoritmo ou o formato
 * refaz o filme a partir do modelo — nenhum gesto é escrito à mão.
 */
export interface DetalheDaOrdenacao {
  readonly algoritmo: Algoritmo;
  readonly vetor: readonly number[];
  readonly comparacoes: number;
  readonly trocas: number;
  readonly escritas: number;
  /** Quantos itens estão na fita auxiliar neste instante. */
  readonly naAuxiliar: number;
  readonly operacao: string;
}

export const LARGURA_DA_ORDENACAO = 1280;
export const ALTURA_DA_ORDENACAO = 720;
export const N_DO_FILME = 8;
/** Formatos com valores distintos: cada barra é um item com identidade. */
export const FORMATOS_DO_FILME: readonly Formato[] = ["random", "sorted", "reversed"];

const PASSO = 128;
const X0 = 160;
const LARGURA = 92;
const BASE = 340;
const BASE_AUX = 660;
const altura = (v: number) => 34 + v * 30;
const xDaVaga = (k: number) => X0 + k * PASSO;
const caixa = (v: number, k: number): Box => ({ x: xDaVaga(k), y: BASE - altura(v), w: LARGURA, h: altura(v) });

const descrever = (op: Operacao, v: readonly number[]): string => {
  switch (op.tipo) {
    case "compare":
      return `compare place ${op.i + 1} with place ${op.j + 1}`;
    case "swap":
      return `swap ${v[op.i]} (place ${op.i + 1}) with ${v[op.j]} (place ${op.j + 1})`;
    case "write":
      return `write ${op.valor} back into place ${op.i + 1}`;
  }
};

export function filmeDaOrdenacao(algoritmo: Algoritmo = "bubble", formato: Formato = "random", semente = 3): Film<DetalheDaOrdenacao> {
  if (!FORMATOS_DO_FILME.includes(formato)) throw new RangeError(`the film needs distinct values; “${formato}” repeats them`);
  const v0 = entrada(formato, N_DO_FILME, semente);
  const t: Traco = ordenar(algoritmo, v0);
  const ficha = FICHAS[algoritmo];
  const f = film<DetalheDaOrdenacao>({ width: LARGURA_DA_ORDENACAO, height: ALTURA_DA_ORDENACAO, gap: 300, maxZoom: 1.5 });

  // ------------------------------------------------------------ o cenário
  f.add({ type: "region", id: "estante", box: { x: X0 - 40, y: 40, w: PASSO * N_DO_FILME + 40, h: BASE - 10 }, label: "the array — reads and writes cost one step each", tone: "container" });
  f.add({
    type: "region",
    id: "auxiliar",
    box: { x: X0 - 40, y: BASE + 40, w: PASSO * N_DO_FILME + 40, h: BASE_AUX - BASE - 30 },
    label: algoritmo === "merge" ? "auxiliary tape — merge pays for its speed here" : "auxiliary tape — this algorithm never needs it",
    tone: "muted",
    icon: ICONES_ALGO.auxiliar,
  });
  for (let k = 0; k < N_DO_FILME; k += 1) f.add({ type: "note", id: `vaga:${k}`, at: pt(xDaVaga(k) + LARGURA / 2, BASE + 18), label: String(k + 1), tone: "muted", width: 40 });
  v0.forEach((v, k) => f.add({ type: "node", id: `item:${v}`, box: caixa(v, k), label: String(v), tone: "processor", shape: "box" }));
  f.add({ type: "note", id: "placar", at: pt(LARGURA_DA_ORDENACAO / 2, 24), label: "0 comparisons · 0 swaps · 0 writes", tone: "ink", width: 640 });

  // ------------------------------------------------------------ o estado que o filme acompanha
  const em = [...v0]; // valor em cada vaga
  const baseDe = new Map(v0.map((v, k) => [v, k])); // vaga original de cada item (o dx é relativo a ela)
  let naAux: number[] = []; // valores na auxiliar, pela vaga de onde saíram
  let auxPorVaga = new Map<number, number>();
  let comparacoes = 0;
  let trocas = 0;
  let escritas = 0;
  const placar = () => `${comparacoes} comparisons · ${trocas} swaps · ${escritas} writes`;
  const detalhe = (operacao: string): DetalheDaOrdenacao => ({ algoritmo, vetor: [...em], comparacoes, trocas, escritas, naAuxiliar: naAux.length, operacao });
  const irPara = (d: Director<DetalheDaOrdenacao>, v: number, vaga: number, aux: boolean, dur = 420) => d.to(`item:${v}`, { dx: xDaVaga(vaga) - xDaVaga(baseDe.get(v)!), dy: aux ? BASE_AUX - BASE : 0 }, { dur, wait: false });

  const gesto = (d: Director<DetalheDaOrdenacao>, op: Operacao) => {
    if (op.tipo === "compare") {
      comparacoes += 1;
      const a = algoritmo === "merge" ? auxPorVaga.get(op.i)! : em[op.i]!;
      const b = algoritmo === "merge" ? auxPorVaga.get(op.j)! : em[op.j]!;
      d.beat({ title: `Compare ${a} and ${b}`, detail: detalhe(descrever(op, em)) });
      d.set(`item:${a}`, { tone: "high" }).set(`item:${b}`, { tone: "high" });
      d.set("placar", { label: placar() }).wait(340);
      d.set(`item:${a}`, { tone: "processor" }).set(`item:${b}`, { tone: "processor" });
      return;
    }
    if (op.tipo === "swap") {
      trocas += 1;
      const a = em[op.i]!;
      const b = em[op.j]!;
      const texto = descrever(op, em);
      em[op.i] = b;
      em[op.j] = a;
      d.beat({ title: `Swap ${a} and ${b}`, detail: detalhe(texto) });
      d.set(`item:${a}`, { tone: "live" }).set(`item:${b}`, { tone: "live" });
      irPara(d, a, op.j, false);
      irPara(d, b, op.i, false);
      d.set("placar", { label: placar() }).wait(460);
      d.set(`item:${a}`, { tone: "processor" }).set(`item:${b}`, { tone: "processor" });
      return;
    }
    escritas += 1;
    em[op.i] = op.valor;
    naAux = naAux.filter((x) => x !== op.valor);
    d.beat({ title: `Write ${op.valor} into place ${op.i + 1}`, detail: detalhe(descrever(op, em)) });
    d.set(`item:${op.valor}`, { tone: "live" });
    irPara(d, op.valor, op.i, false, 380);
    d.set("placar", { label: placar() }).wait(420);
    d.set(`item:${op.valor}`, { tone: "processor" });
  };

  f.chapter(
    { id: "shelf", title: "Eight items on a shelf", body: `${ficha.nome}: ${ficha.regra} Every comparison, swap and write costs one step; the counter at the top is the bill.`, detail: detalhe("nothing yet") },
    (d) => {
      d.camera({ focus: ["estante", "auxiliar"] });
      d.stagger(v0.map((v) => `item:${v}`), 70, (x, id) => x.ping(id));
      d.wait(1400);
    },
  );

  t.fases.forEach((fase, k) => {
    const fim = k + 1 < t.fases.length ? t.fases[k + 1]!.passo : t.ops.length;
    const ops = t.ops.slice(fase.passo, fim);
    f.chapter({ id: `fase-${k + 1}`, title: fase.rotulo.charAt(0).toUpperCase() + fase.rotulo.slice(1), body: ops.length === 0 ? "Nothing to do in this stretch — one item is already in order." : `${ops.length} steps in this stretch.`, detail: detalhe(fase.rotulo) }, (d) => {
      if (algoritmo === "merge") {
        // A metade desce para a auxiliar, cada item sob a vaga de onde saiu.
        naAux = em.slice(fase.ini, fase.fim + 1);
        auxPorVaga = new Map(naAux.map((v, j) => [fase.ini + j, v]));
        d.beat({ title: "Copy the stretch to the auxiliary tape", detail: detalhe(`copy places ${fase.ini + 1}–${fase.fim + 1} out`) });
        for (const [vaga, v] of auxPorVaga) irPara(d, v, vaga, true, 380);
        d.wait(460);
      }
      for (const op of ops) gesto(d, op);
      if (ops.length === 0) d.wait(500);
    });
  });

  f.chapter(
    { id: "bill", title: "Sorted — and the bill", body: `${comparacoes} comparisons, ${trocas} swaps and ${escritas} writes: ${comparacoes + trocas + escritas} steps for ${N_DO_FILME} items. ${ficha.nome} is ${ficha.medio} on average, ${ficha.pior} at worst, ${ficha.melhor} at best, and uses ${ficha.memoria} extra memory.`, detail: detalhe("done") },
    (d) => {
      d.camera({ focus: ["estante", "auxiliar"] });
      d.stagger([...em].map((v) => `item:${v}`), 90, (x, id) => x.set(id, { tone: "conduit" }).ping(id));
      d.wait(1600);
    },
  );
  return f.build();
}
