import { DROP } from "@ovh/depth-core";
import type { AnyObject, Emission, ObjectSpec, Wire } from "@ovh/depth-core";
import { spansDa, type RegistroDeSpan } from "./carga.js";

/**
 * O processador em lote, e ele é o mesmo para traces e para logs.
 *
 * Fonte: [Tracing SDK · Batching processor](https://opentelemetry.io/docs/specs/otel/trace/sdk/#batching-processor).
 * O `BatchSpanProcessor` e o `BatchLogRecordProcessor` têm a mesma forma — fila,
 * gatilho de tempo, exportador —, então há uma fábrica só. Duas cópias divergiriam,
 * e a divergência ensinaria que eles são diferentes, o que é falso.
 *
 * A peça que carrega a lição: **a fila cheia recusa.** O span é descartado, e o
 * descarte sai por uma porta que vai ao descarte declarado — nunca some. Sem a
 * porta, "a fila encheu" e "nada aconteceu" seriam o mesmo desenho, e perder dado
 * em silêncio é o defeito que este projeto trata como inaceitável.
 */

/** Padrões da spec. Escritos aqui uma vez, e citados na tela a partir daqui. */
export const MAX_QUEUE_SIZE_PADRAO = 2048;
export const MAX_EXPORT_BATCH_SIZE_PADRAO = 512;
export const SCHEDULED_DELAY_MS_PADRAO = 5000;

export interface LoteConfig {
  /** O id do composto. `batch-processor` para traces, `batch-log-processor` para logs. */
  readonly id: string;
  readonly fila: string;
  readonly gatilho: string;
  readonly exportador: string;
  readonly rotulos: {
    readonly lote: string;
    readonly fila: string;
    readonly gatilho: string;
    readonly exportador: string;
  };
  /** A chave em `WorldSpec.params` que o leitor mexe para mudar o tamanho da fila. */
  readonly paramFila: string;
  /** A chave que mede, em ticks, o `scheduledDelayMillis`. */
  readonly paramPrazo: string;
  readonly maxExportBatchSize: number;
  /** O `kind` da mensagem que sai pelo canal. É por ele que o Collector separa os sinais. */
  readonly kindDeSaida: string;
  /**
   * Recusar, na entrada, o que não foi amostrado.
   *
   * É verdade só do lado dos traces, e é a [tabela de reação](https://opentelemetry.io/docs/specs/otel/trace/sdk/#recording-sampled-reaction-table):
   * com `RECORD_ONLY` o processador **é** chamado e o exportador não vê o span.
   * O `BatchLogRecordProcessor` não tem essa checagem — o `LoggerProvider` não
   * tem amostrador nenhum —, e por isso isto é opção e não regra.
   *
   * A recusa sai por porta própria, separada da recusa por fila cheia: são dois
   * motivos diferentes de o span não sair, e um desenho que os juntasse
   * ensinaria que são o mesmo.
   */
  readonly recusaNaoAmostrado?: true;
}

export interface EstadoFila {
  readonly itens: readonly RegistroDeSpan[];
  /** Acumulado desde o tick 0. É o número que prova que a perda existe. */
  readonly descartados: number;
}

export interface EstadoGatilho {
  /** Quantos ticks desde o último disparo. */
  readonly desde: number;
}

export interface EstadoExportador {
  readonly lotes: number;
  readonly spans: number;
  /** Quantos `ForceFlush` desceram até aqui. Sem contador, o cascateamento seria invisível. */
  readonly flushes: number;
  /** O último lote que saiu. É daqui que o envelope do L3 é derivado. */
  readonly ultimo: readonly RegistroDeSpan[];
}

export interface Lote {
  readonly objeto: AnyObject;
  readonly wires: readonly Wire[];
}

const inteiro = (valor: number | undefined, padrao: number, minimo: number): number =>
  valor === undefined || !Number.isFinite(valor) ? padrao : Math.max(minimo, Math.round(valor));

export function loteProcessor(cfg: LoteConfig): Lote {
  /**
   * A fila. `buffer` porque **ela recusa quando enche** — é a diferença de forma
   * contra o `store` das métricas, que colapsa em vez de recusar (F4).
   */
  const fila: ObjectSpec<EstadoFila> = {
    id: cfg.fila,
    kind: "buffer",
    label: cfg.rotulos.fila,
    leaf: true,
    init: (): EstadoFila => ({ itens: [], descartados: 0 }),
    behavior: (state, inbox, ctx) => {
      if (ctx.phase !== "commit") return { state, out: [] };

      const max = inteiro(ctx.params[cfg.paramFila], MAX_QUEUE_SIZE_PADRAO, 0);
      const itens: RegistroDeSpan[] = [...state.itens];
      let recusados = 0;
      let naoAmostrados = 0;
      for (const message of inbox) {
        for (const span of spansDa(message)) {
          if (cfg.recusaNaoAmostrado === true && !span.amostrado) {
            naoAmostrados += 1;
            continue;
          }
          if (itens.length < max) itens.push(span);
          else recusados += 1;
        }
      }

      const out: Emission[] = [];
      if (recusados > 0) {
        out.push({ port: "dropped", message: ctx.emit("dropped", recusados, { motivo: "queue-full" }) });
      }
      if (naoAmostrados > 0) {
        out.push({
          port: "unsampled",
          message: ctx.emit("dropped", naoAmostrados, { motivo: "record-only" }),
        });
      }

      // Três gatilhos, e todos são da spec: o tamanho do lote, o prazo (que
      // chega como sinal do gatilho) e o `ForceFlush` (que chega pela mesma
      // porta, vindo do provider). O flush esvazia; o tamanho leva um lote só.
      const pedidoDeFlush = (ctx.signals["flush"]?.length ?? 0) > 0;
      const tamanho = Math.max(1, cfg.maxExportBatchSize);
      let aSair = pedidoDeFlush ? itens.length : itens.length >= tamanho ? tamanho : 0;

      let restantes = itens;
      while (aSair > 0) {
        const n = Math.min(tamanho, aSair);
        const spans = restantes.slice(0, n);
        restantes = restantes.slice(n);
        aSair -= n;
        out.push({ port: "out", message: ctx.emit("batch", n, { spans }) });
      }

      return { state: { itens: restantes, descartados: state.descartados + recusados }, out };
    },
  };

  /**
   * O gatilho de tempo. `sequencer`: guarda fase entre ticks, **só fala por
   * linha de controle**, e `validateWorld` recusa uma aresta de dado saindo dele.
   *
   * Ele empurra. É a metade da assimetria de F4 — do outro lado, o
   * `MetricReader` pede.
   */
  const gatilho: ObjectSpec<EstadoGatilho> = {
    id: cfg.gatilho,
    kind: "sequencer",
    label: cfg.rotulos.gatilho,
    leaf: true,
    init: (): EstadoGatilho => ({ desde: 0 }),
    behavior: (state, _inbox, ctx) => {
      if (ctx.phase !== "commit") return { state, out: [] };
      const prazo = inteiro(ctx.params[cfg.paramPrazo], 1, 1);
      const desde = state.desde + 1;
      if (desde < prazo) return { state: { desde }, out: [] };
      return {
        state: { desde: 0 },
        out: [{ port: "flush", message: ctx.emit("flush", 1, { motivo: "schedule" }) }],
      };
    },
  };

  /**
   * O exportador. `sink` no sentido do catálogo — consome e não emite para
   * **dentro** —, e o que ele manda para fora é o envelope, pelo canal opaco.
   *
   * Ele guarda estado porque é dele que se lê o resultado do run: sem contador,
   * "não exportou nada" seria indistinguível de "não rodou".
   */
  const exportador: ObjectSpec<EstadoExportador> = {
    id: cfg.exportador,
    kind: "sink",
    label: cfg.rotulos.exportador,
    leaf: true,
    init: (): EstadoExportador => ({ lotes: 0, spans: 0, flushes: 0, ultimo: [] }),
    behavior: (state, inbox, ctx) => {
      if (ctx.phase !== "commit") return { state, out: [] };
      // O `ForceFlush` do provider desce até aqui: a spec manda invocá-lo em
      // todos os processadores registrados, e o do lote continua a descida até
      // o exportador. Contar é o que impede o cascateamento de ser invisível.
      const flushes = state.flushes + (ctx.signals["flush"]?.length ?? 0);
      if (inbox.length === 0) return { state: { ...state, flushes }, out: [] };
      const out: Emission[] = [];
      let lotes = state.lotes;
      let spans = state.spans;
      let ultimo = state.ultimo;
      for (const message of inbox) {
        const carga = spansDa(message);
        if (carga.length === 0) continue;
        lotes += 1;
        spans += carga.length;
        ultimo = carga;
        out.push({ port: "out", message: ctx.emit(cfg.kindDeSaida, carga.length, { spans: carga }) });
      }
      return { state: { lotes, spans, flushes, ultimo }, out };
    },
  };

  const objeto: AnyObject = {
    id: cfg.id,
    kind: "composite",
    label: cfg.rotulos.lote,
    // `entry` e `exit` declarados: num `composite` a ordem dos filhos é
    // acidental, e deixar o motor escolher pelo primeiro faria a fiação de fora
    // depender de como a lista foi escrita.
    entry: cfg.fila,
    exit: cfg.exportador,
    children: [fila, gatilho, exportador],
  };

  return {
    objeto,
    wires: [
      { from: cfg.fila, port: "out", to: cfg.exportador },
      // O descarte é destino declarado. Sem ele, a recusa da fila sumiria do
      // livro-caixa e a perda de dado deixaria de existir no modelo.
      { from: cfg.fila, port: "dropped", to: DROP },
      ...(cfg.recusaNaoAmostrado === true
        ? [{ from: cfg.fila, port: "unsampled", to: DROP } as const]
        : []),
      { from: cfg.gatilho, port: "flush", to: cfg.fila, line: "control", toPort: "flush" },
    ],
  };
}
