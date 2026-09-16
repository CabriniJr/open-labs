import type { AnyObject, Emission, ObjectSpec, Wire, WorldSpec } from "@ovh/depth-core";
import { formatTraceparent, parseTraceparent } from "../traceparent.js";
import { amostradaNaRaiz, idHex, type Chamada, type SpanExportado } from "./carga.js";
import { ROTULOS_ANATOMIA, SERVICOS, type Servico } from "./labels.js";

/**
 * Uma requisição, quatro processos, e uma árvore que ninguém possui.
 *
 * A tese, e ela é geométrica antes de ser texto: a chamada segue **para
 * frente**, de serviço em serviço, levando o `traceparent`; o span sai **para o
 * lado**, cada um por conta própria, para o backend. Nenhum serviço manda uma
 * árvore para lugar nenhum — nenhum serviço **tem** uma árvore. O que o leitor
 * vê no painel é a árvore que o backend consegue montar com o que chegou, e ela
 * é uma conclusão, não um objeto do run.
 *
 * Por isso cada serviço é um leque que abre: uma entrada, duas saídas. O
 * trabalho continua por um lado e a telemetria sai pelo outro, e a forma diz
 * isso antes de qualquer rótulo ser lido.
 *
 * Fontes: [W3C Trace Context](https://www.w3.org/TR/trace-context/),
 * [Tracing API · SpanContext](https://opentelemetry.io/docs/specs/otel/trace/api/#spancontext)
 * e [ParentBased sampler](https://opentelemetry.io/docs/specs/otel/trace/sdk/#parentbased).
 */

export const PARAMS_DA_ANATOMIA: Readonly<Record<string, number>> = {
  /** Quantas requisições entram por segundo. */
  "requisicoes-por-tick": 1,
  /**
   * Em qual fronteira o cabeçalho é derrubado. 0: nenhuma.
   *
   * 1 = gateway→checkout, 2 = checkout→payments, 3 = payments→ledger. É o proxy
   * que remove cabeçalho desconhecido, o cliente que remonta a requisição, a
   * fila que carrega só o payload.
   */
  "derrubar-cabecalho-em": 0,
  /**
   * Qual serviço do meio está sem instrumentação. 0: nenhum.
   *
   * Ele **repassa o cabeçalho** e não exporta span nenhum — que é o caso que
   * engana: os filhos se penduram no avô, a árvore fecha, e o tempo do salto
   * sumido é atribuído a quem está acima.
   */
  "sem-instrumentacao": 0,
  /** A taxa de amostragem decidida na raiz. */
  "taxa-de-amostragem": 1,
  /**
   * Os serviços de baixo ignoram a decisão que veio no cabeçalho e decidem por
   * conta própria. Não é excesso de coleta: é fabricação de fragmentos.
   */
  "ignorar-amostragem": 0,
};

const inteiro = (valor: number | undefined, padrao: number): number =>
  valor === undefined || !Number.isFinite(valor) ? padrao : Math.max(0, Math.round(valor));
const fracao = (valor: number | undefined, padrao: number): number =>
  valor === undefined || !Number.isFinite(valor) ? padrao : Math.min(1, Math.max(0, valor));

export interface EstadoServico {
  readonly atendidas: number;
  readonly exportados: number;
  /** Quantas vezes ele começou um trace NOVO por não ter recebido cabeçalho. */
  readonly raizesInesperadas: number;
  /**
   * A última requisição que passou por ele.
   *
   * Existe para o painel saber **qual requisição já teve tempo de terminar**: a
   * mais recente de todas costuma estar em voo, e desenhar a árvore dela pela
   * metade acusaria um defeito que não existe. Quem responde isso é o último
   * serviço da cadeia, e a resposta é do modelo — não uma folga chutada.
   */
  readonly ultimaN: number;
}

export interface EstadoBackend {
  /** O que de fato chegou. A árvore é montada a partir daqui, e não antes. */
  readonly spans: readonly SpanExportado[];
}

const chamadasDe = (data: Readonly<Record<string, unknown>>): readonly Chamada[] =>
  Array.isArray(data["chamadas"]) ? (data["chamadas"] as readonly Chamada[]) : [];

const spansDe = (data: Readonly<Record<string, unknown>>): readonly SpanExportado[] =>
  Array.isArray(data["spans"]) ? (data["spans"] as readonly SpanExportado[]) : [];

/** Quantos spans o backend guarda antes de o lab virar teste de memória. */
const TETO = 80;

const entrada: ObjectSpec<{ readonly n: number }> = {
  id: "edge",
  kind: "source",
  label: ROTULOS_ANATOMIA.entrada,
  leaf: true,
  init: () => ({ n: 0 }),
  behavior: (state, _inbox, ctx) => {
    if (ctx.phase !== "commit") return { state, out: [] };
    const quantas = inteiro(ctx.params["requisicoes-por-tick"], 1);
    if (quantas === 0) return { state, out: [] };
    const chamadas: Chamada[] = [];
    let n = state.n;
    for (let i = 0; i < quantas; i += 1) {
      n += 1;
      // Sem cabeçalho: a requisição vem de fora do sistema, e é o gateway que
      // vai começar o trace. É o único lugar onde uma raiz é esperada.
      chamadas.push({ n });
    }
    return {
      state: { n },
      out: [{ port: "call", message: ctx.emit("request", chamadas.length, { chamadas }) }],
    };
  },
};

/**
 * Um serviço: extrai o contexto, cria o span, injeta o contexto e segue.
 *
 * Os três controles de defeito moram aqui, e nenhum deles é um caso especial no
 * desenho: são a mesma lógica com uma peça faltando, que é como eles acontecem
 * de verdade.
 */
function servico(nome: Servico, posicao: number, ultimo: boolean): ObjectSpec<EstadoServico> {
  return {
    id: nome,
    kind: "router",
    label: ROTULOS_ANATOMIA[nome],
    leaf: true,
    init: (): EstadoServico => ({ atendidas: 0, exportados: 0, raizesInesperadas: 0, ultimaN: 0 }),
    behavior: (state, inbox, ctx) => {
      if (ctx.phase !== "commit" || inbox.length === 0) return { state, out: [] };

      const semInstrumentacao = inteiro(ctx.params["sem-instrumentacao"], 0) === posicao;
      const derrubaAqui = inteiro(ctx.params["derrubar-cabecalho-em"], 0) === posicao;
      const ignoraAmostragem = inteiro(ctx.params["ignorar-amostragem"], 0) === 1;
      const taxa = fracao(ctx.params["taxa-de-amostragem"], 1);

      const chamadas = inbox.flatMap((m) => chamadasDe(m.data));
      if (chamadas.length === 0) return { state, out: [] };

      const spans: SpanExportado[] = [];
      const seguem: Chamada[] = [];
      let raizesInesperadas = state.raizesInesperadas;

      for (const chamada of chamadas) {
        const recebido =
          chamada.traceparent === undefined ? null : parseTraceparent(chamada.traceparent);

        /*
          Sem contexto, o serviço começa um trace NOVO — e não dá erro nenhum.
          É o modo de falha inteiro num `if`: o dado continua correto, a
          requisição é atendida, e o que se perde é a ligação.
        */
        const traceId = recebido?.traceId ?? idHex(32, `trace:${nome}:${chamada.n}`);
        const spanId = idHex(16, `span:${nome}:${chamada.n}`);
        if (recebido === null && posicao > 1) raizesInesperadas += 1;

        const amostrado =
          recebido === null || ignoraAmostragem
            ? amostradaNaRaiz(chamada.n + posicao * 97, taxa)
            : recebido.sampled;

        if (!semInstrumentacao && amostrado) {
          spans.push({
            traceId,
            spanId,
            ...(recebido === null ? {} : { parentId: recebido.spanId }),
            servico: nome,
            n: chamada.n,
            amostrado,
          });
        }

        if (!ultimo) {
          /*
            O que segue para o próximo.

            Sem instrumentação, ele **repassa o que recebeu** — é o caso que
            engana, porque a árvore fecha com um salto a menos e continua
            parecendo completa. Derrubando o cabeçalho, não segue nada, e o
            próximo começa do zero.
          */
          const paraFrente = semInstrumentacao
            ? chamada.traceparent
            : formatTraceparent({ traceId, spanId, sampled: amostrado });
          seguem.push({
            n: chamada.n,
            ...(derrubaAqui || paraFrente === undefined ? {} : { traceparent: paraFrente }),
          });
        }
      }

      const out: Emission[] = [];
      if (spans.length > 0) {
        out.push({ port: "export", message: ctx.emit("span", spans.length, { spans }) });
      }
      if (seguem.length > 0) {
        out.push({ port: "call", message: ctx.emit("request", seguem.length, { chamadas: seguem }) });
      }
      return {
        state: {
          atendidas: state.atendidas + chamadas.length,
          exportados: state.exportados + spans.length,
          raizesInesperadas,
          ultimaN: chamadas.reduce((maior, c) => Math.max(maior, c.n), state.ultimaN),
        },
        out,
      };
    },
  };
}

/**
 * O backend guarda **o que chegou**, e nada mais.
 *
 * Ele não sabe o que deveria ter chegado: ninguém aloca identificador, então
 * ninguém tem a lista. A árvore é montada em `estado.ts`, na leitura — que é
 * onde ela é montada na vida real.
 */
const backend: ObjectSpec<EstadoBackend> = {
  id: "backend",
  kind: "store",
  label: ROTULOS_ANATOMIA.backend,
  leaf: true,
  init: (): EstadoBackend => ({ spans: [] }),
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit" || inbox.length === 0) return { state, out: [] };
    /*
      O carimbo de chegada é do BACKEND, e não do serviço.

      É ele que permite a única coisa que um backend pode fazer para decidir que
      um trace acabou: **esperar e desistir**. Não existe evento de "trace
      terminou" — não poderia existir, porque emiti-lo exigiria alguém que
      conhecesse a árvore inteira, e esse alguém é justamente o que não há.
    */
    const chegando = inbox
      .flatMap((m) => spansDe(m.data))
      .map((span) => ({ ...span, chegouEm: ctx.tick }));
    return { state: { spans: [...state.spans, ...chegando].slice(-TETO) }, out: [] };
  },
};

export function anatomiaWorld(params: Readonly<Record<string, number>> = {}): WorldSpec {
  const servicos = SERVICOS.map((nome, i) => servico(nome, i + 1, i === SERVICOS.length - 1));

  const root: AnyObject = {
    id: "sistema",
    kind: "composite",
    label: ROTULOS_ANATOMIA.sistema,
    entry: "edge",
    exit: "backend",
    children: [entrada, ...servicos, backend],
  };

  const wires: Wire[] = [{ from: "edge", port: "call", to: SERVICOS[0]! }];
  SERVICOS.forEach((nome, i) => {
    const proximo = SERVICOS[i + 1];
    if (proximo !== undefined) wires.push({ from: nome, port: "call", to: proximo });
    wires.push({ from: nome, port: "export", to: "backend" });
  });

  return {
    id: "otel-anatomy",
    seed: 11,
    root,
    wires,
    params: { ...PARAMS_DA_ANATOMIA, ...params },
    edgeTicks: 1,
  };
}
