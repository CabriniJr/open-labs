import { useEffect, useMemo, useRef, useState } from "react";
import { World, indexTree, seguir } from "@ovh/depth-core";
import type { Parada } from "@ovh/depth-core";
import { Trilha } from "@ovh/depth-ui";
import {
  heroiWorld,
  LEITOR_DO_SPAN,
  tituloDoSpan,
  VIEWS_DO_HEROI,
} from "@ovh/otel-domain";
import { Explorer } from "./Explorer.js";

/**
 * O herói da landing: o mesmo motor que o leitor vai encontrar no primeiro lab.
 *
 * Ele roda o mundo do herói e **abre já seguindo** um span — a trilha ao lado
 * do palco desde o primeiro quadro. Uma vitrine que exige um clique para mostrar
 * o que tem de diferente mostra, para a maioria das visitas, nada.
 *
 * **Sem nenhum controle**, de propósito: controle é assunto de lab. Os gestos
 * são três — a carga anda sozinha, clicar em outro item troca quem está sendo
 * seguido, e duplo clique numa caixa desce para dentro dela.
 */

const TICK_MS = 700;

export function HeroSim() {
  const [, setTick] = useState(0);
  const [seguindo, setSeguindo] = useState<string | undefined>(undefined);
  const [trajeto, setTrajeto] = useState<readonly Parada[]>([]);
  const seguindoRef = useRef<string | undefined>(undefined);
  seguindoRef.current = seguindo;

  const spec = useMemo(() => heroiWorld(), []);
  const arvore = useMemo(() => indexTree(spec.root, spec.channels), [spec]);
  const mundo = useMemo(() => new World(spec), [spec]);
  const mundoRef = useRef<World | null>(null);
  mundoRef.current = mundo;

  useEffect(() => {
    /*
      Quem pediu para não ver movimento não vê: o palco fica no estado inicial,
      legível e parado. É o mesmo respeito que o herói antigo tinha.
    */
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = window.setInterval(() => {
      const m = mundoRef.current;
      if (m === null) return;
      m.advance(1);
      setTick(m.tick);

      const chave = seguindoRef.current;
      if (chave === undefined) {
        /*
          Ninguém escolheu ainda: o herói escolhe por conta própria o primeiro
          item que aparecer, e é assim que a trilha está aberta desde o começo.
        */
        const primeiro = m.state.flight
          .map((item) => LEITOR_DO_SPAN.chave(item.message))
          .find((c): c is string => c !== undefined);
        if (primeiro !== undefined) {
          setSeguindo(primeiro);
          setTrajeto(seguir([], m.state, primeiro, LEITOR_DO_SPAN));
        }
        return;
      }
      setTrajeto((antes) => seguir(antes, m.state, chave, LEITOR_DO_SPAN));
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [mundo]);

  const seguirCarga = (chave: string | undefined): void => {
    // Trajeto novo a cada escolha: misturar o de duas cargas seria a trilha
    // afirmando um percurso que ninguém andou.
    if (chave === undefined) return;
    setSeguindo(chave);
    setTrajeto(seguir([], mundo.state, chave, LEITOR_DO_SPAN));
  };

  return (
    <div className="hero-sim">
      <Explorer
        tree={arvore}
        wires={spec.wires}
        state={mundo.state}
        previous={mundo.previousState}
        edgeTicks={spec.edgeTicks ?? 1}
        tickMs={TICK_MS}
        views={VIEWS_DO_HEROI}
        inicial="pipeline"
        chaveDaCarga={LEITOR_DO_SPAN.chave}
        cargaSeguida={seguindo}
        onSeguirCarga={seguirCarga}
      />

      <Trilha
        trajeto={trajeto}
        titulo={seguindo === undefined ? "waiting for the first span" : tituloDoSpan(seguindo)}
        vazio="The first span is on its way."
      />
    </div>
  );
}
