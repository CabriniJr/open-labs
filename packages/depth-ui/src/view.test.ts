import { describe, expect, it } from "vitest";
import { indexTree } from "@ovh/depth-core";
import type { AnyObject } from "@ovh/depth-core";
import { interiorDisagreement, viewDisagreement } from "./view.js";
import { autoView } from "./auto-view.js";
import type { NodePlacement, View } from "./view.js";

const folha = (id: string): AnyObject => ({
  id,
  kind: "sink",
  label: id,
  leaf: true,
  behavior: (state) => ({ state, out: [] }),
});

const arvore = indexTree({
  id: "raiz",
  kind: "composite",
  label: "raiz",
  children: [
    folha("a"),
    { id: "caixa", kind: "composite", label: "caixa", children: [folha("dentro1"), folha("dentro2")] },
  ],
});

const lugar = (id: string, extra: Partial<NodePlacement> = {}): NodePlacement => ({
  id,
  x: 10,
  y: 10,
  w: 40,
  h: 20,
  ...extra,
});

const view = (places: readonly NodePlacement[]): View => ({
  id: "v",
  focus: "raiz",
  title: "v",
  width: 400,
  height: 200,
  places,
});

describe("view: nem inventa, nem esconde", () => {
  it("aceita uma view que desenha tudo o que está aberto", () => {
    expect(
      viewDisagreement(
        arvore,
        view([
          lugar("a"),
          lugar("caixa", { x: 100, w: 200, h: 100 }),
          lugar("dentro1", { x: 110, y: 20 }),
          lugar("dentro2", { x: 110, y: 60 }),
        ]),
      ),
    ).toBeNull();
  });

  it("aceita esconder o interior quando o `collapsed` está declarado", () => {
    // Esconder é legítimo; esconder calado é que não é.
    expect(
      viewDisagreement(arvore, view([lugar("a"), lugar("caixa", { x: 100, collapsed: true })])),
    ).toBeNull();
  });

  it("recusa esconder sem declarar", () => {
    expect(viewDisagreement(arvore, view([lugar("a"), lugar("caixa", { x: 100 })]))).toMatch(
      /a view não o desenha/,
    );
  });

  it("recusa esquecer um filho do foco", () => {
    expect(viewDisagreement(arvore, view([lugar("caixa", { collapsed: true })]))).toMatch(
      /"a" existe dentro de "raiz"/,
    );
  });

  it("recusa inventar objeto que a árvore não tem", () => {
    expect(
      viewDisagreement(
        arvore,
        view([lugar("a"), lugar("caixa", { x: 100, collapsed: true }), lugar("fantasma", { y: 100 })]),
      ),
    ).toMatch(/view não inventa objeto/);
  });

  it("recusa desenhar duas vezes o mesmo objeto", () => {
    expect(
      viewDisagreement(
        arvore,
        view([lugar("a"), lugar("a", { y: 100 }), lugar("caixa", { x: 100, collapsed: true })]),
      ),
    ).toMatch(/duas vezes/);
  });

  it("recusa objeto de área zero: é esconder com outro nome", () => {
    expect(
      viewDisagreement(
        arvore,
        view([lugar("a", { h: 0 }), lugar("caixa", { x: 100, collapsed: true })]),
      ),
    ).toMatch(/área zero/);
  });

  it("recusa objeto cortado pela moldura: esconder pela metade também é esconder", () => {
    expect(
      viewDisagreement(
        arvore,
        view([lugar("a", { x: 390 }), lugar("caixa", { x: 100, collapsed: true })]),
      ),
    ).toMatch(/sai da moldura/);
  });

  it("recusa desenhar quem está fora do foco", () => {
    const outra: View = {
      id: "v2",
      focus: "caixa",
      title: "v2",
      width: 400,
      height: 200,
      places: [lugar("dentro1"), lugar("dentro2", { y: 60 }), lugar("a", { x: 200 })],
    };
    expect(viewDisagreement(arvore, outra)).toMatch(/está fora de "caixa"/);
  });
});

describe("o interior desenhado dentro de uma caixa", () => {
  /**
   * Desenhar um interior dentro de uma caixa é uma **afirmação estrutural**:
   * dizer que aquilo mora ali. Sem esta regra, o zoom contínuo seria o desenho
   * inventando hierarquia — a coisa exata contra a qual todo o resto existe.
   */
  const dentroDaCaixa = autoView(arvore, "caixa", []);
  const fechada = lugar("caixa", { collapsed: true });

  it("aceita o interior de quem ele é", () => {
    expect(interiorDisagreement(arvore, fechada, dentroDaCaixa)).toBeNull();
  });

  it("recusa o interior de outro objeto", () => {
    expect(interiorDisagreement(arvore, lugar("a", { collapsed: true }), dentroDaCaixa)).toMatch(
      /mostra por dentro a view de "caixa"/,
    );
  });

  it("recusa interior numa caixa desenhada aberta", () => {
    expect(interiorDisagreement(arvore, lugar("caixa"), dentroDaCaixa)).toMatch(/duas vezes/);
  });

  it("recusa interior em folha: seria um dentro que a árvore não tem", () => {
    const mentira = { ...dentroDaCaixa, focus: "a" };
    expect(interiorDisagreement(arvore, lugar("a", { collapsed: true }), mentira)).toMatch(
      /não tem filhos/,
    );
  });

  it("continua cobrando que o interior concorde com a árvore", () => {
    const capenga = {
      ...dentroDaCaixa,
      places: dentroDaCaixa.places.filter((p) => p.id !== "dentro2"),
    };
    expect(interiorDisagreement(arvore, fechada, capenga)).not.toBeNull();
  });
});
