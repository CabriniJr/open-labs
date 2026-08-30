import { describe, expect, it } from "vitest";
import { travessia } from "./travessia.js";

const TRACO = "M 100 50 H 140 V 80 H 180";

describe("o canal atravessando a fronteira", () => {
  it("sem caixa aberta, o traço fica como estava", () => {
    expect(travessia(TRACO, undefined, undefined)).toBe(TRACO);
  });

  it("entrando, o caminho segue até a peça de dentro", () => {
    expect(travessia(TRACO, undefined, { x: 200, y: 90 })).toBe(`${TRACO} L 200 90`);
  });

  it("saindo, o caminho começa na peça de dentro", () => {
    expect(travessia(TRACO, { x: 60, y: 40 }, undefined)).toBe("M 60 40 L 100 50 H 140 V 80 H 180");
  });

  it("atravessando os dois lados, as duas pontas entram", () => {
    expect(travessia(TRACO, { x: 60, y: 40 }, { x: 200, y: 90 })).toBe(
      "M 60 40 L 100 50 H 140 V 80 H 180 L 200 90",
    );
  });

  /**
   * A recusa importa: emendar num caminho que não começa com um `M` conhecido
   * produziria uma linha inventada, ligando duas coisas que ninguém ligou.
   */
  it("um traço que não começa com M sai intacto do lado de fora", () => {
    const estranho = "L 10 10";
    expect(travessia(estranho, { x: 1, y: 2 }, undefined)).toBe(estranho);
  });

  it("aceita coordenadas negativas e decimais, que é o que o layout produz", () => {
    expect(travessia("M -1.5 2.25 H 3", { x: -4, y: 0.5 }, undefined)).toBe(
      "M -4 0.5 L -1.5 2.25 H 3",
    );
  });
});
