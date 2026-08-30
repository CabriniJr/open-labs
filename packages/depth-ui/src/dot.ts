import { DROP } from "@ovh/depth-core";
import type { TreeIndex, Wire } from "@ovh/depth-core";

/**
 * O interior de um objeto, em Graphviz.
 *
 * O desenho do palco é posicionado à mão e escolhe o enquadramento; este aqui
 * não escolhe nada — é a **topologia crua**, do jeito que o modelo a declara, e
 * serve para conferir o desenho contra o modelo, para colar num documento, ou
 * simplesmente para ler a estrutura sem a interferência de um layout.
 *
 * Ele sai do mesmo lugar que tudo o mais: a árvore e os fios. Não há uma
 * segunda descrição da estrutura em lugar nenhum — que é o que faria as duas
 * divergirem.
 */
export function toDot(tree: TreeIndex, wires: readonly Wire[], id: string): string {
  const node = tree.byId.get(id);
  if (node === undefined) return `digraph "${id}" {\n  // não existe na árvore\n}`;

  const filhos = node.children ?? [];
  const dentro = new Set(filhos.map((f) => f.id));

  const esc = (t: string): string => t.replace(/"/g, '\\"');
  const forma = (kind: string): string =>
    kind === "composite" || kind === "pipeline"
      ? "box, style=rounded"
      : kind === "channel"
        ? "box, style=dashed"
        : kind === "source"
          ? "invhouse"
          : kind === "sink"
            ? "house"
            : "box";

  const linhas: string[] = [
    `digraph "${esc(id)}" {`,
    "  rankdir=LR;",
    '  node [fontname="JetBrains Mono", fontsize=10];',
    '  edge [fontname="JetBrains Mono", fontsize=9];',
    "",
  ];

  if (filhos.length === 0) {
    linhas.push(`  "${esc(id)}" [label="${esc(node.label)}\\n${node.kind}", ${forma(node.kind)}];`);
    linhas.push("  // é folha: não há interior para desenhar");
    linhas.push("}");
    return linhas.join("\n");
  }

  for (const filho of filhos) {
    const marca = filho.replicas === undefined ? "" : `\\n×${filho.replicas}`;
    linhas.push(
      `  "${esc(filho.id)}" [label="${esc(filho.label)}${marca}\\n${filho.kind}", ${forma(filho.kind)}];`,
    );
  }
  linhas.push("");

  // Só os fios cujas duas pontas estão aqui dentro. Um fio que sai do bloco não
  // é interior dele, e desenhá-lo aqui daria a entender que é.
  for (const wire of wires) {
    const destino = wire.to === DROP ? null : String(wire.to);
    if (!dentro.has(wire.from) || destino === null || !dentro.has(destino)) continue;
    const rotulo = wire.toPort === undefined ? wire.port : `${wire.port} → ${wire.toPort}`;
    const estilo =
      (wire.line ?? "data") === "control"
        ? ', style=dashed, color="#f0883e"'
        : (wire.timing ?? "clocked") === "settle"
          ? ""
          : ", penwidth=2";
    linhas.push(`  "${esc(wire.from)}" -> "${esc(destino)}" [label="${esc(rotulo)}"${estilo}];`);
  }

  linhas.push("}");
  return linhas.join("\n");
}
