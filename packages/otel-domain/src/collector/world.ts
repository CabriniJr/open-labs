import type { Emission, ObjectSpec, WorldSpec } from "@ovh/depth-core";
import { compileSkeleton, parseSkeleton, type NodeOverride } from "@ovh/mermaid-skeleton";
import COLLECTOR_MMD from "./collector.mmd?raw";
import { ROTA_FILTRADA, ROTAS_DO_COLLECTOR, ROTULOS_COLLECTOR } from "./labels.js";

/**
 * Um receiver, duas pipelines, e uma cópia para cada.
 *
 * A tese, e ela é do desenho antes de ser do texto: **o receiver não sabe
 * quantas pipelines existem.** Ele emite uma vez, por uma porta, e quem
 * multiplica é a fiação — duas arestas saindo da mesma porta entregam duas
 * cópias, cada uma com item em trânsito próprio. É literalmente como o
 * Collector funciona, e é por isso que um `filter` numa pipeline não muda nada
 * na outra: o `filter` nunca viu a cópia que foi para o outro lado.
 *
 * O mal-entendido que isso desfaz é o mais caro do Collector: alguém põe um
 * processor para parar de mandar `/health` ao backend, olha o backend certo,
 * confirma que parou — e o segundo exporter, o que ninguém estava olhando,
 * seguiu mandando tudo.
 *
 * **O que este lab NÃO faz, e é decisão e não lacuna:** contrapressão. Ela é o
 * assunto do lab dos provedores (`collector-down`), e modelá-la aqui exigiria
 * um fio de controle do exportador de volta ao `memory_limiter` — fio que não
 * existe no Collector, onde o limiter lê a memória do processo e não recebe
 * sinal de ninguém. Desenhar esse fio ensinaria uma arquitetura falsa para
 * ganhar um parâmetro.
 *
 * Fontes: [Collector configuration](https://opentelemetry.io/docs/collector/configuration/),
 * [internal telemetry](https://opentelemetry.io/docs/collector/internal-telemetry/).
 */

export const PARAMS_DO_COLLECTOR: Readonly<Record<string, number>> = {
  /** Quantos spans a aplicação exporta por segundo. */
  "spans-por-tick": 3,
  /** `send_batch_size`: o lote fecha ao alcançar este tamanho. */
  "tamanho-do-lote": 4,
  /**
   * `timeout`: o lote fecha também por tempo, e é isto que falta na crença de
   * que "ele manda quando enche". Sem timeout, tráfego baixo guardaria a
   * telemetria até o lote encher — o que pode ser nunca.
   */
  "timeout-do-lote": 3,
  /**
   * Quantos spans o `memory_limiter` admite por tick. O resto é **recusado**, e
   * recusado é contado: o Collector expõe `otelcol_processor_refused_spans`
   * justamente para a perda ser legível onde ela acontece.
   */
  "limite-de-memoria": 6,
  /**
   * O `filter` da segunda pipeline barra `/health`. É o parâmetro que mostra a
   * tese: ligá-lo não muda **nada** no que o backend recebe.
   */
  "filtrar-health-checks": 0,
};

const inteiro = (valor: number | undefined, padrao: number, minimo = 0): number =>
  valor === undefined || !Number.isFinite(valor) ? padrao : Math.max(minimo, Math.round(valor));

/** Um span, do ponto de vista do Collector: um id e a rota que ele nomeia. */
export interface SpanDoCollector {
  readonly n: number;
  readonly rota: string;
}

export interface EstadoDaApp {
  readonly emitidos: number;
}

export interface EstadoDoReceiver {
  readonly recebidos: number;
}

export interface EstadoDoLimiter {
  readonly admitidos: number;
  readonly recusados: number;
}

export interface EstadoDoLote {
  /** O que está retido agora. O painel mostra isto: é a fila que se enche. */
  readonly retidos: readonly SpanDoCollector[];
  /** Há quantos ticks o lote atual está aberto. Zero quando vazio. */
  readonly idade: number;
  readonly fechadosPorTamanho: number;
  readonly fechadosPorTempo: number;
}

export interface EstadoDoFiltro {
  readonly passaram: number;
  readonly barrados: number;
}

export interface EstadoDoDestino {
  readonly spans: readonly SpanDoCollector[];
  readonly lotes: number;
}

export interface EstadoDoDescarte {
  readonly porQuem: Readonly<Record<string, number>>;
  readonly total: number;
}

const spansDe = (data: Readonly<Record<string, unknown>>): readonly SpanDoCollector[] =>
  Array.isArray(data["spans"]) ? (data["spans"] as readonly SpanDoCollector[]) : [];

/** Teto do que um destino guarda, para o lab não virar teste de memória. */
const TETO = 120;

/**
 * A aplicação. Um processo, um exportador, e nenhuma opinião sobre o Collector.
 */
const app: NodeOverride = {
  leaf: true,
  init: (): EstadoDaApp => ({ emitidos: 0 }),
  behavior: (state, _inbox, ctx) => {
    if (ctx.phase !== "commit") return { state, out: [] };
    const quantos = inteiro(ctx.params["spans-por-tick"], 3);
    if (quantos === 0) return { state, out: [] };
    const spans: SpanDoCollector[] = [];
    let n = state.emitidos;
    for (let i = 0; i < quantos; i += 1) {
      n += 1;
      spans.push({ n, rota: ROTAS_DO_COLLECTOR[n % ROTAS_DO_COLLECTOR.length] ?? "/checkout" });
    }
    return {
      state: { emitidos: n },
      out: [{ port: "receber", message: ctx.emit("span", spans.length, { spans }) }],
    };
  },
};

/**
 * O receiver, e ele é o ponto do lab.
 *
 * Uma porta de saída, uma emissão, **nenhuma menção às pipelines**. Quem
 * entrega duas cópias é a fiação do desenho, e o comportamento aqui não tem
 * como saber disso nem precisa: é exatamente o que o Collector faz, onde um
 * receiver declarado em duas pipelines é um receiver só.
 */
const receiver: NodeOverride = {
  leaf: true,
  init: (): EstadoDoReceiver => ({ recebidos: 0 }),
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit" || inbox.length === 0) return { state, out: [] };
    const spans = inbox.flatMap((m) => spansDe(m.data));
    if (spans.length === 0) return { state, out: [] };
    return {
      state: { recebidos: state.recebidos + spans.length },
      out: [{ port: "pipeline", message: ctx.emit("span", spans.length, { spans }) }],
    };
  },
};

/**
 * O `memory_limiter`. Admite até o limite e **recusa o resto por uma porta**.
 *
 * A porta importa mais que o número: recusa que sai por porta é contada no
 * livro-caixa, e é por isso que o Collector tem
 * `otelcol_processor_refused_spans`. Perda que não sai por porta é perda que
 * alguém descobre olhando o backend e subtraindo.
 */
const limiter: NodeOverride = {
  leaf: true,
  init: (): EstadoDoLimiter => ({ admitidos: 0, recusados: 0 }),
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit" || inbox.length === 0) return { state, out: [] };
    const spans = inbox.flatMap((m) => spansDe(m.data));
    if (spans.length === 0) return { state, out: [] };

    const limite = inteiro(ctx.params["limite-de-memoria"], 6);
    const admitidos = spans.slice(0, limite);
    const recusados = spans.slice(limite);

    const out: Emission[] = [];
    if (admitidos.length > 0) {
      out.push({ port: "admitido", message: ctx.emit("span", admitidos.length, { spans: admitidos }) });
    }
    if (recusados.length > 0) {
      out.push({
        port: "recusado",
        message: ctx.emit("span", recusados.length, { spans: recusados, quem: "memory_limiter" }),
      });
    }
    return {
      state: {
        admitidos: state.admitidos + admitidos.length,
        recusados: state.recusados + recusados.length,
      },
      out,
    };
  },
};

/**
 * O `batch`. Fecha por **tamanho ou por tempo**, o que vier primeiro.
 *
 * A crença que isto desfaz é "ele manda quando enche". Se fosse só por
 * tamanho, um serviço de tráfego baixo guardaria a telemetria até o lote
 * encher — e com `send_batch_size` maior que o tráfego de um minuto, isso é
 * nunca. O contador de cada motivo existe para o leitor ver qual dos dois
 * governa o lab dele.
 */
const lote: NodeOverride = {
  leaf: true,
  init: (): EstadoDoLote => ({ retidos: [], idade: 0, fechadosPorTamanho: 0, fechadosPorTempo: 0 }),
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit") return { state, out: [] };
    const tamanho = inteiro(ctx.params["tamanho-do-lote"], 4, 1);
    const timeout = inteiro(ctx.params["timeout-do-lote"], 3, 1);

    const chegando = inbox.flatMap((m) => spansDe(m.data));
    const retidos = [...state.retidos, ...chegando];
    // Lote vazio não envelhece: o `timeout` conta desde o primeiro item, e não
    // desde o último envio. Sem isto um collector ocioso "fecharia" lotes
    // vazios para sempre.
    const idade = retidos.length === 0 ? 0 : state.idade + 1;

    const porTamanho = retidos.length >= tamanho;
    const porTempo = retidos.length > 0 && idade >= timeout;
    if (!porTamanho && !porTempo) {
      return { state: { ...state, retidos, idade }, out: [] };
    }

    const enviados = retidos.slice(0, Math.max(tamanho, retidos.length >= tamanho ? tamanho : retidos.length));
    const sobra = retidos.slice(enviados.length);
    return {
      state: {
        retidos: sobra,
        idade: sobra.length === 0 ? 0 : 1,
        // Tamanho ganha o crédito quando os dois valem: é ele que decidiu.
        fechadosPorTamanho: state.fechadosPorTamanho + (porTamanho ? 1 : 0),
        fechadosPorTempo: state.fechadosPorTempo + (porTamanho ? 0 : 1),
      },
      out: [
        {
          port: "lote",
          message: ctx.emit("batch", enviados.length, {
            spans: enviados,
            motivo: porTamanho ? "size" : "timeout",
          }),
        },
      ],
    };
  },
};

/**
 * O `filter` da segunda pipeline, e ele é o experimento.
 *
 * Ligar `filtrar-health-checks` barra `/health` **aqui**, e o painel mostra o
 * número subindo em `dropped`. O que ele não muda é o backend: a cópia que foi
 * para a primeira pipeline nunca passou por este nó.
 */
const filtro: NodeOverride = {
  leaf: true,
  init: (): EstadoDoFiltro => ({ passaram: 0, barrados: 0 }),
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit" || inbox.length === 0) return { state, out: [] };
    const spans = inbox.flatMap((m) => spansDe(m.data));
    if (spans.length === 0) return { state, out: [] };

    const filtrando = inteiro(ctx.params["filtrar-health-checks"], 0) === 1;
    const passaram = filtrando ? spans.filter((s) => s.rota !== ROTA_FILTRADA) : spans;
    const barrados = filtrando ? spans.filter((s) => s.rota === ROTA_FILTRADA) : [];

    const out: Emission[] = [];
    if (passaram.length > 0) {
      out.push({ port: "passou", message: ctx.emit("span", passaram.length, { spans: passaram }) });
    }
    if (barrados.length > 0) {
      out.push({
        port: "barrado",
        message: ctx.emit("span", barrados.length, { spans: barrados, quem: "filter" }),
      });
    }
    return {
      state: { passaram: state.passaram + passaram.length, barrados: state.barrados + barrados.length },
      out,
    };
  },
};

/** Um exportador: transporte, e nada mais. Ele não decide nem transforma. */
function exportador(porta: string): NodeOverride {
  return {
    leaf: true,
    init: (): { readonly saiu: number } => ({ saiu: 0 }),
    behavior: (state, inbox, ctx) => {
      if (ctx.phase !== "commit" || inbox.length === 0) return { state, out: [] };
      const spans = inbox.flatMap((m) => spansDe(m.data));
      if (spans.length === 0) return { state, out: [] };
      return {
        state: { saiu: state.saiu + spans.length },
        out: [{ port: porta, message: ctx.emit(porta === "otlp" ? "batch" : "span", spans.length, { spans }) }],
      };
    },
  };
}

/** Um destino: guarda o que chegou, e conta os lotes em que chegou. */
const destino: NodeOverride = {
  leaf: true,
  init: (): EstadoDoDestino => ({ spans: [], lotes: 0 }),
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit" || inbox.length === 0) return { state, out: [] };
    const chegando = inbox.flatMap((m) => spansDe(m.data));
    if (chegando.length === 0) return { state, out: [] };
    return {
      state: { spans: [...state.spans, ...chegando].slice(-TETO), lotes: state.lotes + inbox.length },
      out: [],
    };
  },
};

/**
 * O contador de descartes, e ele guarda **quem** descartou.
 *
 * Duas pipelines perdem dado por razões diferentes — uma por limite de memória,
 * outra por filtro declarado — e somar as duas num número só apagaria a
 * diferença que o lab existe para mostrar: uma é falha de capacidade, a outra é
 * a configuração funcionando.
 */
const descartes: NodeOverride = {
  leaf: true,
  init: (): EstadoDoDescarte => ({ porQuem: {}, total: 0 }),
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
 * Monta o `WorldSpec` do Collector a partir do esqueleto em `collector.mmd`.
 *
 * Topologia — quem existe, quem liga em quem, quais são as portas, e **o leque
 * do receiver** — vem toda do desenho. Comportamento e estado ficam aqui.
 */
export function collectorWorld(params: Readonly<Record<string, number>> = {}): WorldSpec {
  const parsed = parseSkeleton(COLLECTOR_MMD);
  if (!parsed.ok) throw new Error(`collector.mmd inválido: ${parsed.errors.join(" | ")}`);

  const overrides: Record<string, NodeOverride> = {
    app,
    receiver,
    limiter,
    lote,
    exportador: exportador("otlp"),
    filtro,
    depuracao: exportador("linha"),
    backend: destino,
    console: destino,
    descartes,
  };

  const compiled = compileSkeleton(parsed.value, {
    overrides,
    rootId: "collector",
    rootLabel: ROTULOS_COLLECTOR.collector,
    rootEntry: "app",
    rootExit: "backend",
  });
  if (!compiled.ok) throw new Error(`collector.mmd não compila: ${compiled.errors.join(" | ")}`);

  const world = comLabels(compiled.world);
  return { ...world, params: { ...PARAMS_DO_COLLECTOR, ...world.params, ...params } };
}

/**
 * Os rótulos longos por cima do compilado. O mmd carrega os ids curtos, que
 * casam com os nomes do Collector de verdade (`otlp`, `batch`, `filter`) —
 * duplicar rótulo lá seria segunda fonte da mesma verdade.
 */
function comLabels(world: WorldSpec): WorldSpec {
  const rotule = (obj: ObjectSpec): ObjectSpec => {
    const rotulo = (ROTULOS_COLLECTOR as Readonly<Record<string, string>>)[obj.id];
    const children = obj.children?.map(rotule);
    return {
      ...obj,
      ...(rotulo === undefined ? {} : { label: rotulo }),
      ...(children === undefined ? {} : { children }),
    };
  };
  return { ...world, root: rotule(world.root) };
}
