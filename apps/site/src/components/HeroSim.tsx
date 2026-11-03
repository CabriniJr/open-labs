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
 * A carga anda sozinha, mas o leitor pode pausar para inspecionar. Clicar em
 * outro item troca quem está sendo seguido; duplo clique numa caixa abre o
 * interior. Os controles de câmera vêm do palco compartilhado.
 */

const TICK_MS = 700;

/**
 * Quantos ticks o quadro parado adianta de uma vez.
 *
 * O bastante para um span sair do serviço, atravessar as três peças do collector
 * e chegar ao backend — a trilha inteira, com o campo que o processador
 * acrescentou. Menos que isso mostraria meia história parada, que é pior que
 * nenhuma: o leitor não teria como saber que falta metade.
 *
 * Eram oito quando o collector era uma caixa fechada, e a chegada era no tick 5.
 * Abrir a caixa pôs dois saltos a mais no caminho, e o número aqui **não** é um
 * detalhe de animação: ele é quanto do trajeto o leitor parado consegue ler.
 * Se o mundo ganhar peça, este número sobe junto — ou o comentário acima passa
 * a mentir, que é o defeito que esta rodada existe para tirar do projeto.
 */
const TICKS_DO_QUADRO_PARADO = 12;

/** A chave do primeiro item que aparecer em voo, se houver algum. */
function primeiroEmVoo(mundo: World): string | undefined {
  return mundo.state.flight
    .map((item) => LEITOR_DO_SPAN.chave(item.message))
    .find((chave): chave is string => chave !== undefined);
}

export function HeroSim() {
  const [, setTick] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused;
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
    const inicial = mundoRef.current;
    if (inicial === null) return;

    /*
      Quem pediu para não ver movimento ganha o quadro **parado com conteúdo**,
      e não o vazio.

      A primeira versão simplesmente não ligava o relógio, e com isso a trilha
      ficava na mensagem de espera — "The first span is on its way" — para um
      leitor que nunca ia ver o span chegar. Uma vitrine dizendo o que não vai
      acontecer é o mesmo defeito que esta rodada existe para tirar da landing.

      Então o mundo anda de uma vez até a história fechar, e para ali. Nada se
      move na tela, e ainda assim há um trajeto de verdade para ler.
    */
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReduced(true);
      let chave: string | undefined;
      let trilho: readonly Parada[] = [];
      for (let i = 0; i < TICKS_DO_QUADRO_PARADO; i += 1) {
        inicial.advance(1);
        chave ??= primeiroEmVoo(inicial);
        if (chave !== undefined) {
          trilho = seguir(trilho, inicial.state, chave, LEITOR_DO_SPAN);
        }
      }
      setTick(inicial.tick);
      if (chave !== undefined) {
        setSeguindo(chave);
        setTrajeto(trilho);
      }
      return;
    }

    const id = window.setInterval(() => {
      if (pausedRef.current) return;
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
        const primeiro = primeiroEmVoo(m);
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
      <div className="hero-sim__transport"><span className="mono">{reduced ? "Still frame · reduced motion" : paused ? "Paused · take a closer look" : "Running · select a part to inspect"}</span>{!reduced && <button type="button" aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? "Resume simulation" : "Pause simulation"}</button>}</div>
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
