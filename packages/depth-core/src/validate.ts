import { DROP } from "./model.js";
import type { WorldSpec } from "./model.js";
import { familyOf } from "./model.js";
import { isOpenable } from "./tree.js";
import type { TreeIndex } from "./tree.js";

/**
 * Recusa um mundo que rodaria mentindo. Roda uma vez, na construção — depois
 * disso o motor pode confiar na fiação em vez de checá-la a cada tick.
 *
 * Acumula todos os erros antes de lançar: devolver o primeiro obriga o autor a
 * consertar em N rodadas.
 */
export function validateWorld(spec: WorldSpec, tree: TreeIndex): void {
  const erros: string[] = [];

  const edge = spec.edgeTicks;
  if (edge !== undefined && (!Number.isInteger(edge) || edge < 1)) {
    erros.push(
      `edgeTicks precisa ser inteiro >= 1 (recebi ${String(edge)}) — ` +
        `zero entregaria no mesmo tick da emissão e a travessia sumiria da tela`,
    );
  }

  for (const wire of spec.wires) {
    if (!tree.byId.has(wire.from)) {
      erros.push(`fio parte de "${wire.from}", que não existe na árvore`);
    }
    if (wire.to !== DROP && !tree.byId.has(wire.to)) {
      erros.push(`fio chega em "${wire.to}", que não existe na árvore`);
    }
    if (wire.channel !== undefined && !tree.byId.has(wire.channel)) {
      erros.push(
        `fio declara o canal "${wire.channel}", que não está indexado — ` +
          `canais vão em WorldSpec.channels, nunca em children`,
      );
    }
    // O livro-caixa separa os campos de uma chave por "." e o eixo por ":".
    // Uma porta que carregue um desses caracteres somaria a contagem dela por
    // cima da de outra, sem erro nenhum.
    if (wire.port.includes(".") || wire.port.includes(":")) {
      erros.push(
        `a porta "${wire.port}" de "${wire.from}" usa "." ou ":", que separam ` +
          `campos no livro-caixa — escolha um nome sem esses caracteres`,
      );
    }
  }

  // Todo objeto que pode receber precisa saber receber.
  for (const node of tree.byId.values()) {
    if (familyOf(node.kind) === "plate") continue;
    if (isOpenable(tree, node.id)) continue;
    if (node.behavior !== undefined) continue;
    erros.push(
      `"${node.id}" é folha de fluxo e não tem behavior: uma mensagem entregue ` +
        `nele desapareceria. Dê um behavior, marque-o como estático, ou remova-o`,
    );
  }

  if (erros.length > 0) {
    throw new Error(`mundo inválido:\n- ${erros.join("\n- ")}`);
  }
}
