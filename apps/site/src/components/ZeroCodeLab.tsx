import { DURACAO_DA_REQUISICAO, PASSOS_ZERO_CODE, traceDaRequisicao } from "@ovh/otel-domain";
import { useState } from "react";

/**
 * A simulação do zero-code: a mesma requisição do filme, e o leitor decidindo
 * quais passos do próprio código ganham um span manual. O waterfall e o tempo
 * escuro são `traceDaRequisicao`.
 */
export function ZeroCodeLab() {
  const [manuais, setManuais] = useState<ReadonlySet<string>>(new Set());
  const t = traceDaRequisicao(manuais);
  const alternar = (id: string) =>
    setManuais((m) => {
      const n = new Set(m);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const pct = (ms: number) => `${(ms / DURACAO_DA_REQUISICAO) * 100}%`;

  return (
    <div className="metlab" data-testid="zerocode-lab">
      <div className="metlab__corpo">
        <section className="metlab__cartao" aria-label="The request, step by step">
          <h3 className="mono">POST /checkout · what runs, in order</h3>
          <ol className="loglab__spans mono">
            {PASSOS_ZERO_CODE.map((p) => (
              <li key={p.id} data-aberto={p.spanAuto !== undefined || manuais.has(p.id) ? "" : undefined}>
                {p.nome} <span>{p.fim - p.inicio} ms</span>
                <small>{p.spanAuto !== undefined ? "auto · library" : "your code"}</small>
                {p.camada === "proprio" ? (
                  <label className="ctxlab-switch zclab__chave" htmlFor={`zc-${p.id}`}>
                    <input id={`zc-${p.id}`} type="checkbox" role="switch" checked={manuais.has(p.id)} onChange={() => alternar(p.id)} />
                    <span className="ctxlab-switch__track" aria-hidden="true">
                      <span />
                    </span>
                    <span>wrap in a manual span</span>
                  </label>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
        <section className="metlab__cartao" aria-label="The trace">
          <h3 className="mono">The trace · {t.spans.length} spans</h3>
          <ol className="zclab__waterfall mono">
            {t.spans.map((s) => (
              <li key={s.nome} data-origem={s.origem}>
                <span className="zclab__barra" style={{ marginInlineStart: pct(s.inicio), width: pct(s.fim - s.inicio) }} />
                <small>
                  {s.nome} · {s.fim - s.inicio} ms{s.origem === "manual" ? " · manual" : ""}
                </small>
              </li>
            ))}
            <li data-origem="escuro">
              <span className="zclab__trilho">
                {t.escuro.map((e) => (
                  <span key={e.inicio} className="zclab__escuro" style={{ left: pct(e.inicio), width: pct(e.fim - e.inicio) }} />
                ))}
              </span>
              <small>no child span</small>
            </li>
          </ol>
          <p className="metlab__veredito" data-testid="zc-veredito">
            <b>{t.msEscuros} ms</b> of {DURACAO_DA_REQUISICAO} ms unexplained · <b>{Math.round(t.cobertura * 100)}%</b> covered by child spans
          </p>
        </section>
      </div>
    </div>
  );
}
