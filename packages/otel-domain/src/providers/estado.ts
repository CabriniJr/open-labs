import type { WorldState } from "@ovh/depth-core";
import type { EstadoExportador, EstadoFila } from "./batch.js";
import type { EstadoPontos, EstadoSaidaDeMetrica } from "./metrics.js";
import type { Decisao } from "./sampler.js";
import type { EstadoCollector } from "./world.js";
import { ATRIBUTO_DE_OVERFLOW } from "./metrics.js";

/**
 * O leitor tipado do `WorldState`.
 *
 * Existe para que a ilha **nunca** cave `state.nodes` com um `as`. Cavar
 * espalharia o formato do estado por dentro do componente, e no dia em que o
 * domínio mudasse um campo o painel passaria a mostrar `undefined` — que
 * aparece como zero, e zero é uma afirmação sobre o mundo. É a mesma classe de
 * defeito de sempre: mentir em silêncio.
 *
 * Os testes deste arquivo são de **conservação**: o que entrou tem de fechar
 * com o que saiu, mais o que ficou, mais o que se perdeu. Sem eles, um painel
 * com números plausíveis e errados passaria em tudo.
 */

export interface PontoDeMetrica {
  readonly chave: string;
  readonly valor: number;
  /** A linha em que o excedente se acumulou. Ela se desenha diferente. */
  readonly overflow: boolean;
}

export interface EstadoOtel {
  /** Quantos spans a instrumentação criou. */
  readonly criados: number;
  /** Quantos o amostrador já decidiu. Menor que `criados` pelo que está em voo. */
  readonly decididos: number;
  readonly amostrados: number;
  /** `RECORD_ONLY`: gravado, legível no processo, e o exportador nunca o vê. */
  readonly gravadosSemSair: number;
  readonly descartadosPeloSampler: number;

  readonly entraramNaFila: number;
  readonly naFila: number;
  readonly descartadosPelaFila: number;
  /** Recusados na entrada do processador por não terem o bit `sampled`. */
  readonly recusadosPorNaoAmostrado: number;
  /**
   * O que a fila soltou. Não é o mesmo que `exportados`: entre uma coisa e a
   * outra há uma aresta, e travessia custa tick. Juntar os dois números apagaria
   * o lote em voo — que é exatamente o que se perde quando o processo morre.
   */
  readonly saiuDaFila: number;
  readonly exportados: number;
  readonly lotes: number;
  readonly flushesRecebidos: number;

  readonly logsEmitidos: number;
  readonly logsBarradosPeloTrace: number;
  readonly logsExportados: number;

  readonly pontos: readonly PontoDeMetrica[];
  readonly colapsados: number;
  readonly coletas: number;

  readonly recebidosPeloCollector: number;
  readonly envelopes: number;
  /** F5: o contador do silêncio. Zero quando o SDK está instalado. */
  readonly engolidosPeloNoop: number;
}

const numero = (state: WorldState, chave: string): number => state.ledger[chave] ?? 0;

function ler<T>(state: WorldState, id: string): T | undefined {
  return state.nodes[id] as T | undefined;
}

export function estadoOtel(state: WorldState): EstadoOtel {
  const app = ler<{ readonly criados: number }>(state, "app");
  const sampler = ler<{ readonly porDecisao: Readonly<Record<Decisao, number>> }>(state, "sampler");
  const fila = ler<EstadoFila>(state, "queue");
  const exportador = ler<EstadoExportador>(state, "span-exporter");
  const porta = ler<{ readonly barrados: number }>(state, "trace-gate");
  const logExportador = ler<EstadoExportador>(state, "log-exporter");
  const pontos = ler<EstadoPontos>(state, "points");
  const metricas = ler<EstadoSaidaDeMetrica>(state, "metric-exporter");
  const collector = ler<EstadoCollector>(state, "collector");
  const noop = ler<{ readonly engolidos: number }>(state, "tracer-provider");

  const decisao = sampler?.porDecisao;
  const amostrados = decisao?.["record-and-sample"] ?? 0;
  const gravadosSemSair = decisao?.["record-only"] ?? 0;
  const descartadosPeloSampler = decisao?.drop ?? 0;

  const linhas = pontos?.linhas ?? {};

  return {
    criados: app?.criados ?? 0,
    decididos: amostrados + gravadosSemSair + descartadosPeloSampler,
    amostrados,
    gravadosSemSair,
    descartadosPeloSampler,

    // O livro-caixa é a fonte do que chegou: ele conta peso, e um lote de N
    // spans pesa N. Contar mensagens diria "um" onde entraram quinhentos.
    entraramNaFila: numero(state, "in:queue.weight"),
    naFila: fila?.itens.length ?? 0,
    descartadosPelaFila: numero(state, "out:queue.dropped.weight"),
    recusadosPorNaoAmostrado: numero(state, "out:queue.unsampled.weight"),
    saiuDaFila: numero(state, "out:queue.out.weight"),
    exportados: exportador?.spans ?? 0,
    lotes: exportador?.lotes ?? 0,
    flushesRecebidos: exportador?.flushes ?? 0,

    logsEmitidos: numero(state, "out:app.log.weight"),
    logsBarradosPeloTrace: porta?.barrados ?? 0,
    logsExportados: logExportador?.spans ?? 0,

    pontos: Object.entries(linhas).map(([chave, valor]) => ({
      chave,
      valor,
      overflow: chave === ATRIBUTO_DE_OVERFLOW,
    })),
    colapsados: pontos?.colapsados ?? 0,
    coletas: metricas?.coletas ?? 0,

    recebidosPeloCollector: collector?.spans ?? 0,
    envelopes: collector?.envelopes ?? 0,
    // No mundo com SDK, `tracer-provider` é composto e não tem estado — então o
    // campo é zero por ausência, e não por um contador que zerou.
    engolidosPeloNoop: noop?.engolidos ?? 0,
  };
}
