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
