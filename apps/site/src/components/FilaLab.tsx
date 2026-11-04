import { consumirLote, consumirUm, esperarNaFila, novaFila, publicar, tracesDaFila, type EstadoDaFila } from "@ovh/otel-domain";
import { useState } from "react";

/**
 * A simulação da fila: o mesmo redutor do filme, com o leitor nos dois lados.
 * Publicar abre um trace e põe uma mensagem na fila; consumir tira uma ou o
 * lote; o painel de baixo é `tracesDaFila`, o que o backend monta.
 */
const curto = (id: string | undefined) => (id === undefined ? "—" : `${id.slice(0, 6)}…`);
const seg = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

export function FilaLab() {
  const [injetar, setInjetar] = useState(true);
  const [e, setE] = useState<EstadoDaFila>(() => novaFila(true));
  const traces = tracesDaFila(e);
  const nomeDoTrace = new Map(traces.map((t, i) => [t.traceId, `T${i + 1}`] as const));

  return (
    <div className="metlab" data-testid="queue-lab">
      <div className="metlab__barra">
        <label className="ctxlab-switch" htmlFor="fila-injetar">
          <input
            id="fila-injetar"
            type="checkbox"
            role="switch"
            checked={injetar}
            onChange={(ev) => {
              setInjetar(ev.target.checked);
              setE(novaFila(ev.target.checked));
            }}
          />
          <span className="ctxlab-switch__track" aria-hidden="true">
            <span />
          </span>
          <span>Producer injects traceparent into the headers</span>
        </label>
        <span className="metlab__relogio mono">t = {seg(e.t)}</span>
      </div>

      <div className="metlab__gestos">
        <button type="button" className="metlab__gesto" onClick={() => setE((x) => publicar(x))}>
          Publish an order
        </button>
        <button type="button" className="metlab__gesto" onClick={() => setE((x) => esperarNaFila(x, 1000))}>
          Wait 1 s
        </button>
        <button type="button" className="metlab__gesto metlab__gesto--coleta" disabled={e.fila.length === 0} onClick={() => setE((x) => consumirUm(esperarNaFila(x, 100)))}>
          Consume one
        </button>
        <button type="button" className="metlab__gesto metlab__gesto--coleta" disabled={e.fila.length === 0} onClick={() => setE((x) => consumirLote(esperarNaFila(x, 100)))}>
          Consume the batch
        </button>
        <button type="button" className="metlab__gesto metlab__gesto--limpar" onClick={() => setE(novaFila(injetar))}>
          Reset
        </button>
      </div>

      <div className="metlab__corpo">
        <section className="metlab__cartao" aria-label="The queue">
          <h3 className="mono">orders queue · {e.fila.length} waiting</h3>
          {e.fila.length === 0 ? (
            <p className="metlab__vazio">Empty. Publish a few orders, let them wait, then consume.</p>
          ) : (
            <ol className="loglab__spans mono">
              {e.fila.map((m) => (
                <li key={m.id} data-aberto="">
                  order #{m.pedido} <span>{m.headers.traceparent === undefined ? "headers {}" : `traceparent ${m.headers.traceparent.slice(0, 22)}…`}</span> <small>{seg(e.t - m.publicadaEm)}</small>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="metlab__cartao" aria-label="What the backend assembled">
          <h3 className="mono">Backend · traces</h3>
          {traces.length === 0 ? (
            <p className="metlab__vazio">No spans yet.</p>
          ) : (
            <table className="metlab__tabela mono">
              <thead>
                <tr>
                  <th scope="col">trace</th>
                  <th scope="col">span</th>
                  <th scope="col">kind</th>
                  <th scope="col">parent</th>
                  <th scope="col">links to</th>
                </tr>
              </thead>
              <tbody>
                {traces.flatMap((t) =>
                  t.spans.map((s) => (
                    <tr key={s.spanId} data-reset={t.orfao && s.parentId === undefined ? "" : undefined}>
                      <td>{nomeDoTrace.get(t.traceId)}</td>
                      <td className="loglab__corpo">{s.nome}</td>
                      <td>{s.tipo}</td>
                      <td data-ruim={s.tipo === "CONSUMER" && s.parentId === undefined && s.links.length === 0 ? "" : undefined}>{s.parentId === undefined ? (s.tipo === "CONSUMER" && s.links.length === 0 ? "none (orphan)" : "root") : curto(s.parentId)}</td>
                      <td>{s.links.length === 0 ? "—" : s.links.map((l) => nomeDoTrace.get(l.traceId)).join(", ")}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          )}
          {traces.length > 0 ? (
            <p className="metlab__veredito" data-testid="fila-veredito">
              <b>{traces.length}</b> traces for <b>{e.pedidos}</b> orders · <b>{traces.filter((t) => t.orfao).length}</b> orphans · <b>{e.spans.reduce((n, s) => n + s.links.length, 0)}</b> links
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
