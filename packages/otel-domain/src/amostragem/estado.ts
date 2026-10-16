import type { WorldState } from "@ovh/depth-core";
import type {
  EstadoDaAppAmostrada,
  EstadoDoBackendDeTraces,
  EstadoDoBalanceador,
  EstadoDoDescarteDeTraces,
  EstadoDoHead,
  EstadoDoTail,
  SpanAmostrado,
  TraceNoBackend,
} from "./world.js";

/**
 * O que a tela mostra, derivado do estado.
 *
 * A pergunta da página é a que se faz depois de um incidente:
 *
 * > O trace do erro está no backend?
 *
 * E a resposta tem duas formas de ser "não", que o lab separa porque elas se
 * consertam de maneiras opostas:
 *
 * - **cortado antes**: o head sampler jogou o trace fora antes de o erro
 *   existir. Nenhuma política de tail conserta, porque o dado nunca chegou;
 * - **chegou quebrado**: o trace está lá, sem o span que falhou. Pior que o
 *   primeiro, porque tem cara de trace que deu certo — e em produção nenhum
 *   contador reporta isso.
 */

/**
 * O que UM gateway sabe — e ter isto por instância não é detalhe de tela.
 *
 * A primeira versão desta página mostrava a soma dos dois nas duas caixas, e
 * isso é uma mentira pequena com consequência grande: o lab inteiro é sobre
 * cada instância decidir com o pedaço que recebeu, e dois painéis idênticos
 * afirmam o contrário do que o modelo faz.
 */
export interface EstadoDeUmGateway {
  readonly retidos: number;
  readonly tracesAbertos: number;
  readonly decididos: number;
  readonly mantidosPorErro: number;
  readonly mantidosPorBase: number;
  readonly cortados: number;
}

export interface EstadoDaAmostragem {
  readonly tracesIniciados: number;
  readonly comErro: number;
  readonly spansEmitidos: number;

  readonly headMantidos: number;
  readonly headCortados: number;
  /** Traces com erro que o head cortou: perda que o tail não pode desfazer. */
  readonly errosCortadosNoHead: number;

  readonly paraA: number;
  readonly paraB: number;

  /** Cada gateway por si: é com o pedaço dele que ele decide. */
  readonly porGateway: Readonly<Record<"gatewayA" | "gatewayB", EstadoDeUmGateway>>;
  readonly retidosNoTail: number;
  readonly decididos: number;
  readonly mantidosPorErro: number;
  readonly mantidosPorBase: number;
  readonly cortadosNoTail: number;

  /** Traces no backend com todos os spans que o produtor emitiu. */
  readonly completos: number;
  /**
   * Traces no backend com spans faltando. É o defeito do roteamento que não
   * conhece trace, e é um número do run.
   */
  readonly quebrados: number;
  /** Traces com erro que chegaram inteiros: a resposta da pergunta da página. */
  readonly errosInteiros: number;
  /** Traces com erro que chegaram quebrados: existem, e mentem. */
  readonly errosQuebrados: number;
  readonly ultimosNoBackend: readonly TraceNoBackend[];

  readonly descartesPorQuem: readonly { readonly quem: string; readonly quantos: number }[];
  readonly descartesTotal: number;
}

const no = <T>(state: WorldState, id: string): T | undefined => state.nodes[id] as T | undefined;

export function estadoDaAmostragem(state: WorldState): EstadoDaAmostragem {
  const app = no<EstadoDaAppAmostrada>(state, "app");
  const head = no<EstadoDoHead>(state, "head");
  const balanceador = no<EstadoDoBalanceador>(state, "balanceador");
  const a = no<EstadoDoTail>(state, "gatewayA");
  const b = no<EstadoDoTail>(state, "gatewayB");
  const backend = no<EstadoDoBackendDeTraces>(state, "backend");
  const descartes = no<EstadoDoDescarteDeTraces>(state, "descartes");

  const doGateway = (t: EstadoDoTail | undefined): EstadoDeUmGateway => ({
    retidos: t?.retidos ?? 0,
    tracesAbertos: Object.keys(t?.abertos ?? {}).length,
    decididos: t?.decididos ?? 0,
    mantidosPorErro: t?.mantidosPorErro ?? 0,
    mantidosPorBase: t?.mantidosPorBase ?? 0,
    cortados: t?.cortados ?? 0,
  });

  const traces = backend?.traces ?? [];
  const inteiro = (t: TraceNoBackend): boolean => t.spans >= t.de;

  return {
    tracesIniciados: app?.tracesIniciados ?? 0,
    comErro: app?.comErro ?? 0,
    spansEmitidos: app?.spans ?? 0,

    headMantidos: head?.mantidos ?? 0,
    headCortados: head?.cortados ?? 0,
    errosCortadosNoHead: head?.errosCortados ?? 0,

    paraA: balanceador?.paraA ?? 0,
    paraB: balanceador?.paraB ?? 0,

    porGateway: { gatewayA: doGateway(a), gatewayB: doGateway(b) },
    retidosNoTail: (a?.retidos ?? 0) + (b?.retidos ?? 0),
    decididos: (a?.decididos ?? 0) + (b?.decididos ?? 0),
    mantidosPorErro: (a?.mantidosPorErro ?? 0) + (b?.mantidosPorErro ?? 0),
    mantidosPorBase: (a?.mantidosPorBase ?? 0) + (b?.mantidosPorBase ?? 0),
    cortadosNoTail: (a?.cortados ?? 0) + (b?.cortados ?? 0),

    completos: traces.filter(inteiro).length,
    quebrados: traces.filter((t) => !inteiro(t)).length,
    errosInteiros: traces.filter((t) => t.comErro && inteiro(t)).length,
    errosQuebrados: traces.filter((t) => t.comErro && !inteiro(t)).length,
    ultimosNoBackend: traces.slice(-6).reverse(),

    descartesPorQuem: Object.entries(descartes?.porQuem ?? {})
      .map(([quem, quantos]) => ({ quem, quantos }))
      .sort((a2, b2) => b2.quantos - a2.quantos),
    descartesTotal: descartes?.total ?? 0,
  };
}

/**
 * Seguir um span pela amostragem.
 *
 * A chave é o trace e o índice do primeiro span da mensagem: é o que distingue
 * dois spans do mesmo trace, que é a distinção que este lab precisa fazer —
 * seguir "o trace 12" não mostraria o que acontece quando o span 3 dele vai
 * para um gateway e os outros dois para o outro.
 */
export const LEITOR_DO_SPAN_AMOSTRADO = {
  chave: (mensagem: { readonly data: Readonly<Record<string, unknown>> }): string | undefined => {
    const spans = mensagem.data["spans"];
    if (!Array.isArray(spans) || spans.length === 0) return undefined;
    const primeiro = spans[0] as SpanAmostrado;
    if (primeiro.trace === undefined) return undefined;
    return `trace ${primeiro.trace} · span ${primeiro.indice}`;
  },

  corpo: (mensagem: {
    readonly kind: string;
    readonly data: Readonly<Record<string, unknown>>;
  }): unknown => {
    const spans = mensagem.data["spans"];
    if (!Array.isArray(spans) || spans.length === 0) return {};
    const span = spans[0] as SpanAmostrado;
    const quem = mensagem.data["quem"];

    // Mesma forma em todas as paradas, de propósito: o diff acusa o que mudou
    // e não a forma do corpo.
    return {
      trace: span.trace,
      span: `${span.indice} of ${span.de}`,
      service: span.servico,
      error: span.erro,
      travelling_as: mensagem.kind === "trace" ? "a decided trace" : "a single span",
      decided_by: typeof quem === "string" ? quem : "— nobody yet —",
      spans_in_message: spans.length,
    };
  },
};
