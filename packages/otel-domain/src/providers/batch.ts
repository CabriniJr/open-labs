import { DROP } from "@ovh/depth-core";
import type { AnyObject, Emission, ObjectSpec, Wire } from "@ovh/depth-core";
import { spansDa, type PlacaDeRecurso, type RegistroDeSpan } from "./carga.js";

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
  /**
   * A chave que diz se o outro lado do canal sumiu.
   *
   * Não é capricho de simulação: é o modo de falha mais comum de um pipeline de
   * telemetria, e o único jeito de **ver** contrapressão. O exportador exporta
   * um lote por vez e espera; com o outro lado mudo, ele não termina, a fila não
   * tem para quem entregar, ela enche, e a partir daí **recusa**. A perda não
   * começa no exportador — começa na fila, três peças antes, e é por isso que
   * ela surpreende quem só olha o exportador.
   */
  readonly paramQueda: string;
  readonly maxExportBatchSize: number;
  /** O `kind` da mensagem que sai pelo canal. É por ele que o Collector separa os sinais. */
  readonly kindDeSaida: string;
  /**
   * O recurso do provider que registrou este processador.
   *
   * É a consequência dura de a placa ser placa: **placa não tem porta e não é
   * fiada**, então o `Resource` não chega ao exportador por fio nenhum. Ele
   * chega porque a fábrica do exportador **fecha** sobre o recurso do provider —
   * que é literalmente o que o SDK faz. O envelope o carrega, e `envelope.test.ts`
   * prova que o campo `resource` é exatamente esta placa.
   */
  readonly recurso: PlacaDeRecurso;
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
  /**
   * Se o exportador está livre para receber o próximo lote.
   *
   * Chega por linha de **controle**, e não como parâmetro lido aqui dentro: a
   * contrapressão é uma conversa entre duas peças, e uma conversa que só
   * existisse como número no ar não apareceria no desenho. É a única aresta do
   * lab que anda **contra** o fluxo, e é isso que a torna reconhecível.
   */
  readonly pronto: boolean;
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
  /**
   * O que ele recebeu e ainda não conseguiu mandar.
   *
   * A spec diz que o exportador exporta **um lote por vez** e espera a resposta.
   * Com o outro lado mudo, o lote fica aqui — e é este campo que mostra que o
   * dado não sumiu: ele está preso.
   */
  readonly retido: readonly RegistroDeSpan[];
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
    init: (): EstadoFila => ({ itens: [], descartados: 0, pronto: true }),
    behavior: (state, inbox, ctx) => {
      if (ctx.phase !== "commit") return { state, out: [] };

      const aviso = ctx.signals["ready"]?.at(-1);
      const pronto = aviso === undefined ? state.pronto : aviso.data["pronto"] === true;

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
      // Nem o `ForceFlush` passa por cima da contrapressão, e é verdade: se o
      // exportador não termina, não há para quem entregar, e o flush espera. É
      // por isso que um `Shutdown` com o coletor fora do ar não salva nada.
      let aSair = !pronto ? 0 : pedidoDeFlush ? itens.length : itens.length >= tamanho ? tamanho : 0;

      let restantes = itens;
      while (aSair > 0) {
        const n = Math.min(tamanho, aSair);
        const spans = restantes.slice(0, n);
        restantes = restantes.slice(n);
        aSair -= n;
        out.push({ port: "out", message: ctx.emit("batch", n, { spans }) });
      }

      return {
        state: { itens: restantes, descartados: state.descartados + recusados, pronto },
        out,
      };
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
    init: (): EstadoExportador => ({ lotes: 0, spans: 0, flushes: 0, ultimo: [], retido: [] }),
    behavior: (state, inbox, ctx) => {
      if (ctx.phase !== "commit") return { state, out: [] };
      // O `ForceFlush` do provider desce até aqui: a spec manda invocá-lo em
      // todos os processadores registrados, e o do lote continua a descida até
      // o exportador. Contar é o que impede o cascateamento de ser invisível.
      const flushes = state.flushes + (ctx.signals["flush"]?.length ?? 0);
      const caido = (ctx.params[cfg.paramQueda] ?? 0) >= 1;

      const retido = [...state.retido];
      for (const message of inbox) retido.push(...spansDa(message));

      const out: Emission[] = [];
      let lotes = state.lotes;
      let spans = state.spans;
      let ultimo = state.ultimo;
      if (!caido && retido.length > 0) {
        lotes += 1;
        spans += retido.length;
        ultimo = retido.slice();
        out.push({
          port: "out",
          message: ctx.emit(cfg.kindDeSaida, retido.length, {
            spans: retido.slice(),
            resource: cfg.recurso.attributes,
            provider: cfg.id,
          }),
        });
        retido.length = 0;
      }

      /*
        Ele se declara pronto quando **não está segurando nada** — e não quando
        o canal está de pé.

        A diferença é a spec: o exportador exporta um lote por vez e espera a
        resposta. Ele aceita o primeiro lote sem saber que o outro lado sumiu, e
        só a partir daí é que a fila descobre. Amarrar o aviso ao parâmetro
        pularia esse instante, e ele é o instante inteiro: a contrapressão
        **começa** com um lote preso, não com um aviso vindo do nada.

        O aviso corre todo tick, e não só quando muda: uma crença antiga na fila
        seria uma fila entregando para quem não pode receber.
      */
      out.push({ port: "ready", message: ctx.emit("ready", 1, { pronto: retido.length === 0 }) });

      return { state: { lotes, spans, flushes, ultimo, retido }, out };
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
      // A única aresta que anda contra o fluxo. Contrapressão é conversa entre
      // duas peças, e desenhá-la é o que permite ver a perda começar na fila em
      // vez de no exportador.
      { from: cfg.exportador, port: "ready", to: cfg.fila, line: "control", toPort: "ready" },
    ],
  };
}
