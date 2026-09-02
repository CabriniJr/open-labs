import { describe, expect, it } from "vitest";
import { EXERCICIOS_DOS_PROVEDORES } from "@ovh/otel-domain";
import { MAPA_OTEL } from "./roadmap.js";

/**
 * O casamento entre exercício e mapa mora aqui, e não no pacote de domínio.
 *
 * O mapa é dado da aplicação; o exercício é dado do domínio. Testar o encontro
 * dos dois lá dentro faria o pacote alcançar `apps/site` para cima — a
 * dependência ao contrário que `pnpm boundaries` existe para impedir. Aqui, os
 * dois lados são importados de onde eles de fato moram.
 */
describe("o exercício e o mapa", () => {
  it("todo exercício pertence a um lab que EXISTE no mapa", () => {
    // Sem isto, um exercício órfão renderiza uma seção que o mapa não conhece, e
    // o placar conta para um nó que não existe. É a mesma regra de fonte única
    // que já vale para o catálogo de labs.
    const doMapa = new Set(MAPA_OTEL.labs.map((l) => l.id));
    for (const e of EXERCICIOS_DOS_PROVEDORES) {
      expect(doMapa.has(e.lab), `${e.id} aponta para o lab "${e.lab}"`).toBe(true);
    }
  });
});
