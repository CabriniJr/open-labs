import { useEffect, useMemo, useRef, useState } from "react";
import { World, indexTree } from "@ovh/depth-core";
import type { WorldState } from "@ovh/depth-core";
import {
  DESCRICOES,
  envelopeUnico,
  especieDaCarga,
  estadoOtel,
  leituraDaCarga,
  otelWorld,
  OTEL_VIEWS,
  VIEWS_SEM_SDK,
} from "@ovh/otel-domain";
import type { ExportTraceServiceRequest } from "@ovh/otel-domain";
import { Explorer } from "./Explorer.js";

/**
 * O lab dos provedores.
 *
 * A pergunta da página, e ela é o título:
 *
 * > You called `tracer.startSpan`. Who decides whether it ever leaves the process?
 *
 * Dois tipos de controle, e a diferença é da spec do handbook §4: **mudar uma
 * taxa é parâmetro** e vive aqui embaixo, no L0; **trocar a árvore é estrutura**
 * e só o "no SDK" faz isso — porque não há provider nenhum naquele mundo, e
 * fingir que há um com um parâmetro desligado seria desenhar uma mentira.
 *
 * Parâmetro é **evento no tempo**, e não reset: mexer num controle mantém o tick
 * e o estado acumulado, e o mundo reage de onde está. Um lab que recomeçasse a
 * cada arrasto apagaria a transição entre dois regimes, que é onde está o
 * aprendizado.
 */

const CONTROLES = [
  "spans-per-tick",
  "logs-per-tick",
  "metrics-per-tick",
  "collector-down",
  "sampling-ratio",
  "record-only",
  "max-queue-size",
  "scheduled-delay",
  "export-interval",
  "cardinality-limit",
  "trace-based",
  "shutdown-at",
  "force-flush",
] as const;

type Controle = (typeof CONTROLES)[number];

const INICIAIS: Record<Controle, number> = {
  "spans-per-tick": 1,
  "logs-per-tick": 1,
  "metrics-per-tick": 1,
  "collector-down": 0,
  "sampling-ratio": 1,
  "record-only": 0,
  "max-queue-size": 2048,
  "scheduled-delay": 5,
  "export-interval": 60,
  "cardinality-limit": 2000,
  "trace-based": 0,
  "shutdown-at": 0,
  "force-flush": 0,
};

const numero = (n: number): string => n.toLocaleString("en-US");

export function ProvidersLab() {
  const [semSdk, setSemSdk] = useState(false);
  const [controles, setControles] = useState<Record<Controle, number>>(INICIAIS);
  const [tick, setTick] = useState(0);
  const [rodando, setRodando] = useState(true);
  const [compasso, setCompasso] = useState(420);
  const [envelope, setEnvelope] = useState<ExportTraceServiceRequest | undefined>();
  const [foco, setFoco] = useState("process");
  const mundoRef = useRef<World | null>(null);

  // Só o cenário sem SDK troca a ÁRVORE. Todo o resto é parâmetro, e parâmetro
  // não reconstrói mundo nenhum.
  const spec = useMemo(
    () => (semSdk ? otelWorld({ semSdk: true, params: INICIAIS }) : otelWorld({ params: INICIAIS })),
    [semSdk],
  );
  const arvore = useMemo(() => indexTree(spec.root, spec.channels), [spec]);
  const mundo = useMemo(() => new World(spec), [spec]);
  mundoRef.current = mundo;

  useEffect(() => {
    setTick(0);
    setEnvelope(undefined);
    setControles(INICIAIS);
    setFoco("process");
    setRodando(true);
  }, [mundo]);

  const andar = (): void => {
    const m = mundoRef.current;
    if (m === null) return;
    m.advance(1);
    setTick(m.tick);
    const novo = envelopeUnico(m.state);
    // O último envelope FICA na tela. Ele cruza o canal num tick e some no
    // seguinte — mostrar só o do instante daria um painel que pisca e não se lê.
    if (novo !== undefined) setEnvelope(novo);
  };

  useEffect(() => {
    if (!rodando) return;
    const id = window.setInterval(andar, compasso);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rodando, compasso, mundo]);

  const mexer = (nome: Controle, valor: number): void => {
    mundoRef.current?.setParam(nome, valor);
    setControles((c) => ({ ...c, [nome]: valor }));
  };

  const cenario = (fim: number, flush: number): void => {
    mexer("shutdown-at", fim === 0 ? 0 : tick + fim);
    mexer("force-flush", flush);
  };

  const estado: WorldState = mundo.state;
  const e = estadoOtel(estado);
  const views = semSdk ? VIEWS_SEM_SDK : OTEL_VIEWS;

  /**
   * O quanto cada caixa está cheia, de 0 a 1.
   *
   * É o que faz a fila **acumular e soltar** em vez de ser um retângulo parado:
   * o nível sobe enquanto os spans entram, e cai de uma vez quando o lote sai.
   * Sem ele, o processador em lote é uma caixa por onde as coisas passam, e o
   * que ele faz — juntar — não aparece em lugar nenhum.
   *
   * O banco de pontos usa a mesma barra contra o limite de cardinalidade, e é
   * ali que o contraste de F4 fica físico: um enche até transbordar e recusar,
   * o outro enche até colapsar.
   */
  const fills: Record<string, number> = semSdk
    ? {}
    : {
        queue: Math.min(1, e.naFila / Math.max(1, controles["max-queue-size"])),
        points: Math.min(1, e.pontos.length / Math.max(1, controles["cardinality-limit"])),
      };

  const readouts: Record<string, string> = semSdk
    ? {
        created: numero(e.criados),
        "ended in the no-op": numero(e.engolidosPeloNoop),
        exported: numero(e.exportados),
        "collector received": numero(e.recebidosPeloCollector),
      }
    : {
        created: numero(e.criados),
        sampled: numero(e.amostrados),
        "record-only": numero(e.gravadosSemSair),
        dropped: numero(e.descartadosPeloSampler),
        "in queue": numero(e.naFila),
        "queue dropped": numero(e.descartadosPelaFila),
        "held by exporter": numero(e.retidosNoExportador),
        exported: numero(e.exportados),
        "metric rows": numero(e.pontos.length),
        collapsed: numero(e.colapsados),
      };

  return (
    <div className="providers-lab">
      <div className="providers-lab__palco">
        <Explorer
          key={`${semSdk ? "no-sdk" : "sdk"}:${foco}`}
          tree={arvore}
          wires={spec.wires}
          state={estado}
          previous={mundo.previousState}
          edgeTicks={spec.edgeTicks ?? 1}
          tickMs={compasso}
          views={views}
          inicial={foco}
          readouts={readouts}
          fills={fills}
          leituraDaCarga={leituraDaCarga}
          especieDaCarga={especieDaCarga}
          comFicha
          descricoes={DESCRICOES}
        />

        <div className="providers-lab__controles">
          <button type="button" onClick={() => setRodando((r) => !r)}>
            {rodando ? "Pause" : "Run"}
          </button>
          <button
            type="button"
            onClick={() => {
              setRodando(false);
              andar();
            }}
          >
            Step
          </button>
          <label className="providers-lab__compasso">
            speed
            <input
              type="range"
              min={120}
              max={1000}
              step={20}
              value={1120 - compasso}
              onChange={(ev) => setCompasso(1120 - Number(ev.target.value))}
              aria-label="Clock speed"
            />
          </label>
          <span className="providers-lab__tick mono">tick {tick}</span>
          <span className="providers-lab__tick mono" title="One tick is one second in this world">
            {tick}s
          </span>
          {/*
            R3 é entregue aqui. As três views de provider compartilham moldura,
            faixas e colunas, então alternar entre elas é um diff visual: no
            lugar onde traces e logs têm uma fila, métricas têm um banco, e a
            seta do gatilho aponta para o outro lado. Sem estes botões a
            comparação existiria só para quem soubesse clicar duas vezes na
            caixa certa — e F4 depende dela.
          */}
          <div className="providers-lab__views" role="group" aria-label="Framing">
            {views.map((v) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={v.focus === foco}
                onClick={() => setFoco(v.focus)}
              >
                {arvore.byId.get(v.focus)?.label ?? v.focus}
              </button>
            ))}
          </div>
        </div>

        <p className="providers-lab__legenda">
          Solid lines carry data; dashed lines carry control. One tick is one
          second here, which is why the spec&rsquo;s own defaults fit on screen
          unchanged — 5&nbsp;000&nbsp;ms between batches, 60&nbsp;000&nbsp;ms
          between metric collections.
        </p>
      </div>

      <aside className="providers-lab__painel">
        <section>
          <h3>Scenario</h3>
          <label className="providers-lab__switch">
            <input
              type="checkbox"
              checked={semSdk}
              onChange={(ev) => setSemSdk(ev.target.checked)}
            />
            No SDK installed
          </label>
          <p className="providers-lab__nota">
            This one is not a parameter: with no SDK there is no provider at
            all, and the API hands back a no-op. Nothing raises. The counter is
            the only evidence.
          </p>
          {!semSdk ? (
            <label className="providers-lab__switch">
              <input
                type="checkbox"
                checked={controles["collector-down"] === 1}
                onChange={(ev) => mexer("collector-down", ev.target.checked ? 1 : 0)}
              />
              Cut the channel to the Collector
            </label>
          ) : null}
          {!semSdk ? (
            <p className="providers-lab__nota">
              The exporter sends one batch and waits. With nothing answering, it
              never finishes, the queue has no one to hand off to, it fills, and
              from there it <b>refuses</b>. The loss starts three pieces before
              the thing that broke — which is why it surprises people. Turn it
              back on and the queue drains: backpressure is reversible, the
              refusal is not.
            </p>
          ) : null}
          {!semSdk ? (
            <div className="providers-lab__botoes">
              <button type="button" onClick={() => cenario(1, 0)}>
                Kill the process now
              </button>
              <button type="button" onClick={() => cenario(1, 1)}>
                Kill it, with ForceFlush
              </button>
              <button type="button" onClick={() => cenario(0, 0)}>
                Keep it running
              </button>
            </div>
          ) : null}
        </section>

        {!semSdk ? (
          <section>
            <h3>Load</h3>
            <p className="providers-lab__nota">
              How much telemetry the application produces each second. Raise it
              past what the pipeline drains and you are looking at backpressure.
            </p>
            {(
              [
                ["spans-per-tick", "spans / s"],
                ["logs-per-tick", "log records / s"],
                ["metrics-per-tick", "measurements / s"],
              ] as const
            ).map(([chave, rotulo]) => (
              <label className="providers-lab__campo" key={chave}>
                <span>
                  {rotulo} <b className="mono">{controles[chave]}</b>
                </span>
                <input
                  type="range"
                  min={0}
                  max={24}
                  step={1}
                  value={controles[chave]}
                  onChange={(ev) => mexer(chave, Number(ev.target.value))}
                />
              </label>
            ))}
          </section>
        ) : null}

        {!semSdk ? (
          <section>
            <h3>Provider configuration</h3>
            <label className="providers-lab__campo">
              <span>
                sampling ratio <b className="mono">{controles["sampling-ratio"].toFixed(2)}</b>
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={controles["sampling-ratio"]}
                onChange={(ev) => mexer("sampling-ratio", Number(ev.target.value))}
              />
            </label>

            <label className="providers-lab__switch">
              <input
                type="checkbox"
                checked={controles["record-only"] === 1}
                onChange={(ev) => mexer("record-only", ev.target.checked ? 1 : 0)}
              />
              Wrap the sampler so DROP becomes RECORD_ONLY
            </label>

            <label className="providers-lab__campo">
              <span>
                maxQueueSize <b className="mono">{numero(controles["max-queue-size"])}</b>
              </span>
              <select
                value={controles["max-queue-size"]}
                onChange={(ev) => mexer("max-queue-size", Number(ev.target.value))}
              >
                {[4, 16, 64, 512, 2048].map((n) => (
                  <option key={n} value={n}>
                    {numero(n)}
                    {n === 2048 ? " (spec default)" : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="providers-lab__campo">
              <span>
                scheduledDelay <b className="mono">{controles["scheduled-delay"] * 1000} ms</b>
              </span>
              <input
                type="range"
                min={1}
                max={30}
                step={1}
                value={controles["scheduled-delay"]}
                onChange={(ev) => mexer("scheduled-delay", Number(ev.target.value))}
              />
            </label>

            <label className="providers-lab__campo">
              <span>
                exportInterval <b className="mono">{controles["export-interval"] * 1000} ms</b>
              </span>
              <input
                type="range"
                min={5}
                max={120}
                step={5}
                value={controles["export-interval"]}
                onChange={(ev) => mexer("export-interval", Number(ev.target.value))}
              />
            </label>

            <label className="providers-lab__campo">
              <span>
                cardinality limit <b className="mono">{numero(controles["cardinality-limit"])}</b>
              </span>
              <select
                value={controles["cardinality-limit"]}
                onChange={(ev) => mexer("cardinality-limit", Number(ev.target.value))}
              >
                {[3, 5, 2000].map((n) => (
                  <option key={n} value={n}>
                    {numero(n)}
                    {n === 2000 ? " (spec default)" : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="providers-lab__switch">
              <input
                type="checkbox"
                checked={controles["trace-based"] === 1}
                onChange={(ev) => mexer("trace-based", ev.target.checked ? 1 : 0)}
              />
              LoggerConfig.trace_based
            </label>
            <p className="providers-lab__nota">
              Turn it on, then drag the sampling ratio to zero. Logs stop
              arriving, and the only thing connecting the two is one dashed line
              crossing a provider boundary.
            </p>
          </section>
        ) : null}

        <section>
          <h3>Where the spans went</h3>
          <ul className="providers-lab__contas mono">
            {Object.entries(readouts).map(([nome, valor]) => (
              <li key={nome} data-zero={valor === "0" ? "true" : undefined}>
                <span>{nome}</span>
                <span>{valor}</span>
              </li>
            ))}
          </ul>
          {!semSdk && e.contrapressao ? (
            <p className="providers-lab__nota" data-alerta="true">
              <b>Backpressure.</b> The exporter is holding{" "}
              <b className="mono">{numero(e.retidosNoExportador)}</b> spans it could
              not send, so the queue has stopped handing off. Held is not lost —
              but everything the queue refuses from here on is.
            </p>
          ) : null}
          {!semSdk && e.logsBarradosPeloTrace > 0 ? (
            <p className="providers-lab__nota">
              <b className="mono">{numero(e.logsBarradosPeloTrace)}</b> log records
              were discarded because their trace was not sampled.
            </p>
          ) : null}
        </section>

        {!semSdk ? (
          <section>
            <h3>On the wire</h3>
            {envelope === undefined ? (
              <p className="providers-lab__nota">
                Nothing has crossed the channel yet. The batch leaves when a
                trigger fires — not every instant.
              </p>
            ) : (
              <>
                <p className="providers-lab__nota">
                  The last envelope that crossed. <code>resource</code> sits one
                  layer above the spans because it belongs to the provider, and
                  it got there without a single wire touching the plate.
                </p>
                <pre className="providers-lab__envelope mono">
                  {JSON.stringify(envelope, null, 1)}
                </pre>
              </>
            )}
          </section>
        ) : null}
      </aside>
    </div>
  );
}
