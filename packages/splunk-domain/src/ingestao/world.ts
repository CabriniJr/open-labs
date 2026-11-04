import type { Emission, ObjectSpec, WorldSpec } from "@ovh/depth-core";
import { compileSkeleton, parseSkeleton, type NodeOverride } from "@ovh/mermaid-skeleton";
import INGESTAO_MMD from "./ingestao.mmd?raw";
import { ROTULOS_DA_INGESTAO } from "./labels.js";

/**
 * A fase de parsing acontece **uma vez**, no primeiro componente capaz dela.
 *
 * O pipeline do Splunk tem quatro segmentos — input, parsing, indexing, search
 * — e a documentação de configuração diz a coisa que este lab existe para
 * tornar visível: cada configuração pertence a **um só** componente, que é o
 * primeiro da implantação a executar aquela fase. Num caminho
 * `universal forwarder → heavy forwarder → indexer`, o input acontece no
 * forwarder universal e o parsing acontece no heavy forwarder; o indexador
 * **não** reprocessa.
 *
 * Disso sai a consequência que custa caro e não dá erro nenhum: um `props.conf`
 * com `LINE_BREAKER` é correto ou é inerte dependendo de em qual máquina ele
 * foi instalado — e a máquina certa depende de uma decisão de topologia que
 * normalmente é de outra pessoa. O arquivo está lá, a sintaxe está certa, o
 * Splunk sobe, o dado chega. E um registro de doze linhas entra no índice como
 * doze eventos.
 *
 * Três lugares onde o arquivo pode estar × duas topologias = seis
 * combinações, das quais **duas** funcionam. O lab é essa tabela, rodando.
 *
 * O que o forwarder universal manda: a documentação dele diz que ele não
 * processa os dados a não exceção de alguns casos limitados, e que ele
 * encaminha dado **não processado**. O que viaja são blocos de 64K anotados com
 * metadado (host, source, sourcetype) — e nada dentro deles é evento ainda.
 *
 * Fontes:
 * [Configuration parameters and the data pipeline](https://help.splunk.com/en/data-management/splunk-enterprise-admin-manual/10.4/administer-splunk-enterprise-with-configuration-files/configuration-parameters-and-the-data-pipeline),
 * [How Splunk Enterprise handles your data](https://docs.splunk.com/Documentation/Splunk/latest/Data/WhatSplunkdoeswithyourdata),
 * [Types of forwarders](https://docs.splunk.com/Documentation/Splunk/9.3.1/Forwarding/Typesofforwarders).
 */

export const PARAMS_DA_INGESTAO: Readonly<Record<string, number>> = {
  /** Quantos registros a aplicação escreve por segundo no arquivo. */
  "registros-por-tick": 40,
  /**
   * Quantas linhas tem um registro multilinha. Doze é um stack trace de Java
   * curto — e é o número que aparece no índice quando a quebra está no lugar
   * errado, porque cada linha vira um evento.
   */
  "linhas-do-registro": 12,
  /** Um registro a cada N é multilinha. Os outros são de uma linha. */
  "multilinha-a-cada": 20,
  /**
   * 0: o nível do meio é um **forwarder universal intermediário** — ele
   * repassa blocos crus e o parsing cai no indexador. 1: é um **heavy
   * forwarder**, que parseia, e então o indexador não reprocessa.
   */
  "meio-cozinha": 0,
  /**
   * Em qual máquina o `props.conf` do sourcetype está instalado:
   * 0 = forwarder universal, 1 = nível do meio, 2 = indexador.
   */
  "props-em": 2,
};

/** O bloco do input phase: 64 KiB, como a documentação descreve. */
export const BYTES_DO_BLOCO = 65_536;

/** Tamanho modelado de uma linha de log. Uma constante declarada, não medida. */
export const BYTES_DA_LINHA = 220;

/** Onde o `props.conf` pode estar, na ordem do parâmetro. */
export const LUGARES_DO_PROPS = ["uf", "meio", "idx"] as const;
export type LugarDoProps = (typeof LUGARES_DO_PROPS)[number];

const inteiro = (valor: number | undefined, padrao: number, minimo = 0): number =>
  valor === undefined || !Number.isFinite(valor) ? padrao : Math.max(minimo, Math.round(valor));

/** Quem executa a fase de parsing, dada a topologia. */
export function quemParseia(params: Readonly<Record<string, number | undefined>>): LugarDoProps {
  return inteiro(params["meio-cozinha"], 0) === 1 ? "meio" : "idx";
}

/** Onde o arquivo de configuração está instalado. */
export function ondeEstaOProps(
  params: Readonly<Record<string, number | undefined>>,
): LugarDoProps {
  const i = Math.min(2, inteiro(params["props-em"], 2));
  return LUGARES_DO_PROPS[i] ?? "idx";
}

/**
 * A regra inteira do lab, numa função: a quebra só vale se o arquivo estiver na
 * máquina que executa a fase.
 *
 * Ela existe como função exportada, e não embutida no comportamento, porque é
 * o que a página precisa dizer ao leitor antes de ele rodar — e porque é o que
 * os testes cobram. Duas cópias da mesma regra divergiriam.
 */
export function aQuebraVale(params: Readonly<Record<string, number | undefined>>): boolean {
  return ondeEstaOProps(params) === quemParseia(params);
}

/** Um registro, como a aplicação o escreveu. */
export interface Registro {
  readonly id: number;
  /** Quantas linhas ele ocupa no arquivo. 1, ou um stack trace. */
  readonly linhas: number;
  readonly multilinha: boolean;
}

/** Um evento, como o parsing o produziu — e é aqui que a verdade se perde. */
export interface EventoIndexado {
  /** De qual registro ele veio. O índice de verdade não sabe este número. */
  readonly registro: number;
  /** Qual pedaço do registro ele é, de `de`. Com a quebra certa, 1 de 1. */
  readonly parte: number;
  readonly de: number;
  /** Quem executou a fase de parsing que o produziu. */
  readonly parseadoPor: LugarDoProps;
  readonly sourcetype: string;
}

export interface EstadoDaApp {
  readonly registros: number;
  readonly linhas: number;
  readonly multilinhas: number;
}

export interface EstadoDoUf {
  readonly registrosLidos: number;
  readonly blocosEnviados: number;
  readonly bytesEnviados: number;
  /**
   * Os registros que ainda não fecharam um bloco de 64K.
   *
   * Eles estão no estado, e não num contador, porque o bloco é formado por
   * eles: um número de bytes bastaria para a tela e não bastaria para o
   * modelo — o bloco que sai carrega estes registros, e são eles que o
   * parsing do outro lado vai ver.
   */
  readonly fila: readonly Registro[];
}

/** Os bytes que um registro ocupa no arquivo. */
export const bytesDoRegistro = (registro: Registro): number =>
  registro.linhas * BYTES_DA_LINHA;

/** O que está esperando para fechar o bloco, em bytes. */
export const bytesNaFila = (fila: readonly Registro[]): number =>
  fila.reduce((n, r) => n + bytesDoRegistro(r), 0);

export interface EstadoDoMeio {
  readonly blocosRecebidos: number;
  readonly blocosRepassados: number;
  readonly eventosProduzidos: number;
  /** Se ele parseou nesta configuração: é a resposta que a caixa mostra. */
  readonly parseou: boolean;
}

export interface EstadoDoIndexador {
  readonly blocosRecebidos: number;
  readonly eventosRecebidos: number;
  readonly eventosGravados: number;
  readonly parseou: boolean;
}

export interface EstadoDoIndice {
  readonly eventos: number;
  /** Registros multilinha que entraram como UM evento: os pesquisáveis. */
  readonly registrosInteiros: number;
  /** Registros multilinha que entraram em pedaços. Nada reporta isto. */
  readonly registrosPartidos: number;
  /** Fragmentos no índice. É o que infla a contagem de eventos da licença. */
  readonly fragmentos: number;
  readonly ultimos: readonly EventoIndexado[];
}

const registrosDe = (data: Readonly<Record<string, unknown>>): readonly Registro[] =>
  Array.isArray(data["registros"]) ? (data["registros"] as readonly Registro[]) : [];

const eventosDe = (data: Readonly<Record<string, unknown>>): readonly EventoIndexado[] =>
  Array.isArray(data["eventos"]) ? (data["eventos"] as readonly EventoIndexado[]) : [];

/** Teto do que o índice guarda em memória, para o lab não virar teste de RAM. */
const TETO = 200;

/**
 * Parseia: transforma registros em eventos.
 *
 * É a única função do arquivo que produz evento, e isso é de propósito — o
 * parsing acontece em um lugar, e um lab em que dois nós sabem quebrar linha
 * seria um lab que contradiz a própria tese.
 *
 * `quebraCerta` é o `LINE_BREAKER`/`SHOULD_LINEMERGE` do sourcetype resolvendo
 * o registro inteiro num evento. Sem ele, a quebra é a padrão — uma linha, um
 * evento — e um stack trace de doze linhas entra como doze eventos.
 */
function parsear(
  registros: readonly Registro[],
  quebraCerta: boolean,
  quem: LugarDoProps,
  sourcetype: string,
): readonly EventoIndexado[] {
  const eventos: EventoIndexado[] = [];
  for (const registro of registros) {
    const partes = quebraCerta ? 1 : registro.linhas;
    for (let p = 1; p <= partes; p += 1) {
      eventos.push({
        registro: registro.id,
        parte: p,
        de: partes,
        parseadoPor: quem,
        sourcetype,
      });
    }
  }
  return eventos;
}

/** O sourcetype do lab: um só, porque a tese é sobre onde o arquivo mora. */
export const SOURCETYPE = "app:json";

/**
 * A aplicação escrevendo no arquivo. Não é Splunk nenhum: é o produtor.
 *
 * O registro multilinha é o stack trace, e ele é o caso que importa porque é o
 * único em que a quebra errada é **visível** — com registros de uma linha, a
 * quebra padrão acerta por acidente, e é exatamente por isso que esse defeito
 * entra em produção sem ninguém notar: ele só aparece no dia da exceção.
 */
const app: NodeOverride = {
  leaf: true,
  init: (): EstadoDaApp => ({ registros: 0, linhas: 0, multilinhas: 0 }),
  behavior: (state, _inbox, ctx) => {
    if (ctx.phase !== "commit") return { state, out: [] };
    const quantos = inteiro(ctx.params["registros-por-tick"], 40);
    if (quantos === 0) return { state, out: [] };
    const linhasDoStack = inteiro(ctx.params["linhas-do-registro"], 12, 1);
    const aCada = inteiro(ctx.params["multilinha-a-cada"], 20);

    const registros: Registro[] = [];
    let id = state.registros;
    let linhas = state.linhas;
    let multilinhas = state.multilinhas;
    for (let i = 0; i < quantos; i += 1) {
      id += 1;
      const multilinha = aCada > 0 && id % aCada === 0;
      const linhasDele = multilinha ? linhasDoStack : 1;
      linhas += linhasDele;
      if (multilinha) multilinhas += 1;
      registros.push({ id, linhas: linhasDele, multilinha });
    }
    return {
      state: { registros: id, linhas, multilinhas },
      out: [{ port: "escreve", message: ctx.emit("registro", registros.length, { registros }) }],
    };
  },
};

/**
 * O forwarder universal, e ele faz **uma** fase: input.
 *
 * O que ele produz é bloco anotado com metadado, não evento. Ele acumula até
 * fechar 64 KiB e manda. Nenhum `props.conf` de quebra de linha muda nada aqui,
 * e o lab prova isso deixando a opção disponível: pôr o arquivo nesta máquina é
 * uma das três escolhas, e é a que nunca funciona.
 *
 * O buffer é visível de propósito. Ele é a razão pela qual o dado não aparece
 * no índice no mesmo instante em que foi escrito, e quem opera Splunk encontra
 * esse atraso antes de encontrar a explicação dele.
 */
const uf: NodeOverride = {
  leaf: true,
  init: (): EstadoDoUf => ({
    registrosLidos: 0,
    blocosEnviados: 0,
    bytesEnviados: 0,
    fila: [],
  }),
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit") return { state, out: [] };
    const chegando = inbox.flatMap((m) => registrosDe(m.data));

    // A fila guarda registros inteiros: o corte de 64K não parte registro
    // nenhum enquanto a conexão não troca de destino, porque o receptor
    // remonta o fluxo. Partir aqui seria ensinar na fase errada um defeito que
    // depende de haver DOIS indexadores — e aqui há um.
    const fila = [...state.fila, ...chegando];

    const blocos: Registro[][] = [];
    let atual: Registro[] = [];
    let bytesDoAtual = 0;
    for (const registro of fila) {
      const tamanho = bytesDoRegistro(registro);
      atual.push(registro);
      bytesDoAtual += tamanho;
      if (bytesDoAtual >= BYTES_DO_BLOCO) {
        blocos.push(atual);
        atual = [];
        bytesDoAtual = 0;
      }
    }

    const out: Emission[] = [];
    let bytesEnviados = state.bytesEnviados;
    for (const bloco of blocos) {
      const bytesDoBloco = bytesNaFila(bloco);
      bytesEnviados += bytesDoBloco;
      out.push({
        port: "encaminha",
        message: ctx.emit("bloco", 1, {
          registros: bloco,
          bytes: bytesDoBloco,
          // O metadado é a outra metade da fase de input, e viaja com o bloco.
          host: "app-01",
          source: "/var/log/app/app.log",
          sourcetype: SOURCETYPE,
        }),
      });
    }

    return {
      state: {
        registrosLidos: state.registrosLidos + chegando.length,
        blocosEnviados: state.blocosEnviados + blocos.length,
        bytesEnviados,
        fila: atual,
      },
      out,
    };
  },
};

/**
 * O nível do meio, e ele é a decisão de topologia inteira.
 *
 * Com `meio-cozinha: 0` ele é um forwarder universal intermediário: repassa
 * bloco cru, e o parsing cai no indexador. Com 1 ele é um heavy forwarder:
 * parseia, e aí o indexador recebe evento pronto e **não** reprocessa.
 *
 * As duas saídas são portas diferentes no desenho porque carregam coisas
 * diferentes — bloco e evento —, e um canal deste repositório carrega um `kind`
 * só. Isso não é restrição do motor atrapalhando: é o desenho sendo obrigado a
 * dizer que o que atravessa essa linha muda de natureza quando a topologia
 * muda.
 */
const meio: NodeOverride = {
  leaf: true,
  init: (): EstadoDoMeio => ({
    blocosRecebidos: 0,
    blocosRepassados: 0,
    eventosProduzidos: 0,
    parseou: false,
  }),
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit" || inbox.length === 0) return { state, out: [] };
    const cozinha = quemParseia(ctx.params) === "meio";
    const blocos = inbox.filter((m) => m.kind === "bloco");
    if (blocos.length === 0) return { state, out: [] };

    if (!cozinha) {
      // Repassa cada bloco como chegou. Um forwarder intermediário sem parsing
      // é topologia recomendada para atravessar rede; o que ele não faz é
      // ajudar a quebrar evento.
      return {
        state: {
          ...state,
          blocosRecebidos: state.blocosRecebidos + blocos.length,
          blocosRepassados: state.blocosRepassados + blocos.length,
          parseou: false,
        },
        out: blocos.map((m) => ({
          port: "cru",
          message: ctx.emit("bloco", 1, { ...m.data }),
        })),
      };
    }

    const registros = blocos.flatMap((m) => registrosDe(m.data));
    const eventos = parsear(registros, aQuebraVale(ctx.params), "meio", SOURCETYPE);
    return {
      state: {
        ...state,
        blocosRecebidos: state.blocosRecebidos + blocos.length,
        eventosProduzidos: state.eventosProduzidos + eventos.length,
        parseou: true,
      },
      out:
        eventos.length === 0
          ? []
          : [{ port: "cozido", message: ctx.emit("evento", eventos.length, { eventos }) }],
    };
  },
};

/**
 * O indexador: ele parseia **se ninguém parseou antes**, e indexa sempre.
 *
 * O `if` que decide isso é a tese do lab em três linhas de código, e é também
 * a razão pela qual um `props.conf` correto instalado no indexador pode ser
 * inerte: se o heavy forwarder já quebrou os eventos, não há fluxo para quebrar
 * aqui, e o arquivo fica no disco sem efeito nenhum.
 */
const idx: NodeOverride = {
  leaf: true,
  init: (): EstadoDoIndexador => ({
    blocosRecebidos: 0,
    eventosRecebidos: 0,
    eventosGravados: 0,
    parseou: false,
  }),
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit" || inbox.length === 0) return { state, out: [] };

    const blocos = inbox.filter((m) => m.kind === "bloco");
    const jaParseados = inbox.filter((m) => m.kind === "evento").flatMap((m) => eventosDe(m.data));

    const registros = blocos.flatMap((m) => registrosDe(m.data));
    const parseadosAqui =
      registros.length === 0
        ? []
        : parsear(registros, aQuebraVale(ctx.params), "idx", SOURCETYPE);

    const eventos = [...jaParseados, ...parseadosAqui];
    if (eventos.length === 0) {
      return {
        state: { ...state, blocosRecebidos: state.blocosRecebidos + blocos.length },
        out: [],
      };
    }

    return {
      state: {
        blocosRecebidos: state.blocosRecebidos + blocos.length,
        eventosRecebidos: state.eventosRecebidos + jaParseados.length,
        eventosGravados: state.eventosGravados + eventos.length,
        parseou: parseadosAqui.length > 0,
      },
      out: [{ port: "grava", message: ctx.emit("evento", eventos.length, { eventos }) }],
    };
  },
};

/**
 * O índice, e ele guarda **o que chegou** — como o backend do lab de
 * amostragem, e pela mesma razão pedagógica.
 *
 * O campo `de` viaja no evento porque só o parsing sabe em quantos pedaços ele
 * cortou o registro. Num índice de verdade esse número não existe: um stack
 * trace que entrou como doze eventos é indistinguível de doze linhas de log que
 * sempre foram doze eventos. É por isso que esse defeito sobrevive anos num
 * ambiente — nada o reporta, e a busca por uma linha do meio do stack devolve
 * um evento com uma linha dentro.
 */
const indice: NodeOverride = {
  leaf: true,
  init: (): EstadoDoIndice => ({
    eventos: 0,
    registrosInteiros: 0,
    registrosPartidos: 0,
    fragmentos: 0,
    ultimos: [],
  }),
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit" || inbox.length === 0) return { state, out: [] };
    const chegando = inbox.flatMap((m) => eventosDe(m.data));
    if (chegando.length === 0) return { state, out: [] };

    let inteiros = state.registrosInteiros;
    let partidos = state.registrosPartidos;
    let fragmentos = state.fragmentos;
    for (const evento of chegando) {
      if (evento.de === 1) {
        if (evento.parte === 1) inteiros += 1;
        continue;
      }
      fragmentos += 1;
      // Conta o registro partido uma vez só: no primeiro pedaço dele.
      if (evento.parte === 1) partidos += 1;
    }

    return {
      state: {
        eventos: state.eventos + chegando.length,
        registrosInteiros: inteiros,
        registrosPartidos: partidos,
        fragmentos,
        ultimos: [...state.ultimos, ...chegando].slice(-TETO),
      },
      out: [],
    };
  },
};

/** Monta o `WorldSpec` da ingestão a partir do esqueleto em `ingestao.mmd`. */
export function ingestaoWorld(params: Readonly<Record<string, number>> = {}): WorldSpec {
  const parsed = parseSkeleton(INGESTAO_MMD);
  if (!parsed.ok) throw new Error(`ingestao.mmd inválido: ${parsed.errors.join(" | ")}`);

  const overrides: Record<string, NodeOverride> = { app, uf, meio, idx, indice };

  const compiled = compileSkeleton(parsed.value, {
    overrides,
    rootId: "ingestao",
    rootLabel: ROTULOS_DA_INGESTAO.ingestao,
    rootEntry: "app",
    rootExit: "indice",
  });
  if (!compiled.ok) throw new Error(`ingestao.mmd não compila: ${compiled.errors.join(" | ")}`);

  const world = comLabels(compiled.world);
  return { ...world, params: { ...PARAMS_DA_INGESTAO, ...world.params, ...params } };
}

function comLabels(world: WorldSpec): WorldSpec {
  const rotule = (obj: ObjectSpec): ObjectSpec => {
    const rotulo = (ROTULOS_DA_INGESTAO as Readonly<Record<string, string>>)[obj.id];
    const children = obj.children?.map(rotule);
    return {
      ...obj,
      ...(rotulo === undefined ? {} : { label: rotulo }),
      ...(children === undefined ? {} : { children }),
    };
  };
  return { ...world, root: rotule(world.root) };
}
