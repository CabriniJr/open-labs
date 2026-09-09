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

/**
 * Como o leitor segue **uma requisição** neste lab, e o que ele vê dela em cada
 * parada.
 *
 * Aqui o trajeto tem uma forma que os outros labs não têm: a requisição sai do
 * serviço para os três gravadores **ao mesmo tempo**, e o corpo em cada braço é
 * o que aquele gravador vai guardar dela. O diff entre as paradas mostra então o
 * que cada sinal **joga fora** — que é a tese do lab, vista de dentro de um
 * item em vez de vista no agregado.
 */
export const LEITOR_DA_REQUISICAO = {
  chave: (mensagem: { readonly data: Readonly<Record<string, unknown>> }): string | undefined => {
    const requisicoes = mensagem.data["requisicoes"];
    if (!Array.isArray(requisicoes) || requisicoes.length === 0) return undefined;
    const primeira = requisicoes[0] as { readonly n?: number };
    return primeira.n === undefined ? undefined : `request:${primeira.n}`;
  },

  corpo: (mensagem: {
    readonly kind: string;
    readonly data: Readonly<Record<string, unknown>>;
  }): unknown => {
    const requisicoes = mensagem.data["requisicoes"];
    if (!Array.isArray(requisicoes) || requisicoes.length === 0) return {};
    const req = requisicoes[0] as Requisicao;

    /*
      Os três corpos têm a MESMA forma, e é isso que faz o diff dizer alguma
      coisa: o campo que um guarda e o outro joga fora aparece no mesmo lugar,
      com o valor trocado por "descartado". Formas diferentes fariam o diff
      acusar a forma, e não a perda — que é o assunto.
    */
    const DESCARTADO = "— discarded at write time —";
    const NUNCA_DITO = "— the code never mentioned it —";

    if (mensagem.kind === "span") {
      // O tracer fica com o indivíduo inteiro: é o único que ainda sabe quem.
      return {
        kept_by: "the tracer",
        request: req.n,
        route: req.rota,
        duration_ms: req.latencia,
        error: req.erro,
      };
    }
    if (mensagem.kind === "measurement") {
      // O medidor fica com o BALDE. O número exato entrou e não saiu.
      return {
        kept_by: "the meter",
        request: DESCARTADO,
        route: req.rota,
        duration_ms: `${baldeDe(req.latencia)} (a bucket, not a number)`,
        error: req.erro,
      };
    }
    if (mensagem.kind === "record") {
      // O registrador fica com o que o código escolheu dizer, e nada mais.
      return {
        kept_by: "the logger",
        request: NUNCA_DITO,
        route: req.erro ? req.rota : NUNCA_DITO,
        duration_ms: NUNCA_DITO,
        error: req.erro,
      };
    }
    return {
      kept_by: "nobody yet — this is the request itself",
      request: req.n,
      route: req.rota,
      duration_ms: req.latencia,
      error: req.erro,
    };
  },
};
