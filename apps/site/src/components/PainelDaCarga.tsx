import { Inspector } from "@ovh/depth-ui";
import type { Parada } from "../lib/seguir.js";
import { PARADAS_NO_PAINEL } from "../lib/seguir.js";

/**
 * O painel de quem está seguindo uma carga.
 *
 * Duas coisas, e a segunda é a que faltava no projeto inteiro: **o corpo agora**
 * e **o trajeto até aqui**, com o que cada parada mudou. É o enriquecimento
 * acontecendo — o cabeçalho reescrito a cada salto, o campo que some quando um
 * proxy o derruba —, e não uma legenda dizendo que ele acontece.
 *
 * O `Inspector` é o mesmo do herói da landing, com os caminhos alterados
 * marcados. Ele existia desde o primeiro dia e nunca tinha entrado num lab.
 */
export interface PainelDaCargaProps {
  readonly titulo: string;
  readonly trajeto: readonly Parada[];
  readonly onFechar: () => void;
  /** O que dizer quando a carga ainda não apareceu, ou já chegou ao fim. */
  readonly vazio: string;
}

export function PainelDaCarga({ titulo, trajeto, onFechar, vazio }: PainelDaCargaProps) {
  const ultima = trajeto.at(-1);
  const paradas = trajeto.slice(-PARADAS_NO_PAINEL);

  return (
    <aside className="carga-painel" aria-label="Following one item">
      <header className="carga-painel__topo">
        <p className="carga-painel__titulo mono">{titulo}</p>
        <button type="button" onClick={onFechar}>
          stop following
        </button>
      </header>

      {ultima === undefined ? (
        <p className="carga-painel__vazio">{vazio}</p>
      ) : (
        <>
          <ol className="carga-painel__trajeto mono">
            {paradas.map((parada, i) => (
              <li
                key={`${parada.tick}:${parada.de}:${parada.para}`}
                data-atual={i === paradas.length - 1 ? "true" : undefined}
                data-mudou={parada.mudou.length > 0 ? "true" : undefined}
              >
                <span className="carga-painel__salto">
                  {parada.de} → {parada.para}
                </span>
                <span className="carga-painel__delta">
                  {parada.mudou.length === 0
                    ? i === 0
                      ? "first sighting"
                      : "unchanged"
                    : parada.mudou.join(", ")}
                </span>
              </li>
            ))}
          </ol>

          {/*
            O corpo, com o que mudou na ÚLTIMA parada marcado. É a mesma peça do
            herói da landing, e o mesmo gesto: o campo que acabou de mudar pisca
            no lugar em que ele mora.
          */}
          <Inspector
            value={ultima.corpo}
            changedPaths={ultima.mudou}
            label={`as it left ${ultima.de}`}
          />
        </>
      )}
    </aside>
  );
}
