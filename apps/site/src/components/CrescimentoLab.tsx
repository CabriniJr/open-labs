import {
  buscaBinaria,
  buscaLinear,
  CLASSES,
  curva,
  duracao,
  entrada,
  FICHAS_DAS_CLASSES,
  filmeDoCrescimento,
  lerPosicao,
  ordenar,
  somaDeSubconjunto,
  TAMANHOS,
  tempoEstimado,
  TOM_DA_CLASSE,
  type Classe,
  type DetalheDoCrescimento,
} from "@ovh/algo-domain";
import { MotionPlayer } from "@ovh/motion/react";
import { useEffect, useMemo, useState } from "react";
import { ModosDoLab } from "./ModosDoLab";

const fmt = (x: number) => (x >= 1e9 ? x.toExponential(2) : Math.round(x).toLocaleString("en-US"));

function Vitrine() {
  const filme = useMemo(() => filmeDoCrescimento(), []);
  return (
    <div className="cpuvit algo" data-testid="growth-showcase">
      <MotionPlayer
        film={filme}
        label="Six bars, one per complexity class, growing on a logarithmic scale as n doubles from 8 to 4096. Each bar is work counted by a real algorithm."
        renderDetail={(frame) => {
          const d: DetalheDoCrescimento | undefined = frame.detail;
          if (d === undefined) return null;
          return (
            <div className="algo-detalhe">
              <p className="algo-h">n = {d.n}</p>
              <div className="algo-tabela">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Class</th>
                      <th scope="col" className="num">
                        Work
                      </th>
                      <th scope="col" className="num">
                        Ratio
                      </th>
                      <th scope="col">At 1 GHz</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.linhas.map((l) => (
                      <tr key={l.classe}>
                        <td data-tone={TOM_DA_CLASSE[l.classe]}>
                          <span className="algo-chip" aria-hidden="true" />
                          {l.notacao}
                        </td>
                        <td className="num">{l.medido ? fmt(l.ops) : `≈ ${fmt(l.ops)}`}</td>
                        <td className="num">{l.razao === undefined ? "—" : `×${l.razao.toFixed(2)}`}</td>
                        <td>{l.tempo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="algo-nota">≈ = not run; the formula, because running it would never finish.</p>
            </div>
          );
        }}
      />
    </div>
  );
}

/** A entrada de cada classe, preparada FORA do relógio: sortear o vetor não é o que se mede. */
function preparar(classe: Classe, n: number): number[] {
  if (classe === "nlogn" || classe === "quadratic") return entrada("random", n, 1);
  if (classe === "exponential") return Array.from({ length: n }, (_, k) => 2 * (k + 1));
  return entrada("sorted", n);
}

/** Roda uma vez. O merge e a seleção ordenam uma cópia; as buscas só leem. */
function rodar(classe: Classe, v: readonly number[]): void {
  const n = v.length;
  switch (classe) {
    case "constant":
      lerPosicao(v, n >> 1);
      return;
    case "log":
      buscaBinaria(v, n + 1);
      return;
    case "linear":
      buscaLinear(v, n + 1);
      return;
    case "nlogn":
      ordenar("merge", v, false);
      return;
    case "quadratic":
      ordenar("selection", v, false);
      return;
    case "exponential":
      somaDeSubconjunto(v, 1);
  }
}

interface Tempo {
  readonly classe: Classe;
  readonly n: number;
  /** Microssegundos por execução. */
  readonly us: number;
}

/**
 * Cronometra repetindo até passar de 4 ms: um O(1) leva nanossegundos, e
 * `performance.now()` não enxerga uma execução só. Tamanhos que custariam mais
 * de ~150 ms ficam de fora, e a tabela diz isso.
 */
function cronometrar(classe: Classe, n: number): number | undefined {
  if (classe === "exponential" && n > 18) return undefined;
  if (classe === "quadratic" && n > 4096) return undefined;
  const v = preparar(classe, n);
  let reps = 0;
  const t0 = performance.now();
  let agora = t0;
  do {
    rodar(classe, v);
    reps += 1;
    agora = performance.now();
  } while (agora - t0 < 4 && reps < 1_000_000);
  return ((agora - t0) / reps) * 1000;
}

/** O eixo do tempo, de 10 ns a 1 s, uma década por marca. */
const ROTULO_DO_TEMPO = ["10 ns", "100 ns", "1 µs", "10 µs", "100 µs", "1 ms", "10 ms", "100 ms", "1 s"];

function Grafico({ visiveis, referencia, nSel, tempos }: { visiveis: ReadonlySet<Classe>; referencia: boolean; nSel: number; tempos: readonly Tempo[] | null }) {
  const W = 760;
  const H = 400;
  const M = { l: 64, r: 20, t: 20, b: 44 };
  const x = (n: number) => M.l + ((Math.log2(n) - 1) / (Math.log2(4096) - 1)) * (W - M.l - M.r);
  const DEC = 8;
  const y = (v: number) => M.t + (1 - Math.min(DEC, Math.log10(Math.max(1, v))) / DEC) * (H - M.t - M.b);
  const usandoTempo = tempos !== null;
  // Em tempo, a escala é µs de 10⁻² a 10⁶ — o mesmo desenho, deslocado.
  const yT = (us: number) => M.t + (1 - (Math.log10(Math.max(0.01, us)) + 2) / DEC) * (H - M.t - M.b);
  return (
    <svg className="algo-svg algo-grafico" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={usandoTempo ? "Measured time per run against n, both on logarithmic scales" : "Counted work against n, both on logarithmic scales, one line per class"}>
      {Array.from({ length: DEC + 1 }, (_, k) => {
        const yy = M.t + (1 - k / DEC) * (H - M.t - M.b);
        return (
          <g key={k}>
            <line className="algo-grade" x1={M.l} x2={W - M.r} y1={yy} y2={yy} />
            <text x={M.l - 8} y={yy + 4} textAnchor="end" className="algo-fraco">
              {usandoTempo ? ROTULO_DO_TEMPO[k] : k === 0 ? "1" : `10^${k}`}
            </text>
          </g>
        );
      })}
      {TAMANHOS.map((n) => (
        <text key={n} x={x(n)} y={H - M.b + 18} textAnchor="middle" className="algo-fraco">
          {n}
        </text>
      ))}
      <text x={(W + M.l) / 2} y={H - 6} textAnchor="middle" className="algo-fraco">
        n (doubling)
      </text>
      <line className="algo-cursor" x1={x(nSel)} x2={x(nSel)} y1={M.t} y2={H - M.b} />
      {CLASSES.filter((c) => visiveis.has(c)).map((c) => {
        const tom = TOM_DA_CLASSE[c];
        if (usandoTempo) {
          const pts = tempos.filter((t) => t.classe === c);
          return (
            <g key={c} data-tone={tom}>
              <polyline className="algo-curva" points={pts.map((p) => `${x(p.n)},${yT(p.us)}`).join(" ")} />
              {pts.map((p) => (
                <circle key={p.n} className="algo-ponto" cx={x(p.n)} cy={yT(p.us)} r={3} />
              ))}
            </g>
          );
        }
        const medidas = curva(c).filter((m) => m.ops !== undefined);
        const ficha = FICHAS_DAS_CLASSES[c];
        const ultimo = medidas.at(-1)!;
        return (
          <g key={c} data-tone={tom}>
            {referencia ? <polyline className="algo-ref" points={TAMANHOS.filter((n) => ficha.referencia(n) <= 1e8).map((n) => `${x(n)},${y(ficha.referencia(n))}`).join(" ")} /> : null}
            <polyline className="algo-curva" points={medidas.map((m) => `${x(m.n)},${y(m.ops!)}`).join(" ")} />
            {medidas.map((m) => (
              <circle key={m.n} className="algo-ponto" cx={x(m.n)} cy={y(m.ops!)} r={3} />
            ))}
            <text x={Math.min(W - M.r - 4, x(ultimo.n) + 6)} y={y(ultimo.ops!) - 8} textAnchor={ultimo.n >= 2048 ? "end" : "start"} className="algo-rotulo" style={{ fill: "var(--algo-c)" }}>
              {ficha.notacao}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Simulacao() {
  const [visiveis, setVisiveis] = useState<ReadonlySet<Classe>>(new Set(CLASSES));
  const [referencia, setReferencia] = useState(true);
  const [indice, setIndice] = useState(5);
  const [porSegundo, setPorSegundo] = useState(1e9);
  const [tempos, setTempos] = useState<Tempo[] | null>(null);
  const [vendoTempo, setVendoTempo] = useState(false);
  const [medindo, setMedindo] = useState<string | null>(null);
  const nSel = TAMANHOS[indice]!;
  const curvas = useMemo(() => new Map(CLASSES.map((c) => [c, curva(c)])), []);

  useEffect(() => {
    if (medindo === null) return;
    let cancelado = false;
    const fila: [Classe, number][] = [];
    for (const c of CLASSES) for (const n of TAMANHOS) fila.push([c, n]);
    const saida: Tempo[] = [];
    const passo = () => {
      if (cancelado) return;
      const item = fila.shift();
      if (item === undefined) {
        setTempos(saida);
        setVendoTempo(true);
        setMedindo(null);
        return;
      }
      const [c, n] = item;
      setMedindo(`${FICHAS_DAS_CLASSES[c].notacao}, n = ${n}`);
      const us = cronometrar(c, n);
      if (us !== undefined) saida.push({ classe: c, n, us });
      setTimeout(passo, 0);
    };
    setTimeout(passo, 30);
    return () => {
      cancelado = true;
    };
    // Começa quando o leitor pede, e só então.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medindo === null]);

  const alternar = (c: Classe) => {
    const s = new Set(visiveis);
    if (s.has(c)) {
      if (s.size > 1) s.delete(c);
    } else s.add(c);
    setVisiveis(s);
  };
  const tempoMedido = (c: Classe, n: number) => tempos?.find((t) => t.classe === c && t.n === n)?.us;
  const razaoDoTempo = (c: Classe, n: number) => {
    const a = tempoMedido(c, n / 2);
    const b = tempoMedido(c, n);
    return a !== undefined && b !== undefined && a > 0 ? b / a : undefined;
  };

  return (
    <div className="algo" data-testid="growth-chart">
      <div className="algo-controles">
        <fieldset>
          <legend>Classes on the chart</legend>
          {CLASSES.map((c) => (
            <label key={c} data-tone={TOM_DA_CLASSE[c]}>
              <input type="checkbox" checked={visiveis.has(c)} onChange={() => alternar(c)} />
              <span className="algo-chip" aria-hidden="true" />
              {FICHAS_DAS_CLASSES[c].notacao}
            </label>
          ))}
        </fieldset>
        <label className="ctxlab-switch" htmlFor="cresc-ref">
          <input id="cresc-ref" type="checkbox" role="switch" checked={referencia} onChange={(e) => setReferencia(e.target.checked)} disabled={vendoTempo} />
          <span className="ctxlab-switch__track" aria-hidden="true">
            <span />
          </span>
          <span>Formula, dashed</span>
        </label>
        <label>
          n = {nSel}
          <input type="range" min={0} max={TAMANHOS.length - 1} value={indice} onChange={(e) => setIndice(Number(e.target.value))} aria-label="Pick n" />
        </label>
        <div className="algo-seg" role="group" aria-label="What the chart shows">
          <button type="button" aria-pressed={!vendoTempo} onClick={() => setVendoTempo(false)}>
            Counted work
          </button>
          <button type="button" aria-pressed={vendoTempo} onClick={() => setVendoTempo(true)} disabled={tempos === null}>
            Measured time
          </button>
        </div>
        <button type="button" className="algo-btn" onClick={() => setMedindo("starting")} disabled={medindo !== null}>
          {medindo === null ? (tempos === null ? "Time it on this device" : "Time it again") : `Timing ${medindo}…`}
        </button>
      </div>

      <Grafico visiveis={visiveis} referencia={referencia} nSel={nSel} tempos={vendoTempo ? tempos : null} />
      <p className="algo-nota">
        Both axes are logarithmic, so every straight line is a power law and its slope is the exponent: the linear line climbs one decade per decade of n, the quadratic two. On a log–log chart the exponential is the only curve that bends upward — and it leaves the chart before n = 32.
      </p>

      <div className="algo-tabela">
        <table>
          <caption>At n = {nSel}: what each class did, and the doubling test (work at n ÷ work at n/2)</caption>
          <thead>
            <tr>
              <th scope="col">Class</th>
              <th scope="col">Algorithm, counting</th>
              <th scope="col" className="num">
                Counted
              </th>
              <th scope="col" className="num">
                Doubling ratio
              </th>
              <th scope="col" className="num">
                Measured time
              </th>
              <th scope="col" className="num">
                Time ratio
              </th>
              <th scope="col">
                At{" "}
                <select value={porSegundo} onChange={(e) => setPorSegundo(Number(e.target.value))} aria-label="Operations per second">
                  <option value={1e6}>1 million</option>
                  <option value={1e9}>1 billion</option>
                  <option value={1e12}>1 trillion</option>
                </select>{" "}
                ops/s
              </th>
            </tr>
          </thead>
          <tbody>
            {CLASSES.map((c) => {
              const m = curvas.get(c)!.find((x) => x.n === nSel)!;
              const ficha = FICHAS_DAS_CLASSES[c];
              const t = tempoMedido(c, nSel);
              const rt = razaoDoTempo(c, nSel);
              return (
                <tr key={c}>
                  <td data-tone={TOM_DA_CLASSE[c]}>
                    <span className="algo-chip" aria-hidden="true" />
                    {ficha.notacao} <small>{ficha.nome}</small>
                  </td>
                  <td>
                    {ficha.algoritmo} — {ficha.conta}
                  </td>
                  <td className="num">{m.ops === undefined ? `not run (≈ ${fmt(ficha.referencia(nSel))})` : fmt(m.ops)}</td>
                  <td className="num">{m.razao === undefined ? "—" : `×${m.razao.toFixed(2)}`}</td>
                  <td className="num">{t === undefined ? "—" : t < 1 ? `${(t * 1000).toFixed(0)} ns` : t < 1000 ? `${t.toFixed(1)} µs` : `${(t / 1000).toFixed(1)} ms`}</td>
                  <td className="num">{rt === undefined ? "—" : `×${rt.toFixed(1)}`}</td>
                  <td>{duracao(tempoEstimado(c, nSel, porSegundo))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {tempos !== null ? (
        <p className="algo-nota">
          Measured on this device with <code>performance.now()</code>, repeating each run until 4 ms had passed. Small n is mostly noise (the timer, the JIT warming up); the ratios settle as n grows. The exponential is only timed up to n = 18.
        </p>
      ) : null}
    </div>
  );
}

export function CrescimentoModos() {
  return <ModosDoLab showcase={() => <Vitrine />} simulation={() => <Simulacao />} inicial="showcase" />;
}
