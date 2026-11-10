import { describe, expect, it } from "vitest";
import { CONFERIR_TABELAS, conferirConstraints, conferirLinhas, conferirRelacionamentos, provasDasRegras, resultadosDoDql, saidaDoDdl, saidaDoDml } from "./oracle.js";

describe("o passo a passo no Oracle", () => {
  it("confere as 10 tabelas, as 10 FKs e uma PK por tabela", () => {
    expect(CONFERIR_TABELAS.esperado.linhas).toHaveLength(10);
    const k = Object.fromEntries(conferirConstraints().esperado.linhas.map(([t, n]) => [t, n]));
    expect(k.P).toBe(10);
    expect(k.R).toBe(10);
    expect(Number(k.U)).toBeGreaterThan(0);
    expect(Number(k.C)).toBeGreaterThan(0);
    expect(conferirRelacionamentos().esperado.linhas).toHaveLength(10);
  });

  it("as contagens batem com o DML, e toda tabela tem pelo menos 5 linhas", () => {
    const l = conferirLinhas();
    expect(l.esperado.linhas.map((x) => x[1])).toEqual([5, 6, 12, 6, 5, 9, 8, 6, 15, 12]);
    expect(l.sql.match(/UNION ALL/gu)).toHaveLength(9);
    expect(saidaDoDml()[0]).toContain("84 times");
    expect(saidaDoDdl()).toContain("Table T_TENTATIVA created.");
  });

  it("as consultas devolvem o que o README diz, e as regras recusam com o código certo", () => {
    const [q1, q2, q3] = resultadosDoDql();
    expect(q1?.esperado.linhas).toHaveLength(12);
    expect(q2?.esperado.linhas).toHaveLength(5);
    expect(q3?.esperado.linhas).toHaveLength(3);
    expect(provasDasRegras().map((p) => p.erro.slice(0, 9))).toEqual(["ORA-02290", "ORA-02291", "ORA-02292"]);
  });
});
