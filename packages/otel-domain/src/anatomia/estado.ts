import type { WorldState } from "@ovh/depth-core";
import type { SpanExportado } from "./carga.js";
import { SERVICOS } from "./labels.js";
import type { EstadoBackend, EstadoServico } from "./world.js";

/**
 * A árvore é montada **aqui**, na leitura — e é isso que o lab afirma.
 *
 * Durante o run ela não existe em lugar nenhum: cada serviço carrega uma aresta
 * só, a que aponta para o pai, e exporta por conta própria. O que este módulo
 * faz é o que o backend faz: pegar o que chegou e calcular o fecho transitivo.
 *
 * E o que ele **não** consegue fazer é a outra metade da tese: dizer o que
 * faltou. Ninguém aloca identificador, então ninguém tem a lista do que deveria
 * ter chegado — a única coisa que se pode notar é um pai que não veio junto, e
 * mesmo isso só quando o filho chegou.
 */

export interface NoDaArvore {
  readonly span: SpanExportado;
  readonly filhos: readonly NoDaArvore[];
  /** O pai foi citado e não chegou. A árvore fecha por cima com um buraco. */
  readonly orfao: boolean;
}

export interface ArvoreMontada {
  readonly traceId: string;
  readonly n: number;
  readonly raizes: readonly NoDaArvore[];
  readonly spans: number;
  readonly servicos: readonly string[];
}

export interface EstadoDaAnatomia {
  readonly requisicoes: number;
  readonly spansChegados: number;
  /** As árvores da requisição mais recente que já produziu alguma. */
  readonly arvores: readonly ArvoreMontada[];
  readonly ultimaRequisicao: number;
  /** Spans cujo pai foi citado e não chegou. */
  readonly orfaos: number;
  /** Serviços que a requisição atravessou e que não exportaram nada. */
  readonly saltosSemSpan: readonly string[];
  readonly porServico: readonly {
    readonly servico: string;
    readonly atendidas: number;
    readonly exportados: number;
    readonly raizesInesperadas: number;
    readonly ultimaN: number;
  }[];
}

const nodo = <T>(state: WorldState, id: string): T | undefined => state.nodes[id] as T | undefined;

/**
 * Quantos ticks de silêncio bastam para o backend dar um trace por encerrado.
 *
 * É a profundidade da cadeia mais o salto da exportação — o tempo que o span do
 * último serviço leva para chegar. Um número menor mostraria árvores pela
 * metade; um maior atrasaria o painel sem ganhar nada.
 */
const ESPERA = 2;

/** Monta a árvore de um trace a partir dos spans que chegaram. */
function montar(spans: readonly SpanExportado[]): readonly NoDaArvore[] {
  const porId = new Map(spans.map((s) => [s.spanId, s]));
  const filhosDe = new Map<string, SpanExportado[]>();
  const raizes: SpanExportado[] = [];

  for (const span of spans) {
    const pai = span.parentId;
    // Raiz é quem não cita pai; **órfão** é quem cita um pai que não chegou — e
    // os dois viram raiz no desenho, que é exatamente o problema.
    if (pai === undefined || !porId.has(pai)) {
      raizes.push(span);
      continue;
    }
    filhosDe.set(pai, [...(filhosDe.get(pai) ?? []), span]);
  }

  const no = (span: SpanExportado): NoDaArvore => ({
    span,
    filhos: (filhosDe.get(span.spanId) ?? []).map(no),
    orfao: span.parentId !== undefined && !porId.has(span.parentId),
  });

  return raizes.map(no);
}

export function estadoDaAnatomia(state: WorldState): EstadoDaAnatomia {
  const backend = nodo<EstadoBackend>(state, "backend");
  const spans = backend?.spans ?? [];

  const porServico = SERVICOS.map((servico) => {
    const s = nodo<EstadoServico>(state, servico);
    return {
      servico,
      atendidas: s?.atendidas ?? 0,
      exportados: s?.exportados ?? 0,
      raizesInesperadas: s?.raizesInesperadas ?? 0,
      ultimaN: s?.ultimaN ?? 0,
    };
  });

  /*
    A requisição que o painel mostra: a mais recente que **está quieta há tempo
    suficiente**.

    Não existe evento de "trace terminou", e não poderia existir: emiti-lo
    exigiria alguém que conhecesse a árvore inteira, que é justamente o que não
    há. Então o backend faz a única coisa possível — **espera e desiste**, que é
    o mesmo que um backend de verdade faz, e a razão de amostragem de cauda
    precisar de janela e de teto de memória.

    Desenhar a requisição mais nova mostraria uma árvore pela metade porque um
    span ainda está no fio, e o leitor não teria como saber que a culpa é do
    relógio: acusaria um defeito que não existe.
  */
  const quieta = (n: number): boolean =>
    state.tick - Math.max(...spans.filter((s) => s.n === n).map((s) => s.chegouEm ?? 0)) >= ESPERA;
  const numeros = [...new Set(spans.map((s) => s.n))].sort((a, b) => b - a);
  const ultimaRequisicao = numeros.find(quieta) ?? numeros[0] ?? 0;
  const daRequisicao = spans.filter((s) => s.n === ultimaRequisicao);

  const traces = new Map<string, SpanExportado[]>();
  for (const span of daRequisicao) {
    traces.set(span.traceId, [...(traces.get(span.traceId) ?? []), span]);
  }

  const arvores = [...traces.entries()].map(([traceId, doTrace]) => ({
    traceId,
    n: ultimaRequisicao,
    raizes: montar(doTrace),
    spans: doTrace.length,
    servicos: doTrace.map((s) => s.servico),
  }));

  const orfaos = daRequisicao.filter(
    (s) => s.parentId !== undefined && !daRequisicao.some((outro) => outro.spanId === s.parentId),
  ).length;

  /*
    O salto sem span: um serviço que ATENDEU a requisição e não exportou nada.

    Só dá para dizer isto de fora, olhando o modelo — e é justamente o que o
    backend não consegue: lá, um salto sem span é indistinguível de um salto que
    não aconteceu.
  */
  const saltosSemSpan = porServico
    .filter((s) => s.atendidas > 0 && daRequisicao.every((span) => span.servico !== s.servico))
    .map((s) => s.servico);

  return {
    requisicoes: porServico[0]?.atendidas ?? 0,
    spansChegados: spans.length,
    arvores,
    ultimaRequisicao,
    orfaos,
    saltosSemSpan,
    porServico,
  };
}

/**
 * Como o leitor segue uma requisição, e o que ele vê dentro dela.
 *
 * A chave é a requisição, e não a mensagem: cada salto emite uma mensagem nova
 * — o motor está certo em dar id novo a cada uma —, e o que faz duas serem a
 * mesma coisa é o número da requisição. Quem sabe disso é o domínio.
 *
 * O corpo é o que ela carrega **naquele ponto do trajeto**, e é por isso que
 * seguir uma requisição mostra o enriquecimento: o `traceparent` é reescrito a
 * cada serviço, e some inteiro quando alguém o derruba.
 */
export const LEITOR_DA_CHAMADA = {
  chave: (mensagem: { readonly data: Readonly<Record<string, unknown>> }): string | undefined => {
    const chamadas = mensagem.data["chamadas"];
    if (Array.isArray(chamadas) && chamadas.length > 0) {
      const primeira = chamadas[0] as { readonly n?: number };
      return primeira.n === undefined ? undefined : `request:${primeira.n}`;
    }
    const spans = mensagem.data["spans"];
    if (Array.isArray(spans) && spans.length > 0) {
      const primeiro = spans[0] as { readonly n?: number };
      return primeiro.n === undefined ? undefined : `request:${primeiro.n}`;
    }
    return undefined;
  },

  /**
   * O trajeto é o da REQUISIÇÃO; o span é produto dela, e não parada.
   *
   * Misturados, cada parada acusava "mudou o traceparent e mudou o span",
   * porque o corpo alternava entre duas formas — o leitor lia ruído no lugar do
   * mecanismo, que é o cabeçalho sendo reescrito a cada serviço.
   */
  noTrajeto: (mensagem: { readonly data: Readonly<Record<string, unknown>> }): boolean =>
    Array.isArray(mensagem.data["chamadas"]),

  corpo: (mensagem: { readonly data: Readonly<Record<string, unknown>> }): unknown => {
    const chamadas = mensagem.data["chamadas"];
    if (Array.isArray(chamadas) && chamadas.length > 0) {
      const chamada = chamadas[0] as { readonly n: number; readonly traceparent?: string };
      return {
        request: chamada.n,
        // A ausência é dita, e não omitida: um campo que some da tela sem
        // explicação é exatamente o defeito que este lab existe para mostrar.
        traceparent: chamada.traceparent ?? "— no header on the wire —",
      };
    }
    const spans = mensagem.data["spans"];
    if (Array.isArray(spans) && spans.length > 0) {
      const span = spans[0] as SpanExportado;
      return {
        request: span.n,
        exported_span: {
          service: span.servico,
          trace_id: span.traceId,
          span_id: span.spanId,
          parent_span_id: span.parentId ?? "— none: this span is a root —",
          sampled: span.amostrado,
        },
      };
    }
    return {};
  },
};
