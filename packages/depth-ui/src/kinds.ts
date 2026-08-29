import type { Family, Kind } from "@ovh/depth-core";

/**
 * O que cada `kind` e cada família **são**, em texto que o leitor vê.
 *
 * Isto é vocabulário do **motor**, e por isso mora aqui: `router`, `buffer` e
 * `channel` significam a mesma coisa em qualquer `.model`. O que não pode entrar
 * aqui é palavra de domínio, porque ela muda de handbook para handbook e o motor
 * não a conhece.
 *
 * A guarda de fronteira vigia este arquivo como vigia os outros — e pegou este
 * próprio comentário na primeira escrita, porque ele *citava* as palavras
 * proibidas como exemplo. Ela está certa: a regra é sobre o texto, e um exemplo
 * é texto. Por isso não há exemplos aqui.
 *
 * A gramática vem de `docs/kinds.md` §1, e é emprestada de Factorio pelo motivo
 * de que se aprende sem tutorial: **cinta transporta, máquina transforma, e o
 * fio de circuito carrega sinal, não item.**
 */

export interface Descricao {
  /** Uma linha, para o hover. */
  readonly resumo: string;
  /** O parágrafo, para o painel. */
  readonly detalhe: string;
}

export const FAMILIAS: Readonly<Record<Family, Descricao>> = {
  conduit: {
    resumo: "Conduit: it carries, and never alters the load.",
    detalhe:
      "It sits on the data path and it is the path. What goes in one end comes out the " +
      "other unchanged — a pipe that transformed its load would hide the transformation " +
      "inside the transport.",
  },
  processor: {
    resumo: "Processor: it acts on the data crossing it.",
    detalhe:
      "It sits on the data path, takes in from its inlet and emits from its outlet. This is " +
      "where the load changes shape, value or direction — and the only place it changes.",
  },
  controller: {
    resumo: "Controller: it decides, and never receives the load.",
    detalhe:
      "It sits off the data path and influences what is on it. It speaks through control " +
      "lines, which carry a signal and not an item — which is why it never shows up in the " +
      "load count.",
  },
  container: {
    resumo: "Container: it organises, it does not process.",
    detalhe:
      "It has no behaviour of its own: what it does is what its children do. It is the frame " +
      "that gives the model its depth — opening a container is going one level down.",
  },
  plate: {
    resumo: "Plate: attached data, read and never crossed.",
    detalhe:
      "It has no ports and sits on nobody\u2019s path. It exists to hang information on an " +
      "object without inventing a flow that does not exist.",
  },
};

export const KINDS: Readonly<Record<Kind, Descricao>> = {
  composite: {
    resumo: "Groups other objects. Does not act on its own.",
    detalhe:
      "The order of its children is accidental — what matters is who is inside whom. When it " +
      "declares a shortcut it starts acting as a single part, and that shortcut is proved " +
      "against the composition it closes.",
  },
  pipeline: {
    resumo: "A container whose child order is a contract.",
    detalhe:
      "The load crosses the children in the order they are written. That is the difference " +
      "from a composite, where the order means nothing.",
  },
  source: {
    resumo: "Where the load is born.",
    detalhe:
      "It produces without receiving. In a model it is the outer edge: what enters the system " +
      "and has no explanation inside it — a clock, a client, a power rail.",
  },
  sink: {
    resumo: "Where the load ends.",
    detalhe:
      "It consumes and does not emit. The other edge: what leaves the system. It keeps state, " +
      "which is why the result of a run is usually read off a sink.",
  },
  router: {
    resumo: "Takes in, decides, emits on an outlet.",
    detalhe:
      "The most common processor. A mux is a router: it picks which of its inputs answers, " +
      "and what commands the choice is usually a control line.",
  },
  buffer: {
    resumo: "Holds the load between two points.",
    detalhe:
      "With capacity one it is a register: it holds a value until the next clock edge. Full, " +
      "it refuses — and that refusal is what makes backpressure exist in the model instead of " +
      "vanishing.",
  },
  channel: {
    resumo: "The pipe: it carries without altering.",
    detalhe:
      "It has capacity and a policy, and it is where queueing happens. It never transforms the " +
      "load — transforming is a processor\u2019s job, and mixing the two would hide where the " +
      "data changes.",
  },
  static: {
    resumo: "Attached data, for reference.",
    detalhe:
      "No ports, receives nothing and emits nothing. It attaches information to an object " +
      "without pretending it flows anywhere.",
  },
};

/** O texto de uma linha, para o hover de um objeto. */
export function resumoDoKind(kind: Kind, family: Family): string {
  return `${KINDS[kind].resumo} — ${FAMILIAS[family].resumo}`;
}
