import { useEffect, useMemo, useRef, useState } from "react";
import { World, indexTree } from "@ovh/depth-core";
import {
  ALGO_VIEWS,
  avaliar,
  conteudoDaCaixa,
  leituraDaCarga,
  lerExpressao,
  rpnWorld,
} from "@ovh/algo-domain";
import type { EstadoPilha, EstadoVisor, Token } from "@ovh/algo-domain";
import { Explorer } from "./Explorer.js";

/**
 * A calculadora polonesa reversa, rodando.
 *
 * O ponto do lab não é a conta — é que **um algoritmo é um sistema de peças**.
 * A pilha não é uma variável escondida no código: é uma caixa na tela, com o
 * que ela guarda visível, e o topo marcado. O compasso não é um `setTimeout`:
 * é a pilha pedindo o próximo símbolo quando terminou de aplicar o anterior.
 */

const EXPRESSAO_INICIAL = "3 4 + 2 5 + *";

export function RpnLab() {
  const [fonte, setFonte] = useState(EXPRESSAO_INICIAL);
  const [tokens, setTokens] = useState<readonly Token[]>(() => {
    const r = lerExpressao(EXPRESSAO_INICIAL);
    return r.ok ? r.tokens : [];
  });
  const [erros, setErros] = useState<readonly string[]>([]);
  const [tick, setTick] = useState(0);
  const [rodando, setRodando] = useState(true);
  const [compasso, setCompasso] = useState(520);

  const spec = useMemo(() => rpnWorld(tokens), [tokens]);
  const arvore = useMemo(() => indexTree(spec.root), [spec]);
  const mundoRef = useRef<World | null>(null);
  const specRef = useRef(spec);
  if (mundoRef.current === null) mundoRef.current = new World(spec);
  // Trocar a expressão é recomeçar a máquina: a fita é outra, e continuar de
  // onde estava seria rodar um programa com a memória de outro.
  if (specRef.current !== spec) {
    specRef.current = spec;
    mundoRef.current = new World(spec);
  }

  useEffect(() => {
    if (!rodando) return;
    const id = window.setInterval(() => {
      const mundo = mundoRef.current;
      if (mundo === null) return;
      mundo.advance(1);
      setTick(mundo.tick);
    }, compasso);
    return () => window.clearInterval(id);
  }, [rodando, compasso]);

  const mundo = mundoRef.current;
  const estado = mundo?.state;
  if (mundo === null || estado === undefined) return null;

  const pilha = (estado.nodes.pilha as EstadoPilha | undefined)?.itens ?? [];
  const visor = estado.nodes.visor as EstadoVisor | undefined;
  const posDaFita = (estado.nodes.fita as { readonly pos: number } | undefined)?.pos ?? 0;
  const esperado = avaliar(tokens);
  const respondeu = posDaFita === tokens.length && pilha.length === 1;

  const readouts: Record<string, string> = {
    fita: `${posDaFita}/${tokens.length}`,
    pilha: `${pilha.length} deep`,
    visor: visor?.erro !== undefined ? "error" : `${visor?.resultados.length ?? 0} results`,
  };

  const montar = (texto: string): void => {
    const r = lerExpressao(texto);
    if (!r.ok) {
      setErros(r.errors.map((e) => (e.posicao === 0 ? e.message : `symbol ${e.posicao}: ${e.message}`)));
      return;
    }
    setErros([]);
    setTokens(r.tokens);
    setTick(0);
    setRodando(true);
  };

  return (
    <div className="rpn-lab">
      <div className="rpn-lab__palco">
        <Explorer
          tree={arvore}
          wires={spec.wires}
          state={estado}
          previous={mundo.previousState}
          edgeTicks={spec.edgeTicks ?? 1}
          tickMs={compasso}
          views={ALGO_VIEWS}
          readouts={readouts}
          leituraDaCarga={leituraDaCarga}
          conteudo={conteudoDaCaixa(estado, tokens)}
          comFicha
        />
        <p className="rpn-lab__legenda">
          Nothing here is scheduled. The stack asks the tape for the next symbol
          only after it has applied the last one — which is why two operators in
          a row do not run into each other, and why a longer expression takes
          more ticks. That is what pacing means in a system that actually runs.
        </p>
      </div>

      <aside className="rpn-lab__painel">
        <section>
          <h3>Expression</h3>
          <label className="rpn-lab__campo">
            <input
              className="mono"
              value={fonte}
              onChange={(e) => setFonte(e.target.value)}
              aria-label="Postfix expression"
              spellCheck={false}
            />
          </label>
          <button type="button" onClick={() => montar(fonte)}>
            Load and restart
          </button>
          {erros.length > 0 ? (
            <ul className="rpn-lab__erros">
              {erros.map((erro) => (
                <li key={erro}>{erro}</li>
              ))}
            </ul>
          ) : (
            <p className="rpn-lab__nota">
              Postfix: the operator comes after its two values. No parentheses
              exist, and none are needed — the order is the grouping.
            </p>
          )}
        </section>

        <section>
          <h3>Stack</h3>
          <ol className="rpn-lab__pilha mono" reversed>
            {[...pilha].reverse().map((valor, i) => (
              <li key={`${String(i)}:${String(valor)}`} data-topo={i === 0 ? "true" : undefined}>
                {valor}
              </li>
            ))}
          </ol>
          {pilha.length === 0 ? <p className="rpn-lab__nota">Empty.</p> : null}
        </section>

        <section>
          <h3>Answer</h3>
          <p className="rpn-lab__resultado mono">
            {visor?.erro !== undefined
              ? visor.erro
              : respondeu
                ? String(pilha[0])
                : "…"}
          </p>
          <p className="rpn-lab__nota">
            {esperado === undefined
              ? "This expression has no answer."
              : `Written the ordinary way, this is ${String(esperado)}. The machine gets there by moving items.`}
          </p>
        </section>

        <div className="rpn-lab__controles">
          <button type="button" onClick={() => setRodando((r) => !r)}>
            {rodando ? "Pause" : "Run"}
          </button>
          <button
            type="button"
            onClick={() => {
              setRodando(false);
              mundo.advance(1);
              setTick(mundo.tick);
            }}
          >
            One tick
          </button>
          <label className="rpn-lab__compasso">
            speed
            <input
              type="range"
              min={120}
              max={1200}
              step={40}
              value={1320 - compasso}
              onChange={(e) => setCompasso(1320 - Number(e.target.value))}
              aria-label="Clock speed"
            />
          </label>
          <span className="rpn-lab__tick mono">tick {tick}</span>
        </div>
      </aside>
    </div>
  );
}
