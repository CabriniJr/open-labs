import type {
  AnyObject,
  Borne,
  Emission,
  ObjectSpec,
  Wire,
  WorldSpec,
  WorldState,
} from "@ovh/depth-core";
import { borneNode, bornePort } from "@ovh/depth-core";
import type { TreeIndex } from "@ovh/depth-core";
import { fiosDaPortaAberta, portaAberta } from "./transistors.js";
import { ROTULOS } from "./labels.js";

/**
 * A fatia vertical: somador → somador completo → portas lógicas → transistores.
 *
 * **A mensagem carrega o bit.** Uma linha que existe está sempre dizendo alguma
 * coisa — `bit: 0` ou `bit: 1` —, e o que a acomodação leva não é a notícia de
 * que algo aconteceu, é o valor que a linha tem neste tick.
 *
 * Não foi sempre assim. Antes, a codificação era **presença**: chegar uma
 * mensagem era o nível alto, e não chegar nada era zero. Era mais bonita — a
 * porta acesa era literalmente a emissão dela no livro-caixa — e tinha um preço
 * declarado: `not` não cabia, porque com entrada zero a porta nunca rodaria.
 *
 * O preço venceu quando a fatia chegou no transistor. Uma porta CMOS é uma rede
 * de pull-up (PMOS, puxa para o 1) e uma rede de pull-down (NMOS, puxa para o
 * 0). Sob presença, "puxado para o 0" e "não puxado" são o mesmo estado, e a
 * rede de pull-down fica **invisível** — metade de cada porta, e justamente a
 * metade que faz CMOS ser CMOS. Desenhar meia porta e chamar de transistor
 * seria ensinar errado em silêncio, que é o defeito que este projeto persegue.
 *
 * O que se ganhou junto: `not` existe, e com ele NAND e NOR, que são as portas
 * que o silício de fato tem. O que se perdeu: a porta acesa não é mais "ela
 * emitiu" — é o **valor** que ela emitiu, lido de `WorldState.settled`. Continua
 * saindo do modelo e não do desenho; só deixou de caber numa contagem.
 *
 * Abaixo da porta a presença volta, com outro significado e sem ambiguidade:
 * um transistor que **conduz** emite o que chegou na fonte dele, e um que corta
 * não emite nada. Ali presença é caminho fechado, não nível alto.
 */

export type PortaLogica = "xor" | "and" | "or" | "nand" | "nor" | "not";

/** A tabela-verdade, em função de quantas entradas estão em alto. */
export function decide(porta: PortaLogica, altas: number, entradas: number): 0 | 1 {
  switch (porta) {
    case "xor": return altas % 2 === 1 ? 1 : 0;
    case "and": return altas === entradas ? 1 : 0;
    case "nand": return altas === entradas ? 0 : 1;
    case "or": return altas >= 1 ? 1 : 0;
    case "nor": return altas >= 1 ? 0 : 1;
    // `not` só existe porque a mensagem carrega o bit: sob presença ela nunca
    // rodaria com a entrada em zero, e é dela que vem toda a inversão.
    case "not": return altas === 0 ? 1 : 0;
  }
}

/**
 * Uma porta lógica: acomoda, não guarda nada, e emite o valor da saída dela.
 *
 * `entradas` diz de quantas vias ela é feita. Ela ainda precisa saber: uma
 * linha em zero agora chega, mas o AND precisa distinguir "duas entradas, uma
 * em alto" de "uma entrada só, em alto".
 */
export function porta(
  id: string,
  tipo: PortaLogica,
  saida = "out",
  label = tipo.toUpperCase(),
  entradas = tipo === "not" ? 1 : 2,
): ObjectSpec {
  return {
    id,
    kind: "router",
    label,
    leaf: true,
    behavior: (state, inbox, ctx) => {
      if (ctx.phase !== "settle" || inbox.length === 0) return { state, out: [] };
      const altas = inbox.reduce((soma, m) => soma + (m.data.bit === 1 ? 1 : 0), 0);
      const bit = decide(tipo, altas, entradas);
      return { state, out: [{ port: saida, message: ctx.emit("bit", 1, { bit }) }] };
    },
  };
}

/**
 * Um somador completo, montado com cinco portas:
 *
 * ```
 * soma  = (a xor b) xor cin
 * vaium = (a and b) or ((a xor b) and cin)
 * ```
 *
 * Ele pode ser fechado num **atalho** que faz as duas contas de uma vez, e o
 * atalho só é legítimo porque um teste prova que ele concorda com as cinco
 * portas. Isso passou a ser possível quando o contêiner ganhou **bornes**: com
 * entradas nomeadas, a fiação de fora é a mesma aberto e fechado, e as duas
 * versões são comparáveis por serem o mesmo modelo.
 */
export function somadorCompleto(id: string, comAtalho: boolean, comTransistores = false): AnyObject {
  const p = (sufixo: string): string => `${id}-${sufixo}`;

  // Com transistores, cada porta é um bloco com entradas nomeadas, e o borne do
  // somador precisa dizer em qual terminal dela ele entra. Sem eles, a porta é
  // folha e o nome dela basta. É a mesma diferença que os bornes existem para
  // não deixar acontecer em silêncio, agora um nível abaixo.
  const em = (sufixo: string, port: "a" | "b"): Borne =>
    comTransistores ? { node: p(sufixo), port } : p(sufixo);
  const de = (sufixo: string, port: string): Borne =>
    comTransistores ? { node: p(sufixo), port } : p(sufixo);
  const monta = (sufixo: string, tipo: PortaLogica, saida = "out"): AnyObject =>
    comTransistores
      ? // Sem atalho: aberto até o transistor é aberto de verdade, e descer
        // encontra silício rodando em vez de uma tabela respondendo por ele.
        portaAberta(p(sufixo), tipo, saida, false)
      : porta(p(sufixo), tipo, saida);

  // O índice sai do próprio id (`bit12`), que é quem o conhece. Guardá-lo à
  // parte seria a segunda fonte de sempre; e sem índice nenhum, trinta e duas
  // caixas iguais chamadas "full adder" não se distinguem.
  const indice = /(\d+)$/.exec(id)?.[1];
  const base: AnyObject = {
    id,
    kind: "composite",
    label: indice === undefined ? ROTULOS.somadorCompletoSemIndice : ROTULOS.somadorCompleto(Number(indice)),
    // Os três bornes. `a` e `b` alimentam duas portas cada — é o leque de
    // dentro do bloco, o pontinho que o esquemático desenha na linha que entra.
    inlets: {
      a: [em("xor1", "a"), em("and1", "a")],
      b: [em("xor1", "b"), em("and1", "b")],
      cin: [em("xor2", "b"), em("and2", "b")],
    },
    outlets: { soma: [de("xor2", "soma")], vaium: [de("or1", "vaium")] },
    children: [
      monta("xor1", "xor"),
      monta("and1", "and"),
      // As saídas são nomeadas pelo papel: a emissão sobe para o fio do pai com
      // o mesmo nome de porta, e é isso que faz a fiação de fora não mudar
      // quando o bloco fecha.
      monta("xor2", "xor", "soma"),
      monta("and2", "and"),
      monta("or1", "or", "vaium"),
    ],
  };
  if (!comAtalho) return base;
  return {
    ...base,
    /**
     * As duas contas numa passada só. Ele é legítimo porque existe teste
     * provando que concorda com as cinco portas — e o teste só é possível
     * porque a fiação de fora é a **mesma** nos dois casos, que é exatamente o
     * que os bornes destravaram.
     */
    shortcut: (state, _inbox, ctx) => {
      if (ctx.phase !== "settle") return { state, out: [] };
      const vias = [...(ctx.inlets.a ?? []), ...(ctx.inlets.b ?? []), ...(ctx.inlets.cin ?? [])];
      if (vias.length === 0) return { state, out: [] };
      // Contar mensagens não serve mais: a linha em zero também chega. O que se
      // conta é quantas delas estão dizendo um.
      const altas = vias.reduce((soma, m) => soma + (m.data.bit === 1 ? 1 : 0), 0);
      return {
        state,
        out: [
          { port: "soma", message: ctx.emit("bit", 1, { bit: altas % 2 === 1 ? 1 : 0 }) },
          { port: "vaium", message: ctx.emit("bit", 1, { bit: altas >= 2 ? 1 : 0 }) },
        ],
      };
    },
  };
}

/** Os fios de dentro de um somador completo. São eles que fazem a conta. */
export function fiosDoSomador(id: string, comTransistores = false): readonly Wire[] {
  const p = (sufixo: string): string => `${id}-${sufixo}`;
  // Entrando num bloco com terminais, o fio precisa dizer em qual deles entra.
  const t = (port: "a" | "b"): { toPort?: string } => (comTransistores ? { toPort: port } : {});
  return [
    // a xor b alimenta as duas portas do segundo estágio
    { from: p("xor1"), port: "out", to: p("xor2"), timing: "settle", ...t("a") },
    { from: p("xor1"), port: "out", to: p("and2"), timing: "settle", ...t("a") },
    { from: p("and1"), port: "out", to: p("or1"), timing: "settle", ...t("a") },
    { from: p("and2"), port: "out", to: p("or1"), timing: "settle", ...t("b") },
    ...(comTransistores
      ? [
          ...fiosDaPortaAberta(p("xor1"), "xor"),
          ...fiosDaPortaAberta(p("and1"), "and"),
          ...fiosDaPortaAberta(p("xor2"), "xor"),
          ...fiosDaPortaAberta(p("and2"), "and"),
          ...fiosDaPortaAberta(p("or1"), "or"),
        ]
      : []),
  ];
}

/**
 * Uma linha amarrada num nível fixo, que é o que o vai-um do primeiro bit é.
 *
 * O somador sempre teve essa linha, e ela nunca foi acionada: sob a codificação
 * de presença, "ninguém acionou" e "zero" eram o mesmo estado, então amarrar em
 * zero era o mesmo que esquecer. Deixaram de ser. Uma porta que recebe uma
 * linha morta não sabe o que responder, e a rede de transistores dela acusa —
 * foi assim que este fio esquecido apareceu, depois de o somador inteiro passar
 * em todos os testes por não perguntar.
 */
export function nivelFixo(id: string, bit: 0 | 1, label = `${bit}`): ObjectSpec {
  return {
    id,
    kind: "source",
    label,
    leaf: true,
    drives: true,
    behavior: (state, _inbox, ctx) =>
      ctx.phase === "settle"
        ? { state, out: [{ port: "out", message: ctx.emit("bit", 1, { bit }) }] }
        : { state, out: [] },
  };
}

/**
 * Um somador de vai-um em cascata, com as portas todas modeladas.
 *
 * `replicas` não é atalho de desenho: os `bits` somadores existem de verdade e
 * é deles que os números saem. A marca só diz ao leitor que eles são iguais —
 * e é por isso que somar dois números de N bits custa N vezes um somador de um
 * bit, que é a coisa que este modelo existe para mostrar.
 */
export function somadorWorld(
  bits: number,
  comAtalho = false,
  seed = 1,
  comTransistores = false,
): WorldSpec {
  const somadores = Array.from({ length: bits }, (_, i) =>
    somadorCompleto(`bit${i}`, comAtalho, comTransistores),
  );
  const wires: Wire[] = [];

  // O vai-um que entra no primeiro bit está amarrado em zero. Todo somador tem
  // essa linha; ela só era invisível enquanto não acionar significava zero.
  wires.push({
    from: "cin0",
    port: "out",
    to: "bit0",
    toPort: "cin",
    timing: "settle",
  });

  for (let i = 0; i < bits; i += 1) {
    const p = (sufixo: string): string => `bit${i}-${sufixo}`;
    wires.push(...fiosDoSomador(`bit${i}`, comTransistores));

    // As entradas chegam por aresta de relógio: elas vêm de fora do circuito,
    // e é a chegada delas que dá início à acomodação deste tick.
    for (const via of ["a", "b"] as const) {
      wires.push({
        from: "entradas",
        port: `${via}${i}`,
        to: `bit${i}`,
        toPort: via,
        timing: "clocked",
      });
    }

    // As saídas são do BLOCO: aberto, a emissão da porta sobe para o fio do
    // pai; fechado, quem emite é o bloco. O fio é o mesmo, e é isso que faz as
    // duas versões serem comparáveis.
    wires.push({ from: `bit${i}`, port: "soma", to: `soma${i}`, timing: "settle" });

    const proximo = i + 1;
    if (proximo < bits) {
      // O vai-um: é ele que faz a conta ser em cascata, e é ele que custa
      // profundidade. Um somador de 32 bits tem 32 destes em fila.
      wires.push({
        from: `bit${i}`,
        port: "vaium",
        to: `bit${proximo}`,
        toPort: "cin",
        timing: "settle",
      });
    } else {
      wires.push({ from: `bit${i}`, port: "vaium", to: "vaium", timing: "settle" });
    }
  }

  /** Recebe um bit e acende se ele for um. Agora o zero também chega. */
  const saida = (id: string, label: string): ObjectSpec => ({
    id,
    kind: "sink",
    label,
    leaf: true,
    init: () => ({ alto: false }),
    behavior: (state, inbox, ctx) =>
      ctx.phase === "commit"
        ? { state: { alto: inbox.some((m) => m.data.bit === 1) }, out: [] }
        : { state, out: [] },
  });

  const entradas: ObjectSpec = {
    id: "entradas",
    kind: "source",
    label: ROTULOS.entradas,
    leaf: true,
    behavior: (state, _inbox, ctx) => {
      if (ctx.phase !== "commit") return { state, out: [] };
      const out: Emission[] = [];
      for (const via of ["a", "b"] as const) {
        const valor = ctx.params[via] ?? 0;
        for (let i = 0; i < bits; i += 1) {
          // Toda linha sai, dizendo o que vale. O bit baixo é uma linha em zero,
          // e não uma linha que não existe.
          const bit = ((valor >> i) & 1) as 0 | 1;
          out.push({ port: `${via}${i}`, message: ctx.emit("bit", 1, { bit }) });
        }
      }
      return { state, out };
    },
  };

  return {
    id: "somador",
    seed,
    edgeTicks: 1,
    params: { a: 6, b: 7 },
    root: {
      id: "circuito",
      kind: "composite",
      label: ROTULOS.circuito,
      children: [
        entradas,
        nivelFixo("cin0", 0, ROTULOS.cin),
        {
          id: "somador",
          kind: "composite",
          label: ROTULOS.somadorDe(bits),
          replicas: bits,
          children: somadores,
        },
        ...Array.from({ length: bits }, (_, i) => saida(`soma${i}`, ROTULOS.soma(i))),
        saida("vaium", ROTULOS.vaium),
      ],
    },
    wires,
  };
}

/**
 * Quem está com a saída em alto neste tick, para o desenho acender.
 *
 * Isto vive no domínio porque só o domínio sabe que `data.bit` quer dizer
 * alguma coisa. O motor guarda o que saiu de cada porta e não olha dentro; a
 * tela recebe o conjunto pronto e também não olha.
 *
 * **Contêiner não emite** — quem emite é a folha lá no fundo, e o borne de saída
 * é que diz quem fala por ele. Uma porta lógica aberta em transistores é o caso
 * puro: o valor sai do nó da rede, sobe pelo NAND, sobe pela porta. Marcar só as
 * folhas apagaria toda porta que tem interior, e apagar quem está aceso é a
 * mesma espécie de mentira que acender quem não está.
 */
export function portasAltas(state: WorldState, tree: TreeIndex): ReadonlySet<string> {
  // Por porta, e não por objeto: um somador completo tem soma e vai-um, e
  // juntá-los faria um deles responder pelo outro.
  const altas = new Set<string>(
    Object.entries(state.settled)
      .filter(([, mensagens]) => mensagens.some((m) => m.data.bit === 1))
      .map(([chave]) => chave),
  );

  // Sobe pelos bornes até parar de mudar: os níveis se encadeiam (nó › NAND ›
  // XOR › somador), e uma volta só pararia no primeiro.
  for (let volta = 0; volta <= tree.byId.size; volta += 1) {
    let mudou = false;
    for (const [id, node] of tree.byId) {
      for (const [porta, bornes] of Object.entries(node.outlets ?? {})) {
        const chave = `${id}.${porta}`;
        if (altas.has(chave)) continue;
        for (const borne of bornes) {
          if (!altas.has(`${borneNode(borne)}.${bornePort(borne) ?? porta}`)) continue;
          altas.add(chave);
          mudou = true;
          break;
        }
      }
    }
    if (!mudou) break;
  }

  return new Set([...altas].map((chave) => chave.slice(0, chave.lastIndexOf("."))));
}
