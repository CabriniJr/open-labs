import type { WorldState } from "@ovh/depth-core";
import { baldeDe, type Requisicao } from "./carga.js";
import type { EstadoMedidor, EstadoRegistrador, EstadoServico, EstadoTracer } from "./world.js";

/**
 * O leitor tipado do `WorldState` deste lab — e o **juiz da pergunta**.
 *
 * A pergunta é a peça central: *quais requisições passaram de N milissegundos?*
 * As três respostas saem daqui, e **todas as três saem do estado**. Nenhuma é
 * texto escrito à mão dizendo o que o leitor deveria concluir: o tracer responde
 * porque tem as linhas, o medidor não responde porque só tem contagens, e o
 * registrador responde ou não conforme o que o código escolheu dizer.
 *
 * Se um dia o modelo mudar e a métrica passar a guardar identidade, esta função
 * passa a responder — e é isso que a torna evidência em vez de moral da história.
 */

export interface RespostaDoSinal {
  /** Ele consegue responder a pergunta com o que guardou? */
  readonly responde: boolean;
  /** A resposta, ou o motivo de não haver uma. Em inglês: o leitor lê isto. */
  readonly texto: string;
}

export interface EstadoDosPilares {
  readonly atendidas: number;
  /** Quantas passaram do limite da pergunta, de verdade. É a régua das respostas. */
  readonly acimaDoLimite: number;
  readonly limite: number;

  readonly spans: readonly Requisicao[];
  readonly baldes: readonly { readonly nome: string; readonly contagem: number }[];
  readonly series: readonly { readonly chave: string; readonly valor: number }[];
  readonly seriesColapsadas: number;
  readonly linhas: readonly { readonly texto: string; readonly tick: number }[];
  readonly caladas: number;

  readonly resposta: {
    readonly trace: RespostaDoSinal;
    readonly metric: RespostaDoSinal;
    readonly log: RespostaDoSinal;
  };
}

const nodo = <T>(state: WorldState, id: string): T | undefined =>
  state.nodes[id] as T | undefined;

const numero = (n: number): string => n.toLocaleString("en-US");

export function estadoDosPilares(
  state: WorldState,
  limite: number,
): EstadoDosPilares {
  const servico = nodo<EstadoServico>(state, "service");
  const tracer = nodo<EstadoTracer>(state, "trace-store");
  const medidor = nodo<EstadoMedidor>(state, "metric-store");
  const registrador = nodo<EstadoRegistrador>(state, "log-store");

  const spans = tracer?.spans ?? [];
  const lentos = spans.filter((s) => s.latencia > limite);

  /*
    Os baldes saem ORDENADOS, e a ordem é do modelo.

    Eles nascem na ordem em que a primeira medição de cada um chegou, que é
    ordem de acaso — e um histograma fora de ordem não se lê como histograma:
    ele vira uma tabela de números soltos, e a forma da distribuição, que é a
    coisa que ele existe para mostrar, desaparece.
  */
  const baldes = Object.entries(medidor?.baldes ?? {})
    .map(([nome, contagem]) => ({ nome, contagem }))
    .sort((a, b) => ordemDoBalde(a.nome) - ordemDoBalde(b.nome));
  /*
    A conta do medidor para a pergunta.

    Ele **consegue** dizer quantas passaram — desde que o limite da pergunta caia
    numa borda de balde. Fora disso ele nem isso: um balde que cruza o limite
    responde "entre X e Y", que é o que um histograma é. É a diferença entre não
    saber quem e não saber nem quantos.
  */
  const bordaDoBalde = baldeDe(limite) !== baldeDe(limite + 1);
  const acimaNoHistograma = baldes
    .filter((b) => ordemDoBalde(b.nome) > ordemDoBalde(baldeDe(limite)))
    .reduce((total, b) => total + b.contagem, 0);

  const series = Object.entries(medidor?.series ?? {}).map(([chave, valor]) => ({ chave, valor }));
  const linhas = registrador?.linhas ?? [];
  const lentasRegistradas = linhas.filter((l) => spans.some((s) => s.tick === l.tick && s.latencia > limite));

  return {
    atendidas: servico?.atendidas ?? 0,
    acimaDoLimite: lentos.length,
    limite,
    spans,
    baldes,
    series,
    seriesColapsadas: medidor?.colapsadas ?? 0,
    linhas,
    caladas: registrador?.caladas ?? 0,
    resposta: {
      trace: {
        responde: lentos.length > 0,
        texto:
          lentos.length === 0
            ? "None yet — and it would say so by having no matching row."
            : `${numero(lentos.length)}: ${lentos
                .slice(-4)
                .map((s) => `#${s.n} ${s.rota} (${s.latencia} ms)`)
                .join(", ")}`,
      },
      metric: {
        // Ele nunca responde "quais". Quando o limite cai numa borda de balde
        // ele responde "quantas"; fora dela, nem isso.
        responde: false,
        texto: bordaDoBalde
          ? `${numero(acimaNoHistograma)} measurements landed above ${numero(limite)} ms — ` +
            "and it cannot say which ones, because it never knew."
          : `It cannot even count them: ${numero(limite)} ms falls inside a bucket, and a ` +
            "bucket is a count, not a list.",
      },
      log: {
        responde: lentasRegistradas.length > 0,
        texto:
          lentasRegistradas.length > 0
            ? `${numero(lentasRegistradas.length)} of them left a line — the ones the code ` +
              "chose to talk about."
            : `Nothing. ${numero(registrador?.caladas ?? 0)} requests went by without the ` +
              "code saying a word, and slow is not something it was asked to mention.",
      },
    },
  };
}

/** A ordem dos baldes, para "acima de" ter sentido. O aberto é o último. */
function ordemDoBalde(nome: string): number {
  const numeros = nome.match(/\d+/u);
  const valor = numeros === null ? 0 : Number(numeros[0]);
  return nome.startsWith(">") ? valor + 1 : valor;
}
