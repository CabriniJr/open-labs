import { useEffect, useMemo, useRef, useState } from "react";
import { World, indexTree, seguir } from "@ovh/depth-core";
import type { Parada } from "@ovh/depth-core";
import {
  amostragemWorld,
  estadoDaAmostragem,
  LEITOR_DO_SPAN_AMOSTRADO,
  PARAMS_DA_AMOSTRAGEM,
  VIEWS_DA_AMOSTRAGEM,
} from "@ovh/otel-domain";
import { Explorer } from "./Explorer.js";
import { PainelDaCarga } from "./PainelDaCarga.js";

/**
 * O lab da amostragem.
 *
 * A pergunta da página é a de um plantão:
 *
 * > O trace do erro está no backend?
 *
 * E ela tem três respostas possíveis, que o placar mostra lado a lado porque
 * elas se consertam de maneiras diferentes: o trace está inteiro, o trace foi
 * cortado antes de existir o erro, ou o trace está lá **sem o span que
 * falhou**. A terceira é a pior, e é a que nenhum contador de produção
 * reportaria — aqui ela é um número porque o modelo sabe o tamanho do trace, e
 * um backend de verdade não sabe.
 *
 * Todo controle é parâmetro: mexer num deles mantém o tick e o estado
 * acumulado, então o leitor vê a transição entre dois regimes em vez de dois
 * runs separados.
 */

const CONTROLES = [
  "traces-por-tick",
  "spans-por-trace",
  "erro-a-cada",
  "head-mantem-1-em",
  "espera-do-tail",
  "tail-mantem-1-em",
  "rotear-por-trace",
] as const;

type Controle = (typeof CONTROLES)[number];

const INICIAIS = Object.fromEntries(
  CONTROLES.map((nome) => [nome, PARAMS_DA_AMOSTRAGEM[nome] ?? 0]),
) as Record<Controle, number>;

const numero = (n: number): string => n.toLocaleString("en-US");

export function AmostragemLab() {
  const [controles, setControles] = useState<Record<Controle, number>>(INICIAIS);
  const [tick, setTick] = useState(0);
  const [rodando, setRodando] = useState(true);
  const [seguindo, setSeguindo] = useState<string | undefined>(undefined);
  const [trajeto, setTrajeto] = useState<readonly Parada[]>([]);
  const seguindoRef = useRef<string | undefined>(undefined);
  seguindoRef.current = seguindo;
  const mundoRef = useRef<World | null>(null);

  const spec = useMemo(() => amostragemWorld(INICIAIS), []);
  const arvore = useMemo(() => indexTree(spec.root, spec.channels), [spec]);
  const mundo = useMemo(() => new World(spec), [spec]);
  mundoRef.current = mundo;

  useEffect(() => {
    if (!rodando) return;
    const id = window.setInterval(() => {
      const m = mundoRef.current;
      if (m === null) return;
      m.advance(1);
      setTick(m.tick);
      const chave = seguindoRef.current;
      if (chave !== undefined) {
        setTrajeto((antes) => seguir(antes, m.state, chave, LEITOR_DO_SPAN_AMOSTRADO));
      }
    }, 600);
    return () => window.clearInterval(id);
  }, [rodando, mundo]);

  const mexer = (nome: Controle, valor: number): void => {
    mundoRef.current?.setParam(nome, valor);
    setControles((c) => ({ ...c, [nome]: valor }));
  };

  const e = estadoDaAmostragem(mundo.state);
  const porTrace = controles["rotear-por-trace"] === 1;
  const amostrandoNoHead = controles["head-mantem-1-em"] > 1;

  const seguirCarga = (chave: string | undefined): void => {
    setSeguindo(chave);
    setTrajeto(chave === undefined ? [] : seguir([], mundo.state, chave, LEITOR_DO_SPAN_AMOSTRADO));
  };

  /**
   * O que cada caixa guarda. Os gateways mostram a retenção, porque a memória
   * é o preço do tail sampling e um preço que não aparece não é lido.
   */
  const conteudo = (id: string) => {
    if (id === "head") {
      return [
        { chave: "kept", valor: numero(e.headMantidos) },
        { chave: "cut", valor: numero(e.headCortados) },
        {
          chave: "error traces cut",
          valor: numero(e.errosCortadosNoHead),
          ...(e.errosCortadosNoHead > 0 ? { ativo: true } : {}),
        },
      ];
    }
    if (id === "balanceador") {
      return [
        { chave: "routing", valor: porTrace ? "by trace id" : "by arrival" },
        { chave: "to A", valor: numero(e.paraA) },
        { chave: "to B", valor: numero(e.paraB) },
      ];
    }
    if (id === "gatewayA" || id === "gatewayB") {
      // Cada instância com os números DELA: o lab é sobre decidir com o pedaço
      // que chegou, e dois painéis iguais afirmariam o contrário.
      const g = e.porGateway[id];
      return [
        { chave: "holding", valor: `${numero(g.retidos)} spans` },
        { chave: "open traces", valor: numero(g.tracesAbertos) },
        { chave: "kept · error", valor: numero(g.mantidosPorErro) },
        { chave: "kept · baseline", valor: numero(g.mantidosPorBase) },
        { chave: "cut", valor: numero(g.cortados) },
      ];
    }
    if (id === "backend") {
      return [
        { chave: "whole traces", valor: numero(e.completos) },
        {
          chave: "broken traces",
          valor: numero(e.quebrados),
          ...(e.quebrados > 0 ? { ativo: true } : {}),
        },
        ...e.ultimosNoBackend
          .slice(0, 3)
          .map((t) => ({ chave: `#${t.trace}${t.comErro ? " ⚠" : ""}`, valor: `${t.spans}/${t.de}` })),
      ];
    }
    if (id === "descartes") {
      return e.descartesPorQuem.length === 0
        ? [{ chave: "nothing dropped", valor: "0" }]
        : e.descartesPorQuem.map((d) => ({ chave: d.quem, valor: numero(d.quantos), ativo: true }));
    }
    return undefined;
  };

  const readouts: Record<string, string> = {
    app: `${numero(e.tracesIniciados)} traces · ${numero(e.comErro)} with an error`,
    head: amostrandoNoHead ? `1 in ${controles["head-mantem-1-em"]}` : "keeping everything",
    balanceador: porTrace ? "by trace id" : "by arrival",
    gatewayA: `${numero(e.porGateway.gatewayA.retidos)} holding`,
    gatewayB: `${numero(e.porGateway.gatewayB.retidos)} holding`,
    backend: `${numero(e.completos)} whole · ${numero(e.quebrados)} broken`,
    descartes: `${numero(e.descartesTotal)} dropped`,
  };

  /** A retenção contra a janela: a barra de sempre, e as casas. */
  const teto = Math.max(1, controles["spans-por-trace"] * controles["traces-por-tick"] * 4);
  const fills: Record<string, number> = {
    gatewayA: Math.min(1, e.porGateway.gatewayA.retidos / teto),
    gatewayB: Math.min(1, e.porGateway.gatewayB.retidos / teto),
  };

  return (
    <div className="amostragem-lab">
      <div className="amostragem-lab__palco">
        <Explorer
          tree={arvore}
          wires={spec.wires}
          state={mundo.state}
          previous={mundo.previousState}
          edgeTicks={spec.edgeTicks ?? 1}
          tickMs={600}
          views={VIEWS_DA_AMOSTRAGEM}
          inicial="amostragem"
          readouts={readouts}
          fills={fills}
          conteudo={conteudo}
          comFicha
          chaveDaCarga={LEITOR_DO_SPAN_AMOSTRADO.chave}
          cargaSeguida={seguindo}
          onSeguirCarga={seguirCarga}
          painelDaCarga={
            <PainelDaCarga
              titulo={seguindo ?? ""}
              trajeto={trajeto}
              onFechar={() => seguirCarga(undefined)}
              vazio="This one has already been decided. Click another span on a wire to follow it — and with routing by arrival, follow two spans of the same trace."
            />
          }
        />

        <div className="amostragem-lab__placar">
          <p className="amostragem-lab__pergunta">
            A request failed. Is its trace in the backend?
          </p>
          <div className="amostragem-lab__respostas">
            <div className="amostragem-lab__resposta">
              <span className="amostragem-lab__rotulo">error traces · whole</span>
              <b className="mono">{numero(e.errosInteiros)}</b>
              <span className="amostragem-lab__nota">
                of {numero(e.comErro)} that failed — these are queryable
              </span>
            </div>
            <div
              className="amostragem-lab__resposta"
              data-destaque={e.errosCortadosNoHead > 0 ? "true" : undefined}
            >
              <span className="amostragem-lab__rotulo">cut before the error existed</span>
              <b className="mono">{numero(e.errosCortadosNoHead)}</b>
              <span className="amostragem-lab__nota">
                {amostrandoNoHead
                  ? "no tail policy can recover these — they never arrived"
                  : "head sampling is off"}
              </span>
            </div>
            <div
              className="amostragem-lab__resposta"
              data-destaque={e.errosQuebrados > 0 ? "quebrado" : undefined}
            >
              <span className="amostragem-lab__rotulo">arrived broken</span>
              <b className="mono">{numero(e.errosQuebrados)}</b>
              <span className="amostragem-lab__nota">
                {porTrace
                  ? "routing by trace id keeps each trace whole"
                  : "in the backend, and missing the span that failed"}
              </span>
            </div>
          </div>
        </div>

        <div className="amostragem-lab__controles">
          <button type="button" onClick={() => setRodando((r) => !r)}>
            {rodando ? "Pause" : "Run"}
          </button>
          <span className="amostragem-lab__tick mono">t{tick}</span>

          <label className="amostragem-lab__switch">
            <input
              type="checkbox"
              checked={porTrace}
              onChange={(ev) => mexer("rotear-por-trace", ev.target.checked ? 1 : 0)}
            />
            load balancer routes by <code>traceID</code>
          </label>

          <label className="amostragem-lab__campo">
            <span>
              head sampler keeps <b className="mono">1 in {controles["head-mantem-1-em"]}</b>
            </span>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={controles["head-mantem-1-em"]}
              onChange={(ev) => mexer("head-mantem-1-em", Number(ev.target.value))}
            />
          </label>

          <label className="amostragem-lab__campo">
            <span>
              tail keeps <b className="mono">1 in {controles["tail-mantem-1-em"]}</b> of the rest
            </span>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={controles["tail-mantem-1-em"]}
              onChange={(ev) => mexer("tail-mantem-1-em", Number(ev.target.value))}
            />
          </label>

          <label className="amostragem-lab__campo">
            <span>
              decision window <b className="mono">{controles["espera-do-tail"]} ticks</b>
            </span>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={controles["espera-do-tail"]}
              onChange={(ev) => mexer("espera-do-tail", Number(ev.target.value))}
            />
          </label>

          <label className="amostragem-lab__campo">
            <span>
              traces per second <b className="mono">{controles["traces-por-tick"]}</b>
            </span>
            <input
              type="range"
              min={0}
              max={5}
              step={1}
              value={controles["traces-por-tick"]}
              onChange={(ev) => mexer("traces-por-tick", Number(ev.target.value))}
            />
          </label>

          <label className="amostragem-lab__campo">
            <span>
              one error every <b className="mono">{controles["erro-a-cada"]} traces</b>
            </span>
            <input
              type="range"
              min={2}
              max={12}
              step={1}
              value={controles["erro-a-cada"]}
              onChange={(ev) => mexer("erro-a-cada", Number(ev.target.value))}
            />
          </label>

          <label className="amostragem-lab__campo">
            <span>
              spans per trace <b className="mono">{controles["spans-por-trace"]}</b>
            </span>
            <input
              type="range"
              min={1}
              max={6}
              step={1}
              value={controles["spans-por-trace"]}
              onChange={(ev) => mexer("spans-por-trace", Number(ev.target.value))}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
