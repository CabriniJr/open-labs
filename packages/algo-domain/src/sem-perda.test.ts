// packages/algo-domain/src/sem-perda.test.ts
//
// Nenhum lab deste domínio joga emissão fora em silêncio.
//
// A máquina de pilha é o caso em que a guarda tem mais a dizer, porque o
// despachante é o único objeto do repositório que escolhe a porta de saída
// **pelo conteúdo** do que chegou: número vai para a pilha, operador vai para o
// operador. Uma porta a mais no `switch` do comportamento do que no desenho não
// dá erro nenhum — a expressão que não usa aquele caminho continua fechando a
// conta certa, e a que usa some no meio.
import { describe, expect, it } from "vitest";
import { World, emissoesPerdidas, relatoDePerdas } from "@ovh/depth-core";
import { lerExpressao, rpnWorld } from "./rpn.js";

/**
 * Expressões escolhidas por quais caminhos elas acordam, e não por aritmética:
 * as quatro operações, parênteses implícitos pela ordem, e um operando só (que
 * nunca chega a acionar o operador).
 */
const EXPRESSOES = ["3 4 +", "3 4 + 2 *", "10 2 -", "12 4 /", "7"] as const;

describe("nenhuma emissão cai no vácuo", () => {
  for (const fonte of EXPRESSOES) {
    it(`"${fonte}": toda porta que emite tem fio ou descarte declarado`, () => {
      const lido = lerExpressao(fonte);
      if (!lido.ok) throw new Error(lido.errors.map((e) => e.message).join(" | "));
      const world = new World(rpnWorld(lido.tokens));
      world.advance(60);
      const perdas = emissoesPerdidas(world.state);
      expect(perdas, `\n${relatoDePerdas(perdas)}`).toEqual([]);
    });
  }
});
