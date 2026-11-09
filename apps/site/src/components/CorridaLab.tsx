import {
  ALGORITMOS,
  custo,
  entrada,
  ErroDeVetor,
  FICHAS,
  filmeDaOrdenacao,
  FORMATO_ROTULO,
  FORMATOS,
  FORMATOS_DO_FILME,
  instante,
  lerVetor,
  ordenar,
  podio,
  type Algoritmo,
  type DetalheDaOrdenacao,
  type Formato,
  type Traco,
} from "@ovh/algo-domain";
import { MotionPlayer } from "@ovh/motion/react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ModosDoLab } from "./ModosDoLab";

const TAMANHOS = [8, 16, 32, 64] as const;

function Vitrine() {
  const [algoritmo, setAlgoritmo] = useState<Algoritmo>("bubble");
  const [formato, setFormato] = useState<Formato>("random");
  const filme = useMemo(() => filmeDaOrdenacao(algoritmo, formato), [algoritmo, formato]);
  return (
    <div className="cpuvit algo" data-testid="sorting-showcase">
      <MotionPlayer
        film={filme}
        label={`${FICHAS[algoritmo].nome} sorting eight bars, one comparison, swap or write at a time, with the cost counted at the top.`}
        controls={
          <div className="algo-controles">
            <label>
              Algorithm
              <select aria-label="Algorithm" value={algoritmo} onChange={(e) => setAlgoritmo(e.target.value as Algoritmo)}>
                {ALGORITMOS.map((a) => (
                  <option key={a} value={a}>
                    {FICHAS[a].nome} · {FICHAS[a].medio}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Input
              <select aria-label="Input" value={formato} onChange={(e) => setFormato(e.target.value as Formato)}>
                {FORMATOS_DO_FILME.map((f) => (
                  <option key={f} value={f}>
                    {FORMATO_ROTULO[f]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
        renderDetail={(frame) => {
          const d: DetalheDaOrdenacao | undefined = frame.detail;
          if (d === undefined) return null;
          const f = FICHAS[d.algoritmo];
          return (
            <div className="algo-detalhe">
              <p className="algo-h">Now</p>
              <p className="mono">{d.operacao}</p>
              <ol className="algo-vetor mono" aria-label="The array right now">
                {d.vetor.map((v, k) => (
                  <li key={k}>{v}</li>
                ))}
              </ol>
              <dl className="algo-linhas mono">
                <div>
                  <dt>comparisons</dt>
                  <dd>{d.comparacoes}</dd>
                </div>
                <div>
                  <dt>swaps</dt>
                  <dd>{d.trocas}</dd>
                </div>
                <div>
                  <dt>writes</dt>
                  <dd>{d.escritas}</dd>
                </div>
                <div>
                  <dt>on the auxiliary tape</dt>
                  <dd>{d.naAuxiliar}</dd>
                </div>
                <div>
                  <dt>average · worst · best</dt>
                  <dd>
                    {f.medio} · {f.pior} · {f.melhor}
                  </dd>
                </div>
                <div>
                  <dt>extra memory</dt>
                  <dd>{f.memoria}</dd>
                </div>
              </dl>
            </div>
          );
        }}
      />
    </div>
  );
}

/** Uma pista da corrida: as barras no passo dado, sem estado próprio. */
const Pista = memo(function Pista({ t, passo, lugar }: { t: Traco; passo: number; lugar: number | undefined }) {
  const agora = instante(t, passo);
  const n = agora.v.length;
  const max = Math.max(...t.entrada.map((x) => Math.abs(x)), 1);
  const min = Math.min(0, ...t.entrada);
  const W = 320;
  const H = 120;
  const largura = W / n;
  const tocados = new Set<number>(agora.op === undefined ? [] : agora.op.tipo === "write" ? [agora.op.i] : [agora.op.i, agora.op.j]);
  const ficha = FICHAS[t.algoritmo];
  const total = custo(t);
  return (
    <section className="algo-pista" data-fim={agora.terminou ? "" : undefined} aria-label={`${ficha.nome} lane`}>
      <header>
        <b>{ficha.nome}</b>
        <small className="mono">{ficha.medio}</small>
      </header>
      <svg className="algo-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${ficha.nome}: ${agora.terminou ? "sorted" : `step ${Math.min(passo, total)} of ${total}`}`}>
        {agora.v.map((v, k) => {
          const h = 6 + ((v - min) / (max - min || 1)) * (H - 10);
          return <rect key={k} className="algo-barra" data-op={tocados.has(k) ? agora.op!.tipo : undefined} x={k * largura + 0.6} y={H - h} width={Math.max(1, largura - 1.2)} height={h} rx={1.5} />;
        })}
      </svg>
      <p className="algo-cont mono">
        <span>{agora.comparacoes} cmp</span>
        <span>{agora.trocas} swp</span>
        <span>{agora.escritas} wr</span>
        <span>
          {Math.min(passo, total)}/{total} steps
        </span>
        {agora.terminou && lugar !== undefined ? <span className="algo-lugar">#{lugar} — done</span> : null}
      </p>
    </section>
  );
});

interface Medicao {
  readonly algoritmo: Algoritmo;
  readonly ms: number;
}

/** Mede o tempo de verdade, neste aparelho: mediana de cinco rodadas, uma por vez. */
function medirNoAparelho(n: number, formato: Formato, algoritmos: readonly Algoritmo[], pronto: (m: Medicao[]) => void, progresso: (a: Algoritmo) => void): () => void {
  let cancelado = false;
  const resultados: Medicao[] = [];
  const v = entrada(formato, n, 7);
  let k = 0;
  const proximo = () => {
    if (cancelado) return;
    if (k >= algoritmos.length) {
      pronto(resultados);
      return;
    }
    const a = algoritmos[k]!;
    progresso(a);
    const tempos: number[] = [];
    for (let r = 0; r < 5; r += 1) {
      const t0 = performance.now();
      ordenar(a, v, false);
      tempos.push(performance.now() - t0);
    }
    tempos.sort((x, y) => x - y);
    resultados.push({ algoritmo: a, ms: tempos[2]! });
    k += 1;
    // Um algoritmo por tarefa: a página respira entre um e outro.
    setTimeout(proximo, 16);
  };
  setTimeout(proximo, 16);
  return () => {
    cancelado = true;
  };
}

function Simulacao() {
  const [n, setN] = useState<number>(32);
  const [formato, setFormato] = useState<Formato>("random");
  const [semente, setSemente] = useState(1);
  const [proprio, setProprio] = useState("");
  const [escolhidos, setEscolhidos] = useState<ReadonlySet<Algoritmo>>(new Set(ALGORITMOS));
  const [passo, setPasso] = useState(0);
  const [tocando, setTocando] = useState(false);
  const [ritmo, setRitmo] = useState(4);
  const [medida, setMedida] = useState<{ n: number; formato: Formato; m: Medicao[] } | null>(null);
  const [medindo, setMedindo] = useState<Algoritmo | null>(null);
  const [nMedida, setNMedida] = useState(2000);

  const leitura = useMemo((): { v: number[] } | { erro: string } => {
    if (proprio.trim() === "") return { v: entrada(formato, n, semente) };
    try {
      return { v: lerVetor(proprio) };
    } catch (e) {
      return { erro: e instanceof ErroDeVetor ? e.message : String(e) };
    }
  }, [proprio, formato, n, semente]);
  const v = "v" in leitura ? leitura.v : entrada(formato, n, semente);
  const tracos = useMemo(() => ALGORITMOS.filter((a) => escolhidos.has(a)).map((a) => ordenar(a, v)), [v.join(","), escolhidos]);
  const maior = Math.max(1, ...tracos.map(custo));
  const lugares = useMemo(() => new Map(podio(tracos).map((c) => [c.algoritmo, c.lugar])), [tracos]);

  // O vetor mudou: a corrida volta à largada.
  useEffect(() => {
    setPasso(0);
  }, [v.join(","), escolhidos]);

  const quadro = useRef<number | null>(null);
  useEffect(() => {
    if (!tocando) return;
    const tique = () => {
      setPasso((p) => {
        const prox = p + ritmo;
        if (prox >= maior) {
          setTocando(false);
          return maior;
        }
        return prox;
      });
      quadro.current = requestAnimationFrame(tique);
    };
    quadro.current = requestAnimationFrame(tique);
    return () => {
      if (quadro.current !== null) cancelAnimationFrame(quadro.current);
    };
  }, [tocando, ritmo, maior]);

  useEffect(() => {
    if (medindo === null) return;
    return medirNoAparelho(
      nMedida,
      formato,
      ALGORITMOS.filter((a) => escolhidos.has(a)),
      (m) => {
        setMedida({ n: nMedida, formato, m });
        setMedindo(null);
      },
      (a) => setMedindo(a),
    );
    // Só começa quando o leitor pede; trocar o algoritmo em medição não reinicia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medindo === null]);

  const alternar = (a: Algoritmo) => {
    const s = new Set(escolhidos);
    if (s.has(a)) {
      if (s.size > 1) s.delete(a);
    } else s.add(a);
    setEscolhidos(s);
  };
  const ordenadoPorCusto = [...tracos].sort((a, b) => custo(a) - custo(b));
  const maisRapida = medida === null ? 0 : Math.min(...medida.m.map((x) => x.ms));

  return (
    <div className="algo" data-testid="sorting-race">
      <div className="algo-controles">
        <label>
          Items
          <select aria-label="Items" value={n} onChange={(e) => setN(Number(e.target.value))} disabled={proprio.trim() !== ""}>
            {TAMANHOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Input
          <select aria-label="Input" value={formato} onChange={(e) => setFormato(e.target.value as Formato)} disabled={proprio.trim() !== ""}>
            {FORMATOS.map((f) => (
              <option key={f} value={f}>
                {FORMATO_ROTULO[f]}
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
        <fieldset>
          <legend>Racing</legend>
          {ALGORITMOS.map((a) => (
            <label key={a}>
              <input type="checkbox" checked={escolhidos.has(a)} onChange={() => alternar(a)} />
              {FICHAS[a].nome}
            </label>
          ))}
        </fieldset>
      </div>
      {"erro" in leitura ? (
        <p className="algo-erro" role="alert">
          {leitura.erro}
        </p>
      ) : null}

      <div className="algo-transporte">
        <button type="button" className="algo-btn" onClick={() => (passo >= maior ? (setPasso(0), setTocando(true)) : setTocando(!tocando))}>
          {tocando ? "Pause" : passo >= maior ? "Race again" : passo === 0 ? "Start the race" : "Resume"}
        </button>
        <button type="button" className="algo-btn" onClick={() => setPasso((p) => Math.min(maior, p + 1))} disabled={tocando}>
          One step
        </button>
        <label className="algo-nota">
          Speed{" "}
          <select aria-label="Speed" value={ritmo} onChange={(e) => setRitmo(Number(e.target.value))}>
            <option value={1}>1 step per frame</option>
            <option value={4}>4 steps per frame</option>
            <option value={16}>16 steps per frame</option>
            <option value={64}>64 steps per frame</option>
          </select>
        </label>
        <input type="range" min={0} max={maior} value={passo} aria-label="Race clock, in steps" onChange={(e) => (setTocando(false), setPasso(Number(e.target.value)))} />
        <output aria-live="off">
          step {passo} of {maior}
        </output>
      </div>
      <p className="algo-nota">One step = one comparison, swap or write. Every lane gets the same clock, so the one that finishes first did the least work on this input.</p>

      <div className="algo-pistas">
        {tracos.map((t) => (
          <Pista key={t.algoritmo} t={t} passo={passo} lugar={lugares.get(t.algoritmo)} />
        ))}
      </div>

      <div className="algo-tabela">
        <table>
          <caption>The bill, counted ({v.length} items, {proprio.trim() !== "" ? "your list" : FORMATO_ROTULO[formato]})</caption>
          <thead>
            <tr>
              <th scope="col">Place</th>
              <th scope="col">Algorithm</th>
              <th scope="col" className="num">
                Comparisons
              </th>
              <th scope="col" className="num">
                Swaps
              </th>
              <th scope="col" className="num">
                Writes
              </th>
              <th scope="col" className="num">
                Total steps
              </th>
              <th scope="col">Class (avg · worst)</th>
              <th scope="col">Extra memory</th>
            </tr>
          </thead>
          <tbody>
            {ordenadoPorCusto.map((t) => (
              <tr key={t.algoritmo} data-melhor={lugares.get(t.algoritmo) === 1 ? "" : undefined}>
                <td>#{lugares.get(t.algoritmo)}</td>
                <td>{FICHAS[t.algoritmo].nome}</td>
                <td className="num">{t.comparacoes}</td>
                <td className="num">{t.trocas}</td>
                <td className="num">{t.escritas}</td>
                <td className="num">{custo(t)}</td>
                <td>
                  {FICHAS[t.algoritmo].medio} · {FICHAS[t.algoritmo].pior}
                </td>
                <td>{t.algoritmo === "merge" ? `${t.memoriaExtra} slots` : t.algoritmo === "quick" ? `stack depth ${t.memoriaExtra}` : "none"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="algo-cartao" aria-label="Measure real time on this device">
        <h3>Now measure it for real, on this device</h3>
        <p className="algo-nota">
          Counting steps is exact; time is what you pay. This runs each algorithm five times on a bigger {FORMATO_ROTULO[formato]} array with <code>performance.now()</code> and keeps the median. Your numbers will differ from anyone else’s — the ranking usually does not.
        </p>
        <div className="algo-transporte">
          <label className="algo-nota">
            Items to time{" "}
            <select aria-label="Items to time" value={nMedida} onChange={(e) => setNMedida(Number(e.target.value))} disabled={medindo !== null}>
              <option value={500}>500</option>
              <option value={1000}>1 000</option>
              <option value={2000}>2 000</option>
              <option value={4000}>4 000</option>
            </select>
          </label>
          <button type="button" className="algo-btn" onClick={() => setMedindo(ALGORITMOS.find((a) => escolhidos.has(a))!)} disabled={medindo !== null}>
            {medindo === null ? "Measure" : `Measuring ${FICHAS[medindo].nome}…`}
          </button>
        </div>
        {medida !== null ? (
          <div className="algo-tabela">
            <table>
              <caption>
                Median of 5 runs, {medida.n} items, {FORMATO_ROTULO[medida.formato]}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Algorithm</th>
                  <th scope="col" className="num">
                    Time
                  </th>
                  <th scope="col" className="num">
                    vs. fastest
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...medida.m]
                  .sort((a, b) => a.ms - b.ms)
                  .map((x) => (
                    <tr key={x.algoritmo}>
                      <td>{FICHAS[x.algoritmo].nome}</td>
                      <td className="num">{x.ms < 0.1 ? "< 0.1 ms" : `${x.ms.toFixed(1)} ms`}</td>
                      <td className="num">{maisRapida > 0 ? `×${(x.ms / maisRapida).toFixed(1)}` : "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function CorridaModos() {
  return <ModosDoLab showcase={() => <Vitrine />} simulation={() => <Simulacao />} inicial="showcase" />;
}
