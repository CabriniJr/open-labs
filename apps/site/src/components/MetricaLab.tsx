import { coletar, lerNoBackend, novoAgregador, registrar, reiniciar, ROTULOS_DOS_BALDES, type Agregador, type PontoExportado, type Temporalidade } from "@ovh/otel-domain";
import { useState } from "react";

/**
 * A simulação da métrica: o mesmo redutor do filme, nas mãos do leitor.
 *
 * Cada botão é um verbo do modelo — registrar, coletar, reiniciar — e o relógio
 * anda um segundo por gesto, para que o `inicio` e o `fim` de cada ponto sejam
 * legíveis. Nada aqui calcula por conta própria: a tabela é `PontoExportado`, e
 * a coluna "backend reads" é `lerNoBackend`.
 */
interface Estado {
  readonly t: number;
  readonly agregador: Agregador;
  readonly pontos: readonly PontoExportado[];
  /** O que aconteceu em cada intervalo fechado, e no que está aberto. */
  readonly reais: readonly number[];
  readonly aberto: number;
  readonly perdidas: number;
}

const inicial = (temporalidade: Temporalidade): Estado => ({ t: 0, agregador: novoAgregador(temporalidade, 0), pontos: [], reais: [], aberto: 0, perdidas: 0 });
const seg = (ms: number) => `${Math.round(ms / 1000)} s`;

const LATENCIAS = [
  { rotulo: "Fast request", ms: 20 },
  { rotulo: "Normal request", ms: 80 },
  { rotulo: "Slow request", ms: 300 },
] as const;

export function MetricaLab() {
  const [temporalidade, setTemporalidade] = useState<Temporalidade>("cumulative");
  const [respeita, setRespeita] = useState(false);
  const [e, setE] = useState<Estado>(() => inicial("cumulative"));

  const trocar = (t: Temporalidade) => {
    setTemporalidade(t);
    setE(inicial(t));
  };
  const medir = (ms: number) => setE((x) => ({ ...x, t: x.t + 1000, agregador: registrar(x.agregador, ms), aberto: x.aberto + 1 }));
  const coletarAgora = () =>
    setE((x) => {
      const t = x.t + 1000;
      const r = coletar(x.agregador, t);
      return { ...x, t, agregador: r.agregador, pontos: [...x.pontos, r.ponto], reais: [...x.reais, x.aberto], aberto: 0 };
    });
  const cair = () => setE((x) => ({ ...x, t: x.t + 1000, agregador: reiniciar(x.agregador, x.t + 1000), perdidas: x.perdidas + x.aberto, aberto: 0 }));

  const lidos = lerNoBackend(e.pontos, { respeitaInicio: respeita });
  const totalLido = lidos.reduce((a, b) => a + b, 0);
  const totalReal = e.reais.reduce((a, b) => a + b, 0);
  const maiorBalde = Math.max(1, ...e.agregador.baldes);
  const maiorLido = Math.max(1, ...lidos.map(Math.abs));
  const a = e.agregador;

  return (
    <div className="metlab" data-testid="metric-lab">
      <div className="metlab__barra">
        <div className="deplab-modes" role="radiogroup" aria-label="Temporality">
          {(["cumulative", "delta"] as const).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={temporalidade === t} onClick={() => trocar(t)}>
              {t}
            </button>
          ))}
        </div>
        <label className="ctxlab-switch" htmlFor="met-respeita">
          <input id="met-respeita" type="checkbox" role="switch" checked={respeita} disabled={temporalidade === "delta"} onChange={(ev) => setRespeita(ev.target.checked)} />
          <span className="ctxlab-switch__track" aria-hidden="true">
            <span />
          </span>
          <span>Backend honours start time</span>
        </label>
        <span className="metlab__relogio mono" aria-live="polite">
          t = {seg(e.t)}
        </span>
      </div>

      <div className="metlab__gestos">
        {LATENCIAS.map((l) => (
          <button key={l.ms} type="button" className="metlab__gesto" onClick={() => medir(l.ms)}>
            {l.rotulo} <span className="mono">{l.ms} ms</span>
          </button>
        ))}
        <button type="button" className="metlab__gesto metlab__gesto--coleta" onClick={coletarAgora}>
          Collect now
        </button>
        <button type="button" className="metlab__gesto metlab__gesto--queda" onClick={cair}>
          Restart the process
        </button>
        <button type="button" className="metlab__gesto metlab__gesto--limpar" onClick={() => setE(inicial(temporalidade))}>
          Reset
        </button>
      </div>

      <div className="metlab__corpo">
        <section className="metlab__cartao" aria-label="The aggregator, in memory">
          <h3 className="mono">SDK aggregator · {a.temporalidade}</h3>
          <dl className="metlab__agg mono">
            <div>
              <dt>count</dt>
              <dd data-testid="agg-count">{a.contagem}</dd>
            </div>
            <div>
              <dt>sum</dt>
              <dd>{a.soma} ms</dd>
            </div>
            <div>
              <dt>counting since</dt>
              <dd>{seg(a.desde)}</dd>
            </div>
            <div>
              <dt>not yet collected</dt>
              <dd>{e.aberto}</dd>
            </div>
          </dl>
          <ol className="metlab__baldes" aria-label="Histogram buckets">
            {a.baldes.map((n, i) => (
              <li key={ROTULOS_DOS_BALDES[i]}>
                <span className="metlab__balde" style={{ ["--h" as string]: String(n / maiorBalde) }} />
                <b className="mono">{n}</b>
                <small className="mono">{ROTULOS_DOS_BALDES[i]}</small>
              </li>
            ))}
          </ol>
        </section>

        <section className="metlab__cartao" aria-label="Exported points and what the backend reads">
          <h3 className="mono">Points on the wire · backend reading</h3>
          {e.pontos.length === 0 ? (
            <p className="metlab__vazio">Record a few requests, then collect. Nothing leaves the process until the reader asks.</p>
          ) : (
            <>
              <table className="metlab__tabela mono">
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">start</th>
                    <th scope="col">time</th>
                    <th scope="col">count</th>
                    <th scope="col">really</th>
                    <th scope="col">backend reads</th>
                  </tr>
                </thead>
                <tbody>
                  {e.pontos.map((p, i) => (
                    <tr key={i} data-reset={i > 0 && p.inicio !== e.pontos[i - 1]!.inicio ? "" : undefined}>
                      <td>{i + 1}</td>
                      <td>{seg(p.inicio)}</td>
                      <td>{seg(p.fim)}</td>
                      <td>{p.contagem}</td>
                      <td>{e.reais[i]}</td>
                      <td data-ruim={lidos[i]! < 0 || lidos[i] !== e.reais[i] ? "" : undefined}>{lidos[i]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <svg className="metlab__grafico" viewBox={`0 0 ${Math.max(4, lidos.length) * 40} 120`} role="img" aria-label="Requests per interval, as the backend reads them">
                <line x1="0" x2={Math.max(4, lidos.length) * 40} y1="60" y2="60" className="metlab__eixo" />
                {lidos.map((v, i) => {
                  const h = (Math.abs(v) / maiorLido) * 54;
                  return <rect key={i} x={i * 40 + 8} y={v >= 0 ? 60 - h : 60} width="24" height={Math.max(1, h)} className={v < 0 ? "metlab__coluna metlab__coluna--neg" : "metlab__coluna"} />;
                })}
              </svg>
              <p className="metlab__veredito" data-testid="met-veredito">
                The backend counts <b>{totalLido}</b> requests; <b>{totalReal}</b> happened in closed intervals
                {e.perdidas > 0 ? (
                  <>
                    , and <b>{e.perdidas}</b> died in memory with the process
                  </>
                ) : null}
                .
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
