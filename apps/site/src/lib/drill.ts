/**
 * O drill-down textual, escrito em markdown que ainda se lê no repositório.
 *
 * O artigo tem que responder na primeira leitura e ainda assim guardar o
 * degrau seguinte para quem quer descer. Nota de rodapé não serve: ela tira o
 * leitor do lugar. Uma seção escondida serve, desde que o texto continue
 * legível como arquivo — por isso a sintaxe é a de alerta do GitHub, que o
 * repositório já sabe mostrar:
 *
 * ```md
 * > [!deeper] Por que o limiar não fica na metade
 * >
 * > O corpo, um parágrafo depois do marcador.
 * ```
 *
 * O parágrafo em branco entre marcador e corpo não é estilo: sem ele o
 * markdown junta título e corpo num nó de texto só, e o título sairia impresso
 * dentro do resumo junto com a primeira frase. Faltando, o build para.
 */

const MARCADOR = /^\[!deeper\]\s*([\s\S]*)$/;

interface Node {
  type: string;
  tagName?: string;
  value?: string;
  children?: Node[];
  properties?: Record<string, unknown>;
}

function textoDe(node: Node): string {
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(textoDe).join("");
}

/** Um `<details>` já aberto seria só um parágrafo com borda: o valor é o degrau. */
export function drillDown() {
  return (tree: Node) => {
    visitar(tree);
  };
}

function visitar(node: Node): void {
  const filhos = node.children;
  if (filhos === undefined) return;

  for (let i = 0; i < filhos.length; i++) {
    const filho = filhos[i];
    if (filho === undefined) continue;
    visitar(filho);

    if (filho.tagName !== "blockquote") continue;

    const blocos = (filho.children ?? []).filter(
      (c) => c.type === "element" || (c.type === "text" && (c.value ?? "").trim() !== ""),
    );
    const primeiro = blocos[0];
    if (primeiro === undefined || primeiro.tagName !== "p") continue;

    const bruto = textoDe(primeiro);
    const casou = MARCADOR.exec(bruto.trim());
    if (casou === null) continue;

    const titulo = (casou[1] ?? "").trim();
    if (titulo === "") {
      throw new Error(
        "um bloco [!deeper] sem título — o leitor decide se desce pelo título, " +
          "e um resumo vazio não dá essa decisão a ele",
      );
    }
    if (titulo.includes("\n")) {
      throw new Error(
        `o bloco [!deeper] "${titulo.split("\n")[0]}" não tem linha em branco ` +
          "depois do marcador, e o corpo entrou no título",
      );
    }
    if (blocos.length < 2) {
      throw new Error(
        `o bloco [!deeper] "${titulo}" não tem corpo — um degrau que não desce ` +
          "para lugar nenhum é pior que degrau nenhum",
      );
    }

    filhos[i] = {
      type: "element",
      tagName: "details",
      properties: { className: ["drill"] },
      children: [
        {
          type: "element",
          tagName: "summary",
          properties: {},
          children: [{ type: "text", value: titulo }],
        },
        ...blocos.slice(1),
      ],
    };
  }
}
