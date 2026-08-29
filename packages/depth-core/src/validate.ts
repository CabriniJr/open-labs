import { DROP } from "./model.js";
import type { Wire, WireTiming, WorldSpec } from "./model.js";
import { familyOf } from "./model.js";
import { findCombinationalCycle } from "./settle-graph.js";
import { entryLeaf, visibleChild } from "./tree.js";
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

    const line = wire.line ?? "data";

    if (line === "control" && wire.toPort === undefined) {
      erros.push(
        `a linha de controle de "${wire.from}.${wire.port}" precisa de toPort — ` +
          `carga entra num objeto e o motor acha a folha de entrada, mas sinal ` +
          `chega numa entrada nomeada, senão quem recebe não sabe qual sinal é`,
      );
    }

    // Carga com porta nomeada: o destino tem que ter aquele borne. Sem esta
    // regra, o fio entraria num nome que não existe e a carga sumiria — o
    // desenho mostraria uma ligação e o modelo não teria nenhuma.
    if (line === "data" && wire.toPort !== undefined && wire.to !== DROP) {
      const destino = tree.byId.get(wire.to);
      const bornes = destino?.inlets;
      if (destino !== undefined && destino.shortcut === undefined && bornes?.[wire.toPort] === undefined) {
        erros.push(
          `o fio de "${wire.from}.${wire.port}" entra em "${wire.to}" pela porta ` +
            `"${wire.toPort}", e "${wire.to}" não declara essa entrada` +
            (bornes === undefined
              ? " — ele não tem entradas nomeadas"
              : ` — as que ele tem são ${Object.keys(bornes).join(", ")}`),
        );
      }
    }

    // O contrário também: entrar sem nome num objeto que tem bornes deixaria o
    // motor escolher um deles, e escolher em silêncio é o que não pode.
    if (line === "data" && wire.toPort === undefined && wire.to !== DROP) {
      const destino = tree.byId.get(wire.to);
      if (destino?.inlets !== undefined) {
        erros.push(
          `o fio de "${wire.from}.${wire.port}" entra em "${wire.to}" sem dizer por ` +
            `qual porta, e "${wire.to}" tem entradas nomeadas ` +
            `(${Object.keys(destino.inlets).join(", ")}). Diga por qual delas`,
        );
      }
    }

    if (wire.toPort !== undefined && (wire.toPort.includes(".") || wire.toPort.includes(":"))) {
      erros.push(
        `o toPort "${wire.toPort}" usa "." ou ":", que separam campos no ` +
          `livro-caixa — escolha um nome sem esses caracteres`,
      );
    }

    // Sinal não atravessa contêiner sem dizer por onde: ou o destino age, ou
    // ele declara o borne por onde o sinal entra e quem, lá dentro, obedece.
    if (line === "control" && wire.to !== DROP && wire.toPort !== undefined) {
      const destino = tree.byId.get(wire.to);
      const bornes = destino?.inlets?.[wire.toPort];
      if (
        destino !== undefined &&
        destino.behavior === undefined &&
        destino.shortcut === undefined &&
        bornes === undefined
      ) {
        erros.push(
          `o sinal de "${wire.from}.${wire.port}" chega em "${wire.to}", que não age — ` +
            `sinal tem destinatário nomeado e não atravessa contêiner. Aponte-o ` +
            `para o objeto que de fato reage a ele`,
        );
      }
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
    // Quem tem atalho age: o atalho É o comportamento dele.
    const age = destino?.behavior !== undefined || destino?.shortcut !== undefined;
    if (destino !== undefined && familyOf(destino.kind) !== "plate" && age) {
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

  // Uma porta é de um regime só. Sem isso, o ator não teria como saber, ao
  // emitir, se está acomodando ou confrontando — e a fase é justamente o que
  // decide se o que ele devolve como estado vale ou é descartado.
  const tempoDaPorta = new Map<string, WireTiming>();
  for (const wire of spec.wires) {
    const chave = `${wire.from}\u0000${wire.port}`;
    const timing = wire.timing ?? "clocked";
    const anterior = tempoDaPorta.get(chave);
    if (anterior === undefined) {
      tempoDaPorta.set(chave, timing);
      continue;
    }
    if (anterior !== timing) {
      erros.push(
        `a porta "${wire.port}" de "${wire.from}" mistura tempos: um fio é ` +
          `"${anterior}" e outro é "${timing}". Uma porta entrega numa fase só`,
      );
    }
  }

  // As entradas nomeadas precisam apontar para dentro, e para quem age: um
  // borne ligado a quem não existe, ou a quem não faz nada, é uma entrada que
  // engole carga.
  for (const node of tree.byId.values()) {
    if (node.inlets === undefined) continue;
    if (node.leaf === true || (node.children ?? []).length === 0) {
      erros.push(
        `"${node.id}" declara entradas nomeadas e não tem interior: um borne ` +
          `serve para dizer quem, lá dentro, recebe — e não há lá dentro`,
      );
      continue;
    }
    for (const [porta, filhos] of Object.entries(node.inlets)) {
      if (porta.includes(".") || porta.includes(":")) {
        erros.push(
          `a entrada "${porta}" de "${node.id}" usa "." ou ":", que separam ` +
            `campos no livro-caixa — escolha um nome sem esses caracteres`,
        );
      }
      if (filhos.length === 0) {
        erros.push(
          `a entrada "${porta}" de "${node.id}" não leva a ninguém: a carga que ` +
            `chegasse por ela desapareceria`,
        );
      }
      for (const filho of filhos) {
        if (!tree.byId.has(filho)) {
          erros.push(
            `a entrada "${porta}" de "${node.id}" leva a "${filho}", que não existe`,
          );
          continue;
        }
        if (visibleChild(tree, node.id, filho).at === "outside") {
          erros.push(
            `a entrada "${porta}" de "${node.id}" leva a "${filho}", que está fora ` +
              `dele — borne é entrada para DENTRO`,
          );
        }
      }
    }
  }

  for (const node of tree.byId.values()) {
    if (node.outlets === undefined) continue;
    for (const [porta, filhos] of Object.entries(node.outlets)) {
      if (porta.includes(".") || porta.includes(":")) {
        erros.push(
          `a saída "${porta}" de "${node.id}" usa "." ou ":", que separam campos ` +
            `no livro-caixa — escolha um nome sem esses caracteres`,
        );
      }
      if (filhos.length === 0) {
        erros.push(
          `a saída "${porta}" de "${node.id}" não vem de ninguém: nada seria ` +
            `emitido por ela, e o fio ligado nela nunca teria carga`,
        );
      }
      for (const filho of filhos) {
        if (!tree.byId.has(filho)) {
          erros.push(`a saída "${porta}" de "${node.id}" vem de "${filho}", que não existe`);
          continue;
        }
        if (visibleChild(tree, node.id, filho).at === "outside") {
          erros.push(
            `a saída "${porta}" de "${node.id}" vem de "${filho}", que está fora ` +
              `dele — borne é saída de DENTRO`,
          );
        }
      }
    }
  }

  // O atalho substitui a composição, então ele exige que haja composição — e
  // não pode conviver com um behavior, que seria um segundo comportamento no
  // mesmo objeto sem nada dizendo qual vence.
  for (const node of tree.byId.values()) {
    if (node.shortcut === undefined) continue;
    if (node.behavior !== undefined) {
      erros.push(
        `"${node.id}" tem behavior e shortcut: seriam dois comportamentos no mesmo ` +
          `objeto, e nada diria qual vence. O atalho é o comportamento de um ` +
          `contêiner — remova um dos dois`,
      );
    }
    const filhos = (node.children ?? []).filter((c) => familyOf(c.kind) !== "plate");
    if (filhos.length === 0 || node.leaf === true) {
      erros.push(
        `"${node.id}" declara shortcut e não tem composição para atalhar: o atalho ` +
          `existe para produzir o mesmo que rodar os filhos, e sem filhos não há ` +
          `com o que comparar — nem teste de equivalência que se possa escrever`,
      );
    }
  }

  // As duas marcas de multiplicidade. Cada uma tem uma forma de mentir, e a
  // regra existe contra ela — não contra o dado malformado.
  for (const wire of spec.wires) {
    const width = wire.width;
    if (width === undefined) continue;
    if (!Number.isInteger(width) || width < 2) {
      erros.push(
        `o fio de "${wire.from}.${wire.port}" declara width ${String(width)}: a ` +
          `largura é um feixe de vias em paralelo, então precisa ser inteiro >= 2. ` +
          `Uma via só é uma linha comum, e declará-la é ruído no desenho`,
      );
    }
  }

  for (const node of tree.byId.values()) {
    const replicas = node.replicas;
    if (replicas === undefined) continue;
    if (!Number.isInteger(replicas) || replicas < 2) {
      erros.push(
        `"${node.id}" declara replicas ${String(replicas)}: réplica é "N objetos ` +
          `idênticos, um desenhado", então precisa ser inteiro >= 2`,
      );
      continue;
    }
    const filhos = (node.children ?? []).filter((c) => familyOf(c.kind) !== "plate");
    if (filhos.length !== replicas) {
      erros.push(
        `"${node.id}" declara replicas ${replicas} e tem ${filhos.length} filhos de ` +
          `fluxo: a marca diz "desenhe um destes ${replicas}", e os ${replicas} ` +
          `precisam existir de verdade — senão o leitor lê a conta de um achando ` +
          `que é a de ${replicas}`,
      );
      continue;
    }
    const kinds = new Set(filhos.map((c) => c.kind));
    if (kinds.size > 1) {
      erros.push(
        `"${node.id}" declara replicas ${replicas}, mas os filhos não são idênticos ` +
          `(kinds: ${[...kinds].join(", ")}). Desenhar um só no lugar de todos ` +
          `esconderia a diferença`,
      );
    }
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

  // Laço combinacional é percurso que não termina, e em hardware é erro de
  // projeto. Recusar aqui é a diferença entre uma violação impossível e uma
  // improvável — a alternativa seria um teto de iterações no percurso, que
  // transformaria "não converge" em "converge errado", em silêncio.
  const ciclo = findCombinationalCycle(spec.wires);
  if (ciclo !== null) {
    erros.push(
      `laço combinacional: ${ciclo.join(" -> ")}. Um caminho que acomoda não pode ` +
        `voltar a si mesmo dentro do mesmo tick. Ponha um fio com timing ` +
        `"clocked" em algum ponto da volta — é o que um elemento de memória faz`,
    );
  }

  // Trilho de alimentação: quem declara `drives` promete dirigir a linha sem
  // depender de entrada nenhuma. As duas maneiras de a promessa ser falsa são
  // recusadas aqui, na construção, e não descobertas por um circuito que roda
  // dando resposta errada.
  for (const [id, node] of tree.byId) {
    if (node.drives !== true) continue;
    const acomoda = (w: Wire): boolean => (w.timing ?? "clocked") === "settle";
    const recebe = spec.wires.some((w) => acomoda(w) && w.to === id);
    const dirige = spec.wires.some((w) => acomoda(w) && w.from === id && w.to !== DROP);
    if (recebe) {
      erros.push(
        `"${id}" declara drives e tem entrada acomodada — um trilho não depende ` +
          `de entrada. Ou tire o drives, ou tire o fio que acomoda até ele`,
      );
    }
    if (!dirige) {
      erros.push(
        `"${id}" declara drives e não tem saída acomodada: ele rodaria todo tick ` +
          `sem alimentar nada. Ligue uma saída dele por um fio com timing "settle", ` +
          `ou tire o drives`,
      );
    }
  }

  if (erros.length > 0) {
    throw new Error(`mundo inválido:\n- ${erros.join("\n- ")}`);
  }
}
