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
 * A família vem antes do arquétipo e carrega a linguagem de forma. O `kind` só
 * faz a variação dentro dela — nunca uma forma inteiramente nova. É o que
 * impede o handbook de virar coleção de ilustrações sob medida, e o que faz
 * outro domínio herdar a linguagem inteira trocando só as variações.
 */
export type Family = "block" | "conduit" | "plate";

export function familyOf(kind: Kind): Family {
  if (kind === "channel") return "conduit";
  if (kind === "static") return "plate";
  return "block";
}

export type PortId = string;

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
  readonly random: () => number;
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
  readonly children?: readonly ObjectSpec[];
  /** Folha mesmo tendo filhos: a válvula da regra de abertura. */
  readonly leaf?: true;
  /** Abrível, mas os filhos são o conteúdo, não uma sub-árvore declarada. */
  readonly dynamic?: true;
  /** Obrigatório em objeto que age. Composto NUNCA tem comportamento. */
  readonly behavior?: Behavior<S>;
  readonly init?: () => S;
}

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
}

export interface WorldSpec {
  readonly id: string;
  readonly seed: number;
  readonly root: ObjectSpec;
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
