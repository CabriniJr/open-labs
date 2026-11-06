import { ORDEM_CODIGO_PRIMEIRO, ORDEM_RECOMENDADA, planejar, riscosDoPlano, type IdDaEtapa } from "@ovh/otel-domain";
import { useState } from "react";
import { url } from "../lib/urls";

/**
 * O planejador do rollout: as mesmas seis etapas do filme, na ordem que o
 * leitor escolher. Cada etapa diz o que faltava antes dela e o que destrava;
 * o plano é `planejar`, e cada etapa leva ao lab que a explica.
 */
export function RolloutLab() {
  const [ordem, setOrdem] = useState<readonly IdDaEtapa[]>(ORDEM_CODIGO_PRIMEIRO);
  const plano = planejar(ordem);
  const n = riscosDoPlano(plano);
  const mover = (i: number, d: -1 | 1) =>
    setOrdem((o) => {
      const j = i + d;
      if (j < 0 || j >= o.length) return o;
      const nova = [...o];
      [nova[i], nova[j]] = [nova[j]!, nova[i]!];
      return nova;
    });

  return (
    <div className="metlab" data-testid="rollout-lab">
      <div className="metlab__gestos">
        <button type="button" className="metlab__gesto" onClick={() => setOrdem(ORDEM_CODIGO_PRIMEIRO)}>
          Start from code
        </button>
        <button type="button" className="metlab__gesto metlab__gesto--coleta" onClick={() => setOrdem(ORDEM_RECOMENDADA)}>
          Recommended order
        </button>
      </div>
      <ol className="rolab__plano">
        {plano.map((p, i) => (
          <li key={p.etapa.id} data-risco={p.faltando.length > 0 ? "" : undefined}>
            <div className="rolab__cabeca">
              <b>
                {i + 1}. {p.etapa.titulo}
              </b>
              <span className="rolab__mover">
                <button type="button" aria-label={`Move ${p.etapa.titulo} up`} disabled={i === 0} onClick={() => mover(i, -1)}>
                  ↑
                </button>
                <button type="button" aria-label={`Move ${p.etapa.titulo} down`} disabled={i === plano.length - 1} onClick={() => mover(i, 1)}>
                  ↓
                </button>
              </span>
            </div>
            <p>{p.etapa.acao}</p>
            {p.faltando.map((f) => (
              <p key={f.de} className="rolab__aviso">
                Too early: {f.sem}.
              </p>
            ))}
            <p className="rolab__rodape mono">
              <a href={url(p.etapa.lab)}>{p.etapa.labTitulo} →</a> · {p.etapa.custo} effort · answers: {p.etapa.destrava.join(" · ")}
            </p>
          </li>
        ))}
      </ol>
      <p className="metlab__veredito" data-testid="ro-veredito">
        <b>{n}</b> {n === 1 ? "step" : "steps"} done before their prerequisites
      </p>
    </div>
  );
}
