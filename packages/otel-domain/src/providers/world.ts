import { DROP } from "@ovh/depth-core";
import type { AnyObject, Emission, ObjectSpec, Wire, WorldSpec } from "@ovh/depth-core";
import { loteProcessor, MAX_EXPORT_BATCH_SIZE_PADRAO, MAX_QUEUE_SIZE_PADRAO, SCHEDULED_DELAY_MS_PADRAO } from "./batch.js";
import { medicao, EXPORT_INTERVAL_MS_PADRAO, LIMITE_DE_CARDINALIDADE_PADRAO } from "./metrics.js";
import { decidir, PORTA_DA_DECISAO, type Amostrador, type Decisao } from "./sampler.js";
import { idHex, spansDa, type PlacaDeRecurso, type RegistroDeSpan } from "./carga.js";
import { ROTULOS } from "./labels.js";

/**
 * O processo instrumentado, e os três provedores dentro dele.
 *
 * A tese, e é o motivo de este ser o primeiro lab do `otel.model`:
 *
 * > **O envelope do OTLP é a árvore de objetos do SDK.**
 * > `ResourceSpans → ScopeSpans → Span` é, campo por campo, provider → tracer → span.
 *
 * O `Resource` está uma camada acima dos spans no payload porque ele pertence ao
 * **provider**, não ao span. Aqui isso não é comentário: o recurso é `static` —
 * placa —, e placa **não tem porta e não é fiada**. Nenhum fio o toca. Ele chega
 * ao envelope porque quem exporta fecha sobre o recurso do provider que o
 * declarou, e há teste (`envelope.test.ts`) provando que o campo `resource` do
 * envelope é exatamente a placa. Se um dia alguém ligar um fio nela, o teste da
 * placa cai — e ele cai porque a placa deixou de ser placa.
 *
 * **Uma árvore, quatro raízes.** `labs/providers` abre em `process`;
 * `labs/batch`, em `batch-processor`; `labs/queue`, em `queue`; `labs/two-providers`,
 * em `host` com o segundo provider ligado. Nenhum deles precisa de código de
 * domínio novo — o que muda é onde a vista foca.
 *
 * Escala de tempo deste mundo: **um tick é um segundo.** É o que faz os padrões
 * da spec caberem no lab sem serem reescritos — `scheduledDelayMillis` 5 000 são
 * 5 ticks, `exportIntervalMillis` 60 000 são 60, e o 12× entre traces e métricas
 * é o número da spec, e não um número escolhido para a demonstração.
 */

const TICK_MS = 1000;
const emTicks = (ms: number): number => Math.max(1, Math.round(ms / TICK_MS));

export const PARAMS_PADRAO: Readonly<Record<string, number>> = {
  /** `TraceIdRatioBased`: a fração dos traces raiz que é amostrada. */
  "sampling-ratio": 1,
  /** Liga o decorador que rebaixa `DROP` a `RECORD_ONLY` — é como a porta do meio acende. */
  "record-only": 0,
  "max-queue-size": MAX_QUEUE_SIZE_PADRAO,
  "log-max-queue-size": MAX_QUEUE_SIZE_PADRAO,
  "scheduled-delay": emTicks(SCHEDULED_DELAY_MS_PADRAO),
  "log-scheduled-delay": emTicks(SCHEDULED_DELAY_MS_PADRAO),
  "export-interval": emTicks(EXPORT_INTERVAL_MS_PADRAO),
  "cardinality-limit": LIMITE_DE_CARDINALIDADE_PADRAO,
  /** `LoggerConfig.trace_based`. Padrão da spec: desligado. */
  "trace-based": 0,
  /** O processo termina neste tick. Zero: não termina. */
  "shutdown-at": 0,
  /** Chamar `ForceFlush` no fim. É o contrafactual de F3. */
  "force-flush": 0,
  "spans-per-tick": 1,
  "logs-per-tick": 1,
  "metrics-per-tick": 1,
};

export interface OpcoesDoMundo {
  readonly seed?: number;
  /**
   * A API sem SDK instalado. O provider vira uma folha `sink` que consome e não
   * emite, com contador legível — porque a única forma de ensinar silêncio é
   * mostrá-lo **com número**.
   */
  readonly semSdk?: true;
  /**
   * Um segundo `TracerProvider` no mesmo processo, com recurso diferente. Nada
   * falha, nenhum log de erro, e no envelope aparecem dois `resourceSpans` com
   * `service.name` diferente — que é o motivo real pelo qual um backend deixa de
   * correlacionar. É a raiz do lab `two-providers`.
   */
  readonly segundoProvider?: true;
  readonly params?: Readonly<Record<string, number>>;
}

const inteiro = (valor: number | undefined, padrao: number, minimo = 0): number =>
  valor === undefined || !Number.isFinite(valor) ? padrao : Math.max(minimo, Math.round(valor));

const placa = (id: string, dados: PlacaDeRecurso | string): AnyObject => ({
  id,
  kind: "static",
  label: typeof dados === "string" ? dados : dados.titulo,
  leaf: true,
});

// ---------------------------------------------------------------------------
// A instrumentação

interface EstadoApp {
  readonly criados: number;
}

/**
 * A borda de dentro: `startSpan`, `record`, `emit`. Produz sem receber, que é a
 * definição de `source`.
 *
 * Ela emite pelas três portas todo tick, e é o único lugar do lab que sabe que
 * existem três sinais. Depois daqui os três caminhos nunca mais se encontram —
 * exceto por uma linha de controle, que é justamente a lição de D5.
 */
function app(escopo: string): ObjectSpec<EstadoApp> {
  return {
    id: "app",
    kind: "source",
    label: ROTULOS.app,
    leaf: true,
    init: (): EstadoApp => ({ criados: 0 }),
    behavior: (state, _inbox, ctx) => {
      if (ctx.phase !== "commit") return { state, out: [] };
      const fim = inteiro(ctx.params["shutdown-at"], 0);
      if (fim > 0 && ctx.tick > fim) return { state, out: [] };

      const quantos = (chave: string): number => inteiro(ctx.params[chave], 1);
      const nSpans = quantos("spans-per-tick");
      const nLogs = quantos("logs-per-tick");
      const nMetricas = quantos("metrics-per-tick");

      const registros = (n: number, nome: string): readonly RegistroDeSpan[] =>
        Array.from({ length: n }, (_, i) => ({
          traceId: idHex(32, `trace:${ctx.tick}:${i}`),
          spanId: idHex(16, `${nome}:${ctx.tick}:${i}`),
          nome,
          escopo,
          // O bit nasce falso e quem o estampa é o amostrador. É onde ele é
          // decidido de verdade: na CRIAÇÃO do span, antes de qualquer processador.
          amostrado: false,
          inicio: ctx.tick,
        }));

      const out: Emission[] = [];
      if (nSpans > 0) {
        out.push({ port: "span", message: ctx.emit("span", nSpans, { spans: registros(nSpans, "GET /checkout") }) });
      }
      if (nLogs > 0) {
        out.push({ port: "log", message: ctx.emit("log", nLogs, { spans: registros(nLogs, "log record") }) });
      }
      if (nMetricas > 0) {
        const medidas = Array.from({ length: nMetricas }, (_, i) => ({
          chave: `http.route=/checkout/${(ctx.tick + i) % 7}`,
          valor: 1,
        }));
        out.push({ port: "metric", message: ctx.emit("measurement", nMetricas, { medidas }) });
      }
      return { state: { criados: state.criados + nSpans }, out };
    },
  };
}

// ---------------------------------------------------------------------------
// O amostrador

const amostradorDe = (params: Readonly<Record<string, number>>): Amostrador => {
  const razao = params["sampling-ratio"] ?? 1;
  // O padrão da spec é `ParentBased(root=AlwaysOn)`. Neste lab não há pai
  // remoto, então o `parent-based` cai na raiz dele — e está aqui escrito assim,
  // e não simplificado para a raiz, porque o desenho e a ficha dizem o nome do
  // amostrador que o SDK realmente instala.
  const raiz: Amostrador = { tipo: "parent-based", raiz: { tipo: "ratio", razao } };
  return (params["record-only"] ?? 0) >= 1 ? { tipo: "always-record", raiz } : raiz;
};

interface EstadoSampler {
  readonly porDecisao: Readonly<Record<Decisao, number>>;
}

const ZERO: Readonly<Record<Decisao, number>> = {
  "record-and-sample": 0,
  "record-only": 0,
  drop: 0,
};

/**
 * Uma entrada, **três** saídas nomeadas.
 *
 * `router` pelo resumo do catálogo — "recebe, decide, emite por uma saída" —, e
 * o retorno de motor deste round está aqui: o detalhe do catálogo descreve o
 * mux, que escolhe qual ENTRADA responde, e um amostrador é o espelho disso.
 * Fica registrado; `kind` novo exigiria dois alvos pagantes, e há um.
 */
function sampler(id: string, alvoDoSinal: boolean): ObjectSpec<EstadoSampler> {
  return {
    id,
    kind: "router",
    label: ROTULOS.sampler,
    leaf: true,
    init: (): EstadoSampler => ({ porDecisao: ZERO }),
    behavior: (state, inbox, ctx) => {
      if (ctx.phase !== "commit" || inbox.length === 0) return { state, out: [] };
      const amostrador = amostradorDe(ctx.params);
      const porPorta = new Map<string, RegistroDeSpan[]>();
      const porDecisao: Record<Decisao, number> = { ...state.porDecisao };
      let algumAmostrado = false;

      let j = 0;
      for (const message of inbox) {
        for (const span of spansDa(message)) {
          const decisao = decidir(amostrador, { aleatorio: ctx.random(String(j)) });
          j += 1;
          porDecisao[decisao] += 1;
          if (decisao === "record-and-sample") algumAmostrado = true;
          const porta = PORTA_DA_DECISAO[decisao];
          const lista = porPorta.get(porta) ?? [];
          // O bit do `traceparent` é estampado aqui. `RECORD_ONLY` sai com o bit
          // baixo: o span é gravado, é legível, e o exportador nunca o vê.
          lista.push({ ...span, amostrado: decisao === "record-and-sample" });
          porPorta.set(porta, lista);
        }
      }

      const out: Emission[] = [];
      for (const [porta, spans] of porPorta) {
        out.push({ port: porta, message: ctx.emit("span", spans.length, { spans }) });
      }
      // A única linha do lab que cruza a fronteira de um provider, e ela é de
      // CONTROLE: baixar a amostragem de traces apaga logs, e quase ninguém liga
      // as duas coisas até ver a linha.
      if (alvoDoSinal) {
        out.push({
          port: "decision",
          message: ctx.emit("sampled", 1, { amostrado: algumAmostrado }),
        });
      }
      return { state: { porDecisao }, out };
    },
  };
}

// ---------------------------------------------------------------------------
// A porta dos logs

interface EstadoPorta {
  readonly ultimoAmostrado: boolean;
  readonly barrados: number;
}

/**
 * `LoggerConfig.trace_based`: "deixa o caminho passar, ou não, e quem manda é
 * outro". É a definição de `switch`, e quem manda é o bit `sampled` do trace.
 *
 * A porta guarda o último sinal que recebeu, e não o casa registro a registro:
 * o sinal do amostrador e o registro do `app` chegam com um tick de diferença,
 * e casá-los exigiria correlacionar contexto — que é outro lab. O que o
 * fenômeno afirma é agregado (baixar a amostragem apaga logs) e o agregado é
 * exato.
 */
function traceGate(id: string): ObjectSpec<EstadoPorta> {
  return {
    id,
    kind: "switch",
    label: ROTULOS.traceGate,
    leaf: true,
    init: (): EstadoPorta => ({ ultimoAmostrado: true, barrados: 0 }),
    behavior: (state, inbox, ctx) => {
      if (ctx.phase !== "commit") return { state, out: [] };
      const sinais = ctx.signals["sampled"] ?? [];
      const ultimo = sinais.at(-1);
      const ultimoAmostrado =
        ultimo === undefined ? state.ultimoAmostrado : ultimo.data["amostrado"] === true;

      if (inbox.length === 0) return { state: { ...state, ultimoAmostrado }, out: [] };

      const registros = inbox.flatMap((m) => spansDa(m));
      const ligado = (ctx.params["trace-based"] ?? 0) >= 1;
      if (!ligado || ultimoAmostrado) {
        return {
          state: { ultimoAmostrado, barrados: state.barrados },
          out: [{ port: "out", message: ctx.emit("log", registros.length, { spans: registros }) }],
        };
      }
      return {
        state: { ultimoAmostrado, barrados: state.barrados + registros.length },
        out: [
          {
            port: "dropped",
            message: ctx.emit("dropped", registros.length, { motivo: "trace-based" }),
          },
        ],
      };
    },
  };
}

// ---------------------------------------------------------------------------
// O flush do provider

interface EstadoFlush {
  readonly disparos: number;
}

/**
 * `ForceFlush` / `Shutdown` do provider. `sequencer` da família `controller`:
 * ele não recebe carga e só fala por linha de controle.
 *
 * A spec: `ForceFlush` **MUST** invocar `ForceFlush` em todos os `SpanProcessor`
 * registrados — e por isso a linha desce para mais de um destino ao mesmo tempo.
 * É a imagem do "todos" no desenho.
 */
function flush(id: string, rotulo: string): ObjectSpec<EstadoFlush> {
  return {
    id,
    kind: "sequencer",
    label: rotulo,
    leaf: true,
    init: (): EstadoFlush => ({ disparos: 0 }),
    behavior: (state, _inbox, ctx) => {
      if (ctx.phase !== "commit") return { state, out: [] };
      const fim = inteiro(ctx.params["shutdown-at"], 0);
      const pediu = (ctx.params["force-flush"] ?? 0) >= 1;
      if (!pediu || fim <= 0 || ctx.tick !== fim) return { state, out: [] };
      return {
        state: { disparos: state.disparos + 1 },
        out: [{ port: "flush", message: ctx.emit("flush", 1, { motivo: "force-flush" }) }],
      };
    },
  };
}

// ---------------------------------------------------------------------------
// A borda de fora

export interface EstadoCollector {
  readonly spans: number;
  readonly logs: number;
  readonly coletas: number;
  readonly envelopes: number;
  /** O último lote de spans que atravessou o canal. É a fonte do L3. */
  readonly ultimo: readonly RegistroDeSpan[];
}

/**
 * O Collector. **Opaco de propósito** — a régua-mãe é *a ferramenta ensina; não
 * opera*, e o que acontece lá dentro é o lab `collector-pipeline`.
 *
 * Ele é a borda: conta, guarda o último envelope, e a ficha dele diz para onde
 * ir. Nunca uma caixa vazia.
 */
const collector: ObjectSpec<EstadoCollector> = {
  id: "collector",
  kind: "sink",
  label: ROTULOS.collector,
  leaf: true,
  init: (): EstadoCollector => ({ spans: 0, logs: 0, coletas: 0, envelopes: 0, ultimo: [] }),
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit" || inbox.length === 0) return { state, out: [] };
    let { spans, logs, coletas, envelopes, ultimo } = state;
    for (const message of inbox) {
      envelopes += 1;
      if (message.kind === "otlp-traces") {
        spans += message.weight;
        ultimo = spansDa(message);
      } else if (message.kind === "otlp-logs") {
        logs += message.weight;
      } else {
        coletas += 1;
      }
    }
    return { state: { spans, logs, coletas, envelopes, ultimo }, out: [] };
  },
};

interface EstadoNoop {
  readonly engolidos: number;
}

/**
 * O provider no-op: a API sem SDK instalado.
 *
 * Nenhum erro, nenhuma exceção, nenhum aviso — e é isso que faz esta ser a falha
 * nº 1 de quem instrumenta pela primeira vez. Ele é `sink` e guarda estado, então
 * o contador é legível: *"37 spans ended here"*. A única forma de ensinar
 * silêncio é mostrá-lo com número.
 */
const noopProvider: ObjectSpec<EstadoNoop> = {
  id: "tracer-provider",
  kind: "sink",
  label: ROTULOS.noopTracerProvider,
  leaf: true,
  init: (): EstadoNoop => ({ engolidos: 0 }),
  behavior: (state, inbox, ctx) =>
    ctx.phase !== "commit" || inbox.length === 0
      ? { state, out: [] }
      : {
          state: { engolidos: state.engolidos + inbox.reduce((n, m) => n + m.weight, 0) },
          out: [],
        },
};

// ---------------------------------------------------------------------------
// Os três provedores

interface ProvedorDeTraces {
  readonly objeto: AnyObject;
  readonly wires: readonly Wire[];
  readonly exportador: string;
}

function tracerProvider(sufixo: string, placaDoRecurso: PlacaDeRecurso, rotulo: string): ProvedorDeTraces {
  const s = sufixo;
  const ids = {
    provider: `tracer-provider${s}`,
    recurso: `resource-traces${s}`,
    limites: `span-limits${s}`,
    sampler: `sampler${s}`,
    processadores: `span-processors${s}`,
    lote: `batch-processor${s}`,
    fila: `queue${s}`,
    gatilho: `batch-timer${s}`,
    exportador: `span-exporter${s}`,
    flush: `trace-flush${s}`,
  };

  const lote = loteProcessor({
    id: ids.lote,
    fila: ids.fila,
    gatilho: ids.gatilho,
    exportador: ids.exportador,
    rotulos: {
      lote: ROTULOS.batchProcessor,
      fila: ROTULOS.queue,
      gatilho: ROTULOS.batchTimer,
      exportador: ROTULOS.spanExporter,
    },
    paramFila: "max-queue-size",
    paramPrazo: "scheduled-delay",
    maxExportBatchSize: MAX_EXPORT_BATCH_SIZE_PADRAO,
    kindDeSaida: "otlp-traces",
    recurso: placaDoRecurso,
    recusaNaoAmostrado: true,
  });

  const objeto: AnyObject = {
    id: ids.provider,
    kind: "composite",
    label: rotulo,
    entry: ids.sampler,
    exit: ids.processadores,
    children: [
      placa(ids.recurso, placaDoRecurso),
      placa(ids.limites, ROTULOS.spanLimits),
      sampler(ids.sampler, sufixo === ""),
      {
        id: ids.processadores,
        kind: "pipeline",
        label: ROTULOS.spanProcessors,
        children: [lote.objeto],
      },
      flush(ids.flush, ROTULOS.traceFlush),
    ],
  };

  return {
    objeto,
    exportador: ids.exportador,
    wires: [
      { from: ids.sampler, port: "sampled", to: ids.processadores },
      // `RECORD_ONLY` chega no processador e não no exportador. A linha existe
      // porque o span de fato passa por aqui; quem o recusa é a fila, por porta
      // própria, e o motivo da recusa não se confunde com fila cheia.
      { from: ids.sampler, port: "recorded", to: ids.processadores },
      // `DROP` é ausência de destino, dita em voz alta.
      { from: ids.sampler, port: "dropped", to: DROP },
      ...lote.wires,
      { from: ids.flush, port: "flush", to: ids.fila, line: "control", toPort: "flush" },
      { from: ids.flush, port: "flush", to: ids.exportador, line: "control", toPort: "flush" },
    ],
  };
}

function loggerProvider(): ProvedorDeTraces {
  const lote = loteProcessor({
    id: "batch-log-processor",
    fila: "log-queue",
    gatilho: "log-timer",
    exportador: "log-exporter",
    rotulos: {
      lote: ROTULOS.batchLogProcessor,
      fila: ROTULOS.logQueue,
      gatilho: ROTULOS.logTimer,
      exportador: ROTULOS.logExporter,
    },
    paramFila: "log-max-queue-size",
    paramPrazo: "log-scheduled-delay",
    maxExportBatchSize: MAX_EXPORT_BATCH_SIZE_PADRAO,
    kindDeSaida: "otlp-logs",
    recurso: ROTULOS.recursoDeLogs,
    // Sem `recusaNaoAmostrado`: o `LoggerProvider` não tem amostrador nenhum, e
    // o `BatchLogRecordProcessor` não olha o bit. A ausência é conteúdo.
  });

  const objeto: AnyObject = {
    id: "logger-provider",
    kind: "composite",
    label: ROTULOS.loggerProvider,
    entry: "trace-gate",
    exit: "log-processors",
    children: [
      placa("resource-logs", ROTULOS.recursoDeLogs),
      traceGate("trace-gate"),
      {
        id: "log-processors",
        kind: "pipeline",
        label: ROTULOS.logProcessors,
        children: [lote.objeto],
      },
      flush("log-flush", ROTULOS.logFlush),
    ],
  };

  return {
    objeto,
    exportador: "log-exporter",
    wires: [
      { from: "trace-gate", port: "out", to: "log-processors" },
      { from: "trace-gate", port: "dropped", to: DROP },
      ...lote.wires,
      { from: "log-flush", port: "flush", to: "log-queue", line: "control", toPort: "flush" },
      { from: "log-flush", port: "flush", to: "log-exporter", line: "control", toPort: "flush" },
    ],
  };
}

function meterProvider(): ProvedorDeTraces {
  const m = medicao({
    pontos: "points",
    leitor: "metric-reader",
    exportador: "metric-exporter",
    rotulos: {
      pontos: ROTULOS.points,
      leitor: ROTULOS.metricReader,
      exportador: ROTULOS.metricExporter,
    },
    paramIntervalo: "export-interval",
    paramCardinalidade: "cardinality-limit",
  });

  const objeto: AnyObject = {
    id: "meter-provider",
    kind: "composite",
    label: ROTULOS.meterProvider,
    entry: "points",
    exit: "metric-exporter",
    children: [
      placa("resource-metrics", ROTULOS.recursoDeMetricas),
      placa("views", ROTULOS.views),
      ...m.objetos,
    ],
  };

  return { objeto, exportador: "metric-exporter", wires: m.wires };
}

// ---------------------------------------------------------------------------

/** O canal de exportação. Opaco neste lab: o interior dele é o anexo gRPC/HTTP2. */
const canalOtlp: AnyObject = {
  id: "otlp-out",
  kind: "channel",
  role: "channel",
  label: ROTULOS.canal,
  leaf: true,
};

export function otelWorld(opcoes: OpcoesDoMundo = {}): WorldSpec {
  const params = { ...PARAMS_PADRAO, ...opcoes.params };

  if (opcoes.semSdk === true) {
    // F5. A árvore muda porque o fenômeno é estrutural: não há provider, e
    // fingir que há um com um parâmetro desligado seria desenhar uma mentira.
    const root: AnyObject = {
      id: "host",
      kind: "composite",
      label: ROTULOS.host,
      entry: "process",
      exit: "collector",
      children: [
        {
          id: "process",
          kind: "composite",
          label: ROTULOS.process,
          entry: "app",
          exit: "tracer-provider",
          children: [app(ROTULOS.escopo), placa("propagators", ROTULOS.propagators), noopProvider],
        },
        collector,
      ],
    };
    return {
      id: "otel-providers-no-sdk",
      seed: opcoes.seed ?? 1,
      edgeTicks: 1,
      root,
      channels: [canalOtlp],
      params,
      wires: [
        { from: "app", port: "span", to: "tracer-provider" },
        { from: "app", port: "log", to: DROP },
        { from: "app", port: "metric", to: DROP },
      ],
    };
  }

  const traces = tracerProvider("", ROTULOS.recursoDeTraces, ROTULOS.tracerProvider);
  const logs = loggerProvider();
  const metricas = meterProvider();
  const segundo =
    opcoes.segundoProvider === true
      ? tracerProvider("-b", ROTULOS.recursoDoSegundo, ROTULOS.tracerProviderB)
      : undefined;

  const process: AnyObject = {
    id: "process",
    kind: "composite",
    label: ROTULOS.process,
    entry: "app",
    exit: "meter-provider",
    children: [
      app(ROTULOS.escopo),
      // A placa dos propagadores pendura no PROCESSO, e não em provider nenhum:
      // a API de propagadores é global, e contexto não é configuração de
      // provider. Quem a placa toca é quem a possui — a posição É a posse, e ela
      // mata o mal-entendido sem uma palavra de texto.
      placa("propagators", ROTULOS.propagators),
      traces.objeto,
      ...(segundo === undefined ? [] : [segundo.objeto]),
      logs.objeto,
      metricas.objeto,
    ],
  };

  const root: AnyObject = {
    id: "host",
    kind: "composite",
    label: ROTULOS.host,
    entry: "process",
    exit: "collector",
    // O `collector` é filho do HOST e não do processo, porque ele não roda no
    // processo. Enfiá-lo dentro seria a primeira mentira estrutural, e ela
    // apareceria de graça no desenho.
    children: [process, collector],
  };

  const paraOCollector = (de: string): Wire => ({
    from: de,
    port: "out",
    to: "collector",
    channel: "otlp-out",
  });

  return {
    id: "otel-providers",
    seed: opcoes.seed ?? 1,
    edgeTicks: 1,
    root,
    channels: [canalOtlp],
    params,
    wires: [
      { from: "app", port: "span", to: "tracer-provider" },
      ...(segundo === undefined ? [] : [{ from: "app", port: "span", to: "tracer-provider-b" } as const]),
      { from: "app", port: "log", to: "logger-provider" },
      { from: "app", port: "metric", to: "meter-provider" },
      ...traces.wires,
      ...(segundo?.wires ?? []),
      ...logs.wires,
      ...metricas.wires,
      // A linha de D5: a única do lab que cruza a fronteira de um provider.
      { from: "sampler", port: "decision", to: "trace-gate", line: "control", toPort: "sampled" },
      paraOCollector(traces.exportador),
      ...(segundo === undefined ? [] : [paraOCollector(segundo.exportador)]),
      paraOCollector(logs.exportador),
      paraOCollector(metricas.exportador),
    ],
  };
}
