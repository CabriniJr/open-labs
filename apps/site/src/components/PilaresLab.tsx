import { useEffect, useMemo, useRef, useState } from "react";
import { World, indexTree } from "@ovh/depth-core";
import {
  estadoDosPilares,
  LEITOR_DA_REQUISICAO,
  MAL_ENTENDIDOS_DOS_PILARES,
  PARAMS_DOS_PILARES,
  pilaresWorld,
  VIEWS_DOS_PILARES,
} from "@ovh/otel-domain";
import { seguir } from "../lib/seguir.js";
import type { Parada } from "../lib/seguir.js";
import { Explorer } from "./Explorer.js";
import { PainelDaCarga } from "./PainelDaCarga.js";

/**
 * O lab dos três pilares.
 *
 * A pergunta da página é a que o leitor vai fazer no trabalho:
 *
 * > Quais requisições passaram de 250 ms?
 *
 * E a resposta dos três é o lab inteiro. Ela **sai do estado** — o tracer
 * responde porque tem as linhas, o medidor não responde porque só tem
 * contagens, o registrador responde se o código escolheu falar. Nenhuma delas é
 * texto dizendo ao leitor o que concluir.
 *
 * Todo controle aqui é **parâmetro**: mexer num deles mantém o tick e o estado
 * acumulado, e o mundo reage de onde está. Um lab que recomeçasse a cada arrasto
 * apagaria a transição entre dois regimes, que é onde está o aprendizado.
 */

const CONTROLES = [
  "requisicoes-por-tick",
  "erro-a-cada",
  "registrar-tudo",
  "atributo-por-usuario",
  "limite-de-series",
  "pergunta-acima-de",
] as const;

type Controle = (typeof CONTROLES)[number];

const INICIAIS: Record<Controle, number> = {
  "requisicoes-por-tick": PARAMS_DOS_PILARES["requisicoes-por-tick"]!,
  "erro-a-cada": PARAMS_DOS_PILARES["erro-a-cada"]!,
  "registrar-tudo": PARAMS_DOS_PILARES["registrar-tudo"]!,
  "atributo-por-usuario": PARAMS_DOS_PILARES["atributo-por-usuario"]!,
  "limite-de-series": PARAMS_DOS_PILARES["limite-de-series"]!,
  "pergunta-acima-de": PARAMS_DOS_PILARES["pergunta-acima-de"]!,
};

const numero = (n: number): string => n.toLocaleString("en-US");

export function PilaresLab() {
  const [controles, setControles] = useState<Record<Controle, number>>(INICIAIS);
  const [tick, setTick] = useState(0);
  const [rodando, setRodando] = useState(true);
  /**
   * Seguir uma requisição: aqui o trajeto se abre em três braços ao mesmo
   * tempo, e o corpo em cada um é o que aquele gravador guarda dela. O diff
   * entre as paradas mostra o que cada sinal **joga fora** — a tese do lab
   * vista de dentro de um item, e não no agregado.
   */
  const [seguindo, setSeguindo] = useState<string | undefined>(undefined);
  const [trajeto, setTrajeto] = useState<readonly Parada[]>([]);
  const seguindoRef = useRef<string | undefined>(undefined);
  seguindoRef.current = seguindo;
  const mundoRef = useRef<World | null>(null);

  const spec = useMemo(() => pilaresWorld(INICIAIS), []);
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
        setTrajeto((antes) => seguir(antes, m.state, chave, LEITOR_DA_REQUISICAO));
      }
    }, 600);
    return () => window.clearInterval(id);
  }, [rodando, mundo]);

  const mexer = (nome: Controle, valor: number): void => {
    mundoRef.current?.setParam(nome, valor);
    setControles((c) => ({ ...c, [nome]: valor }));
  };

  const e = estadoDosPilares(mundo.state, controles["pergunta-acima-de"]);

  const seguirCarga = (chave: string | undefined): void => {
    setSeguindo(chave);
    setTrajeto(chave === undefined ? [] : seguir([], mundo.state, chave, LEITOR_DA_REQUISICAO));
  };

  /**
   * O que cada caixa guarda, linha a linha — e é aqui que o lab acontece.
   *
   * O tracer mostra requisições; o medidor mostra **baldes com contagem**, e a
   * ausência dos itens ao lado da contagem é o descarte desenhado; o
   * registrador mostra as frases, e quantas passaram sem frase nenhuma.
   */
  const conteudo = (id: string) => {
    if (id === "trace-store") {
      return e.spans
        .slice(-6)
        .reverse()
        .map((s) => ({
          chave: `#${s.n} ${s.rota}`,
          valor: `${numero(s.latencia)} ms`,
          ...(s.latencia > e.limite ? { ativo: true } : {}),
        }));
    }
    if (id === "metric-store") {
      const baldes = e.baldes.map((b) => ({ chave: b.nome, valor: numero(b.contagem) }));
      return [
        ...baldes,
        { chave: "series", valor: numero(e.series.length) },
        ...(e.seriesColapsadas > 0
          ? [{ chave: "otel.metric.overflow", valor: numero(e.seriesColapsadas), ativo: true }]
          : []),
      ];
    }
    if (id === "log-store") {
      return [
        ...e.linhas
          .slice(-5)
          .reverse()
          .map((l) => ({ chave: `t${l.tick}`, valor: l.texto })),
        ...(e.caladas > 0
          ? [{ chave: "said nothing", valor: numero(e.caladas), ativo: true }]
          : []),
      ];
    }
    return undefined;
  };

  const readouts: Record<string, string> = {
    requests: numero(e.atendidas),
    "trace-store": `${numero(e.spans.length)} rows`,
    "metric-store": `${numero(e.series.length)} series`,
    "log-store": `${numero(e.linhas.length)} lines`,
  };

  /** O banco de séries contra o limite: a mesma barra de sempre, e as casas. */
  const fills: Record<string, number> = {
    "metric-store": Math.min(1, e.series.length / Math.max(1, controles["limite-de-series"])),
  };
  const capacidades: Record<string, number> = {
    "metric-store": controles["limite-de-series"],
  };

  return (
    <div className="pilares-lab">
      <div className="pilares-lab__palco">
        <Explorer
          tree={arvore}
          wires={spec.wires}
          state={mundo.state}
          previous={mundo.previousState}
          edgeTicks={spec.edgeTicks ?? 1}
          tickMs={600}
          views={VIEWS_DOS_PILARES}
          inicial="process"
          readouts={readouts}
          fills={fills}
          capacidades={capacidades}
          conteudo={conteudo}
          comFicha
          chaveDaCarga={LEITOR_DA_REQUISICAO.chave}
          cargaSeguida={seguindo}
          onSeguirCarga={seguirCarga}
          painelDaCarga={
            <PainelDaCarga
              titulo={seguindo ?? ""}
              trajeto={trajeto}
              onFechar={() => seguirCarga(undefined)}
              vazio="This one has already been recorded. Click another item on a wire to follow it."
            />
          }
        />

        <div className="pilares-lab__controles">
          <button type="button" onClick={() => setRodando((r) => !r)}>
            {rodando ? "Pause" : "Run"}
          </button>
          <span className="pilares-lab__tick mono">t{tick}</span>

          <label className="pilares-lab__campo">
            <span>
              requests per second <b className="mono">{controles["requisicoes-por-tick"]}</b>
            </span>
            <input
              type="range"
              min={0}
              max={8}
              step={1}
              value={controles["requisicoes-por-tick"]}
              onChange={(ev) => mexer("requisicoes-por-tick", Number(ev.target.value))}
            />
          </label>

          <label className="pilares-lab__campo">
            <span>
              ask: slower than <b className="mono">{numero(controles["pergunta-acima-de"])} ms</b>
            </span>
            <select
              value={controles["pergunta-acima-de"]}
              onChange={(ev) => mexer("pergunta-acima-de", Number(ev.target.value))}
            >
              {[50, 100, 250, 300, 500, 1000].map((n) => (
                <option key={n} value={n}>
                  {numero(n)} ms{[50, 100, 250, 500, 1000].includes(n) ? " (bucket edge)" : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="pilares-lab__switch">
            <input
              type="checkbox"
              checked={controles["registrar-tudo"] === 1}
              onChange={(ev) => mexer("registrar-tudo", ev.target.checked ? 1 : 0)}
            />
            The code logs every request, not just failures
          </label>

          <label className="pilares-lab__switch">
            <input
              type="checkbox"
              checked={controles["atributo-por-usuario"] === 1}
              onChange={(ev) => mexer("atributo-por-usuario", ev.target.checked ? 1 : 0)}
            />
            Add <code>user.id</code> to the metric attributes
          </label>

          <label className="pilares-lab__campo">
            <span>
              cardinality limit <b className="mono">{numero(controles["limite-de-series"])}</b>
            </span>
            <select
              value={controles["limite-de-series"]}
              onChange={(ev) => mexer("limite-de-series", Number(ev.target.value))}
            >
              {[6, 12, 30, 100].map((n) => (
                <option key={n} value={n}>
                  {numero(n)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/*
        A pergunta, e as três respostas.

        Elas saem do estado: o `responde` é fato do modelo, e o `data-responde`
        no DOM é o que permite conferir de fora que o medidor **nunca** responde
        — que é a tese do lab, e não uma frase sobre ela.
      */}
      <section className="pilares-lab__pergunta" aria-label="Ask the three">
        <h3>
          Which requests took longer than{" "}
          <b className="mono">{numero(controles["pergunta-acima-de"])} ms</b>?
        </h3>
        <p className="pilares-lab__verdade mono">
          {numero(e.acimaDoLimite)} of the {numero(e.atendidas)} requests did — that is the
          truth, and only one of the three can hand it to you.
        </p>
        <dl className="pilares-lab__respostas">
          {(
            [
              ["Trace", e.resposta.trace],
              ["Metric", e.resposta.metric],
              ["Log", e.resposta.log],
            ] as const
          ).map(([nome, resposta]) => (
            <div key={nome} data-responde={resposta.responde ? "true" : "false"}>
              <dt>{nome}</dt>
              <dd>{resposta.texto}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="pilares-lab__erros" aria-label="What people get wrong">
        <h3>What people get wrong</h3>
        <dl>
          {MAL_ENTENDIDOS_DOS_PILARES.map((m) => (
            <div key={m.crenca}>
              <dt>{m.crenca}</dt>
              <dd>
                {m.spec}{" "}
                <a href={m.fonte} rel="noopener">
                  spec&nbsp;→
                </a>
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
