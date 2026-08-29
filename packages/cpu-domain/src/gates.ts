import type { AnyObject, Emission, ObjectSpec, Wire, WorldSpec } from "@ovh/depth-core";

/**
 * A fatia vertical: somador → somador completo → portas lógicas.
 *
 * A codificação é a que a própria natureza do motor sugere, e é o que faz uma
 * porta lógica caber nele sem nenhuma primitiva nova:
 *
 * > **A presença da mensagem é o bit em alto. Não chegar nada é zero.**
 *
 * Uma porta que recebe só zeros não roda — e não rodar é exatamente o que uma
 * porta faz quando a saída dela é zero: nada acontece na linha. Por isso a
 * porta acesa na tela não é um efeito: é a saída dela, lida do livro-caixa.
 *
 * A consequência honesta dessa escolha: **`not` não é expressável assim**, e
 * por isso não existe aqui. Com entrada zero ela nunca rodaria, e precisaria
 * emitir um. Um somador completo se faz com XOR, AND e OR, então a fatia
 * fecha; no dia em que precisar de `not`, a codificação é que muda — e vai
 * estar escrito por quê.
 */

export type PortaLogica = "xor" | "and" | "or";

/** Quantas entradas altas fazem esta porta emitir. */
function decide(porta: PortaLogica, altas: number): boolean {
  if (porta === "xor") return altas % 2 === 1;
  if (porta === "and") return altas === 2;
  return altas >= 1;
}

/**
 * Uma porta lógica: acomoda, não guarda nada, e emite só quando a saída é 1.
 *
 * `entradas` diz de quantas vias ela é feita — a porta precisa saber, porque
 * "chegou uma mensagem" só significa "uma entrada em alto" se ela souber
 * quantas existem no total.
 */
export function porta(
  id: string,
  tipo: PortaLogica,
  saida = "out",
  label = tipo.toUpperCase(),
): ObjectSpec {
  return {
    id,
    kind: "router",
    label,
    leaf: true,
    behavior: (state, inbox, ctx) => {
      if (ctx.phase !== "settle" || inbox.length === 0) return { state, out: [] };
      const altas = inbox.reduce((soma, m) => soma + (m.data.bit === 1 ? 1 : 0), 0);
      if (!decide(tipo, altas)) return { state, out: [] };
      return { state, out: [{ port: saida, message: ctx.emit("bit", 1, { bit: 1 }) }] };
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
export function somadorCompleto(id: string, comAtalho: boolean): AnyObject {
  const p = (sufixo: string): string => `${id}-${sufixo}`;
  const base: AnyObject = {
    id,
    kind: "composite",
    label: id,
    // Os três bornes. `a` e `b` alimentam duas portas cada — é o leque de
    // dentro do bloco, o pontinho que o esquemático desenha na linha que entra.
    inlets: {
      a: [p("xor1"), p("and1")],
      b: [p("xor1"), p("and1")],
      cin: [p("xor2"), p("and2")],
    },
    outlets: { soma: [p("xor2")], vaium: [p("or1")] },
    children: [
      porta(p("xor1"), "xor"),
      porta(p("and1"), "and"),
      // As saídas são nomeadas pelo papel: a emissão sobe para o fio do pai com
      // o mesmo nome de porta, e é isso que faz a fiação de fora não mudar
      // quando o bloco fecha.
      porta(p("xor2"), "xor", "soma"),
      porta(p("and2"), "and"),
      porta(p("or1"), "or", "vaium"),
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
      const altas =
        (ctx.inlets.a ?? []).length + (ctx.inlets.b ?? []).length + (ctx.inlets.cin ?? []).length;
      if (altas === 0) return { state, out: [] };
      const out: Emission[] = [];
      if (altas % 2 === 1) out.push({ port: "soma", message: ctx.emit("bit", 1, { bit: 1 }) });
      if (altas >= 2) out.push({ port: "vaium", message: ctx.emit("bit", 1, { bit: 1 }) });
      return { state, out };
    },
  };
}

/** Os fios de dentro de um somador completo. São eles que fazem a conta. */
export function fiosDoSomador(id: string): readonly Wire[] {
  const p = (sufixo: string): string => `${id}-${sufixo}`;
  return [
    // a xor b alimenta as duas portas do segundo estágio
    { from: p("xor1"), port: "out", to: p("xor2"), timing: "settle" },
    { from: p("xor1"), port: "out", to: p("and2"), timing: "settle" },
    { from: p("and1"), port: "out", to: p("or1"), timing: "settle" },
    { from: p("and2"), port: "out", to: p("or1"), timing: "settle" },
  ];
}

/**
 * Um somador de vai-um em cascata, com as portas todas modeladas.
 *
 * `replicas` não é atalho de desenho: os `bits` somadores existem de verdade e
 * é deles que os números saem. A marca só diz ao leitor que eles são iguais —
 * e é por isso que somar dois números de N bits custa N vezes um somador de um
 * bit, que é a coisa que este modelo existe para mostrar.
 */
export function somadorWorld(bits: number, comAtalho = false, seed = 1): WorldSpec {
  const somadores = Array.from({ length: bits }, (_, i) => somadorCompleto(`bit${i}`, comAtalho));
  const wires: Wire[] = [];

  for (let i = 0; i < bits; i += 1) {
    const p = (sufixo: string): string => `bit${i}-${sufixo}`;
    wires.push(...fiosDoSomador(`bit${i}`));

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

  /** Recebe um bit e acende. Vazio é zero: não chegar nada já é a resposta. */
  const saida = (id: string, label: string): ObjectSpec => ({
    id,
    kind: "sink",
    label,
    leaf: true,
    init: () => ({ alto: false }),
    behavior: (state, inbox, ctx) =>
      ctx.phase === "commit"
        ? { state: { alto: inbox.length > 0 }, out: [] }
        : { state, out: [] },
  });

  const entradas: ObjectSpec = {
    id: "entradas",
    kind: "source",
    label: "entradas",
    leaf: true,
    behavior: (state, _inbox, ctx) => {
      if (ctx.phase !== "commit") return { state, out: [] };
      const out: Emission[] = [];
      for (const via of ["a", "b"] as const) {
        const valor = ctx.params[via] ?? 0;
        for (let i = 0; i < bits; i += 1) {
          // Presença é um; ausência é zero. O bit baixo simplesmente não sai.
          if (((valor >> i) & 1) === 1) {
            out.push({ port: `${via}${i}`, message: ctx.emit("bit", 1, { bit: 1 }) });
          }
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
      label: "circuito",
      children: [
        entradas,
        {
          id: "somador",
          kind: "composite",
          label: `somador de ${bits} bits`,
          replicas: bits,
          children: somadores,
        },
        ...Array.from({ length: bits }, (_, i) => saida(`soma${i}`, `soma ${i}`)),
        saida("vaium", "vai-um"),
      ],
    },
    wires,
  };
}
