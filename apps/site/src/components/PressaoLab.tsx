import { LIMITE_DO_LIMITER, MEMORIA_MAXIMA, novaPressao, SPANS_POR_LOTE, tickDaPressao, totalDeLotes, type EstadoDaPressao } from "@ovh/otel-domain";
import { useState } from "react";

/**
 * A simulação do backpressure: o mesmo `tick` do filme, com o leitor
 * segurando o interruptor do backend. A coluna é a `sending_queue`; as marcas
 * são os limites; os contadores são o modelo.
 */
const FILAS = [4, 15] as const;
const ROTULO_DA_CHEGADA: Record<EstadoDaPressao["chegada"], string> = {
  aceito: "queued",
  recusado: "refused by memory_limiter",
  "fila-cheia": "dropped: queue full",
  crash: "out of memory — the process restarted empty",
};

export function PressaoLab() {
  const [fila, setFila] = useState<number>(4);
  const [limiter, setLimiter] = useState(true);
  const [noAr, setNoAr] = useState(true);
  const [e, setE] = useState<EstadoDaPressao>(() => novaPressao());
  const [primeiro, setPrimeiro] = useState(true);
  const avancar = (n: number) => {
    setPrimeiro(false);
    setE((x) => {
      let y = x;
      for (let i = 0; i < n; i += 1) y = tickDaPressao(y, { fila, limiter }, noAr);
      return y;
    });
  };
  const zerar = () => {
    setE(novaPressao());
    setPrimeiro(true);
  };
  const altura = Math.max(MEMORIA_MAXIMA, Math.min(fila, MEMORIA_MAXIMA + 2));
  const c = e.contadores;

  return (
    <div className="metlab" data-testid="pressure-lab">
      <div className="metlab__barra">
        <label className="ctxlab-switch" htmlFor="pr-noar">
          <input id="pr-noar" type="checkbox" role="switch" checked={noAr} onChange={(ev) => setNoAr(ev.target.checked)} />
          <span className="ctxlab-switch__track" aria-hidden="true">
            <span />
          </span>
          <span>Backend up</span>
        </label>
        <label className="ctxlab-switch" htmlFor="pr-limiter">
          <input
            id="pr-limiter"
            type="checkbox"
            role="switch"
            checked={limiter}
            onChange={(ev) => {
              setLimiter(ev.target.checked);
              zerar();
            }}
          />
          <span className="ctxlab-switch__track" aria-hidden="true">
            <span />
          </span>
          <span>memory_limiter</span>
        </label>
        <div className="deplab-modes" role="radiogroup" aria-label="queue_size">
          {FILAS.map((q) => (
            <button
              key={q}
              type="button"
              role="radio"
              aria-checked={fila === q}
              onClick={() => {
                setFila(q);
                zerar();
              }}
            >
              queue_size {q}
            </button>
          ))}
        </div>
        <span className="metlab__relogio mono">tick {e.t}</span>
      </div>

      <div className="metlab__gestos">
        <button type="button" className="metlab__gesto metlab__gesto--coleta" onClick={() => avancar(1)}>
          Next tick
        </button>
        <button type="button" className="metlab__gesto" onClick={() => avancar(5)}>
          5 ticks
        </button>
        <button type="button" className="metlab__gesto metlab__gesto--limpar" onClick={zerar}>
          Reset
        </button>
      </div>

      <div className="metlab__corpo">
        <section className="metlab__cartao" aria-label="The sending queue">
          <h3 className="mono">sending_queue · {e.fila.length} batches</h3>
          <ol className="prlab__coluna mono" aria-label="Queued batches, bottom first">
            {Array.from({ length: altura }, (_, k) => altura - 1 - k).map((k) => {
              const lote = e.fila[k];
              return (
                <li key={k} data-cheia={lote !== undefined ? "" : undefined} data-acima={(limiter && k >= LIMITE_DO_LIMITER) || k >= fila ? "" : undefined}>
                  <span>{lote === undefined ? "" : `#${lote.id}${lote.tentativas > 0 ? ` · retry ${lote.tentativas}` : ""}`}</span>
                  <small>
                    {k === fila - 1 ? "queue_size" : ""}
                    {limiter && k === LIMITE_DO_LIMITER - 1 ? " limiter" : ""}
                    {k === MEMORIA_MAXIMA - 1 ? " memory" : ""}
                  </small>
                </li>
              );
            })}
          </ol>
          <p className="metlab__veredito" data-testid="pr-chegada">
            {primeiro ? "Press Next tick. Then take the backend down and watch the queue." : `Last batch: ${ROTULO_DA_CHEGADA[e.chegada]}.`}
          </p>
        </section>
        <section className="metlab__cartao" aria-label="Where every batch went">
          <h3 className="mono">Where every span went</h3>
          <dl className="metlab__agg mono" data-testid="pr-contadores">
            {(
              [
                ["delivered", c.entregues],
                ["refused at the edge", c.recusados],
                ["dropped: queue full", c.filaCheia],
                ["dropped: retries exhausted", c.retryEsgotado],
                ["lost in the crash", c.perdidosNoCrash],
                ["still queued", e.fila.length],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v * SPANS_POR_LOTE}</dd>
              </div>
            ))}
          </dl>
          <p className="metlab__veredito">
            <b>{(totalDeLotes(c) + e.fila.length) * SPANS_POR_LOTE}</b> spans arrived; each one is in exactly one box above.
          </p>
        </section>
      </div>
    </div>
  );
}
