import {
  ALGORITMOS,
  aplicarOperacao,
  CLASSES_DE_ORDENACAO,
  curvaDeOrdenacao,
  custo,
  entrada,
  ErroDeVetor,
  FICHAS,
  FORMATO_ROTULO,
  FORMATOS,
  lerVetor,
  ordenar,
  podio,
  type Algoritmo,
  type ClasseDeOrdenacao,
  type Formato,
  type Operacao,
  type Traco,
} from "@ovh/algo-domain";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { som, tomDe } from "../lib/som";
import { css, misturar, rampa, usePaleta, type Paleta } from "../lib/tinta";
import { BotaoSom, GraficoVivo, Narrador, ProgressoVivo, Pseudocodigo, tomDaPista, useRelogio, type CapituloDoShowcase, type Serie } from "./CorridaKit";
import { ModosDoLab } from "./ModosDoLab";

/** O vetor de uma pista em `k`, mantido entre quadros: avançar aplica só as operações novas. */
function useVetorNoPasso(t: Traco, k: number): { v: readonly number[]; op: Operacao | undefined } {
  const estado = useRef<{ t: Traco; v: number[]; feito: number } | null>(null);
  if (estado.current === null || estado.current.t !== t || k < estado.current.feito) estado.current = { t, v: [...t.entrada], feito: 0 };
  const e = estado.current;
  const ate = Math.min(k, t.ops.length);
  for (let i = e.feito; i < ate; i += 1) aplicarOperacao(e.v, t.ops[i]!);
  e.feito = ate;
  return { v: e.v, op: ate === 0 ? undefined : t.ops[ate - 1] };
}

interface PropsDaPista {
  readonly t: Traco;
  readonly k: number;
  readonly paleta: Paleta;
  readonly rotulo: string;
  /** Onde a pista soa, de −1 (esquerda) a 1 (direita). */
  readonly pan: number;
  readonly venceu: boolean;
  readonly indice: number;
}

/**
 * As barras de uma pista, num canvas. Cor = valor (a rampa do catálogo, do
 * frio ao quente); a operação de agora acende — clara ao comparar, viva ao
 * trocar ou escrever, alta ao ler. Ao terminar, uma onda passa da esquerda para
 * a direita conferindo a ordem.
 */
const PistaDeBarras = memo(function PistaDeBarras({ t, k, paleta: p, rotulo, pan, venceu, indice }: PropsDaPista) {
  const caixa = useRef<HTMLDivElement>(null);
  const tela = useRef<HTMLCanvasElement>(null);
  const [largura, setLargura] = useState(0);
  const { v, op } = useVetorNoPasso(t, k);
  const terminou = k >= t.ops.length;
  const [onda, setOnda] = useState(0);
  useEffect(() => {
    const el = caixa.current;
    if (el === null) return;
    const ro = new ResizeObserver(([e]) => setLargura(Math.floor(e!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (!terminou) {
      setOnda(0);
      return;
    }
    let id = 0;
    const t0 = performance.now();
    const passo = (agora: number) => {
      const f = Math.min(1, (agora - t0) / 800);
      setOnda(f);
      if (f < 1) id = requestAnimationFrame(passo);
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, [terminou, t]);

  const min = useMemo(() => Math.min(...t.entrada), [t]);
  const max = useMemo(() => Math.max(...t.entrada), [t]);

  // O som de verdade: o tom é o VALOR do item que a última operação tocou —
  // uma ordenação que termina soa como uma escala subindo.
  const ouvido = useRef(0);
  useEffect(() => {
    const k0 = ouvido.current;
    const k1 = Math.min(k, t.ops.length);
    ouvido.current = k1;
    if (k1 <= k0 || op === undefined) return;
    const faixa = max - min || 1;
    if (k1 < t.ops.length) {
      const pos = op.tipo === "compare" || op.tipo === "swap" ? op.j : op.i;
      som.nota(tomDe((v[pos]! - min) / faixa), { pista: `barras${indice}`, pan, onda: op.tipo === "compare" ? "triangle" : op.tipo === "read" ? "sine" : "square", ganho: op.tipo === "compare" ? 0.055 : 0.035, dur: 0.05 });
    } else {
      // A onda de conferência: uma escala subindo enquanto ela passa.
      for (let j = 0; j < 10; j += 1) som.nota(tomDe(j / 9), { quando: j * 0.075, pan, onda: "sine", ganho: 0.06, dur: 0.12, pista: `onda${indice}-${j}` });
      if (venceu) som.chegada(523.25, pan);
    }
  }, [k, t, op, v, min, max, pan, venceu, indice]);
  useEffect(() => {
    const cv = tela.current;
    if (cv === null || largura === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = largura;
    const H = Math.round(Math.min(220, Math.max(120, W * 0.5)));
    if (cv.width !== Math.round(W * dpr)) cv.width = Math.round(W * dpr);
    if (cv.height !== Math.round(H * dpr)) cv.height = Math.round(H * dpr);
    cv.style.height = `${H}px`;
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = css(p.fundo);
    ctx.fillRect(0, 0, W, H);
    const n = v.length;
    const passo = W / n;
    const folga = passo > 4 ? Math.min(2, passo * 0.18) : 0;
    const tocados = new Map<number, Operacao["tipo"]>();
    if (op !== undefined && !terminou) {
      tocados.set(op.i, op.tipo);
      if (op.tipo === "compare" || op.tipo === "swap") tocados.set(op.j, op.tipo);
    }
    const faixa = max - min || 1;
    for (let i = 0; i < n; i += 1) {
      const f = (v[i]! - min) / faixa;
      const h = 4 + f * (H - 10);
      const x = i * passo;
      const tipo = tocados.get(i);
      let cor = rampa(p, f);
      if (terminou && i / n <= onda) cor = misturar(cor, p.ok, 0.75);
      if (tipo === "compare") cor = p.claro;
      else if (tipo === "swap" || tipo === "write") cor = p.viva;
      else if (tipo === "read") cor = p.alto;
      ctx.fillStyle = css(cor, tipo === undefined ? 0.92 : 1);
      ctx.fillRect(x + folga / 2, H - h, Math.max(0.6, passo - folga), h);
      if (tipo !== undefined && passo > 2) {
        // Um halo de luz na barra tocada: disco translúcido, sem filtro.
        ctx.fillStyle = css(cor, 0.25);
        ctx.fillRect(x - passo * 0.5, H - h - 6, passo * 2, h + 6);
      }
    }
    if (terminou && onda < 1) {
      const x = onda * W;
      const g = ctx.createLinearGradient(x - 40, 0, x, 0);
      g.addColorStop(0, css(p.claro, 0));
      g.addColorStop(1, css(p.claro, 0.55));
      ctx.fillStyle = g;
      ctx.fillRect(x - 40, 0, 40, H);
    }
  });
  return (
    <div ref={caixa} className="barras-pista">
      <canvas ref={tela} className="barras-tela" role="img" aria-label={rotulo} />
    </div>
  );
});

/** Quantos itens já estão na posição final — a medida de "quão ordenado", em O(n). */
function noLugar(v: readonly number[], final: readonly number[]): number {
  let c = 0;
  for (let i = 0; i < v.length; i += 1) if (v[i] === final[i]) c += 1;
  return c;
}

function contagens(t: Traco, k: number) {
  let cmp = 0;
  let trc = 0;
  let esc = 0;
  let lei = 0;
  const ate = Math.min(k, t.ops.length);
  for (let i = 0; i < ate; i += 1) {
    const tipo = t.ops[i]!.tipo;
    if (tipo === "compare") cmp += 1;
    else if (tipo === "swap") trc += 1;
    else if (tipo === "write") esc += 1;
    else lei += 1;
  }
  return { cmp, trc, esc, lei };
}

function Raia({ t, k, i, n, paleta, lugar, pan }: { t: Traco; k: number; i: number; n: number; paleta: Paleta; lugar: number | undefined; pan: number }) {
  const f = FICHAS[t.algoritmo];
  const c = contagens(t, k);
  const fim = k >= t.ops.length;
  return (
    <section className="barras-cartao" data-tone={tomDaPista(i)} data-fim={fim ? "" : undefined} aria-label={`${f.nome} lane`}>
      <header>
        <b>{f.nome}</b>
        <small className="mono">{f.medio}</small>
      </header>
      <PistaDeBarras t={t} k={k} paleta={paleta} pan={pan} venceu={lugar === 1} indice={i} rotulo={`${f.nome}: ${fim ? "sorted" : "sorting"}, ${n} items`} />
      <ProgressoVivo fracao={t.ops.length === 0 ? 1 : Math.min(k, t.ops.length) / t.ops.length} fim={fim} lugar={lugar} rotulo={`${f.nome} progress`} />
      <p className="algo-cont mono">
        <span>
          <b translate="no">{c.cmp}</b> compares
        </span>
        <span>
          <b translate="no">{c.trc}</b> swaps
        </span>
        <span>
          <b translate="no">{c.esc}</b> writes
        </span>
        {c.lei > 0 ? (
          <span>
            <b translate="no">{c.lei}</b> reads
          </span>
        ) : null}
        <span>{t.memoriaExtra > 0 ? `+${t.memoriaExtra} memory` : "in place"}</span>
      </p>
    </section>
  );
}

function Corrida({ tracos, passo, paleta }: { tracos: readonly Traco[]; passo: number; paleta: Paleta }) {
  const lug = useMemo(() => new Map(podio(tracos).map((c) => [c.algoritmo, c.lugar])), [tracos]);
  return (
    <div className="barras-pistas" data-n={tracos.length}>
      {tracos.map((t, i) => (
        <Raia key={`${t.algoritmo}-${i}`} t={t} k={passo} i={i} n={t.entrada.length} paleta={paleta} lugar={lug.get(t.algoritmo)} pan={tracos.length === 1 ? 0 : -0.85 + (1.7 * i) / (tracos.length - 1)} />
      ))}
    </div>
  );
}

const ritmoPara = (ts: readonly Traco[], segundos: number) => Math.max(1, Math.ceil(Math.max(1, ...ts.map((t) => t.ops.length)) / (segundos * 60)));

// ---------------------------------------------------------------------------------------- showcase

interface CapituloDaOrdenacao extends CapituloDoShowcase {
  readonly algoritmos: readonly Algoritmo[];
  readonly formato: Formato;
  readonly n: number;
  readonly segundos: number;
}

const CAPITULOS: readonly CapituloDaOrdenacao[] = [
  {
    id: "quadratic",
    titulo: "The O(n²) class: three ways to be slow",
    texto: "Sixty-four scattered bars, three algorithms from the same class, one clock. Each step is one comparison, swap or write. They all do about n²/4 to n²/2 steps on random data — the race is decided by constants, and you can hear it.",
    olhe: ["Bubble sort pushes the largest bar to the end on every pass.", "Insertion sort grows a sorted run on the left.", "Selection sort scans everything, then makes one swap."],
    algoritmos: ["bubble", "insertion", "selection"],
    formato: "random",
    n: 64,
    segundos: 14,
  },
  {
    id: "linearithmic",
    titulo: "The O(n log n) class: divide, partition, heap",
    texto: "Two hundred bars. Merge sort splits and merges using extra memory; quicksort partitions around a pivot; heapsort builds a heap and peels off the largest. Each item is touched about log₂ 200 ≈ 8 times.",
    olhe: ["Merge sort finishes in sorted runs that double in size.", "Quicksort sorts in blocks either side of each pivot.", "Heapsort grows the sorted part from the right."],
    algoritmos: ["merge", "quick", "heap"],
    formato: "random",
    n: 200,
    segundos: 12,
  },
  {
    id: "exponent",
    titulo: "The exponent beats the constant",
    texto: "Insertion sort against merge sort on the same 200 bars. Insertion sort has the smaller constant and wins on tiny arrays — at 200 items the n² has already caught up with it.",
    olhe: ["Merge sort finishes while insertion is still sliding bars.", "The gap grows with n: try 256 in the simulation."],
    algoritmos: ["insertion", "merge"],
    formato: "random",
    n: 200,
    segundos: 14,
  },
  {
    id: "input",
    titulo: "The input decides: an already sorted array",
    texto: "150 bars, already in order. Insertion sort checks each neighbour once and stops: n − 1 comparisons. Quicksort, with the last item as pivot, splits every range into nothing and everything — its worst case, n²/2.",
    olhe: ["Insertion finishes almost instantly.", "Quicksort crawls: every partition is as unbalanced as possible."],
    algoritmos: ["insertion", "quick", "merge"],
    formato: "sorted",
    n: 150,
    segundos: 10,
  },
  {
    id: "nearly",
    titulo: "Nearly sorted: insertion sort's home turf",
    texto: "Real data is often almost in order — a log with a few late entries, a list after one edit. Here 5 % of the items are a step or two out of place. Insertion sort only pays for what is out of order.",
    olhe: ["Insertion fixes the few strays and is done.", "Heapsort does the full n log n regardless."],
    algoritmos: ["insertion", "merge", "heap"],
    formato: "nearly-sorted",
    n: 200,
    segundos: 10,
  },
  {
    id: "linear",
    titulo: "No comparisons at all",
    texto: "Counting sort and radix sort never ask “is this bigger than that?”. They read each value and send it where it belongs: counting sort with one counter per value, radix sort with ten buckets per digit. They beat the n log n limit because the values are small whole numbers — that limit only binds algorithms that compare.",
    olhe: ["Watch the reads (highlighted) instead of comparisons.", "Radix sort makes one pass per digit: ones, tens, hundreds."],
    algoritmos: ["counting", "radix", "quick"],
    formato: "random",
    n: 256,
    segundos: 9,
  },
];

function Vitrine({ paleta }: { paleta: Paleta }) {
  const [cap, setCap] = useState(0);
  const [auto, setAuto] = useState(true);
  const [comecou, setComecou] = useState(false);
  const c = CAPITULOS[cap]!;
  const tracos = useMemo(() => {
    const v = entrada(c.formato, c.n, 5);
    return c.algoritmos.map((a) => ordenar(a, v));
  }, [cap]);
  const total = Math.max(...tracos.map((t) => t.ops.length));
  const prox = useRef<number | null>(null);
  const relogio = useRelogio(total, ritmoPara(tracos, c.segundos), () => {
    if (!auto) return;
    prox.current = window.setTimeout(() => setCap((k) => (k + 1) % CAPITULOS.length), 3000);
  });
  useEffect(() => {
    relogio.ir(0);
    relogio.setRitmo(ritmoPara(tracos, c.segundos));
    if (comecou) relogio.tocar();
    return () => {
      if (prox.current !== null) clearTimeout(prox.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cap]);
  const ultimo = tracos.at(-1)!;
  const ativa = Math.min(relogio.passo, ultimo.ops.length) === 0 ? undefined : ultimo.ops[Math.min(relogio.passo, ultimo.ops.length) - 1]!.linha;
  return (
    <div className="algo barras" data-testid="sorting-showcase">
      <Narrador
        capitulos={CAPITULOS}
        atual={cap}
        irPara={(k) => {
          setComecou(true);
          setCap(k);
        }}
        rodape={<Pseudocodigo linhas={FICHAS[ultimo.algoritmo].pseudo} ativa={ativa} titulo={`${FICHAS[ultimo.algoritmo].nome}, line by line`} />}
      >
        <div className="algo-transporte">
          <button
            type="button"
            className="algo-btn algo-btn--grande"
            onClick={() => {
              setComecou(true);
              relogio.tocando ? relogio.pausar() : relogio.tocar();
            }}
          >
            {relogio.tocando ? "Pause" : comecou ? "Play" : "▶ Play the showcase"}
          </button>
          <BotaoSom />
          <label className="ctxlab-switch" htmlFor="barras-auto">
            <input id="barras-auto" type="checkbox" role="switch" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            <span className="ctxlab-switch__track" aria-hidden="true">
              <span />
            </span>
            <span>Next chapter by itself</span>
          </label>
          <output className="mono">
            {c.n} items · {FORMATO_ROTULO[c.formato]}
          </output>
        </div>
        <Corrida tracos={tracos} passo={relogio.passo} paleta={paleta} />
      </Narrador>
    </div>
  );
}

// ---------------------------------------------------------------------------------------- simulação

const TAMANHOS = [16, 32, 64, 128, 200, 256] as const;
const MAIS_PISTAS = 4;
const NS_DO_GRAFICO = [8, 16, 32, 64, 128, 256, 512, 1024];

function Simulacao({ paleta }: { paleta: Paleta }) {
  const [n, setN] = useState<number>(64);
  const [formato, setFormato] = useState<Formato>("random");
  const [semente, setSemente] = useState(1);
  const [proprio, setProprio] = useState("");
  const [algoritmos, setAlgoritmos] = useState<readonly Algoritmo[]>(CLASSES_DE_ORDENACAO.quadratic.algoritmos);
  const [focada, setFocada] = useState(0);
  const leitura = useMemo((): { v: number[] } | { erro: string } => {
    if (proprio.trim() === "") return { v: entrada(formato, n, semente) };
    try {
      return { v: lerVetor(proprio) };
    } catch (e) {
      return { erro: e instanceof ErroDeVetor ? e.message : String(e) };
    }
  }, [proprio, formato, n, semente]);
  const v = "v" in leitura ? leitura.v : entrada(formato, n, semente);
  const chave = v.join(",");
  const tracos = useMemo(() => algoritmos.map((a) => ordenar(a, v)), [chave, algoritmos]);
  const total = Math.max(1, ...tracos.map((t) => t.ops.length));
  const relogio = useRelogio(total, ritmoPara(tracos, 12));
  useEffect(() => {
    relogio.ir(0);
    relogio.setRitmo(ritmoPara(tracos, 12));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracos]);

  // Ao vivo: % dos itens já no lugar final, ao longo da corrida (amostrado).
  const final = useMemo(() => [...v].sort((a, b) => a - b), [chave]);
  const aoVivo: Serie[] = useMemo(() => {
    const amostra = Math.max(1, Math.floor(total / 100));
    return tracos.map((t, i) => {
      const arr = [...t.entrada];
      const pts: [number, number][] = [[0, (100 * noLugar(arr, final)) / arr.length]];
      const ate = Math.min(relogio.passo, t.ops.length);
      for (let k = 0; k < ate; k += 1) {
        aplicarOperacao(arr, t.ops[k]!);
        if ((k + 1) % amostra === 0 || k === ate - 1) pts.push([k + 1, (100 * noLugar(arr, final)) / arr.length]);
      }
      return { id: t.algoritmo, nome: FICHAS[t.algoritmo].nome, tom: tomDaPista(i), pontos: pts };
    });
  }, [tracos, relogio.passo, total, final]);

  // Big-O: trabalho contado de n = 8 a 1024 para as algoritmos da corrida, com a referência tracejada.
  const curvas: Serie[] = useMemo(() => {
    const medidas = algoritmos.map((a, i) => ({ id: a, nome: FICHAS[a].nome, tom: tomDaPista(i), pontos: curvaDeOrdenacao(a, formato === "few-unique" ? "random" : formato, NS_DO_GRAFICO, 3).map((p) => [p.n, p.custo] as const) }));
    const ref = (nome: string, f: (x: number) => number): Serie => ({ id: nome, nome, tom: "muted", pontos: NS_DO_GRAFICO.map((x) => [x, f(x)] as const), tracejada: true });
    return [...medidas, ref("n²/2", (x) => (x * x) / 2), ref("n log₂ n", (x) => x * Math.log2(x)), ref("n", (x) => x)];
  }, [algoritmos, formato]);

  const alternar = (a: Algoritmo) => {
    if (algoritmos.includes(a)) {
      if (algoritmos.length > 1) setAlgoritmos(algoritmos.filter((x) => x !== a));
    } else if (algoritmos.length < MAIS_PISTAS) setAlgoritmos([...algoritmos, a]);
  };
  const f = Math.min(focada, tracos.length - 1);
  const tf = tracos[f]!;
  const kf = Math.min(relogio.passo, tf.ops.length);
  const ordenados = [...tracos].sort((a, b) => custo(a) - custo(b));
  const lug = new Map(podio(tracos).map((c) => [c.algoritmo, c.lugar]));

  return (
    <div className="algo barras" data-testid="sorting-race">
      <div className="algo-controles">
        <div className="algo-seg" role="group" aria-label="Race a class">
          {(Object.keys(CLASSES_DE_ORDENACAO) as ClasseDeOrdenacao[]).map((k) => (
            <button key={k} type="button" aria-pressed={CLASSES_DE_ORDENACAO[k].algoritmos.join() === algoritmos.join()} onClick={() => setAlgoritmos(CLASSES_DE_ORDENACAO[k].algoritmos)}>
              {CLASSES_DE_ORDENACAO[k].notacao} · {CLASSES_DE_ORDENACAO[k].nome}
            </button>
          ))}
        </div>
        <fieldset>
          <legend>Racing (up to {MAIS_PISTAS})</legend>
          {ALGORITMOS.map((a) => (
            <label key={a}>
              <input type="checkbox" checked={algoritmos.includes(a)} onChange={() => alternar(a)} disabled={!algoritmos.includes(a) && algoritmos.length >= MAIS_PISTAS} />
              {FICHAS[a].nome}
            </label>
          ))}
        </fieldset>
        <label>
          Items
          <select aria-label="Items" value={n} onChange={(e) => setN(Number(e.target.value))} disabled={proprio.trim() !== ""}>
            {TAMANHOS.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
        <label>
          Input
          <select aria-label="Input" value={formato} onChange={(e) => setFormato(e.target.value as Formato)} disabled={proprio.trim() !== ""}>
            {FORMATOS.map((x) => (
              <option key={x} value={x}>
                {FORMATO_ROTULO[x]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="algo-btn" onClick={() => setSemente((s) => s + 1)} disabled={proprio.trim() !== "" || formato === "sorted" || formato === "reversed"}>
          Shuffle again
        </button>
        <label>
          Or type your own list
          <input type="text" value={proprio} placeholder="e.g. 5 3 8 1 9 2" onChange={(e) => setProprio(e.target.value)} spellCheck={false} />
        </label>
      </div>
      {"erro" in leitura ? (
        <p className="algo-erro" role="alert">
          {leitura.erro}
        </p>
      ) : null}

      <div className="algo-transporte">
        <button type="button" className="algo-btn algo-btn--grande" onClick={() => (relogio.tocando ? relogio.pausar() : relogio.tocar())}>
          {relogio.tocando ? "Pause" : relogio.passo >= total ? "Race again" : relogio.passo === 0 ? "▶ Start the race" : "Resume"}
        </button>
        <button type="button" className="algo-btn" onClick={() => relogio.ir(relogio.passo + 1)} disabled={relogio.tocando}>
          One step
        </button>
        <BotaoSom />
        <label className="algo-nota">
          Speed{" "}
          <select aria-label="Speed" value={relogio.ritmo} onChange={(e) => relogio.setRitmo(Number(e.target.value))}>
            {[...new Set([1, 2, 5, 15, 40, 120, ritmoPara(tracos, 12)])]
              .sort((a, b) => a - b)
              .map((r) => (
                <option key={r} value={r}>
                  {r} steps per frame
                </option>
              ))}
          </select>
        </label>
        <input type="range" min={0} max={total} value={relogio.passo} aria-label="Race clock, in steps" onChange={(e) => relogio.ir(Number(e.target.value))} />
        <output className="mono">
          step <span translate="no">{relogio.passo}</span> of {total}
        </output>
      </div>
      <p className="algo-nota">One step = one comparison, swap, write or read. Every lane gets the same clock, so the one that finishes first did the least work on this input. The pitch you hear is the value being touched: a sorted run sounds like a rising scale.</p>

      <Corrida tracos={tracos} passo={relogio.passo} paleta={paleta} />

      <div className="mapa-baixo">
        <div>
          <div className="algo-seg" role="group" aria-label="Pseudocode of">
            {tracos.map((t, i) => (
              <button key={t.algoritmo} type="button" aria-pressed={i === f} onClick={() => setFocada(i)}>
                {FICHAS[t.algoritmo].nome}
              </button>
            ))}
          </div>
          <Pseudocodigo linhas={FICHAS[tf.algoritmo].pseudo} ativa={kf === 0 ? undefined : tf.ops[kf - 1]!.linha} titulo={`${FICHAS[tf.algoritmo].nome} — the line running now`} />
          <p className="algo-nota">{FICHAS[tf.algoritmo].regra}</p>
        </div>
        <div>
          <GraficoVivo series={aoVivo} titulo="Items already in their final place, as the race runs" eixoX="race clock (steps)" eixoY="% in place" xMax={total} yMax={100} />
          <GraficoVivo series={curvas} titulo="Big-O: steps counted as n doubles (log–log), formulas dashed" eixoX="n (items)" eixoY="steps" logX logY marcadorX={v.length} />
        </div>
      </div>

      <div className="algo-tabela">
        <table>
          <caption>
            The bill, counted ({v.length} items, {proprio.trim() !== "" ? "your list" : FORMATO_ROTULO[formato]})
          </caption>
          <thead>
            <tr>
              <th scope="col">Place</th>
              <th scope="col">Algorithm</th>
              <th scope="col" className="num">
                Compares
              </th>
              <th scope="col" className="num">
                Swaps
              </th>
              <th scope="col" className="num">
                Writes
              </th>
              <th scope="col" className="num">
                Reads
              </th>
              <th scope="col" className="num">
                Total steps
              </th>
              <th scope="col">Class (avg · worst)</th>
              <th scope="col">Extra memory</th>
            </tr>
          </thead>
          <tbody>
            {ordenados.map((t) => (
              <tr key={t.algoritmo} data-melhor={lug.get(t.algoritmo) === 1 ? "" : undefined}>
                <td>#{lug.get(t.algoritmo)}</td>
                <td>{FICHAS[t.algoritmo].nome}</td>
                <td className="num">{t.comparacoes}</td>
                <td className="num">{t.trocas}</td>
                <td className="num">{t.escritas}</td>
                <td className="num">{t.leituras}</td>
                <td className="num">{custo(t)}</td>
                <td>
                  {FICHAS[t.algoritmo].medio} · {FICHAS[t.algoritmo].pior}
                </td>
                <td>{t.memoriaExtra > 0 ? `${t.memoriaExtra} slots` : "none"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ComPaleta({ filho }: { filho: (p: Paleta) => React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const paleta = usePaleta(ref);
  return <div ref={ref}>{paleta === null ? null : filho(paleta)}</div>;
}

export function CorridaModos() {
  return <ModosDoLab showcase={() => <ComPaleta filho={(p) => <Vitrine paleta={p} />} />} simulation={() => <ComPaleta filho={(p) => <Simulacao paleta={p} />} />} inicial="showcase" />;
}
