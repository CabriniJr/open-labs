import { film, pt, type Film } from "@ovh/motion";
import { ICONES_ALGO } from "../icones.js";
import { CLASSES, curva, duracao, FICHAS_DAS_CLASSES, medir, tempoEstimado, type Classe } from "./crescimento.js";

/**
 * O filme do crescimento: seis barras, uma por classe, e o n dobrando. Cada
 * barra mede o trabalho que o algoritmo dela CONTOU rodando — não a fórmula.
 * A escala é logarítmica (cada marca é ×10), porque em escala linear a
 * quadrática apaga todas as outras no primeiro capítulo.
 *
 * A exponencial só é medida até n = 20. Depois disso o filme mostra a conta e
 * diz quanto tempo levaria, em vez de fingir que rodou.
 */
export interface LinhaDoCrescimento {
  readonly classe: Classe;
  readonly notacao: string;
  readonly algoritmo: string;
  readonly ops: number;
  readonly medido: boolean;
  readonly razao: number | undefined;
  readonly tempo: string;
}

export interface DetalheDoCrescimento {
  readonly n: number;
  readonly linhas: readonly LinhaDoCrescimento[];
}

export const LARGURA_DO_CRESCIMENTO = 1280;
export const ALTURA_DO_CRESCIMENTO = 720;
export const NS_DO_FILME: readonly number[] = [8, 16, 64, 512, 4096];

const X_BARRA = 430;
const W_BARRA = 760;
const Y0 = 84;
const ALTURA_LINHA = 88;
/** A escala: 10^0 … 10^8, e o que passa disso encosta no fim (e diz quanto). */
const DECADAS = 8;
const progresso = (ops: number) => Math.min(1, Math.max(0.012, Math.log10(Math.max(1, ops)) / DECADAS));

const TOM: Readonly<Record<Classe, "kind-1" | "kind-2" | "kind-3" | "kind-4" | "kind-5" | "live">> = {
  constant: "kind-3",
  log: "kind-4",
  linear: "kind-1",
  nlogn: "kind-2",
  quadratic: "kind-5",
  exponential: "live",
};
export const TOM_DA_CLASSE = TOM;

const fmt = (x: number) => (x >= 1e9 ? x.toExponential(1) : Math.round(x).toLocaleString("en-US"));

export function linhasEm(n: number, anterior?: number): LinhaDoCrescimento[] {
  return CLASSES.map((c) => {
    const ficha = FICHAS_DAS_CLASSES[c];
    const medido = n <= ficha.ate;
    const ops = medido ? medir(c, n) : ficha.referencia(n);
    const antes = anterior !== undefined && anterior <= ficha.ate ? medir(c, anterior) : undefined;
    return { classe: c, notacao: ficha.notacao, algoritmo: ficha.algoritmo, ops, medido, razao: antes !== undefined && medido ? ops / antes : undefined, tempo: duracao(tempoEstimado(c, n)) };
  });
}

export function filmeDoCrescimento(): Film<DetalheDoCrescimento> {
  const f = film<DetalheDoCrescimento>({ width: LARGURA_DO_CRESCIMENTO, height: ALTURA_DO_CRESCIMENTO, gap: 350, maxZoom: 1.4 });
  f.add({ type: "note", id: "titulo", at: pt(LARGURA_DO_CRESCIMENTO / 2, 40), label: "n = 8", tone: "ink", width: 600, icon: ICONES_ALGO.contador });
  for (let k = 0; k <= DECADAS; k += 2) f.add({ type: "note", id: `escala:${k}`, at: pt(X_BARRA + (W_BARRA * k) / DECADAS, Y0 + ALTURA_LINHA * 6 + 6), label: k === 0 ? "1" : `10${"⁰¹²³⁴⁵⁶⁷⁸"[k]}`, tone: "muted", width: 60 });
  CLASSES.forEach((c, k) => {
    const y = Y0 + k * ALTURA_LINHA;
    const ficha = FICHAS_DAS_CLASSES[c];
    f.add({ type: "node", id: `classe:${c}`, box: { x: 60, y, w: 340, h: ALTURA_LINHA - 22 }, label: ficha.notacao, sublabel: ficha.algoritmo, tone: TOM[c], shape: "box" });
    f.add({ type: "bar", id: `barra:${c}`, box: { x: X_BARRA, y: y + 14, w: W_BARRA, h: ALTURA_LINHA - 50 }, grow: "right", tone: TOM[c], hidden: true, label: "" });
  });

  const primeiro = NS_DO_FILME[0]!;
  f.chapter(
    { id: "six", title: "Six algorithms, six ways to grow", body: "Each bar is work an algorithm counted while it ran — reads, comparisons, subsets tried. The scale is logarithmic: every tick is ten times the last. Watch what happens to each bar as n grows.", detail: { n: primeiro, linhas: linhasEm(primeiro) } },
    (d) => {
      d.camera({ at: { cx: LARGURA_DO_CRESCIMENTO / 2, cy: ALTURA_DO_CRESCIMENTO / 2, zoom: 1 } });
      for (const l of linhasEm(primeiro)) {
        d.show(`barra:${l.classe}`, { dur: 1, wait: false });
        d.to(`barra:${l.classe}`, { progress: progresso(l.ops) }, { dur: 600, wait: false });
        d.set(`barra:${l.classe}`, { label: fmt(l.ops) });
      }
      d.wait(2000);
    },
  );

  for (let k = 1; k < NS_DO_FILME.length; k += 1) {
    const n = NS_DO_FILME[k]!;
    const antes = NS_DO_FILME[k - 1]!;
    const linhas = linhasEm(n, antes);
    const exp = linhas.find((l) => l.classe === "exponential")!;
    const corpo =
      n <= 16
        ? `n went from ${antes} to ${n}. The constant did not move; the logarithm added a step; the linear doubled; the quadratic quadrupled — and the exponential squared.`
        : exp.medido
          ? `n = ${n}.`
          : `n = ${n}. The quadratic did ${fmt(linhas.find((l) => l.classe === "quadratic")!.ops)} comparisons. The exponential was not run: 2^${n} subsets would take ${exp.tempo} at a billion per second.`;
    f.chapter({ id: `n-${n}`, title: `n = ${n}`, body: corpo, detail: { n, linhas } }, (d) => {
      d.set("titulo", { label: `n = ${n}` }).ping("titulo");
      for (const l of linhas) {
        d.to(`barra:${l.classe}`, { progress: progresso(l.ops) }, { dur: 900, wait: false });
        d.set(`barra:${l.classe}`, { label: l.medido ? fmt(l.ops) : `not run · ${l.tempo}` });
        if (!l.medido) d.glow(`classe:${l.classe}`).ping(`barra:${l.classe}`);
      }
      d.wait(2600);
    });
  }

  const fim = NS_DO_FILME.at(-1)!;
  f.chapter(
    {
      id: "doubling",
      title: "The doubling test",
      body: `Double n and divide: that ratio names the class. Measured from ${fim / 2} to ${fim}: ${CLASSES.filter((c) => c !== "exponential")
        .map((c) => {
          const m = curva(c).find((x) => x.n === fim)!;
          return `${FICHAS_DAS_CLASSES[c].notacao} ×${m.razao!.toFixed(2)}`;
        })
        .join(", ")}. It is how you find the class of code nobody documented: run it twice and measure.`,
      detail: { n: fim, linhas: linhasEm(fim, fim / 2) },
    },
    (d) => {
      d.stagger(CLASSES, 200, (x, c) => x.glow(`classe:${c}`).ping(`classe:${c}`));
      d.wait(2600);
    },
  );
  return f.build();
}
