import { Trilha } from "@ovh/depth-ui";
import type { Parada } from "@ovh/depth-core";

/**
 * O painel lateral de quem está seguindo uma carga num lab.
 *
 * O que ele desenha é a `Trilha` — a mesma peça que o herói usa. O painel só
 * acrescenta a moldura e o botão de parar: nos labs o protagonista continua
 * sendo a fábrica, e o item é convidado. Uma fonte por fato — a lista de
 * paradas tinha dois desenhos possíveis e agora tem um.
 */
export interface PainelDaCargaProps {
  readonly titulo: string;
  readonly trajeto: readonly Parada[];
  readonly onFechar: () => void;
  /** O que dizer quando a carga ainda não apareceu, ou já chegou ao fim. */
  readonly vazio: string;
}

export function PainelDaCarga({ titulo, trajeto, onFechar, vazio }: PainelDaCargaProps) {
  return (
    <aside className="carga-painel" aria-label="Following one item">
      <header className="carga-painel__topo">
        <button type="button" onClick={onFechar}>
          stop following
        </button>
      </header>
      <Trilha trajeto={trajeto} titulo={titulo} vazio={vazio} />
    </aside>
  );
}
