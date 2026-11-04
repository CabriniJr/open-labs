import type { Emission, ObjectSpec, WorldSpec } from "@ovh/depth-core";
import { compileSkeleton, parseSkeleton, type NodeOverride } from "@ovh/mermaid-skeleton";
import BALDES_MMD from "./baldes.mmd?raw";
import { ROTULOS_DOS_BALDES } from "./labels.js";

/**
 * Até onde você pode pesquisar não é uma configuração.
 *
 * É uma propriedade **emergente** de quatro limites e do seu volume diário, e
 * nenhum dos quatro diz o número que importa. A documentação de política de
 * retenção é explícita sobre a parte que surpreende: o dado rola para congelado
 * quando **qualquer** um dos dois limites é alcançado, e ele será congelado
 * antes de o período configurado passar se o limite de tamanho vier primeiro.
 *
 * Com os defaults — 500 000 MB de índice e 188 697 600 segundos de retenção, que
 * são aproximadamente seis anos — e 20 GB em disco por dia, a janela real é de
 * vinte e cinco dias. Nenhum arquivo em lugar nenhum contém o número 25, e é
 * por isso que este lab existe: o número está no run, e sai da conta.
 *
 * A segunda coisa que o lab torna visível é o que "congelado" significa.
 * Congelar é **remover do índice**. Só há arquivo depois disso se alguém
 * configurou `coldToFrozenDir` ou `coldToFrozenScript` — e quem não configurou
 * não recebe aviso nenhum, porque remover é o comportamento normal.
 *
 * Fontes:
 * [Set a retirement and archiving policy](https://help.splunk.com/en/splunk-enterprise/administer/manage-indexers-and-indexer-clusters/10.6/back-up-and-archive-your-indexes/set-a-retirement-and-archiving-policy),
 * [Configure index storage](https://help.splunk.com/en/data-management/manage-splunk-enterprise-indexers/9.3/manage-index-storage/configure-index-storage),
 * [How the indexer stores indexes](https://help.splunk.com/en/splunk-enterprise/administer/manage-indexers-and-indexer-clusters/10.6/manage-index-storage/how-the-indexer-stores-indexes).
 */

export const PARAMS_DOS_BALDES: Readonly<Record<string, number>> = {
  /**
   * Quantos GB **em disco** o índice recebe por dia.
   *
   * Em disco, e não de volume licenciado: um balde guarda o bruto comprimido
   * mais os arquivos de índice, e a razão entre os dois depende dos dados. Este
   * lab não afirma nenhuma taxa de compressão — ele parte do que ocupa o disco,
   * que é o lado que os limites de tamanho medem.
   */
  "gb-por-dia": 20,
  /**
   * Quantas horas um tick vale. É compressão de tempo declarada: com os
   * defaults de verdade, nada rola em menos de uma semana de relógio, e um lab
   * em que nada acontece não ensina. O preço é que o relógio da tela é o do
   * parâmetro, e não o do navegador.
   */
  "horas-por-tick": 12,
  /**
   * `maxDataSize`: o tamanho máximo de um balde quente. O default de verdade é
   * o valor especial `auto`, que são 750 MB.
   */
  "max-data-size-mb": 750,
  /** `maxWarmDBCount`: quantos baldes mornos cabem antes de o mais velho esfriar. */
  "max-warm": 300,
  /** `maxTotalDataSizeMB`, em GB para a tela caber. O default são 500 000 MB. */
  "max-total-gb": 500,
  /**
   * `frozenTimePeriodInSecs`, em dias. O default são 188 697 600 segundos —
   * 2 184 dias, aproximadamente seis anos.
   */
  "retencao-dias": 2184,
  /** `coldToFrozenDir` configurado. Em 0, congelar é apagar. */
  arquivar: 0,
};

const inteiro = (valor: number | undefined, padrao: number, minimo = 0): number =>
  valor === undefined || !Number.isFinite(valor) ? padrao : Math.max(minimo, Math.round(valor));

/** Um balde: tamanho, e quando o dado mais novo dele entrou. */
export interface Balde {
  readonly id: number;
  readonly mb: number;
  /** O tick em que ele fechou. A idade sai daqui, e ela é POR BALDE. */
  readonly fechadoEm: number;
}

export interface EstadoDosEventos {
  readonly mbEscritos: number;
}

export interface EstadoDoQuente {
  /** O balde quente em formação, em MB. Ele é o único gravável. */
  readonly mbAberto: number;
  readonly baldesFechados: number;
  readonly proximoId: number;
}

export interface EstadoDoMorno {
  readonly baldes: readonly Balde[];
  readonly recebidos: number;
  readonly esfriados: number;
}

export interface EstadoDoFrio {
  readonly baldes: readonly Balde[];
  readonly recebidos: number;
  readonly congelados: number;
  /** Congelados porque o índice estourou o tamanho. */
  readonly porTamanho: number;
  /** Congelados porque o balde inteiro ficou velho. */
  readonly porIdade: number;
  /**
   * O total do nível morno, como o último balde que desceu o informou.
   *
   * O limite `maxTotalDataSizeMB` é do **índice inteiro**, e um nó deste motor
   * só conhece o próprio estado. Então o tamanho do morno viaja junto do balde
   * que ele manda para baixo, e este número atrasa no máximo um balde — 750 MB
   * de 500 GB, nos defaults. O quente não entra na conta e está declarado na
   * página: ele vale no máximo `maxHotBuckets × maxDataSize`, que nos defaults
   * são 2,2 GB.
   */
  readonly mbDoMorno: number;
}

export interface EstadoDoCongelado {
  readonly baldes: number;
  readonly mb: number;
  readonly apagados: number;
  readonly arquivados: number;
}

const baldesDe = (data: Readonly<Record<string, unknown>>): readonly Balde[] =>
  Array.isArray(data["baldes"]) ? (data["baldes"] as readonly Balde[]) : [];

const soma = (baldes: readonly Balde[]): number => baldes.reduce((n, b) => n + b.mb, 0);

/** Quantos MB em disco entram por tick, dada a compressão de tempo. */
export function mbPorTick(params: Readonly<Record<string, number | undefined>>): number {
  const gbDia = inteiro(params["gb-por-dia"], 20);
  const horas = inteiro(params["horas-por-tick"], 12, 1);
  return (gbDia * 1024 * horas) / 24;
}

/** Quantos dias um tick vale. A idade do balde é medida nisto. */
export function diasPorTick(params: Readonly<Record<string, number | undefined>>): number {
  return inteiro(params["horas-por-tick"], 12, 1) / 24;
}

/**
 * Os eventos chegando da fase de indexação.
 *
 * Eles entram em MB e não em contagem de propósito: todo limite desta fase é de
 * tamanho ou de tempo, e nenhum é de número de eventos. Contar eventos aqui
 * seria oferecer ao leitor uma alavanca que o Splunk não tem.
 */
const eventos: NodeOverride = {
  leaf: true,
  init: (): EstadoDosEventos => ({ mbEscritos: 0 }),
  behavior: (state, _inbox, ctx) => {
    if (ctx.phase !== "commit") return { state, out: [] };
    const mb = mbPorTick(ctx.params);
    if (mb <= 0) return { state, out: [] };
    return {
      state: { mbEscritos: state.mbEscritos + mb },
      out: [{ port: "grava", message: ctx.emit("evento", Math.round(mb), { mb }) }],
    };
  },
};

/**
 * O balde quente: o único gravável, e o que fecha por tamanho.
 *
 * `maxHotBuckets` não é parâmetro aqui, e a ausência é declarada: com um fluxo
 * só, um balde quente está aberto por vez. O limite importa quando um índice
 * recebe dados de épocas diferentes ao mesmo tempo — e aí ele é a causa de um
 * defeito que merece o próprio lab, não um controle a mais neste.
 */
const quente: NodeOverride = {
  leaf: true,
  init: (): EstadoDoQuente => ({ mbAberto: 0, baldesFechados: 0, proximoId: 1 }),
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit") return { state, out: [] };
    const chegando = inbox.reduce((n, m) => n + Number(m.data["mb"] ?? 0), 0);
    if (chegando <= 0) return { state, out: [] };

    const teto = inteiro(ctx.params["max-data-size-mb"], 750, 1);
    let aberto = state.mbAberto + chegando;
    let id = state.proximoId;
    const fechados: Balde[] = [];
    while (aberto >= teto) {
      fechados.push({ id, mb: teto, fechadoEm: ctx.tick });
      id += 1;
      aberto -= teto;
    }

    return {
      state: {
        mbAberto: aberto,
        baldesFechados: state.baldesFechados + fechados.length,
        proximoId: id,
      },
      out:
        fechados.length === 0
          ? []
          : [{ port: "rola", message: ctx.emit("balde", fechados.length, { baldes: fechados }) }],
    };
  },
};

/**
 * O nível morno: só leitura, e ele esfria o mais velho quando enche.
 *
 * O limite é de **contagem** de baldes, e não de tamanho — é o que
 * `maxWarmDBCount` mede. Nos defaults isso são 300 baldes de 750 MB, ou seja
 * 225 GB: quase metade do limite de tamanho do índice inteiro mora aqui, o que
 * é o motivo de este nível não poder ficar fora da conta do que congela.
 */
const morno: NodeOverride = {
  leaf: true,
  init: (): EstadoDoMorno => ({ baldes: [], recebidos: 0, esfriados: 0 }),
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit") return { state, out: [] };
    const chegando = inbox.flatMap((m) => baldesDe(m.data));
    if (chegando.length === 0) return { state, out: [] };

    const maximo = inteiro(ctx.params["max-warm"], 300, 1);
    const todos = [...state.baldes, ...chegando];
    const excedente = Math.max(0, todos.length - maximo);
    // Os mais velhos primeiro: a fila é por idade, e é o que "o mais velho
    // rola" quer dizer.
    const esfriando = todos.slice(0, excedente);
    const ficam = todos.slice(excedente);

    const out: Emission[] = [];
    if (esfriando.length > 0) {
      out.push({
        port: "rola",
        message: ctx.emit("balde", esfriando.length, {
          baldes: esfriando,
          // O tamanho deste nível viaja com o balde: ver `mbDoMorno`.
          mbDoMorno: soma(ficam),
        }),
      });
    }

    return {
      state: {
        baldes: ficam,
        recebidos: state.recebidos + chegando.length,
        esfriados: state.esfriados + esfriando.length,
      },
      out,
    };
  },
};

/**
 * O nível frio, e é aqui que a decisão caro acontece.
 *
 * Duas razões para congelar, e a documentação diz que vale **a que vier
 * primeiro**:
 *
 * - **tamanho**: o índice passou de `maxTotalDataSizeMB`, e o mais velho sai
 *   até caber. É esta que surpreende, porque ela não aparece em nenhuma
 *   conversa sobre "quantos dias a gente guarda";
 * - **idade**: o balde inteiro ficou mais velho que `frozenTimePeriodInSecs`.
 *   Inteiro: a documentação do `indexes.conf` cobra que **todo** evento do
 *   balde seja mais velho que o período, e é por isso que a retenção efetiva é
 *   sempre um pouco mais longa que o número configurado.
 */
const frio: NodeOverride = {
  leaf: true,
  init: (): EstadoDoFrio => ({
    baldes: [],
    recebidos: 0,
    congelados: 0,
    porTamanho: 0,
    porIdade: 0,
    mbDoMorno: 0,
  }),
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit") return { state, out: [] };

    const chegando = inbox.flatMap((m) => baldesDe(m.data));
    let mbDoMorno = state.mbDoMorno;
    for (const m of inbox) {
      const informado = m.data["mbDoMorno"];
      if (typeof informado === "number") mbDoMorno = informado;
    }

    let baldes = [...state.baldes, ...chegando];
    const tetoMb = inteiro(ctx.params["max-total-gb"], 500, 1) * 1024;
    const retencao = inteiro(ctx.params["retencao-dias"], 2184, 1);
    const dias = diasPorTick(ctx.params);

    const congelando: Balde[] = [];
    let porIdade = state.porIdade;
    let porTamanho = state.porTamanho;

    // 1. idade: o balde inteiro é mais velho que a retenção.
    const velhos = baldes.filter((b) => (ctx.tick - b.fechadoEm) * dias > retencao);
    if (velhos.length > 0) {
      const ids = new Set(velhos.map((b) => b.id));
      baldes = baldes.filter((b) => !ids.has(b.id));
      congelando.push(...velhos);
      porIdade += velhos.length;
    }

    // 2. tamanho: o índice estourou, e sai o mais velho até caber.
    while (baldes.length > 0 && soma(baldes) + mbDoMorno > tetoMb) {
      const maisVelho = baldes[0];
      if (maisVelho === undefined) break;
      baldes = baldes.slice(1);
      congelando.push(maisVelho);
      porTamanho += 1;
    }

    const out: Emission[] =
      congelando.length === 0
        ? []
        : [
            {
              port: "congela",
              message: ctx.emit("balde", congelando.length, {
                baldes: congelando,
                arquivado: inteiro(ctx.params["arquivar"], 0) === 1,
              }),
            },
          ];

    if (chegando.length === 0 && congelando.length === 0) {
      return { state: { ...state, mbDoMorno }, out: [] };
    }

    return {
      state: {
        baldes,
        recebidos: state.recebidos + chegando.length,
        congelados: state.congelados + congelando.length,
        porTamanho,
        porIdade,
        mbDoMorno,
      },
      out,
    };
  },
};

/**
 * Congelado, e congelar é **remover do índice**.
 *
 * As duas contagens existem separadas porque a diferença entre elas é uma linha
 * de configuração que ninguém é obrigado a escrever: sem `coldToFrozenDir` ou
 * `coldToFrozenScript`, o balde é apagado, e apagar é o comportamento normal —
 * não há aviso, não há erro, e o dado não está em lugar nenhum.
 */
const congelado: NodeOverride = {
  leaf: true,
  init: (): EstadoDoCongelado => ({ baldes: 0, mb: 0, apagados: 0, arquivados: 0 }),
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit" || inbox.length === 0) return { state, out: [] };
    let baldes = state.baldes;
    let mb = state.mb;
    let apagados = state.apagados;
    let arquivados = state.arquivados;
    for (const m of inbox) {
      const chegando = baldesDe(m.data);
      if (chegando.length === 0) continue;
      baldes += chegando.length;
      mb += soma(chegando);
      if (m.data["arquivado"] === true) arquivados += chegando.length;
      else apagados += chegando.length;
    }
    return { state: { baldes, mb, apagados, arquivados }, out: [] };
  },
};

/** Monta o `WorldSpec` dos baldes a partir do esqueleto em `baldes.mmd`. */
export function baldesWorld(params: Readonly<Record<string, number>> = {}): WorldSpec {
  const parsed = parseSkeleton(BALDES_MMD);
  if (!parsed.ok) throw new Error(`baldes.mmd inválido: ${parsed.errors.join(" | ")}`);

  const overrides: Record<string, NodeOverride> = {
    eventos,
    quente,
    morno,
    frio,
    congelado,
  };

  const compiled = compileSkeleton(parsed.value, {
    overrides,
    rootId: "baldes",
    rootLabel: ROTULOS_DOS_BALDES.baldes,
    rootEntry: "eventos",
    rootExit: "congelado",
  });
  if (!compiled.ok) throw new Error(`baldes.mmd não compila: ${compiled.errors.join(" | ")}`);

  const world = comLabels(compiled.world);
  return { ...world, params: { ...PARAMS_DOS_BALDES, ...world.params, ...params } };
}

function comLabels(world: WorldSpec): WorldSpec {
  const rotule = (obj: ObjectSpec): ObjectSpec => {
    const rotulo = (ROTULOS_DOS_BALDES as Readonly<Record<string, string>>)[obj.id];
    const children = obj.children?.map(rotule);
    return {
      ...obj,
      ...(rotulo === undefined ? {} : { label: rotulo }),
      ...(children === undefined ? {} : { children }),
    };
  };
  return { ...world, root: rotule(world.root) };
}
