import type { Emission, ObjectSpec, WorldSpec } from "@ovh/depth-core";
import { compileSkeleton, parseSkeleton, type NodeOverride } from "@ovh/mermaid-skeleton";
import AMOSTRAGEM_MMD from "./amostragem.mmd?raw";
import { ROTULOS_AMOSTRAGEM, SERVICOS_DO_TRACE } from "./labels.js";

/**
 * Head decide antes de saber; tail precisa do trace inteiro.
 *
 * As duas amostragens não são a mesma política em lugares diferentes — são
 * decisões tomadas em **instantes** diferentes, e o instante é tudo:
 *
 * - o head sampler decide no span raiz, quando a requisição ainda não fez
 *   nada. A decisão não pode depender de um erro que ainda não aconteceu, e é
 *   por isso que amostrar 10% do tráfego não guarda 10% de cada categoria:
 *   guarda 10% do tráfego, e o erro raro fica proporcionalmente tão raro
 *   quanto era;
 * - o tail sampler decide no trace terminado, e consegue dizer "guarde tudo
 *   que falhou". O preço é guardar **todos** os spans de **todos** os traces
 *   em memória até a janela fechar, inclusive os que vão ser jogados fora.
 *
 * A terceira coisa é a que não está em nenhuma das duas definições e derruba
 * instalações reais: o tail sampler só decide certo se **todos** os spans de um
 * trace chegarem na mesma instância. Com dois gateways e um balanceamento que
 * não conhece trace, cada um decide sobre um pedaço — e o resultado continua
 * com cara de amostragem.
 *
 * **O que este lab NÃO faz, e é decisão:** probabilidade. O head sampler aqui
 * guarda 1 em N de forma determinística, e o tail guarda 1 em N dos traces sem
 * erro. Amostragem de verdade é probabilística sobre o id do trace, e trocar o
 * sorteio por um resto de divisão muda a estatística — mas o lab não é sobre a
 * estatística, é sobre **quais** traces sobrevivem, e um run reproduzível é o
 * que deixa o leitor comparar dois regimes em vez de duas tiragens.
 *
 * Fontes: [Sampling](https://opentelemetry.io/docs/concepts/sampling/),
 * [W3C Trace Context](https://www.w3.org/TR/trace-context/),
 * [agent-to-gateway](https://opentelemetry.io/docs/collector/deploy/other/agent-to-gateway/).
 */

export const PARAMS_DA_AMOSTRAGEM: Readonly<Record<string, number>> = {
  /** Quantos traces a aplicação começa por segundo. */
  "traces-por-tick": 2,
  /** Quantos spans cada trace tem. O último é o que falha, quando falha. */
  "spans-por-trace": 3,
  /**
   * Um trace a cada N contém erro. Erro no último span de propósito: ele
   * acontece **depois** da decisão do head sampler, que é a tese.
   */
  "erro-a-cada": 4,
  /** O head sampler guarda 1 trace a cada N. Em 1, guarda tudo. */
  "head-mantem-1-em": 1,
  /** Quantos ticks o tail sampler espera antes de decidir sobre um trace. */
  "espera-do-tail": 2,
  /** Dos traces SEM erro, o tail guarda 1 a cada N: a linha de base. */
  "tail-mantem-1-em": 5,
  /**
   * 1: o balanceador roteia por trace, e todo span de um trace cai na mesma
   * instância. 0: roteia por chegada, como um Service do Kubernetes que
   * balanceia conexões — e aí um trace se parte entre os dois gateways.
   */
  "rotear-por-trace": 1,
};

/**
 * O embaralhador do id do trace, e ele não é enfeite de implementação.
 *
 * A primeira versão deste lab decidia com `trace % N`, e isso ensinava uma
 * mentira: com "um erro a cada 4" e "guarde 1 em 4", os dois restos coincidem
 * e o head sampler aparece guardando **todos** os erros — exatamente o
 * contrário da tese. Qualquer regra determinística em cima do id cru é
 * periódica, e duas periodicidades alinhadas produzem uma conclusão falsa que o
 * leitor não tem como desconfiar.
 *
 * Embaralhar primeiro é também o que o sampler de verdade faz: o
 * `TraceIdRatioBased` decide a partir de um hash do id do trace, e é por isso
 * que a taxa dele é aproximada e não exata. Esta função é um xorshift de 32
 * bits — barata, determinística (o run é reproduzível) e sem relação com o
 * resto da divisão do id.
 */
export function hashDoTrace(trace: number): number {
  let x = (trace + 0x9e3779b9) | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return Math.abs(x | 0);
}

const inteiro = (valor: number | undefined, padrao: number, minimo = 0): number =>
  valor === undefined || !Number.isFinite(valor) ? padrao : Math.max(minimo, Math.round(valor));

/** Um span, do ponto de vista da amostragem. */
export interface SpanAmostrado {
  /** O trace a que pertence: é por ele que tudo se agrupa. */
  readonly trace: number;
  /** A posição dentro do trace, de 1 a `de`. */
  readonly indice: number;
  /** Quantos spans o trace tem. Só o produtor sabe isto — ver `estado.ts`. */
  readonly de: number;
  readonly servico: string;
  readonly erro: boolean;
}

export interface EstadoDaAppAmostrada {
  readonly tracesIniciados: number;
  readonly comErro: number;
  readonly spans: number;
}

export interface EstadoDoHead {
  readonly mantidos: number;
  readonly cortados: number;
  /** Traces com erro que o head cortou: o número que o lab existe para mostrar. */
  readonly errosCortados: number;
}

export interface EstadoDoBalanceador {
  readonly paraA: number;
  readonly paraB: number;
  /** Quantos spans já passaram, para o modo de rodízio por chegada. */
  readonly vistos: number;
}

/** Um trace aberto dentro de um tail sampler, esperando a janela fechar. */
export interface TraceAberto {
  readonly spans: readonly SpanAmostrado[];
  readonly idade: number;
}

export interface EstadoDoTail {
  readonly abertos: Readonly<Record<string, TraceAberto>>;
  readonly decididos: number;
  readonly mantidosPorErro: number;
  readonly mantidosPorBase: number;
  readonly cortados: number;
  /** Spans retidos agora: o custo de memória, que é um número e não um aviso. */
  readonly retidos: number;
}

/** O que o backend guarda de um trace, e é só o que chegou. */
export interface TraceNoBackend {
  readonly trace: number;
  readonly spans: number;
  readonly de: number;
  readonly comErro: boolean;
}

export interface EstadoDoBackendDeTraces {
  readonly traces: readonly TraceNoBackend[];
}

export interface EstadoDoDescarteDeTraces {
  readonly porQuem: Readonly<Record<string, number>>;
  readonly total: number;
}

const spansDe = (data: Readonly<Record<string, unknown>>): readonly SpanAmostrado[] =>
  Array.isArray(data["spans"]) ? (data["spans"] as readonly SpanAmostrado[]) : [];

/** Teto do que o backend guarda, para o lab não virar teste de memória. */
const TETO = 160;

/**
 * A aplicação: dois serviços, um trace, e o erro no fim.
 *
 * Todos os spans de um trace saem no mesmo tick. É uma simplificação declarada:
 * num sistema real eles saem ao longo da requisição, e é exatamente por isso
 * que o tail sampler precisa de uma janela de espera. Aqui a janela existe e é
 * parâmetro, mas o que ela espera é a rede do modelo, não a duração da
 * requisição.
 */
const app: NodeOverride = {
  leaf: true,
  init: (): EstadoDaAppAmostrada => ({ tracesIniciados: 0, comErro: 0, spans: 0 }),
  behavior: (state, _inbox, ctx) => {
    if (ctx.phase !== "commit") return { state, out: [] };
    const quantos = inteiro(ctx.params["traces-por-tick"], 2);
    if (quantos === 0) return { state, out: [] };
    const porTrace = inteiro(ctx.params["spans-por-trace"], 3, 1);
    const erroACada = inteiro(ctx.params["erro-a-cada"], 4);

    const spans: SpanAmostrado[] = [];
    let trace = state.tracesIniciados;
    let comErro = state.comErro;
    for (let t = 0; t < quantos; t += 1) {
      trace += 1;
      const falha = erroACada > 0 && trace % erroACada === 0;
      if (falha) comErro += 1;
      for (let i = 1; i <= porTrace; i += 1) {
        spans.push({
          trace,
          indice: i,
          de: porTrace,
          // O primeiro span é do serviço de entrada; o resto, do de dentro.
          servico: SERVICOS_DO_TRACE[i === 1 ? 0 : 1] ?? "checkout",
          // O erro mora no ÚLTIMO span: ele acontece depois da decisão do head.
          erro: falha && i === porTrace,
        });
      }
    }
    return {
      state: { tracesIniciados: trace, comErro, spans: state.spans + spans.length },
      out: [{ port: "exporta", message: ctx.emit("span", spans.length, { spans }) }],
    };
  },
};

/**
 * O head sampler, e ele decide **por trace**, não por span.
 *
 * Isso é o comportamento do sampler padrão: a decisão é tomada na raiz e viaja
 * no bit `sampled` do `traceparent`, então ou o trace inteiro é amostrado ou
 * nenhum span dele é. Decidir span a span produziria traces furados, que é o
 * defeito que o parent-based existe para não ter.
 */
const head: NodeOverride = {
  leaf: true,
  init: (): EstadoDoHead => ({ mantidos: 0, cortados: 0, errosCortados: 0 }),
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit" || inbox.length === 0) return { state, out: [] };
    const spans = inbox.flatMap((m) => spansDe(m.data));
    if (spans.length === 0) return { state, out: [] };

    const umEm = inteiro(ctx.params["head-mantem-1-em"], 1, 1);
    // Em 1, guarda tudo sem passar pelo hash: "amostrar 100%" não é uma
    // tiragem, é a ausência de amostragem, e um hash aqui deixaria a taxa
    // aproximada onde ela devia ser exata.
    const fica = (s: SpanAmostrado): boolean => umEm === 1 || hashDoTrace(s.trace) % umEm === 0;
    const mantidos = spans.filter(fica);
    const cortados = spans.filter((s) => !fica(s));

    // Quantos TRACES com erro foram cortados aqui: a perda que importa não se
    // conta em spans, porque um trace é a unidade que responde a pergunta.
    const tracesComErroCortados = new Set(
      cortados.filter((s) => s.erro).map((s) => s.trace),
    ).size;

    const out: Emission[] = [];
    if (mantidos.length > 0) {
      out.push({ port: "amostrado", message: ctx.emit("span", mantidos.length, { spans: mantidos }) });
    }
    if (cortados.length > 0) {
      out.push({
        port: "cortado",
        message: ctx.emit("span", cortados.length, { spans: cortados, quem: "head sampler" }),
      });
    }
    return {
      state: {
        mantidos: state.mantidos + mantidos.length,
        cortados: state.cortados + cortados.length,
        errosCortados: state.errosCortados + tracesComErroCortados,
      },
      out,
    };
  },
};

/**
 * O balanceador, e ele é o experimento silencioso do lab.
 *
 * `rotear-por-trace: 1` é o `loadbalancing` exporter com `routing_key: traceID`:
 * o destino sai do trace, então todo span de um trace vai para a mesma
 * instância. `0` é um Service comum do Kubernetes, que balanceia **conexões** e
 * não requisições — modelado aqui como rodízio por chegada, que é o que
 * produz o defeito: o trace se parte, e nenhum dos dois gateways tem o trace
 * inteiro para decidir.
 */
const balanceador: NodeOverride = {
  leaf: true,
  init: (): EstadoDoBalanceador => ({ paraA: 0, paraB: 0, vistos: 0 }),
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit" || inbox.length === 0) return { state, out: [] };
    const spans = inbox.flatMap((m) => spansDe(m.data));
    if (spans.length === 0) return { state, out: [] };

    const porTrace = inteiro(ctx.params["rotear-por-trace"], 1) === 1;
    const paraA: SpanAmostrado[] = [];
    const paraB: SpanAmostrado[] = [];
    let vistos = state.vistos;
    for (const s of spans) {
      vistos += 1;
      const vaiParaA = porTrace ? s.trace % 2 === 0 : vistos % 2 === 0;
      (vaiParaA ? paraA : paraB).push(s);
    }

    const out: Emission[] = [];
    if (paraA.length > 0) out.push({ port: "paraA", message: ctx.emit("span", paraA.length, { spans: paraA }) });
    if (paraB.length > 0) out.push({ port: "paraB", message: ctx.emit("span", paraB.length, { spans: paraB }) });
    return {
      state: { paraA: state.paraA + paraA.length, paraB: state.paraB + paraB.length, vistos },
      out,
    };
  },
};

/**
 * Um tail sampler: junta por trace, espera, e decide no que tem.
 *
 * "No que tem" é a frase inteira do lab. Ele não sabe quantos spans o trace
 * tinha — ninguém a jusante sabe — então a janela fechar é o que ele chama de
 * trace terminado. Com roteamento por trace, isso é verdade. Sem, ele decide
 * sobre um pedaço e não tem como notar.
 */
function tail(quem: string): NodeOverride {
  return {
    leaf: true,
    init: (): EstadoDoTail => ({
      abertos: {},
      decididos: 0,
      mantidosPorErro: 0,
      mantidosPorBase: 0,
      cortados: 0,
      retidos: 0,
    }),
    behavior: (state, inbox, ctx) => {
      if (ctx.phase !== "commit") return { state, out: [] };
      const espera = inteiro(ctx.params["espera-do-tail"], 2, 1);
      const base = inteiro(ctx.params["tail-mantem-1-em"], 5, 1);

      // 1. o que chegou entra no balde do seu trace
      const abertos: Record<string, TraceAberto> = {};
      // A anotação é necessária, e não cosmética: `state.abertos` é um
      // `Record` com índice de string, e o `Object.entries` dele perde o tipo
      // do valor atravessando a assinatura genérica do comportamento.
      const antesDeTudo: readonly [string, TraceAberto][] = Object.entries(
        state.abertos,
      ) as readonly [string, TraceAberto][];
      for (const [chave, aberto] of antesDeTudo) {
        abertos[chave] = { spans: aberto.spans, idade: aberto.idade + 1 };
      }
      for (const s of inbox.flatMap((m) => spansDe(m.data))) {
        const chave = String(s.trace);
        const antes = abertos[chave];
        abertos[chave] =
          antes === undefined
            ? { spans: [s], idade: 0 }
            : { spans: [...antes.spans, s], idade: antes.idade };
      }

      // 2. os baldes cuja janela fechou são decididos
      const mantidos: TraceAberto[] = [];
      const cortados: TraceAberto[] = [];
      const restam: Record<string, TraceAberto> = {};
      let mantidosPorErro = state.mantidosPorErro;
      let mantidosPorBase = state.mantidosPorBase;
      let cortadosConta = state.cortados;
      let decididos = state.decididos;

      for (const [chave, aberto] of Object.entries(abertos)) {
        if (aberto.idade < espera) {
          restam[chave] = aberto;
          continue;
        }
        decididos += 1;
        const temErro = aberto.spans.some((s) => s.erro);
        // A política de base é probabilística no Collector de verdade, e aqui
        // ela passa pelo mesmo embaralhador, pela mesma razão.
        const naBase = base === 1 || hashDoTrace(Number(chave)) % base === 0;
        if (temErro) {
          mantidosPorErro += 1;
          mantidos.push(aberto);
        } else if (naBase) {
          mantidosPorBase += 1;
          mantidos.push(aberto);
        } else {
          cortadosConta += 1;
          cortados.push(aberto);
        }
      }

      const out: Emission[] = [];
      for (const t of mantidos) {
        out.push({
          port: "mantido",
          message: ctx.emit("trace", t.spans.length, { spans: t.spans, quem }),
        });
      }
      for (const t of cortados) {
        out.push({
          port: "cortado",
          message: ctx.emit("trace", t.spans.length, { spans: t.spans, quem }),
        });
      }

      return {
        state: {
          abertos: restam,
          decididos,
          mantidosPorErro,
          mantidosPorBase,
          cortados: cortadosConta,
          retidos: Object.values(restam).reduce((n, t) => n + t.spans.length, 0),
        },
        out,
      };
    },
  };
}

/**
 * O backend, e ele guarda **só o que chegou**.
 *
 * O campo `de` viaja no span porque o produtor é o único que sabe o tamanho do
 * trace. Num backend de verdade esse número não existe, e é por isso que um
 * trace sem o span que falhou tem exatamente a mesma cara de um trace que deu
 * certo. Aqui ele existe para o lab poder **medir** o que a produção não
 * consegue nem reportar.
 */
const backend: NodeOverride = {
  leaf: true,
  init: (): EstadoDoBackendDeTraces => ({ traces: [] }),
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit" || inbox.length === 0) return { state, out: [] };
    const chegando = inbox.flatMap((m) => spansDe(m.data));
    if (chegando.length === 0) return { state, out: [] };

    const porTrace = new Map<number, TraceNoBackend>();
    for (const t of state.traces) porTrace.set(t.trace, t);
    for (const s of chegando) {
      const antes = porTrace.get(s.trace);
      porTrace.set(s.trace, {
        trace: s.trace,
        spans: (antes?.spans ?? 0) + 1,
        de: s.de,
        comErro: (antes?.comErro ?? false) || s.erro,
      });
    }
    return {
      state: { traces: [...porTrace.values()].slice(-TETO) },
      out: [],
    };
  },
};

/**
 * O descarte, por quem descartou — a mesma decisão do lab do Collector.
 *
 * Head e tail jogam fora por razões opostas: um por não saber ainda, o outro
 * por já saber que não interessa. Somar os dois num número só apagaria a única
 * diferença que importa quando falta um trace.
 */
const descartes: NodeOverride = {
  leaf: true,
  init: (): EstadoDoDescarteDeTraces => ({ porQuem: {}, total: 0 }),
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit" || inbox.length === 0) return { state, out: [] };
    const porQuem = { ...state.porQuem };
    let total = state.total;
    for (const m of inbox) {
      const spans = spansDe(m.data);
      if (spans.length === 0) continue;
      const quem = typeof m.data["quem"] === "string" ? m.data["quem"] : "desconhecido";
      porQuem[quem] = (porQuem[quem] ?? 0) + spans.length;
      total += spans.length;
    }
    return { state: { porQuem, total }, out: [] };
  },
};

/**
 * Monta o `WorldSpec` da amostragem a partir do esqueleto em `amostragem.mmd`.
 *
 * Topologia — inclusive a escolha de ter DOIS gateways desenhados sempre — vem
 * do desenho. Com roteamento por trace os dois trabalham; sem ele os dois
 * continuam trabalhando, e é justamente aí que o defeito aparece.
 */
export function amostragemWorld(params: Readonly<Record<string, number>> = {}): WorldSpec {
  const parsed = parseSkeleton(AMOSTRAGEM_MMD);
  if (!parsed.ok) throw new Error(`amostragem.mmd inválido: ${parsed.errors.join(" | ")}`);

  const overrides: Record<string, NodeOverride> = {
    app,
    head,
    balanceador,
    gatewayA: tail("gateway A"),
    gatewayB: tail("gateway B"),
    backend,
    descartes,
  };

  const compiled = compileSkeleton(parsed.value, {
    overrides,
    rootId: "amostragem",
    rootLabel: ROTULOS_AMOSTRAGEM.amostragem,
    rootEntry: "app",
    rootExit: "backend",
  });
  if (!compiled.ok) throw new Error(`amostragem.mmd não compila: ${compiled.errors.join(" | ")}`);

  const world = comLabels(compiled.world);
  return { ...world, params: { ...PARAMS_DA_AMOSTRAGEM, ...world.params, ...params } };
}

function comLabels(world: WorldSpec): WorldSpec {
  const rotule = (obj: ObjectSpec): ObjectSpec => {
    const rotulo = (ROTULOS_AMOSTRAGEM as Readonly<Record<string, string>>)[obj.id];
    const children = obj.children?.map(rotule);
    return {
      ...obj,
      ...(rotulo === undefined ? {} : { label: rotulo }),
      ...(children === undefined ? {} : { children }),
    };
  };
  return { ...world, root: rotule(world.root) };
}
