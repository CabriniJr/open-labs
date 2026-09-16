import { describe, expect, it } from "vitest";
import { indexTree, isOpenable } from "@ovh/depth-core";
import { viewDisagreement } from "@ovh/depth-ui";
import { heroiWorld } from "./world.js";
import { VIEW_DO_COLLECTOR, VIEW_HEROI, VIEWS_DO_HEROI } from "./views.js";

const spec = heroiWorld();
const arvore = indexTree(spec.root, spec.channels);

describe("as views do herói dizem a verdade sobre a árvore", () => {
  it.each(VIEWS_DO_HEROI.map((v) => [v.id, v] as const))(
    "%s não inventa nem esconde",
    (_id, view) => {
      expect(viewDisagreement(arvore, view)).toBeNull();
    },
  );

  it("o collector abre, e é o único dos três que abre", () => {
    /*
      É a promessa da landing virada em fato do modelo: "duplo clique numa caixa
      desce para dentro dela". Ela esteve escrita no componente enquanto as três
      caixas eram folha, e o gesto não fazia nada. Este teste é quem denuncia a
      volta disso.
    */
    expect(isOpenable(arvore, "collector")).toBe(true);
    expect(isOpenable(arvore, "service")).toBe(false);
    expect(isOpenable(arvore, "backend")).toBe(false);
  });

  it("a vista de dentro ocupa a mesma moldura e a mesma fileira que a de fora", () => {
    // A superposição é o argumento: descer troca o que está nas caixas, e não o
    // lugar delas. Se as duas se soltarem, alternar entre elas vira um corte.
    expect(VIEW_DO_COLLECTOR.width).toBe(VIEW_HEROI.width);
    expect(VIEW_DO_COLLECTOR.height).toBe(VIEW_HEROI.height);
    const caixas = (places: (typeof VIEW_HEROI)["places"]): string =>
      places.map((p) => `${p.x},${p.y},${p.w},${p.h}`).join(" | ");
    expect(caixas(VIEW_DO_COLLECTOR.places)).toBe(caixas(VIEW_HEROI.places));
  });
});
