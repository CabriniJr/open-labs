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
import * as pacote from "./index.js";

/**
 * Expressões escolhidas por quais caminhos elas acordam, e não por aritmética:
 * as quatro operações, parênteses implícitos pela ordem, e um operando só (que
 * nunca chega a acionar o operador).
 */
const EXPRESSOES = ["3 4 +", "3 4 + 2 *", "10 2 -", "12 4 /", "7"] as const;

/** Os construtores que a varredura exercita, por nome. Ver a guarda no fim. */
const CONSTRUTORES_VARRIDOS = ["rpnWorld"];

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

describe("a varredura não envelhece em silêncio", () => {
  /*
    Guarda com lista escrita à mão passa a não medir nada sem avisar: o lab
    novo entra, ninguém lembra deste arquivo, e o verde continua verde cobrindo
    os antigos. Não é hipótese — na primeira vez que a versão desta guarda
    rodou no `cpu-domain` ela achou `portaCmosWorld` de fora.

    A convenção que ela usa já valia antes de ela existir: todo construtor de
    mundo deste repositório termina em `World`. Construtor não exportado do
    índice fica invisível aqui, e é o limite declarado desta checagem.
  */
  it("todo construtor de mundo exportado pelo pacote está na varredura", () => {
    const exportados = Object.keys(pacote)
      .filter((nome) => /World$/u.test(nome))
      .sort();
    expect(
      exportados,
      "um construtor de mundo entrou no índice do pacote e não entrou na " +
        "varredura de emissões perdidas. Acrescente-o neste arquivo.",
    ).toEqual(CONSTRUTORES_VARRIDOS);
  });
});
