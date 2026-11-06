import { abrirSpan, contextoAtivo, criarThread, fecharSpan, juntar, logar, novoProcesso, type EstadoDoLog } from "@ovh/otel-domain";
import { useState } from "react";

/**
 * A simulação do log: o mesmo redutor do filme, com o leitor no lugar do
 * handler. Cada botão é um verbo do modelo; a tabela é `juntar`, que faz o que
 * o backend faz — liga o log ao span pelo campo, e só por ele.
 */
const curto = (id: string | undefined) => (id === undefined ? "—" : `${id.slice(0, 8)}…`);
const MENSAGENS = ["cart loaded", "card authorized", "stock reserved", "receipt queued", "request finished"];

export function LogLab() {
  const [ponte, setPonte] = useState(true);
  const [propagar, setPropagar] = useState(true);
  const [thread, setThread] = useState<"main" | "worker">("main");
  const [e, setE] = useState<EstadoDoLog>(() => novoProcesso(true));
  const [nSpan, setNSpan] = useState(0);

  const temWorker = e.threads["worker"] !== undefined;
  const ativo = contextoAtivo(e, thread);
  const juncoes = juntar(e);
  const reiniciar = (p: boolean) => {
    setE(novoProcesso(p));
    setThread("main");
    setNSpan(0);
  };

  return (
    <div className="metlab" data-testid="log-lab">
      <div className="metlab__barra">
        <label className="ctxlab-switch" htmlFor="log-ponte">
          <input
            id="log-ponte"
            type="checkbox"
            role="switch"
            checked={ponte}
            onChange={(ev) => {
              setPonte(ev.target.checked);
              reiniciar(ev.target.checked);
            }}
          />
          <span className="ctxlab-switch__track" aria-hidden="true">
            <span />
          </span>
          <span>Log bridge installed</span>
        </label>
        <label className="ctxlab-switch" htmlFor="log-propagar">
          <input id="log-propagar" type="checkbox" role="switch" checked={propagar} onChange={(ev) => setPropagar(ev.target.checked)} />
          <span className="ctxlab-switch__track" aria-hidden="true">
            <span />
          </span>
          <span>Hand the context to new threads</span>
        </label>
        <div className="deplab-modes" role="radiogroup" aria-label="Thread">
          {(["main", "worker"] as const).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={thread === t} disabled={t === "worker" && !temWorker} onClick={() => setThread(t)}>
              {t} thread
            </button>
          ))}
        </div>
      </div>

      <div className="metlab__gestos">
        <button
          type="button"
          className="metlab__gesto"
          onClick={() => {
            setE((x) => abrirSpan(x, thread, nSpan === 0 ? "POST /checkout" : `step ${nSpan}`));
            setNSpan((n) => n + 1);
          }}
        >
          Start a span
        </button>
        <button type="button" className="metlab__gesto" disabled={ativo === null} onClick={() => setE((x) => fecharSpan(x, thread))}>
          End the active span
        </button>
        <button type="button" className="metlab__gesto metlab__gesto--coleta" onClick={() => setE((x) => logar(x, thread, MENSAGENS[x.logs.length % MENSAGENS.length]!))}>
          log.info(…)
        </button>
        <button type="button" className="metlab__gesto" disabled={temWorker} onClick={() => setE((x) => criarThread(x, "main", "worker", propagar))}>
          Spawn a worker thread
        </button>
        <button type="button" className="metlab__gesto metlab__gesto--limpar" onClick={() => reiniciar(ponte)}>
          Reset
        </button>
      </div>

      <div className="metlab__corpo">
        <section className="metlab__cartao" aria-label="Active context per thread">
          <h3 className="mono">Active context, per thread</h3>
          <dl className="metlab__agg mono">
            {Object.keys(e.threads).map((t) => {
              const c = contextoAtivo(e, t);
              return (
                <div key={t}>
                  <dt>{t} thread</dt>
                  <dd data-testid={`ctx-${t}`}>{c === null ? "none" : `span ${curto(c.spanId)}`}</dd>
                </div>
              );
            })}
          </dl>
          <ol className="loglab__spans mono" aria-label="Spans">
            {e.spans.map((s) => (
              <li key={s.spanId} data-aberto={s.aberto ? "" : undefined}>
                {s.nome} <span>{curto(s.spanId)}</span> <small>{s.thread}</small>
              </li>
            ))}
          </ol>
        </section>

        <section className="metlab__cartao" aria-label="Log records and whether the backend can link them">
          <h3 className="mono">LogRecords · can the backend link them?</h3>
          {e.logs.length === 0 ? (
            <p className="metlab__vazio">Start a span and log inside it. Then end the span and log again, or log from a worker.</p>
          ) : (
            <table className="metlab__tabela mono">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">thread</th>
                  <th scope="col">body</th>
                  <th scope="col">trace_id</th>
                  <th scope="col">span_id</th>
                  <th scope="col">links to</th>
                </tr>
              </thead>
              <tbody>
                {juncoes.map((j) => (
                  <tr key={j.log.n}>
                    <td>{j.log.n}</td>
                    <td>{j.log.thread}</td>
                    <td className="loglab__corpo">{j.log.corpo}</td>
                    <td>{curto(j.log.traceId)}</td>
                    <td>{curto(j.log.spanId)}</td>
                    <td data-ruim={j.motivo === "joined" ? undefined : ""}>{j.motivo === "joined" ? j.span.nome : j.motivo === "text-only" ? "nothing (id in text)" : "nothing (no context)"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
