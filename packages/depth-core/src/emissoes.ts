import { borneNode, bornePort } from "./model.js";
import type { Borne, Message, PortId, WorldState } from "./model.js";
import type { TreeIndex } from "./tree.js";

/**
 * O que cada porta emitiu neste tick, **incluindo as portas dos compostos**.
 *
 * `WorldState.settled` registra quem de fato emitiu, e quem emite é sempre uma
 * folha: um composto não tem comportamento próprio. Só que o desenho liga fios
 * entre os objetos que a vista mostra, e esses são quase sempre compostos — a
 * porta lógica, o somador, a ULA. Resultado: a linha existia, o valor existia,
 * e a carga não aparecia em nenhuma das duas pontas.
 *
 * Um borne de saída diz qual porta de qual filho responde por aquela porta do
 * pai. Seguir essa cadeia é o que faz a esteira atravessar as camadas de
 * abstração sem se interromper: o item que sai lá do fundo é o mesmo que sai
 * de cada composto acima dele, com o mesmo valor, na mesma porta.
 *
 * Nada é inventado aqui. Se nenhum filho emitiu, a porta do pai continua sem
 * emissão — que é a resposta certa, e é diferente de emitir vazio.
 */
export interface EmissaoDaPorta {
  readonly mensagens: readonly Message[];
  /**
   * Quem de fato emitiu — a folha lá no fundo.
   *
   * O desenho precisa dela para saber **quando** aquilo aconteceu dentro do
   * tick: o subpasso é do emissor, e um composto não tem subpasso porque não
   * roda. Sem isto a onda inteira parecia acontecer no mesmo instante.
   */
  readonly fonte: string;
}

export function emissoesPorPorta(
  state: WorldState,
  tree: TreeIndex,
): Readonly<Record<string, EmissaoDaPorta>> {
  const porPorta: Record<string, EmissaoDaPorta> = {};
  for (const [chave, mensagens] of Object.entries(state.settled)) {
    porPorta[chave] = { mensagens, fonte: chave.slice(0, chave.lastIndexOf(".")) };
  }

  // Ponto fixo: os níveis se encadeiam, e uma volta só pararia no primeiro. O
  // limite é o tamanho da árvore, porque uma cadeia não pode ser mais longa
  // que ela.
  for (let volta = 0; volta <= tree.byId.size; volta += 1) {
    let mudou = false;
    for (const [id, node] of tree.byId) {
      for (const [porta, bornes] of Object.entries(node.outlets ?? {}) as readonly [
        PortId,
        readonly Borne[],
      ][]) {
        const chave = `${id}.${porta}`;
        if (porPorta[chave] !== undefined) continue;
        for (const borne of bornes) {
          const dentro = porPorta[`${borneNode(borne)}.${bornePort(borne) ?? porta}`];
          if (dentro === undefined) continue;
          porPorta[chave] = dentro;
          mudou = true;
          break;
        }
      }
    }
    if (!mudou) break;
  }

  return porPorta;
}
