import { borneNode } from "@ovh/depth-core";
import type { TreeIndex, Wire } from "@ovh/depth-core";

/**
 * As portas de uma caixa: por onde entra e por onde sai.
 *
 * Sem elas, uma caixa é um retângulo com linhas encostando em algum lugar da
 * borda, e o leitor não tem como saber **onde** aquilo entrou. Ao descer um
 * nível a pergunta fica pior: o interior aparece sem nenhuma pista de qual
 * pedaço da margem era a entrada. Desenhar a porta é o que dá direção à
 * leitura — de onde veio, para onde vai — e é o que faz a margem da caixa
 * significar alguma coisa quando o interior está aberto.
 *
 * Elas são **derivadas**, e essa é a garantia: uma porta existe porque um fio
 * chega nela ou sai dela, ou porque o objeto declarou um borne. Desenhar uma
 * porta que ninguém usa seria prometer uma ligação que o modelo não tem.
 */
export interface PortasDaCaixa {
  readonly entradas: readonly string[];
  readonly saidas: readonly string[];
}

/** A porta sem nome, quando a carga entra e o motor acha a folha de entrada. */
export const PORTA_ANONIMA = "in";

export function portasDaCaixa(
  tree: TreeIndex,
  wires: readonly Wire[],
  id: string,
): PortasDaCaixa {
  const node = tree.byId.get(id);
  const entradas = new Set<string>();
  const saidas = new Set<string>();

  for (const porta of Object.keys(node?.inlets ?? {})) entradas.add(porta);
  for (const porta of Object.keys(node?.outlets ?? {})) saidas.add(porta);

  for (const wire of wires) {
    if (wire.from === id) saidas.add(wire.port);
    if (wire.to === id) entradas.add(wire.toPort ?? PORTA_ANONIMA);
  }

  // Um borne de entrada pode apontar para dentro de um filho: aquilo é porta do
  // filho, e não do pai. O pai já a declarou como sua acima; aqui só se conta
  // quem de fato aparece nesta caixa.
  return { entradas: [...entradas].sort(), saidas: [...saidas].sort() };
}

/**
 * Onde cada porta fica na borda, de 0 a 1 ao longo do lado.
 *
 * Distribuídas com folga nas pontas: encostadas no canto, duas portas de lados
 * diferentes se tocam e a caixa parece ter uma só.
 */
export function posicaoDaPorta(indice: number, total: number): number {
  return (indice + 1) / (total + 1);
}

/** Quem recebe aquele borne, para a porta do pai apontar para dentro. */
export function alvoDoBorne(tree: TreeIndex, id: string, porta: string): string | undefined {
  const bornes = tree.byId.get(id)?.inlets?.[porta];
  const primeiro = bornes?.[0];
  return primeiro === undefined ? undefined : borneNode(primeiro);
}

/**
 * Para que lado o leque da caixa abre.
 *
 * O trapézio era desenhado **sempre do mesmo jeito** — largo à esquerda,
 * estreito à direita — para todo `router`, e a descrição dele no catálogo era a
 * do mux: muitas entram, uma sai. Só que metade dos `router` do acervo é o
 * espelho disso: o amostrador tem uma entrada e três saídas, o dispersor tem uma
 * entrada e sessenta e quatro. Neles a forma afirmava o contrário do que o
 * modelo diz, e forma afirma antes de qualquer rótulo ser lido.
 *
 * Agora a forma **segue o leque**:
 *
 * - `fecha` — várias entram, uma sai. É o mux, o coletor, a porta lógica;
 * - `abre` — uma entra, várias saem. É o amostrador, o dispersor;
 * - `reto` — não há leque, e um trapézio afirmaria um que não existe.
 *
 * O que a forma **não** diz é se a caixa escolhe ou combina: as duas convergem.
 * Quem separa é a linha de controle — quem escolhe é comandado, e desde a
 * separação dos planos ela é desenhada por cima, noutra altura.
 */
export type Leque = "abre" | "fecha" | "reto";

export function lequeDe(entradas: number, saidas: number): Leque {
  if (entradas > saidas) return "fecha";
  if (saidas > entradas) return "abre";
  return "reto";
}

/**
 * O leque de uma caixa, contado nas **ligações** e não nos nomes de porta.
 *
 * O coletor da ULA recebe trinta e dois fios numa entrada anônima só: pelos
 * nomes de porta ele tem uma entrada e uma saída, e não teria leque nenhum.
 * Pelo que o leitor vê — trinta e duas linhas chegando e uma saindo —, ele
 * fecha, e é exatamente o espelho do dispersor.
 *
 * Sem fio nenhum na vista, o que sobra é o que o objeto declarou: uma caixa
 * fora do enquadramento não perde a forma que ela tem.
 */
export function lequeDaCaixa(tree: TreeIndex, wires: readonly Wire[], id: string): Leque {
  let entram = 0;
  let saem = 0;
  for (const wire of wires) {
    if (String(wire.to) === id) entram += 1;
    if (wire.from === id) saem += 1;
  }
  if (entram === 0 && saem === 0) {
    const node = tree.byId.get(id);
    return lequeDe(
      Object.keys(node?.inlets ?? {}).length,
      Object.keys(node?.outlets ?? {}).length,
    );
  }
  return lequeDe(entram, saem);
}
