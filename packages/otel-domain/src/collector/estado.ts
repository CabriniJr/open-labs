import type { WorldState } from "@ovh/depth-core";
import { ROTA_FILTRADA } from "./labels.js";
import type {
  EstadoDaApp,
  EstadoDoDescarte,
  EstadoDoDestino,
  EstadoDoFiltro,
  EstadoDoLimiter,
  EstadoDoLote,
  EstadoDoReceiver,
  SpanDoCollector,
} from "./world.js";

/**
 * O que a tela mostra, derivado do estado — e nunca de texto.
 *
 * A pergunta que a página faz é a que alguém faz no trabalho:
 *
 * > Liguei um filter para parar de mandar `/health`. Paramos?
 *
 * E a resposta sai daqui: `healthNoBackend` conta quantos `/health` o backend
 * recebeu **mesmo com o filtro ligado**. Enquanto esse número subir, a resposta
 * é não — e ela é um número do run, não uma frase do autor.
 */

export interface EstadoDoCollector {
  readonly emitidos: number;
  readonly recebidos: number;
  /** A pipeline de cima, a que o backend lê. */
  readonly admitidos: number;
  readonly recusados: number;
  readonly retidos: number;
  readonly idadeDoLote: number;
  readonly fechadosPorTamanho: number;
  readonly fechadosPorTempo: number;
  readonly noBackend: number;
  readonly lotesNoBackend: number;
  /** A pipeline de baixo, a que ninguém estava olhando. */
  readonly passaram: number;
  readonly barrados: number;
  readonly noConsole: number;
  /** O descarte, por quem descartou. Somar os dois apagaria a diferença. */
  readonly descartesPorQuem: readonly { readonly quem: string; readonly quantos: number }[];
  readonly descartesTotal: number;
  /**
   * A resposta da pergunta da página: quantos `/health` chegaram ao backend.
   *
   * É o número que **não muda** quando o filtro liga, e é por isso que ele é o
   * primeiro da tela.
   */
  readonly healthNoBackend: number;
  readonly healthNoConsole: number;
  /** As últimas linhas de cada destino, para o leitor ver o conteúdo e não só a soma. */
  readonly ultimosNoBackend: readonly SpanDoCollector[];
  readonly ultimosNoConsole: readonly SpanDoCollector[];
}

const no = <T>(state: WorldState, id: string): T | undefined => state.nodes[id] as T | undefined;

const contaHealth = (spans: readonly SpanDoCollector[]): number =>
  spans.filter((s) => s.rota === ROTA_FILTRADA).length;

export function estadoDoCollector(state: WorldState): EstadoDoCollector {
  const app = no<EstadoDaApp>(state, "app");
  const receiver = no<EstadoDoReceiver>(state, "receiver");
  const limiter = no<EstadoDoLimiter>(state, "limiter");
  const lote = no<EstadoDoLote>(state, "lote");
  const filtro = no<EstadoDoFiltro>(state, "filtro");
  const backend = no<EstadoDoDestino>(state, "backend");
  const console_ = no<EstadoDoDestino>(state, "console");
  const descartes = no<EstadoDoDescarte>(state, "descartes");

  const spansNoBackend = backend?.spans ?? [];
  const spansNoConsole = console_?.spans ?? [];

  return {
    emitidos: app?.emitidos ?? 0,
    recebidos: receiver?.recebidos ?? 0,
    admitidos: limiter?.admitidos ?? 0,
    recusados: limiter?.recusados ?? 0,
    retidos: lote?.retidos.length ?? 0,
    idadeDoLote: lote?.idade ?? 0,
    fechadosPorTamanho: lote?.fechadosPorTamanho ?? 0,
    fechadosPorTempo: lote?.fechadosPorTempo ?? 0,
    noBackend: spansNoBackend.length,
    lotesNoBackend: backend?.lotes ?? 0,
    passaram: filtro?.passaram ?? 0,
    barrados: filtro?.barrados ?? 0,
    noConsole: spansNoConsole.length,
    descartesPorQuem: Object.entries(descartes?.porQuem ?? {})
      .map(([quem, quantos]) => ({ quem, quantos }))
      .sort((a, b) => b.quantos - a.quantos),
    descartesTotal: descartes?.total ?? 0,
    healthNoBackend: contaHealth(spansNoBackend),
    healthNoConsole: contaHealth(spansNoConsole),
    ultimosNoBackend: spansNoBackend.slice(-6).reverse(),
    ultimosNoConsole: spansNoConsole.slice(-6).reverse(),
  };
}

/**
 * Seguir um span pelas duas pipelines.
 *
 * É a tese vista de dentro de um item, e é a melhor demonstração que este lab
 * tem: o trajeto de **um** span se abre em dois braços no receiver, e os dois
 * braços continuam até destinos diferentes. Nenhum texto precisa dizer que a
 * cópia existe — ela aparece duas vezes no mesmo trajeto.
 *
 * O nome carrega `_DO_COLLECTOR` porque `LEITOR_DO_SPAN` já é do lab do herói,
 * e os dois leem spans de mundos diferentes. Colisão de nome em pacote com
 * índice único é erro de build, e foi assim que esta apareceu.
 *
 * A chave é o `n` do primeiro span da mensagem. Mensagens deste mundo carregam
 * listas (um tick traz vários spans, um lote traz vários), e seguir a lista
 * inteira não é seguir um item: o primeiro é o representante, que é a mesma
 * escolha que o lab dos pilares faz.
 */
export const LEITOR_DO_SPAN_DO_COLLECTOR = {
  chave: (mensagem: { readonly data: Readonly<Record<string, unknown>> }): string | undefined => {
    const spans = mensagem.data["spans"];
    if (!Array.isArray(spans) || spans.length === 0) return undefined;
    const primeiro = spans[0] as { readonly n?: number };
    return primeiro.n === undefined ? undefined : `span:${primeiro.n}`;
  },

  corpo: (mensagem: {
    readonly kind: string;
    readonly data: Readonly<Record<string, unknown>>;
  }): unknown => {
    const spans = mensagem.data["spans"];
    if (!Array.isArray(spans) || spans.length === 0) return {};
    const span = spans[0] as SpanDoCollector;
    const quem = mensagem.data["quem"];

    /*
      Os corpos têm a MESMA forma de propósito, pela mesma razão do lab dos
      pilares: o campo que muda de uma parada para a outra aparece no mesmo
      lugar, e o diff acusa a mudança em vez de acusar a forma.
    */
    const comum = { span: span.n, route: span.rota };

    if (typeof quem === "string") {
      return { ...comum, travelling_as: "a dropped span", dropped_by: quem, batch_of: 1 };
    }
    if (mensagem.kind === "batch") {
      return {
        ...comum,
        travelling_as: "one span inside an OTLP request",
        dropped_by: "— nobody —",
        batch_of: spans.length,
      };
    }
    return {
      ...comum,
      travelling_as: "a single span",
      dropped_by: "— nobody —",
      batch_of: spans.length,
    };
  },
};
