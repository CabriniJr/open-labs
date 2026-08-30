import { describe, expect, it } from "vitest";
import { comprimentoDaCarga } from "./Stage.js";

/**
 * A forma da carga vem da largura do fio, que o modelo declara.
 *
 * Antes disto tudo era o mesmo círculo, e a única diferença entre uma palavra
 * de 32 bits e um vai-um de um bit era a tinta. A transformação — que é o que
 * estes labs existem para mostrar — acontecia dentro da caixa, invisível.
 */
describe("a forma da carga", () => {
  it("um fio de uma via leva um ponto, e não uma barra", () => {
    expect(comprimentoDaCarga(1, 4)).toBe(0);
    expect(comprimentoDaCarga(undefined, 4)).toBe(0);
  });

  it("um barramento leva uma barra, e ela cresce com a largura", () => {
    expect(comprimentoDaCarga(4, 4)).toBeGreaterThan(0);
    expect(comprimentoDaCarga(32, 4)).toBeGreaterThan(comprimentoDaCarga(4, 4));
  });

  it("cresce por ordem de grandeza, e tem teto", () => {
    // Entre 1 e 8 há uma lição; entre 24 e 32 não há nenhuma. Linear faria a
    // carga de 32 atravessar a tela inteira.
    const de1a8 = comprimentoDaCarga(8, 4) - comprimentoDaCarga(1, 4);
    const de24a32 = comprimentoDaCarga(32, 4) - comprimentoDaCarga(24, 4);
    expect(de1a8).toBeGreaterThan(de24a32);
    expect(comprimentoDaCarga(4096, 4)).toBeLessThanOrEqual(4 * 5);
  });
});
