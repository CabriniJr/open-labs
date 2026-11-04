import { executarInstrucao, noBackend, nomeDeAltaCardinalidade, novoTracer, programaManual, type EstadoManual } from "@ovh/otel-domain";
import { useMemo, useState } from "react";

/**
 * O editor dos spans à mão: o programa do filme, com cada linha comentável, e
 * o leitor rodando linha a linha. O estado é sempre o replay das linhas
 * ativas até o cursor — o mesmo redutor, nenhuma regra própria.
 */
const curto = (id: string | undefined) => (id === undefined ? "—" : `${id.slice(0, 6)}…`);

export function ManualLab() {
  const [nomeComId, setNomeComId] = useState(false);
  const [comentadas, setComentadas] = useState<ReadonlySet<number>>(new Set());
  const [cursor, setCursor] = useState(0);
  const prog = useMemo(() => programaManual({ nomeComId }), [nomeComId]);

  const estado: EstadoManual = useMemo(() => {
    let e = novoTracer();
    prog.slice(0, cursor).forEach((i, n) => {
      if (!comentadas.has(n)) e = executarInstrucao(e, i);
    });
    return e;
  }, [prog, cursor, comentadas]);
  const backend = noBackend(estado);
  const terminou = cursor >= prog.length;

  const alternar = (n: number) => {
    setComentadas((c) => {
      const novo = new Set(c);
      if (novo.has(n)) novo.delete(n);
      else novo.add(n);
      return novo;
    });
    setCursor(0);
  };

  return (
    <div className="metlab" data-testid="manual-lab">
      <div className="metlab__barra">
        <label className="ctxlab-switch" htmlFor="man-id">
          <input
            id="man-id"
            type="checkbox"
            role="switch"
            checked={nomeComId}
            onChange={(ev) => {
              setNomeComId(ev.target.checked);
              setCursor(0);
            }}
          />
          <span className="ctxlab-switch__track" aria-hidden="true">
            <span />
          </span>
          <span>Put the order id in the span name</span>
        </label>
      </div>

      <div className="metlab__gestos">
        <button type="button" className="metlab__gesto metlab__gesto--coleta" disabled={terminou} onClick={() => setCursor((c) => c + 1)}>
          Run next line
        </button>
        <button type="button" className="metlab__gesto" disabled={terminou} onClick={() => setCursor(prog.length)}>
          Run to the end
        </button>
        <button type="button" className="metlab__gesto metlab__gesto--limpar" onClick={() => setCursor(0)}>
          Restart
        </button>
      </div>

      <div className="metlab__corpo">
        <section className="metlab__cartao" aria-label="The handler code">
          <h3 className="mono">checkout handler · click a line number to comment it out</h3>
          <ol className="manlab__codigo mono">
            {prog.map((i, n) => (
              <li key={n} data-atual={n === cursor ? "" : undefined} data-rodou={n < cursor ? "" : undefined} data-comentada={comentadas.has(n) ? "" : undefined}>
                <button type="button" className="manlab__gutter" aria-pressed={comentadas.has(n)} aria-label={`Comment out line ${n + 1}`} onClick={() => alternar(n)}>
                  {n + 1}
                </button>
                <code>{comentadas.has(n) ? `// ${i.codigo}` : i.codigo}</code>
              </li>
            ))}
          </ol>
        </section>

        <section className="metlab__cartao" aria-label="SDK memory and what the backend received">
          <h3 className="mono">SDK memory</h3>
          {estado.spans.length === 0 ? (
            <p className="metlab__vazio">Run the first line.</p>
          ) : (
            <ol className="loglab__spans mono">
              {estado.spans.map((s) => (
                <li key={s.id} data-aberto={s.fim === undefined ? "" : undefined} data-testid={`mem-${s.nome}`}>
                  {s.nome} <span>{s.fim === undefined ? "open" : "ended"}</span>
                  <small>{Object.entries(s.atributos).map(([k, v]) => `${k}=${v}`).join(" · ") || "no attributes"}</small>
                  {s.ignorados.length > 0 ? <em className="manlab__aviso"> dropped after end: {s.ignorados.join(", ")}</em> : null}
                  {nomeDeAltaCardinalidade(s.nome) ? <em className="manlab__aviso"> id in the name: high cardinality</em> : null}
                </li>
              ))}
            </ol>
          )}
          <h3 className="mono manlab__h">Backend received</h3>
          {backend.recebidos.length === 0 ? (
            <p className="metlab__vazio">Nothing yet — a span leaves when it ends.</p>
          ) : (
            <table className="metlab__tabela mono">
              <thead>
                <tr>
                  <th scope="col">span</th>
                  <th scope="col">parent</th>
                  <th scope="col">state</th>
                </tr>
              </thead>
              <tbody>
                {backend.recebidos.map((r) => (
                  <tr key={r.span.id}>
                    <td className="loglab__corpo">{r.span.nome}</td>
                    <td>{curto(r.span.parentId)}</td>
                    <td data-ruim={r.orfao ? "" : undefined}>{r.orfao ? "orphan" : r.span.parentId === undefined ? "root" : "child"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {terminou && backend.nuncaChegaram.length > 0 ? (
            <p className="metlab__veredito" data-testid="man-veredito">
              Never exported: <b>{backend.nuncaChegaram.map((s) => s.nome).join(", ")}</b> — it never ended.
            </p>
          ) : terminou ? (
            <p className="metlab__veredito" data-testid="man-veredito">
              Every span ended and arrived.
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
