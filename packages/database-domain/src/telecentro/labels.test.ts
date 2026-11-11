import { describe, expect, it } from "vitest";
import { TABELAS } from "./esquema.js";
import { SOBRE_A_COLUNA, SOBRE_A_TABELA } from "./labels.js";

describe("o dicionário do site cobre o esquema inteiro", () => {
  it("toda tabela e toda coluna têm a explicação em inglês, e nenhuma sobra", () => {
    for (const t of TABELAS) {
      expect(SOBRE_A_TABELA[t.nome], t.nome).toBeTruthy();
      expect(Object.keys(SOBRE_A_COLUNA[t.nome]).sort(), t.nome).toEqual(t.colunas.map((c) => c.nome).sort());
    }
  });
});
