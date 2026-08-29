import { DROP } from "./model.js";
import type { WorldSpec } from "./model.js";
import { familyOf } from "./model.js";
import { entryLeaf } from "./tree.js";
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

  // A regra é sobre FIOS, e não sobre nós: o que não pode acontecer é uma
  // mensagem ser entregue a quem não age. Perguntar "toda folha de fluxo tem
  // behavior?" recusaria também um agrupamento decorativo — um contêiner cujos
  // filhos são todas placas (legenda, nota, tabela de configuração) —, que não
  // recebe nada de ninguém e portanto não some com nada.
  //
  // Continua sendo estrutural: os fios são todos declarados na construção do
  // mundo, nenhum aparece em runtime, então o que passa aqui não pode falhar
  // depois. É a mesma checagem que o `stepWorld` faz como cinto, movida para
  // onde a violação é impossível em vez de improvável.
  for (const wire of spec.wires) {
    // O descarte é destino legítimo: é a ausência de destino dita em voz alta.
    if (wire.to === DROP) continue;
    // fio para id inexistente já foi acusado acima; não acuse duas vezes
    if (!tree.byId.has(wire.to)) continue;

    const folha = entryLeaf(tree, wire.to);
    const destino = tree.byId.get(folha);
    if (destino !== undefined && familyOf(destino.kind) !== "plate" && destino.behavior !== undefined) {
      continue;
    }
    const onde =
      folha === wire.to
        ? `chega em "${wire.to}", que não age`
        : `chega em "${wire.to}", cuja folha de entrada "${folha}" não age`;
    erros.push(
      `fio de "${wire.from}" ${onde}: a mensagem entregue ali desapareceria sem ` +
        `deixar rastro no livro-caixa. Dê um behavior a "${folha}", aponte o fio ` +
        `para outro destino, ou mande-o ao descarte se o sumiço for deliberado`,
    );
  }

  // Duas linhas de dado saindo da mesma porta: `resolveTarget` devolve a
  // primeira que casa e ignora as outras em silêncio. O autor desenhou um
  // caminho que não existe, e nada — nem o livro-caixa, nem `.unwired`, que só
  // conta porta sem fio nenhum — acusaria. Replicar uma saída é o que o `tee`
  // faz (onda 1); enquanto ele não chega, a forma é recusada em vez de
  // silenciosamente reduzida à primeira.
  const portasDeDado = new Map<string, number>();
  for (const wire of spec.wires) {
    if ((wire.line ?? "data") !== "data") continue;
    const chave = `${wire.from}\u0000${wire.port}`;
    portasDeDado.set(chave, (portasDeDado.get(chave) ?? 0) + 1);
  }
  for (const [chave, quantos] of portasDeDado) {
    if (quantos < 2) continue;
    const [from, port] = chave.split("\u0000");
    erros.push(
      `a porta "${port}" de "${from}" tem ${quantos} fios de dado saindo, e só o ` +
        `primeiro seria percorrido — os outros seriam desenho sem caminho. ` +
        `Para replicar a saída use um tee; para escolher entre destinos, um router`,
    );
  }

  // `init` sem `behavior` é erro de autoria, não licença poética: `initialWorld`
  // só chama `init` de quem age, então esse estado seria construído por ninguém
  // e lido por ninguém — o autor acha que guardou estado e não guardou.
  for (const node of tree.byId.values()) {
    if (node.init === undefined || node.behavior !== undefined) continue;
    erros.push(
      `"${node.id}" tem init e não tem behavior: esse estado nunca seria criado ` +
        `nem lido. Dê um behavior a ele ou remova o init`,
    );
  }

  if (erros.length > 0) {
    throw new Error(`mundo inválido:\n- ${erros.join("\n- ")}`);
  }
}
