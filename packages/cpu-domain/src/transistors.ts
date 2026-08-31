import type {
  AnyObject,
  BorneInterno,
  Message,
  ObjectSpec,
  Wire,
  WorldSpec,
  WorldState,
} from "@ovh/depth-core";
import { decide } from "./gates.js";
import type { PortaLogica } from "./gates.js";
import { ROTULOS } from "./labels.js";

/**
 * O fundo da fatia: a porta lógica feita de transistores.
 *
 * Aqui há **duas espécies de linha**, e distingui-las é o que faz o nível caber
 * no motor sem primitiva nova:
 *
 * - `bit` é valor lógico. É o que anda entre portas, e é o que chega no
 *   **terminal de porta** de um transistor — o terminal que decide e não
 *   conduz. Ele não puxa corrente nenhuma, o que é verdade no silício também.
 * - `corrente` é o que atravessa o **canal**, da fonte para o dreno. Ela carrega
 *   um `bit` (o nível que está sendo puxado) e um `conduz` (se o caminho está
 *   fechado).
 *
 * **Por que `conduz` é um campo e não a ausência da mensagem.** Seria mais curto
 * um transistor cortado simplesmente não emitir. Mas então um nó de saída que
 * não recebe nada de lado nenhum — que é uma porta mal montada, flutuando —
 * também não rodaria, e o defeito passaria calado: a porta emitiria nada, e o
 * de baixo leria isso como zero. Com o campo, o nó **sempre** roda e sempre
 * pode recusar. É a mesma regra de sempre: mover a validação para onde a
 * violação vira impossível, em vez de torná-la improvável.
 *
 * Uma porta CMOS é um par de redes complementares: a de cima (PMOS) puxa a
 * saída para 1, a de baixo (NMOS) puxa para 0, e nunca as duas ao mesmo tempo.
 * Séries e paralelos entre elas são a tabela-verdade escrita em fiação.
 */

export type Canal = "nmos" | "pmos";

/** As portas que o silício tem de fato. As outras se compõem a partir delas. */
export type PortaCmos = "nand" | "nor" | "not";

const CORRENTE = "corrente";

const corrente = (m: Message): { comandado: boolean; conduz: boolean; bit: 0 | 1 } => ({
  comandado: m.data.comandado !== false,
  conduz: m.data.conduz === true,
  bit: (m.data.bit === 1 ? 1 : 0) as 0 | 1,
});

/**
 * Um trilho de alimentação. Não recebe nada e conduz sempre — é por isso que
 * ele declara `drives`, e é o objeto que fez esse conceito existir no motor.
 */
export function trilho(id: string, bit: 0 | 1): ObjectSpec {
  return {
    id,
    kind: "source",
    label: bit === 1 ? ROTULOS.vdd : ROTULOS.gnd,
    leaf: true,
    drives: true,
    behavior: (state, _inbox, ctx) =>
      ctx.phase === "settle"
        ? {
            state,
            out: [
              {
                port: "out",
                message: ctx.emit(CORRENTE, 1, { comandado: true, conduz: true, bit }),
              },
            ],
          }
        : { state, out: [] },
  };
}

/**
 * Um transistor: uma chave comandada pelo terminal de porta.
 *
 * NMOS fecha com a porta em 1; PMOS fecha com a porta em 0. Fechado, ele deixa
 * passar o que chegou na fonte — inclusive o "não está passando nada", quando
 * quem está acima dele na série também está cortado.
 *
 * Não há curva característica, nem corrente, nem temperatura: **conduz ou
 * corta**. Este nível ensina construção de porta e ensina atraso, e não ensina
 * projeto de circuito.
 */
export function transistor(id: string, canal: Canal): ObjectSpec {
  return {
    id,
    // Chave, e não roteador. Um roteador escolhe qual das entradas responde; um
    // transistor não escolhe nada — ele deixa passar ou não, e quem manda é o
    // terminal de porta. Com `router` ele herdava o trapézio do seletor e a
    // ficha o descrevia como "a mux is a router": símbolo errado e explicação
    // errada, no nível mais didático do modelo.
    kind: "switch",
    label: canal.toUpperCase(),
    leaf: true,
    behavior: (state, inbox, ctx) => {
      if (ctx.phase !== "settle" || inbox.length === 0) return { state, out: [] };
      const comando = inbox.find((m) => m.kind === "bit");
      const fonte = inbox.find((m) => m.kind === CORRENTE);

      // Sem comando, o terminal de porta ainda não foi acionado — é o circuito
      // antes de a primeira entrada chegar nele. Ele **relata assim mesmo**,
      // dizendo que não tem comando: some do relato e o nó lá embaixo não
      // conseguiria separar "a rede ainda não acordou" de "falta um fio".
      const comandado = comando !== undefined;
      const ligado = comandado && (canal === "nmos") === (comando.data.bit === 1);
      const chega = fonte !== undefined && corrente(fonte).conduz;
      const conduz = ligado && chega;
      // Cortado, ele não carrega nível nenhum. Repetir o da fonte faria um PMOS
      // cortado no Vdd relatar um — e a tela, que acende quem está em alto,
      // desenharia como aceso um transistor que está justamente sem conduzir.
      const bit = conduz && fonte !== undefined ? corrente(fonte).bit : 0;
      return {
        state,
        out: [{ port: "dreno", message: ctx.emit(CORRENTE, 1, { comandado, conduz, bit }) }],
      };
    },
  };
}

/**
 * O nó de saída: onde as duas redes se encontram, e o único lugar que pode
 * dizer que a porta está mal montada.
 *
 * Ele recusa os dois defeitos que uma rede errada produz, e recusa alto:
 * **flutuando** (ninguém puxa, e a saída não tem valor nenhum) e **curto** (as
 * duas redes puxam para lados opostos, que no silício é o caminho da fumaça).
 * Nenhum dos dois acontece numa porta CMOS bem montada — é justamente por isso
 * que eles são erro de quem montou, e não estado que o modelo deva representar.
 */
export function noDeSaida(id: string, saida: string, ramos: number): ObjectSpec {
  return {
    id,
    kind: "router",
    label: ROTULOS.no,
    leaf: true,
    behavior: (state, inbox, ctx) => {
      if (ctx.phase !== "settle" || inbox.length === 0) return { state, out: [] };
      const chegaram = inbox.filter((m) => m.kind === CORRENTE).map(corrente);

      // Todo transistor que dá no nó relata todo tick, então o número de
      // relatos é fato de construção. Faltando um, falta um FIO — e sem esta
      // conferência a porta simplesmente ficaria muda, que é o modo silencioso
      // de errar.
      if (chegaram.length !== ramos) {
        throw new Error(
          `"${id}" recebeu ${chegaram.length} ramo(s) e a rede tem ${ramos}: falta fio ` +
            `de um transistor até o nó. Cada dreno que dá na saída precisa de um fio ` +
            `com timing "settle" até aqui`,
        );
      }

      // A rede toda ainda não foi acionada — o circuito antes de a primeira
      // entrada chegar. Não responder é diferente de responder zero.
      if (chegaram.some((c) => !c.comandado)) return { state, out: [] };

      const ativos = chegaram.filter((c) => c.conduz);

      // Só os transistores comandados relatam, então receber alguma coisa já
      // quer dizer que a porta está acionada neste tick — e aí a rede tem de
      // responder por ela.
      if (ativos.length === 0) {
        throw new Error(
          `"${id}" está flutuando: nenhuma das redes está puxando a saída neste tick. ` +
            `Numa porta CMOS as duas redes são complementares, então uma delas sempre ` +
            `conduz — falta um caminho na rede de cima (PMOS, puxa para 1) ou na de ` +
            `baixo (NMOS, puxa para 0)`,
        );
      }
      if (ativos.some((c) => c.bit !== ativos[0]!.bit)) {
        throw new Error(
          `"${id}" está em curto: a rede de cima e a de baixo estão puxando ao mesmo ` +
            `tempo, uma para 1 e outra para 0. As duas redes precisam ser ` +
            `complementares — nenhuma combinação de entrada pode fechar as duas`,
        );
      }
      return { state, out: [{ port: saida, message: ctx.emit("bit", 1, { bit: ativos[0]!.bit }) }] };
    },
  };
}

/**
 * As redes de uma porta CMOS, escritas como o esquemático se lê.
 *
 * Cada entrada comanda **dois** transistores — um em cada rede —, e é essa
 * duplicação que faz as redes serem complementares. O que muda entre NAND e NOR
 * é só quem está em série e quem está em paralelo, e essa troca é a tabela
 * inteira:
 *
 * ```
 * NOT   1 PMOS  · 1 NMOS
 * NAND  2 PMOS em paralelo · 2 NMOS em série     saída 0 só com as duas em 1
 * NOR   2 PMOS em série    · 2 NMOS em paralelo  saída 1 só com as duas em 0
 * ```
 *
 * Série significa que a corrente atravessa um antes do outro: o dreno de um é a
 * fonte do próximo. Paralelo significa que os dois chegam no mesmo nó.
 */
interface Rede {
  readonly transistores: readonly { readonly sufixo: string; readonly canal: Canal }[];
  /** De onde cada transistor tira a fonte: um trilho, ou o dreno de outro. */
  readonly fonte: Readonly<Record<string, string>>;
  /** Quem entrega no nó de saída. */
  readonly noNo: readonly string[];
  /** Qual entrada comanda cada transistor. */
  readonly comando: Readonly<Record<string, "a" | "b">>;
}

const REDES: Readonly<Record<PortaCmos, Rede>> = {
  not: {
    transistores: [
      { sufixo: "p1", canal: "pmos" },
      { sufixo: "n1", canal: "nmos" },
    ],
    fonte: { p1: "vdd", n1: "gnd" },
    noNo: ["p1", "n1"],
    comando: { p1: "a", n1: "a" },
  },
  nand: {
    transistores: [
      { sufixo: "p1", canal: "pmos" },
      { sufixo: "p2", canal: "pmos" },
      { sufixo: "n1", canal: "nmos" },
      { sufixo: "n2", canal: "nmos" },
    ],
    // Os dois PMOS puxam para o mesmo nó: basta uma entrada em 0 para a saída
    // ir a 1. Os dois NMOS estão em série: só as duas em 1 fecham o caminho
    // até o terra.
    fonte: { p1: "vdd", p2: "vdd", n1: "gnd", n2: "n1" },
    noNo: ["p1", "p2", "n2"],
    comando: { p1: "a", p2: "b", n1: "a", n2: "b" },
  },
  nor: {
    transistores: [
      { sufixo: "p1", canal: "pmos" },
      { sufixo: "p2", canal: "pmos" },
      { sufixo: "n1", canal: "nmos" },
      { sufixo: "n2", canal: "nmos" },
    ],
    // O espelho: PMOS em série, NMOS em paralelo.
    fonte: { p1: "vdd", p2: "p1", n1: "gnd", n2: "gnd" },
    noNo: ["p2", "n1", "n2"],
    comando: { p1: "a", p2: "b", n1: "a", n2: "b" },
  },
};

/**
 * Uma porta CMOS aberta em transistores, com a tabela-verdade como atalho.
 *
 * O atalho é o mesmo `decide` que a porta fechada usa, e ele só é legítimo
 * porque `shortcutDisagreement` prova, entrada por entrada, que ele concorda
 * com a rede de transistores lá dentro.
 */
export function portaCmos(
  id: string,
  tipo: PortaCmos,
  saida = "out",
  comAtalho = true,
): AnyObject {
  const rede = REDES[tipo];
  const p = (sufixo: string): string => `${id}-${sufixo}`;
  const entradas = tipo === "not" ? 1 : 2;

  const comandadosPor = (via: "a" | "b"): string[] =>
    rede.transistores.filter((t) => rede.comando[t.sufixo] === via).map((t) => p(t.sufixo));

  const inlets: Record<string, readonly string[]> = { a: comandadosPor("a") };
  if (entradas === 2) inlets.b = comandadosPor("b");

  const base: AnyObject = {
    id,
    kind: "composite",
    label: tipo.toUpperCase(),
    inlets,
    outlets: { [saida]: [p("no")] },
    children: [
      trilho(p("vdd"), 1),
      trilho(p("gnd"), 0),
      ...rede.transistores.map((t) => transistor(p(t.sufixo), t.canal)),
      noDeSaida(p("no"), saida, rede.noNo.length),
    ],
  };
  if (!comAtalho) return base;

  return {
    ...base,
    shortcut: (state, _inbox, ctx) => {
      if (ctx.phase !== "settle") return { state, out: [] };
      const vias = [...(ctx.inlets.a ?? []), ...(ctx.inlets.b ?? [])];
      if (vias.length === 0) return { state, out: [] };
      const altas = vias.reduce((soma, m) => soma + (m.data.bit === 1 ? 1 : 0), 0);
      const bit = decide(tipo as PortaLogica, altas, entradas);
      return { state, out: [{ port: saida, message: ctx.emit("bit", 1, { bit }) }] };
    },
  };
}

/** Os fios de dentro de uma porta CMOS: a fiação das duas redes. */
export function fiosDaPortaCmos(id: string, tipo: PortaCmos): readonly Wire[] {
  const rede = REDES[tipo];
  const p = (sufixo: string): string => `${id}-${sufixo}`;
  const wires: Wire[] = [];

  for (const { sufixo } of rede.transistores) {
    // A fonte: ou um trilho, ou o dreno do transistor acima na série.
    const de = rede.fonte[sufixo]!;
    wires.push({
      from: p(de),
      port: de === "vdd" || de === "gnd" ? "out" : "dreno",
      to: p(sufixo),
      timing: "settle",
    });
  }

  // Os drenos que chegam no nó de saída. Quem está no meio de uma série já foi
  // ligado acima, e por isso não aparece aqui.
  for (const sufixo of rede.noNo) {
    wires.push({ from: p(sufixo), port: "dreno", to: p("no"), timing: "settle" });
  }

  return wires;
}

/**
 * As portas do somador, compostas a partir das que o silício tem.
 *
 * NAND, NOR e NOT são redes de transistores; XOR, AND e OR **não são** — elas
 * se montam a partir daquelas, e é assim no silício também:
 *
 * ```
 * AND  = NOT(NAND(a,b))              6 transistores
 * OR   = NOT(NOR(a,b))               6 transistores
 * XOR  = NAND(NAND(a,g), NAND(b,g))  16 transistores, com g = NAND(a,b)
 * ```
 *
 * Que o XOR custe quase três vezes o AND não é curiosidade: é o motivo de um
 * somador ser caro, e ele aparece sozinho na contagem de subpassos assim que a
 * porta abre.
 */
const COMPOSTAS: Readonly<
  Record<
    "and" | "or" | "xor",
    {
      readonly partes: readonly { readonly sufixo: string; readonly tipo: PortaCmos }[];
      /** Qual porta de qual parte cada entrada do bloco alimenta. */
      readonly entradas: Readonly<Record<"a" | "b", readonly { sufixo: string; port: string }[]>>;
      /** Os fios de dentro: de quem, para qual porta de quem. */
      readonly dentro: readonly { de: string; para: string; port: string }[];
      /** Quem fala pelo bloco. */
      readonly saida: string;
    }
  >
> = {
  and: {
    partes: [
      { sufixo: "nand", tipo: "nand" },
      { sufixo: "inv", tipo: "not" },
    ],
    entradas: { a: [{ sufixo: "nand", port: "a" }], b: [{ sufixo: "nand", port: "b" }] },
    dentro: [{ de: "nand", para: "inv", port: "a" }],
    saida: "inv",
  },
  or: {
    partes: [
      { sufixo: "nor", tipo: "nor" },
      { sufixo: "inv", tipo: "not" },
    ],
    entradas: { a: [{ sufixo: "nor", port: "a" }], b: [{ sufixo: "nor", port: "b" }] },
    dentro: [{ de: "nor", para: "inv", port: "a" }],
    saida: "inv",
  },
  xor: {
    partes: [
      { sufixo: "g1", tipo: "nand" },
      { sufixo: "g2", tipo: "nand" },
      { sufixo: "g3", tipo: "nand" },
      { sufixo: "g4", tipo: "nand" },
    ],
    entradas: {
      a: [
        { sufixo: "g1", port: "a" },
        { sufixo: "g2", port: "a" },
      ],
      b: [
        { sufixo: "g1", port: "b" },
        { sufixo: "g3", port: "a" },
      ],
    },
    dentro: [
      { de: "g1", para: "g2", port: "b" },
      { de: "g1", para: "g3", port: "b" },
      { de: "g2", para: "g4", port: "a" },
      { de: "g3", para: "g4", port: "b" },
    ],
    saida: "g4",
  },
};

/**
 * Uma porta lógica aberta até o transistor, com a tabela-verdade como atalho.
 *
 * NAND, NOR e NOT devolvem a rede direto; as outras três devolvem o bloco de
 * portas CMOS que as compõe — e como cada uma daquelas também abre, daqui até o
 * transistor há **dois** níveis, não um.
 */
export function portaAberta(
  id: string,
  tipo: PortaLogica,
  saida = "out",
  comAtalho = true,
): AnyObject {
  if (tipo === "nand" || tipo === "nor" || tipo === "not") {
    return portaCmos(id, tipo, saida, comAtalho);
  }

  const receita = COMPOSTAS[tipo];
  const p = (sufixo: string): string => `${id}-${sufixo}`;
  const via = (lado: "a" | "b"): BorneInterno[] =>
    receita.entradas[lado].map((e) => ({ node: p(e.sufixo), port: e.port }));

  const base: AnyObject = {
    id,
    kind: "composite",
    label: tipo.toUpperCase(),
    inlets: { a: via("a"), b: via("b") },
    outlets: { [saida]: [{ node: p(receita.saida), port: saida }] },
    // As partes vêm SEMPRE abertas. Se elas guardassem o atalho delas, descer
    // até aqui mostraria transistores parados enquanto a tabela-verdade
    // respondia por eles — e o atalho de fora estaria sendo provado contra
    // outro atalho, e não contra silício.
    children: receita.partes.map((parte) =>
      portaCmos(
        p(parte.sufixo),
        parte.tipo,
        parte.sufixo === receita.saida ? saida : "out",
        false,
      ),
    ),
  };
  if (!comAtalho) return base;

  return {
    ...base,
    shortcut: (state, _inbox, ctx) => {
      if (ctx.phase !== "settle") return { state, out: [] };
      const vias = [...(ctx.inlets.a ?? []), ...(ctx.inlets.b ?? [])];
      if (vias.length === 0) return { state, out: [] };
      const altas = vias.reduce((soma, m) => soma + (m.data.bit === 1 ? 1 : 0), 0);
      return {
        state,
        out: [{ port: saida, message: ctx.emit("bit", 1, { bit: decide(tipo, altas, 2) }) }],
      };
    },
  };
}

/** Os fios de dentro de uma porta composta, e os das redes dela. */
export function fiosDaPortaAberta(id: string, tipo: PortaLogica): readonly Wire[] {
  if (tipo === "nand" || tipo === "nor" || tipo === "not") return fiosDaPortaCmos(id, tipo);

  const receita = COMPOSTAS[tipo];
  const p = (sufixo: string): string => `${id}-${sufixo}`;
  return [
    ...receita.partes.flatMap((parte) => fiosDaPortaCmos(p(parte.sufixo), parte.tipo)),
    ...receita.dentro.map(
      (fio): Wire => ({
        from: p(fio.de),
        port: "out",
        to: p(fio.para),
        toPort: fio.port,
        timing: "settle",
      }),
    ),
  ];
}

/**
 * Um mundo com uma porta só, para provar a composição contra a tabela.
 *
 * As duas entradas são parâmetros, e a saída é um sorvedouro que guarda o bit —
 * é ele que a projeção de fronteira compara quando o atalho entra e sai.
 */
export function portaCmosWorld(tipo: PortaLogica, comAtalho: boolean, seed = 1): WorldSpec {
  const entradas = tipo === "not" ? 1 : 2;
  const vias = (entradas === 1 ? ["a"] : ["a", "b"]) as readonly ("a" | "b")[];

  const fonte: ObjectSpec = {
    id: "entradas",
    kind: "source",
    label: "entradas",
    leaf: true,
    behavior: (state, _inbox, ctx) => {
      if (ctx.phase !== "commit") return { state, out: [] };
      return {
        state,
        out: vias.map((via) => ({
          port: via,
          message: ctx.emit("bit", 1, { bit: (ctx.params[via] ?? 0) & 1 }),
        })),
      };
    },
  };

  const saida: ObjectSpec = {
    id: "saida",
    kind: "sink",
    label: "saída",
    leaf: true,
    init: () => ({ bit: 0 }),
    behavior: (state, inbox, ctx) => {
      if (ctx.phase !== "commit" || inbox.length === 0) return { state, out: [] };
      return { state: { bit: inbox[inbox.length - 1]!.data.bit === 1 ? 1 : 0 }, out: [] };
    },
  };

  const alvo = portaAberta("porta", tipo, "out", comAtalho);
  return {
    id: `cmos-${tipo}`,
    seed,
    edgeTicks: 1,
    params: { a: 0, b: 0 },
    root: {
      id: "bancada",
      kind: "composite",
      label: "bancada",
      children: [fonte, alvo, saida],
    },
    wires: [
      ...fiosDaPortaAberta("porta", tipo),
      ...vias.map(
        (via): Wire => ({
          from: "entradas",
          port: via,
          to: "porta",
          toPort: via,
          timing: "clocked",
        }),
      ),
      { from: "porta", port: "out", to: "saida", timing: "settle" },
    ],
  };
}

/** Todas as portas CMOS dentro de uma porta aberta, com o tipo de cada uma. */
export function portasCmosDe(
  id: string,
  tipo: PortaLogica,
): readonly { readonly id: string; readonly tipo: PortaCmos }[] {
  if (tipo === "nand" || tipo === "nor" || tipo === "not") return [{ id, tipo }];
  return COMPOSTAS[tipo].partes.map((parte) => ({
    id: `${id}-${parte.sufixo}`,
    tipo: parte.tipo,
  }));
}

/** Qual entrada comanda o terminal de porta de cada transistor. */
export function comandoDe(tipo: PortaCmos, sufixo: string): "a" | "b" | undefined {
  return REDES[tipo].comando[sufixo];
}

/** Como cada rede se empilha no esquemático: alimentação em cima, terra embaixo. */
export const DESENHO_CMOS: Readonly<
  Record<PortaCmos, readonly (readonly string[])[]>
> = {
  // Uma linha por andar; dois nomes na mesma linha querem dizer em paralelo.
  not: [["vdd"], ["p1"], ["no"], ["n1"], ["gnd"]],
  nand: [["vdd"], ["p1", "p2"], ["no"], ["n2"], ["n1"], ["gnd"]],
  nor: [["vdd"], ["p1"], ["p2"], ["no"], ["n1", "n2"], ["gnd"]],
};

/**
 * Quem, neste tick, está deixando a corrente passar.
 *
 * O nível do transistor era sete objetos do mesmo azul: não dava para separar
 * a rede que puxa da que não puxa, e a pergunta que aquele nível existe para
 * responder — *por que esta porta deu 1?* — só se respondia lendo número
 * pequeno. Conduzir é estado, e estado se lê de relance.
 *
 * Isto vive no domínio pela mesma razão que `portasAltas`: só ele sabe que
 * `data.conduz` quer dizer alguma coisa. O motor guarda o que saiu de cada
 * porta e não olha dentro.
 *
 * Note que **cortado não é ausência**: um transistor cortado relata todo tick,
 * dizendo que não conduz. Se ele calasse, um nó flutuando por rede mal montada
 * seria indistinguível de um transistor em repouso, e o defeito passaria calado
 * — que é exatamente o motivo de `conduz` ser campo.
 */
export function chavesConduzindo(state: WorldState): ReadonlySet<string> {
  const passando = new Set<string>();
  for (const [chave, mensagens] of Object.entries(state.settled)) {
    if (!mensagens.some((m) => m.kind === CORRENTE && m.data.conduz === true)) continue;
    passando.add(chave.slice(0, chave.lastIndexOf(".")));
  }
  return passando;
}
