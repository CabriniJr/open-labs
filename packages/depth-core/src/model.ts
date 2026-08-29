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

/**
 * Em que fase do tick uma aresta entrega.
 *
 * - `clocked` — custa `edgeTicks`. É o que sempre existiu, e segue sendo o padrão
 * - `settle` — entrega **dentro do mesmo tick**, na fase de acomodação
 *
 * O padrão é `clocked` de propósito: mundo escrito antes desta mudança não muda
 * de comportamento por causa dela.
 */
export type WireTiming = "settle" | "clocked";

/**
 * Qual das duas fases do tick está rodando.
 *
 * - `settle` — propagação dentro do tick. O `state` devolvido é **descartado**:
 *   quem acomoda não guarda, exatamente como lógica combinacional não guarda
 * - `commit` — o fim do tick. É onde o estado muda
 */
export type TickPhase = "settle" | "commit";

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
  /** Em qual das duas fases do tick este comportamento está rodando. */
  readonly phase: TickPhase;
  /**
   * Sinais que chegaram por linha de controle, por porta de entrada. Sinal
   * modifica o que o ator faz; nunca é carga, e por isso não vem em `inbox`.
   */
  readonly signals: Readonly<Record<PortId, readonly Message[]>>;
  /**
   * Carga que chegou por entrada nomeada, agrupada por porta. **O mesmo que
   * está em `inbox`**, visto por outro eixo: quem não liga para qual entrada
   * foi lê `inbox` e ignora isto; quem precisa distinguir as parcelas lê aqui.
   */
  readonly inlets: Readonly<Record<PortId, readonly Message[]>>;
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
  /**
   * As **entradas nomeadas** deste contêiner: nome da porta -> quem, lá dentro,
   * recebe o que chega por ela.
   *
   * Existe porque um objeto de verdade tem mais de uma entrada, e elas não são
   * intercambiáveis: as duas parcelas e o vem-de-trás entram num somador por
   * lugares diferentes. Sem nome, o motor só saberia achar **uma** folha de
   * entrada, e ou o modelo perdia entradas em silêncio, ou o contêiner deixava
   * de poder ser fechado num atalho.
   *
   * Uma entrada pode alimentar vários filhos — é o leque de dentro do bloco,
   * o pontinho que o esquemático desenha na linha de entrada.
   */
  readonly inlets?: Readonly<Record<PortId, readonly string[]>>;
  /**
   * `N` objetos idênticos, um desenhado.
   *
   * O invariante que impede a mentira: quem declara `replicas: N` tem que ter
   * exatamente `N` filhos de fluxo, todos do mesmo `kind`. A marca diz "desenhe
   * um destes N"; os N existem de verdade, e é deles que os números saem. Sem
   * isso, `×32` seria um rótulo sobre um objeto só, e o leitor leria a conta de
   * um achando que é a de trinta e dois.
   */
  readonly replicas?: number;
  /** Abrível, mas os filhos são o conteúdo, não uma sub-árvore declarada. */
  readonly dynamic?: true;
  /** Obrigatório em objeto que age. Composto NUNCA tem comportamento. */
  readonly behavior?: Behavior<S>;
  /**
   * Atalho de execução de um contêiner: produz o mesmo resultado que rodar os
   * filhos, sem rodá-los. Quando presente, **o contêiner age e a subárvore dele
   * não roda**, e para a fiação ele é folha.
   *
   * Roda sempre — nunca "quando ninguém está olhando dentro". Condicioná-lo ao
   * que o leitor abriu faria a resposta do modelo depender da navegação, e a
   * vista deixaria de ser projeção do mesmo run para virar outro run.
   *
   * **Um atalho só é legítimo se um teste provar que ele concorda com a
   * composição.** `shortcutDisagreement` é esse teste: roda os dois caminhos e
   * compara o que o mundo de fora enxerga.
   */
  readonly shortcut?: Behavior<S>;
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
  /**
   * Em que porta do destino um sinal chega. **Obrigatório** em linha de
   * controle e **proibido** em linha de dado: carga entra num objeto e o motor
   * acha a folha de entrada, mas sinal tem destinatário nomeado, porque quem
   * recebe precisa saber qual sinal é.
   */
  readonly toPort?: PortId;
  /** Quando esta aresta entrega. Ausente significa `"clocked"`. */
  readonly timing?: WireTiming;
  /**
   * A linha é um feixe de `N` vias em paralelo. Inteiro `>= 2` — declarar `1` é
   * ruído, e é recusado.
   *
   * **É marca de desenho, e não conta nada.** Quem conta é o livro-caixa, e uma
   * mensagem que atravessa um feixe continua sendo uma mensagem. Há teste
   * dizendo isso: no dia em que alguém fizer a largura multiplicar peso, ele
   * cai — que é a diferença entre "o desenho informa" e "o número mente".
   */
  readonly width?: number;
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
  /** Presente só quando este item é um sinal: a porta de destino dele. */
  readonly signalPort?: PortId;
  /** Por qual entrada nomeada esta carga chega, quando chega por uma. */
  readonly inPort?: PortId;
}

export interface WorldState {
  readonly tick: number;
  /** Estado interno de cada folha, por id. */
  readonly nodes: Readonly<Record<string, unknown>>;
  readonly flight: readonly InFlight[];
  /**
   * Livro-caixa do tráfego. Única fonte dos medidores. Dois eixos, em espaços
   * de nome separados para que uma contagem nunca some por cima da outra:
   * saídas em "out:no.porta" (mais ".weight" e ".unwired"), chegadas em
   * "in:no" (mais ".weight"). Por isso id e porta não podem conter "." nem ":".
   */
  readonly ledger: Readonly<Record<string, number>>;
  /**
   * Quantos subpassos a acomodação levou neste tick — a profundidade do caminho
   * combinacional. Zero num mundo sem aresta acomodada.
   */
  readonly substeps: number;
  /**
   * Em que subpasso da acomodação cada objeto rodou neste tick.
   *
   * É a profundidade dele no caminho combinacional — e profundidade aqui **é**
   * atraso de propagação. Fica no estado, e não só na tela, porque é resposta
   * do modelo: quem desenha só a lê. Sem isto, mostrar a acomodação acontecendo
   * dentro do tick exigiria que o desenho adivinhasse a ordem, que é a mesma
   * coisa que inventá-la.
   */
  readonly substepOf: Readonly<Record<string, number>>;
}
