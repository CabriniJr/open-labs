/**
 * O modelo composicional. Tudo é objeto: `node` ocupa um lugar, `message`
 * viaja, `channel` liga dois nós. Os três usam este mesmo formato.
 *
 * O motor não sabe o que é span, protocolo de exportação ou formato de
 * payload. `kind` de mensagem é uma string escolhida pelo domínio.
 */

export type Kind =
  | "composite"
  | "source"
  | "router"
  | "pipeline"
  | "buffer"
  | "sink"
  | "channel"
  | "static";

export type Role = "node" | "message" | "channel";

/**
 * A que espécie de coisa um objeto pertence. A família carrega a linguagem de
 * formas do desenho; o `kind` só faz a variação dentro dela.
 *
 * - `container` organiza e nunca tem comportamento próprio
 * - `processor` age sobre o que o atravessa
 * - `conduit` transporta e nunca altera a carga
 * - `controller` observa, concede, dispara — e **não** está no caminho da carga
 * - `plate` é dado anexado: consultado, nunca atravessado
 */
export type Family =
  | "container"
  | "processor"
  | "conduit"
  | "controller"
  | "plate";

/**
 * Tabela em vez de cadeia de `if`: sendo um `Record<Kind, Family>`, acrescentar
 * um `kind` sem lhe dar família deixa de compilar. O catálogo cresce em ondas,
 * e crescer sem esquecer é o ponto.
 */
const FAMILY: Record<Kind, Family> = {
  composite: "container",
  pipeline: "container",
  source: "processor",
  router: "processor",
  buffer: "processor",
  sink: "processor",
  channel: "conduit",
  static: "plate",
};

export function familyOf(kind: Kind): Family {
  return FAMILY[kind];
}

/**
 * Duas espécies de linha, e o ganho é de legibilidade: a pergunta "por onde o
 * dado passa?" se responde olhando só as linhas de dado.
 */
export type LineKind = "data" | "control";

export type PortId = string;

/** Onde uma folha está em relação a um foco. Discriminado de propósito: um id
 *  de objeto nunca pode ser confundido com "está fora daqui". */
export type Locus =
  | { readonly at: "child"; readonly id: string }
  | { readonly at: "self" }
  | { readonly at: "outside" };

/** Identificador da lixeira. Não é um objeto: é a ausência de destino. */
export const DROP = "@drop" as const;
export type Drop = typeof DROP;

export interface Message {
  readonly id: string;
  /** A forma da mensagem. Muda quando ela atravessa quem a transforma. */
  readonly kind: string;
  /** Quantos itens ela carrega. Um lote de 6 tem peso 6. */
  readonly weight: number;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface Emission {
  readonly port: PortId;
  readonly message: Message;
}

export interface StepContext {
  readonly tick: number;
  /**
   * Sorteio endereçável: já vem amarrado a (semente, tick, id do nó). O `salt`
   * opcional só entra quando a mesma folha sorteia mais de uma vez no mesmo
   * tick e precisa distinguir os sorteios por propósito.
   */
  readonly random: (salt?: string) => number;
  readonly params: Readonly<Record<string, number>>;
  /**
   * Cria uma mensagem com id determinístico, derivado de (tick, nó, ordem).
   * Nunca um contador global: replay tem que reproduzir os mesmos ids.
   */
  readonly emit: (
    kind: string,
    weight?: number,
    data?: Record<string, unknown>,
  ) => Message;
}

/** Função pura. Nunca muta `state`; sempre devolve um novo. */
export type Behavior<S = unknown> = (
  state: S,
  inbox: readonly Message[],
  ctx: StepContext,
) => { readonly state: S; readonly out: readonly Emission[] };

export interface ObjectSpec<S = unknown> {
  readonly id: string;
  readonly kind: Kind;
  readonly role?: Role;
  readonly label: string;
  readonly children?: readonly AnyObject[];
  /** Por onde uma aresta que chega neste contêiner entra. Padrão: o primeiro
   *  filho de fluxo. Num `pipeline` a ordem é contrato e o padrão basta; num
   *  `composite` ela é acidental, então declare. */
  readonly entry?: string;
  /** Por onde uma aresta que sai deste contêiner parte. Padrão: o último. */
  readonly exit?: string;
  /** Folha mesmo tendo filhos: a válvula da regra de abertura. */
  readonly leaf?: true;
  /** Abrível, mas os filhos são o conteúdo, não uma sub-árvore declarada. */
  readonly dynamic?: true;
  /** Obrigatório em objeto que age. Composto NUNCA tem comportamento. */
  readonly behavior?: Behavior<S>;
  readonly init?: () => S;
}

/**
 * Um objeto de estado qualquer, para uso em posições onde a variância do
 * estado não importa (a lista de filhos). O `any` é deliberado: sem ele, uma
 * folha com estado real não pode ser filha de nada.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyObject = ObjectSpec<any>;

export interface Wire {
  readonly from: string;
  readonly port: PortId;
  readonly to: string | Drop;
  /**
   * O id do objeto `channel` que ESTA aresta é. Um canal não é filho de
   * ninguém na árvore: ele é a linha. Quando presente, a aresta é clicável e
   * abrível, e a subárvore do canal descreve o interior dele.
   */
  readonly channel?: string;
  /** Espécie da linha. Ausente significa `"data"` — a esmagadora maioria. Uma
   *  linha de controle carrega sinal (pedido, concessão, gatilho, medida) e
   *  **nunca** carga. */
  readonly line?: LineKind;
}

export interface WorldSpec {
  readonly id: string;
  readonly seed: number;
  readonly root: AnyObject;
  /** Canais são arestas, não filhos: têm subárvore própria e são indexados
   *  junto, mas nunca aparecem em `flowChildren` de ninguém. */
  readonly channels?: readonly AnyObject[];
  readonly wires: readonly Wire[];
  readonly params: Readonly<Record<string, number>>;
  /** Quantos ticks uma mensagem leva para atravessar uma aresta. */
  readonly edgeTicks?: number;
}

export interface InFlight {
  readonly id: string;
  readonly message: Message;
  readonly from: string;
  readonly to: string | Drop;
  readonly sent: number;
}

export interface WorldState {
  readonly tick: number;
  /** Estado interno de cada folha, por id. */
  readonly nodes: Readonly<Record<string, unknown>>;
  readonly flight: readonly InFlight[];
  /** Livro-caixa de portas: "no.porta" → contagem. Única fonte dos medidores. */
  readonly ledger: Readonly<Record<string, number>>;
}
