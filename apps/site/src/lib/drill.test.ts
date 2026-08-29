import { describe, expect, it } from "vitest";
import { drillDown } from "./drill.js";

interface Node {
  type: string;
  tagName?: string;
  value?: string;
  children?: Node[];
  properties?: Record<string, unknown>;
}

const texto = (value: string): Node => ({ type: "text", value });
const p = (...t: string[]): Node => ({
  type: "element",
  tagName: "p",
  properties: {},
  children: t.map(texto),
});
const citacao = (...filhos: Node[]): Node => ({
  type: "element",
  tagName: "blockquote",
  properties: {},
  children: filhos,
});
const raiz = (...filhos: Node[]): Node => ({ type: "root", children: filhos });

function transformar(arvore: Node): Node {
  drillDown()(arvore);
  return arvore;
}

describe("o drill-down textual", () => {
  it("vira um details fechado, com o título no summary", () => {
    const arvore = transformar(
      raiz(citacao(p("[!deeper] Why the threshold is not at half"), p("The transfer curve."))),
    );
    const detalhes = arvore.children?.[0];
    expect(detalhes?.tagName).toBe("details");
    expect(detalhes?.properties?.["className"]).toEqual(["drill"]);
    expect(detalhes?.properties?.["open"]).toBeUndefined();
    expect(detalhes?.children?.[0]?.tagName).toBe("summary");
    expect(detalhes?.children?.[0]?.children?.[0]?.value).toBe(
      "Why the threshold is not at half",
    );
    expect(detalhes?.children?.[1]).toEqual(p("The transfer curve."));
  });

  it("não toca numa citação de verdade", () => {
    const antes = citacao(p("Shannon said something."));
    const arvore = transformar(raiz(antes));
    expect(arvore.children?.[0]?.tagName).toBe("blockquote");
  });

  it("desce em blocos aninhados", () => {
    const arvore = transformar(
      raiz({
        type: "element",
        tagName: "section",
        properties: {},
        children: [citacao(p("[!deeper] Inside"), p("Body."))],
      }),
    );
    expect(arvore.children?.[0]?.children?.[0]?.tagName).toBe("details");
  });

  /**
   * As três recusas são o ponto: um degrau silenciosamente quebrado é pior que
   * a ausência dele, porque o leitor clica e não recebe nada.
   */
  it("recusa um degrau sem título", () => {
    expect(() => transformar(raiz(citacao(p("[!deeper]"), p("Body."))))).toThrow(/sem título/);
  });

  it("recusa um degrau sem corpo", () => {
    expect(() => transformar(raiz(citacao(p("[!deeper] Só o título"))))).toThrow(/não tem corpo/);
  });

  it("recusa o marcador colado no corpo, que engoliria o título", () => {
    expect(() =>
      transformar(raiz(citacao(p("[!deeper] Title\nThe body came along."), p("x")))),
    ).toThrow(/linha em branco/);
  });
});
