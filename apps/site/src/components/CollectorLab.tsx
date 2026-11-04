import { useEffect, useMemo, useRef, useState } from "react";
import { World, indexTree, seguir } from "@ovh/depth-core";
import type { Parada } from "@ovh/depth-core";
import {
  collectorWorld,
  estadoDoCollector,
  LEITOR_DO_SPAN_DO_COLLECTOR,
  PARAMS_DO_COLLECTOR,
  ROTA_FILTRADA,
  VIEWS_DO_COLLECTOR,
} from "@ovh/otel-domain";
import { Explorer } from "./Explorer.js";
import { PainelDaCarga } from "./PainelDaCarga.js";

/**
 * O lab do Collector.
 *
 * A pergunta da página é a que alguém faz depois de editar um `config.yaml`:
 *
 * > Liguei um `filter` para parar de mandar `/health`. Paramos?
 *
 * E a resposta é um número que **não muda**. O contador de `/health` no backend
 * fica onde estava quando o filtro liga, e o do stdout cai pela metade — os dois
 * lado a lado são a resposta inteira, e nenhum deles é texto dizendo ao leitor o
 * que concluir.
 *
 * Seguir um span é a mesma tese vista de dentro: o trajeto de **um** item se
 * abre em dois braços no receiver e segue até dois destinos. A cópia não é
 * afirmada, ela aparece duas vezes no mesmo painel.
 *
 * Todo controle é **parâmetro**: mexer num deles mantém o tick e o estado
 * acumulado, e o mundo reage de onde está. Um lab que recomeçasse a cada
 * arrasto apagaria a transição entre dois regimes, que é onde está o
 * aprendizado.
 */

const CONTROLES = [
  "spans-por-tick",
  "tamanho-do-lote",
  "timeout-do-lote",
  "limite-de-memoria",
  "filtrar-health-checks",
] as const;

type Controle = (typeof CONTROLES)[number];

const INICIAIS: Record<Controle, number> = {
  "spans-por-tick": PARAMS_DO_COLLECTOR["spans-por-tick"]!,
  "tamanho-do-lote": PARAMS_DO_COLLECTOR["tamanho-do-lote"]!,
  "timeout-do-lote": PARAMS_DO_COLLECTOR["timeout-do-lote"]!,
  "limite-de-memoria": PARAMS_DO_COLLECTOR["limite-de-memoria"]!,
  "filtrar-health-checks": PARAMS_DO_COLLECTOR["filtrar-health-checks"]!,
};

const numero = (n: number): string => n.toLocaleString("en-US");

export function CollectorLab() {
  const [controles, setControles] = useState<Record<Controle, number>>(INICIAIS);
  const [tick, setTick] = useState(0);
  const [rodando, setRodando] = useState(true);
  const [seguindo, setSeguindo] = useState<string | undefined>(undefined);
  const [trajeto, setTrajeto] = useState<readonly Parada[]>([]);
  const seguindoRef = useRef<string | undefined>(undefined);
  seguindoRef.current = seguindo;
  const mundoRef = useRef<World | null>(null);

  const spec = useMemo(() => collectorWorld(INICIAIS), []);
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
        setTrajeto((antes) => seguir(antes, m.state, chave, LEITOR_DO_SPAN_DO_COLLECTOR));
      }
    }, 600);
    return () => window.clearInterval(id);
  }, [rodando, mundo]);

  const mexer = (nome: Controle, valor: number): void => {
    mundoRef.current?.setParam(nome, valor);
    setControles((c) => ({ ...c, [nome]: valor }));
  };

  const e = estadoDoCollector(mundo.state);
  const filtrando = controles["filtrar-health-checks"] === 1;

  const seguirCarga = (chave: string | undefined): void => {
    setSeguindo(chave);
    setTrajeto(chave === undefined ? [] : seguir([], mundo.state, chave, LEITOR_DO_SPAN_DO_COLLECTOR));
  };

  /**
   * O que cada caixa guarda. O lote mostra a fila e a idade dela, porque é a
   * idade que explica um lote que sai sem estar cheio — e é esse o ponto do
   * `timeout`.
   */
  const conteudo = (id: string) => {
    if (id === "lote") {
      return [
        { chave: "holding", valor: numero(e.retidos) },
        { chave: "age", valor: `${numero(e.idadeDoLote)} / ${numero(controles["timeout-do-lote"])}` },
        { chave: "closed by size", valor: numero(e.fechadosPorTamanho) },
        {
          chave: "closed by timeout",
          valor: numero(e.fechadosPorTempo),
          ...(e.fechadosPorTempo > 0 ? { ativo: true } : {}),
        },
      ];
    }
    if (id === "backend") {
      return [
        {
          chave: `${ROTA_FILTRADA} arrived`,
          valor: numero(e.healthNoBackend),
          ...(filtrando && e.healthNoBackend > 0 ? { ativo: true } : {}),
        },
        ...e.ultimosNoBackend.slice(0, 4).map((s) => ({ chave: `#${s.n}`, valor: s.rota })),
      ];
    }
    if (id === "console") {
      return [
        { chave: `${ROTA_FILTRADA} arrived`, valor: numero(e.healthNoConsole) },
        ...e.ultimosNoConsole.slice(0, 4).map((s) => ({ chave: `#${s.n}`, valor: s.rota })),
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
    app: `${numero(e.emitidos)} spans`,
    receiver: `${numero(e.recebidos)} in · 1 out`,
    limiter: `${numero(e.admitidos)} admitted`,
    lote: `${numero(e.retidos)} holding`,
    backend: `${numero(e.noBackend)} spans`,
    filtro: filtrando ? `${numero(e.barrados)} blocked` : "passing all",
    console: `${numero(e.noConsole)} spans`,
    descartes: `${numero(e.descartesTotal)} dropped`,
  };

  /** A fila do lote contra o tamanho declarado: a barra de sempre, e as casas. */
  const fills: Record<string, number> = {
    lote: Math.min(1, e.retidos / Math.max(1, controles["tamanho-do-lote"])),
  };
  const capacidades: Record<string, number> = { lote: controles["tamanho-do-lote"] };

  return (
    <div className="collector-lab">
      <div className="collector-lab__palco">
        <Explorer
          tree={arvore}
          wires={spec.wires}
          state={mundo.state}
          previous={mundo.previousState}
          edgeTicks={spec.edgeTicks ?? 1}
          tickMs={600}
          views={VIEWS_DO_COLLECTOR}
          inicial="collector"
          readouts={readouts}
          fills={fills}
          capacidades={capacidades}
          conteudo={conteudo}
          comFicha
          chaveDaCarga={LEITOR_DO_SPAN_DO_COLLECTOR.chave}
          cargaSeguida={seguindo}
          onSeguirCarga={seguirCarga}
          painelDaCarga={
            <PainelDaCarga
              titulo={seguindo ?? ""}
              trajeto={trajeto}
              onFechar={() => seguirCarga(undefined)}
              vazio="This one has already landed. Click another item on a wire to follow it — and watch it appear on both branches."
            />
          }
        />

        <div className="collector-lab__placar">
          <p className="collector-lab__pergunta">
            I turned on a <code>filter</code> to stop sending <code>{ROTA_FILTRADA}</code>. Did we
            stop?
          </p>
          <div className="collector-lab__respostas">
            <div className="collector-lab__resposta" data-destaque={filtrando ? "true" : undefined}>
              <span className="collector-lab__rotulo">backend · pipeline traces</span>
              <b className="mono">{numero(e.healthNoBackend)}</b>
              <span className="collector-lab__nota">
                {filtrando ? "still arriving — the filter is in the other pipeline" : "arriving"}
              </span>
            </div>
            <div className="collector-lab__resposta">
              <span className="collector-lab__rotulo">stdout · pipeline traces/audit</span>
              <b className="mono">{numero(e.healthNoConsole)}</b>
              <span className="collector-lab__nota">
                {filtrando ? "blocked here, and only here" : "arriving"}
              </span>
            </div>
          </div>
        </div>

        <div className="collector-lab__controles">
          <button type="button" onClick={() => setRodando((r) => !r)}>
            {rodando ? "Pause" : "Run"}
          </button>
          <span className="collector-lab__tick mono">t{tick}</span>

          <label className="collector-lab__switch">
            <input
              type="checkbox"
              checked={filtrando}
              onChange={(ev) => mexer("filtrar-health-checks", ev.target.checked ? 1 : 0)}
            />
            <code>filter</code> drops <code>{ROTA_FILTRADA}</code> in <code>traces/audit</code>
          </label>

          <label className="collector-lab__campo">
            <span>
              spans per second <b className="mono">{controles["spans-por-tick"]}</b>
            </span>
            <input
              type="range"
              min={0}
              max={8}
              step={1}
              value={controles["spans-por-tick"]}
              onChange={(ev) => mexer("spans-por-tick", Number(ev.target.value))}
            />
          </label>

          <label className="collector-lab__campo">
            <span>
              <code>send_batch_size</code> <b className="mono">{controles["tamanho-do-lote"]}</b>
            </span>
            <input
              type="range"
              min={1}
              max={12}
              step={1}
              value={controles["tamanho-do-lote"]}
              onChange={(ev) => mexer("tamanho-do-lote", Number(ev.target.value))}
            />
          </label>

          <label className="collector-lab__campo">
            <span>
              <code>timeout</code>{" "}
              <b className="mono">{controles["timeout-do-lote"]} ticks</b>
            </span>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={controles["timeout-do-lote"]}
              onChange={(ev) => mexer("timeout-do-lote", Number(ev.target.value))}
            />
          </label>

          <label className="collector-lab__campo">
            <span>
              <code>memory_limiter</code> admits{" "}
              <b className="mono">{controles["limite-de-memoria"]}/s</b>
            </span>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={controles["limite-de-memoria"]}
              onChange={(ev) => mexer("limite-de-memoria", Number(ev.target.value))}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
