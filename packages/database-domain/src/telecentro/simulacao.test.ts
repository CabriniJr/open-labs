import { describe, expect, it } from "vitest";
import { TABELAS } from "./esquema.js";
import { apagar, bancoInicial, inserir } from "./motor.js";
import { linhaValida, TENTATIVAS_ERRADAS } from "./simulacao.js";

const b0 = bancoInicial();

describe("a simulação", () => {
  it("a linha que ela sugere é aceita em toda tabela", () => {
    for (const t of TABELAS) {
      const r = inserir(b0, t.nome, linhaValida(b0, t.nome));
      expect(r.ok ? "ok" : r.recusa.mensagem, t.nome).toBe("ok");
    }
  });

  for (const e of TENTATIVAS_ERRADAS) {
    it(`"${e.rotulo}" → ${e.espera}`, () => {
      const v = e.valores(b0);
      const r = e.operacao === "insert" ? inserir(b0, e.tabela, v) : apagar(b0, e.tabela, v[Object.keys(v)[0] ?? ""] ?? null);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.recusa.codigo).toBe(e.espera);
    });
  }
});
