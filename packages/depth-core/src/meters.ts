import { DROP } from "./model.js";
import type { InFlight, PortId, WorldState } from "./model.js";
import { visibleChild } from "./tree.js";
import type { TreeIndex } from "./tree.js";

/**
 * Um medidor é função pura sobre o tráfego de PORTA. Nunca espia o estado
 * interno de um objeto. É o que o mantém honesto: ele mede o que o leitor vê
 * acontecer, e por isso pode vir de graça junto com o arquétipo.
 *
 * A assinatura recebe `WorldState` e devolve número — não há caminho para
 * `state.nodes` a partir daqui.
 */
export function portCount(state: WorldState, node: string, port: PortId): number {
  return state.ledger[`out:${node}.${port}`] ?? 0;
}

export function portWeight(state: WorldState, node: string, port: PortId): number {
  return state.ledger[`out:${node}.${port}.weight`] ?? 0;
}

/**
 * O outro eixo do livro-caixa: o que CHEGOU num objeto. Um objeto não tem
 * portas de entrada nomeadas — tudo que lhe é entregue cai na mesma caixa —,
 * então a contagem é por objeto, e não por (objeto, porta).
 */
export function inCount(state: WorldState, node: string): number {
  return state.ledger[`in:${node}`] ?? 0;
}

export function inWeight(state: WorldState, node: string): number {
  return state.ledger[`in:${node}.weight`] ?? 0;
}

export interface Crossing {
  readonly item: InFlight;
  /** Filho do foco de onde a mensagem sai, o próprio foco, ou "outside". */
  readonly fromVisible: string;
  /** Filho do foco onde ela entra, o próprio foco, "outside", ou "@drop". */
  readonly toVisible: string;
}

/**
 * As mensagens que cruzam a fronteira de dois objetos visíveis a partir deste
 * foco. É isto que a vista agregada desenha — e é por isso que ela não precisa
 * ser autorada: o L0 é uma projeção do mesmo run que o interior mostra em
 * detalhe, e não tem como divergir dele.
 *
 * O filtro é por NOME resolvido, não pelo par de loci: origem e destino que
 * resolvem para o mesmo rótulo visível — os dois "outside", os dois dentro do
 * mesmo filho, ou (caso um objeto dinâmico rotule para si mesmo) os dois
 * "self" — não são travessia de fronteira nenhuma, são o mesmo lugar visto
 * duas vezes.
 */
export function boundaryCrossings(
  tree: TreeIndex,
  state: WorldState,
  focusId: string,
): Crossing[] {
  const name = (loc: ReturnType<typeof visibleChild> | { readonly at: "drop" }): string => {
    switch (loc.at) {
      case "child":
        return loc.id;
      case "self":
        return focusId;
      case "drop":
        return DROP;
      case "outside":
        return "outside";
    }
  };

  const out: Crossing[] = [];

  for (const item of state.flight) {
    const from = visibleChild(tree, focusId, item.from);
    const to = item.to === DROP ? ({ at: "drop" } as const) : visibleChild(tree, focusId, item.to);

    const fromVisible = name(from);
    const toVisible = name(to);
    // mesmo rótulo dos dois lados: não é fronteira, é o mesmo lugar visto de
    // dentro e de fora (inclui "outside"/"outside" e "child a"/"child a")
    if (fromVisible === toVisible) continue;

    out.push({ item, fromVisible, toVisible });
  }

  return out;
}

/** Uma emissão que saiu por uma porta onde não há fio nenhum. */
export interface EmissaoPerdida {
  readonly node: string;
  readonly port: PortId;
  /** Quantas emissões caíram no vácuo até aqui. */
  readonly count: number;
}

/**
 * As emissões que o mundo jogou fora sem que ninguém pedisse.
 *
 * O escalonador já marca isso: uma emissão que sai por porta sem fio de dado e
 * sem descarte declarado vira `out:<nó>.<porta>.unwired` no livro-caixa. O
 * contador existia e **ninguém lia** — então o buraco de autoria mais comum do
 * formato passava em silêncio.
 *
 * É o caso de um `.mmd` com a porta escrita errado: trocar `call:request` por
 * `cal:request` compila, o mundo é válido, e o fio liga o nó a uma porta que
 * nenhum comportamento usa. Nenhuma guarda acusa, porque nenhuma pode — o
 * comportamento é uma função, e o compilador não sabe por quais portas ela
 * emite. Quem sabe é o run, e o run já sabia.
 *
 * O que se perde sem isto não é o desenho: é o **sentido**. A anatomia com esse
 * erro de uma letra continuava rodando, continuava válida, e passava a ensinar
 * que um trace tem um span — e a primeira coisa que alguém suspeitaria é do
 * comportamento, que está certo.
 *
 * A chave é partida no PRIMEIRO ponto, e a assimetria é a razão: `indexTree`
 * recusa id com "." ou ":" na construção do mundo, então o nó é garantidamente
 * de um pedaço só — mas a porta aqui é a de uma emissão **sem fio**, e
 * `validateWorld` só olha porta que aparece num fio. A porta deste balde é a
 * única do livro-caixa que nunca passou por validação nenhuma, e pode trazer
 * um ponto dentro. Partir no último ponto moveria esse pedaço para o nome do
 * nó e devolveria um nó que não existe.
 */
export function emissoesPerdidas(state: WorldState): readonly EmissaoPerdida[] {
  const SUFIXO = ".unwired";
  const perdas: EmissaoPerdida[] = [];
  for (const [chave, count] of Object.entries(state.ledger)) {
    if (!chave.startsWith("out:") || !chave.endsWith(SUFIXO)) continue;
    if (count <= 0) continue;
    const corpo = chave.slice("out:".length, -SUFIXO.length);
    const corte = corpo.indexOf(".");
    // Sem ponto não há porta: a chave não é do formato que o escalonador
    // escreve, e inventar um nó a partir dela seria pior que ignorá-la.
    if (corte <= 0 || corte === corpo.length - 1) continue;
    perdas.push({ node: corpo.slice(0, corte), port: corpo.slice(corte + 1), count });
  }
  return perdas;
}

/**
 * O relato que vai para a mensagem de um teste que falhou.
 *
 * Separado da medida porque a medida é dado e isto é texto: quem chama a
 * guarda num `expect` precisa ler o nó, a porta e a contagem sem montar a
 * frase de novo em cada lab.
 */
export function relatoDePerdas(perdas: readonly EmissaoPerdida[]): string {
  return perdas
    .map((p) => `  ${p.node}.${p.port}: ${p.count} emissão(ões) sem fio`)
    .join("\n");
}
