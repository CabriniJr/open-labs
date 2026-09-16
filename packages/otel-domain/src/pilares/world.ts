import type { AnyObject, Emission, ObjectSpec, Wire, WorldSpec } from "@ovh/depth-core";
import { baldeDe, chaveDaSerie, type Requisicao } from "./carga.js";
import { ROTULOS_PILARES } from "./labels.js";

/**
 * Três gravadores, **as mesmas** requisições.
 *
 * A tese, e é a razão de este ser o primeiro lab do handbook:
 *
 * > Um sinal não é um tipo de dado. É a **decisão sobre o que jogar fora na
 * > escrita** — e o que se joga fora ali não se pede depois.
 *
 * O desenho carrega o argumento: uma fonte, um serviço, e um leque que abre
 * para três caixas. Elas veem o mesmo evento. Se cada uma tivesse a própria
 * fonte, a demonstração seria um truque de montagem.
 *
 * O que cada uma guarda é o lab inteiro:
 *
 * - o **tracer** guarda o indivíduo: uma linha por requisição, com a duração;
 * - o **medidor** guarda a **contagem por balde** — e o balde foi decidido antes
 *   da medição. A identidade não foi comprimida, foi descartada;
 * - o **registrador** guarda a frase que o código escolheu dizer, e só ela.
 *
 * Fontes: [What is a signal](https://opentelemetry.io/docs/concepts/signals/),
 * [Metrics data model · histogram](https://opentelemetry.io/docs/specs/otel/metrics/data-model/#histogram),
 * [Cardinality limits](https://opentelemetry.io/docs/specs/otel/metrics/sdk/#cardinality-limits)
 * e [Logs data model](https://opentelemetry.io/docs/specs/otel/logs/data-model/).
 *
 * Escala de tempo: **um tick é um segundo**, a mesma do lab dos provedores.
 */

export const PARAMS_DOS_PILARES: Readonly<Record<string, number>> = {
  /** Quantas requisições o serviço atende por segundo. */
  "requisicoes-por-tick": 3,
  /** Uma a cada N falha. Zero: nenhuma falha. */
  "erro-a-cada": 7,
  /**
   * O código registra **toda** requisição, ou só as que falharam?
   *
   * É a pergunta que separa log de trace, e ela é uma decisão de quem escreveu
   * o código — não do backend, não da configuração.
   */
  "registrar-tudo": 0,
  /**
   * Acrescenta `user.id` aos atributos da métrica.
   *
   * Um atributo, e a conta do ano. É o mesmo botão que a fase 5 vai cobrar de
   * novo, e aqui ele serve para mostrar de onde vem a explosão: cada valor
   * distinto **abre uma série**, e séries são o que se paga.
   */
  "atributo-por-usuario": 0,
  /** Quantas séries o medidor aguenta antes de colapsar o excedente. */
  "limite-de-series": 12,
  /** A pergunta que o leitor faz aos três, em milissegundos. */
  "pergunta-acima-de": 250,
};

const inteiro = (valor: number | undefined, padrao: number): number =>
  valor === undefined || !Number.isFinite(valor) ? padrao : Math.max(0, Math.round(valor));

/** As rotas e os usuários do cenário. Poucos, e nomeados: é um lab, não um teste de carga. */
const ROTAS = ["/checkout", "/cart", "/search"] as const;
const USUARIOS = ["u-1042", "u-2071", "u-3319", "u-4560", "u-5127"] as const;

/**
 * A latência não é sorteada no desenho: ela sai do número da requisição.
 *
 * Determinística de propósito — o mesmo run duas vezes conta a mesma história,
 * e um lab que muda de resposta entre dois carregamentos não é evidência de
 * nada. A forma é a que se vê em serviço de verdade: quase tudo rápido, uma
 * cauda longa, e um pico raro.
 */
export function latenciaDe(n: number): number {
  const passo = n % 17;
  if (passo === 3) return 820;
  if (passo === 9) return 1400;
  if (passo % 4 === 0) return 40 + passo * 6;
  if (passo % 3 === 0) return 180 + passo * 9;
  return 60 + passo * 11;
}

export interface EstadoServico {
  readonly atendidas: number;
}

export interface EstadoTracer {
  /** Uma linha por requisição: o indivíduo, com o que ele levou. */
  readonly spans: readonly Requisicao[];
}

export interface EstadoMedidor {
  /** A contagem por balde. **Contagem**, e não os itens: é o descarte. */
  readonly baldes: Readonly<Record<string, number>>;
  /** Uma linha por conjunto de atributos. A chave É o conjunto. */
  readonly series: Readonly<Record<string, number>>;
  /** Quantas medições foram para a linha de overflow depois do limite. */
  readonly colapsadas: number;
  readonly total: number;
}

export interface EstadoRegistrador {
  readonly linhas: readonly { readonly texto: string; readonly tick: number }[];
  /** Quantas requisições aconteceram sem o código dizer nada sobre elas. */
  readonly caladas: number;
}

/** O quanto cada gravador guarda antes de o lab virar um teste de memória. */
const TETO = 60;

const fonte: ObjectSpec<{ readonly n: number }> = {
  id: "requests",
  kind: "source",
  label: ROTULOS_PILARES.requests,
  leaf: true,
  init: () => ({ n: 0 }),
  behavior: (state, _inbox, ctx) => {
    if (ctx.phase !== "commit") return { state, out: [] };
    const quantas = inteiro(ctx.params["requisicoes-por-tick"], 3);
    if (quantas === 0) return { state, out: [] };
    const erroACada = inteiro(ctx.params["erro-a-cada"], 0);

    const requisicoes: Requisicao[] = [];
    let n = state.n;
    for (let i = 0; i < quantas; i += 1) {
      n += 1;
      requisicoes.push({
        n,
        rota: ROTAS[n % ROTAS.length]!,
        latencia: latenciaDe(n),
        erro: erroACada > 0 && n % erroACada === 0,
        usuario: USUARIOS[n % USUARIOS.length]!,
        tick: ctx.tick,
      });
    }
    return {
      state: { n },
      out: [{ port: "out", message: ctx.emit("request", requisicoes.length, { requisicoes }) }],
    };
  },
};

const requisicoesDe = (data: Readonly<Record<string, unknown>>): readonly Requisicao[] =>
  Array.isArray(data["requisicoes"]) ? (data["requisicoes"] as readonly Requisicao[]) : [];

/**
 * O serviço: um leque que abre.
 *
 * Ele não decide nada sobre o conteúdo — só entrega **a mesma** requisição aos
 * três. A forma do desenho sai daqui: uma entrada, três saídas, e o trapézio
 * abre para o lado em que são muitos.
 */
const servico: ObjectSpec<EstadoServico> = {
  id: "service",
  kind: "router",
  label: ROTULOS_PILARES.service,
  leaf: true,
  init: (): EstadoServico => ({ atendidas: 0 }),
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit" || inbox.length === 0) return { state, out: [] };
    const requisicoes = inbox.flatMap((m) => requisicoesDe(m.data));
    if (requisicoes.length === 0) return { state, out: [] };
    const out: Emission[] = ["trace", "metric", "log"].map((porta) => ({
      port: porta,
      message: ctx.emit(porta === "trace" ? "span" : porta === "metric" ? "measurement" : "record", requisicoes.length, {
        requisicoes,
      }),
    }));
    return { state: { atendidas: state.atendidas + requisicoes.length }, out };
  },
};

/** O tracer guarda o indivíduo. É o único que ainda sabe quem era quem. */
const tracer: ObjectSpec<EstadoTracer> = {
  id: "trace-store",
  kind: "store",
  label: ROTULOS_PILARES.trace,
  leaf: true,
  init: (): EstadoTracer => ({ spans: [] }),
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit" || inbox.length === 0) return { state, out: [] };
    const chegando = inbox.flatMap((m) => requisicoesDe(m.data));
    return { state: { spans: [...state.spans, ...chegando].slice(-TETO) }, out: [] };
  },
};

/**
 * O medidor guarda a **contagem**.
 *
 * O balde existe antes da medição, e é isso que torna a identidade
 * irrecuperável: o valor entra, a contagem sobe, e o que sobra é a contagem.
 * Nenhum backend desfaz isso, porque não há o que desfazer — não foi
 * comprimido, foi **descartado**.
 *
 * O limite de séries colapsa o excedente numa linha só, como manda a spec: o
 * banco cheio não recusa, ele **soma junto** — mesma memória finita da fila do
 * lote, outra mentira.
 */
const medidor: ObjectSpec<EstadoMedidor> = {
  id: "metric-store",
  kind: "store",
  label: ROTULOS_PILARES.metric,
  leaf: true,
  init: (): EstadoMedidor => ({ baldes: {}, series: {}, colapsadas: 0, total: 0 }),
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit" || inbox.length === 0) return { state, out: [] };
    const comUsuario = inteiro(ctx.params["atributo-por-usuario"], 0) === 1;
    const limite = Math.max(1, inteiro(ctx.params["limite-de-series"], 12));

    const baldes: Record<string, number> = { ...state.baldes };
    const series: Record<string, number> = { ...state.series };
    let colapsadas = state.colapsadas;
    let total = state.total;

    for (const requisicao of inbox.flatMap((m) => requisicoesDe(m.data))) {
      total += 1;
      const balde = baldeDe(requisicao.latencia);
      baldes[balde] = (baldes[balde] ?? 0) + 1;

      const chave = chaveDaSerie(requisicao, comUsuario);
      if (series[chave] !== undefined || Object.keys(series).length < limite) {
        series[chave] = (series[chave] ?? 0) + 1;
      } else {
        colapsadas += 1;
      }
    }
    return { state: { baldes, series, colapsadas, total }, out: [] };
  },
};

/**
 * O registrador guarda a frase que o código escolheu dizer.
 *
 * O parâmetro `registrar-tudo` é a decisão de quem escreveu o código, e ela é
 * anterior a qualquer configuração: o que o código não disse, ninguém lê depois.
 * O contador de caladas é o que torna esse silêncio **contável**.
 */
const registrador: ObjectSpec<EstadoRegistrador> = {
  id: "log-store",
  kind: "store",
  label: ROTULOS_PILARES.log,
  leaf: true,
  init: (): EstadoRegistrador => ({ linhas: [], caladas: 0 }),
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit" || inbox.length === 0) return { state, out: [] };
    const tudo = inteiro(ctx.params["registrar-tudo"], 0) === 1;
    const linhas = [...state.linhas];
    let caladas = state.caladas;

    for (const requisicao of inbox.flatMap((m) => requisicoesDe(m.data))) {
      if (requisicao.erro) {
        linhas.push({
          texto: `ERROR checkout failed for ${requisicao.rota}`,
          tick: requisicao.tick,
        });
        continue;
      }
      if (tudo) {
        linhas.push({ texto: `INFO handled ${requisicao.rota}`, tick: requisicao.tick });
        continue;
      }
      caladas += 1;
    }
    return { state: { linhas: linhas.slice(-TETO), caladas }, out: [] };
  },
};

export function pilaresWorld(params: Readonly<Record<string, number>> = {}): WorldSpec {
  const root: AnyObject = {
    id: "process",
    kind: "composite",
    label: ROTULOS_PILARES.process,
    entry: "requests",
    exit: "trace-store",
    children: [fonte, servico, tracer, medidor, registrador],
  };

  /**
   * As três linhas saem da MESMA porta de dado? Não: de três portas do mesmo
   * serviço, porque são três chamadas de API diferentes — e é o leque delas que
   * o desenho mostra.
   */
  const wires: readonly Wire[] = [
    { from: "requests", port: "out", to: "service" },
    { from: "service", port: "trace", to: "trace-store" },
    { from: "service", port: "metric", to: "metric-store" },
    { from: "service", port: "log", to: "log-store" },
  ];

  return {
    id: "otel-three-pillars",
    seed: 7,
    root,
    wires,
    params: { ...PARAMS_DOS_PILARES, ...params },
    edgeTicks: 1,
  };
}
