import { describe, expect, it } from "vitest";
import { consulta3 } from "../telecentro/motor.js";
import { bancoInicial } from "../telecentro/motor.js";
import { andamento, comoResultado, comparacoes, grupos, ligar, linhasDaJuncao, resultadoDaJuncao, semPar, sqlDaJuncao, type Ligacao } from "./modelo.js";

const ids = (ls: readonly { aluno: { id_aluno?: unknown } }[]) => ls.map((l) => l.aluno.id_aluno);

describe("juntar T_ALUNO e T_TENTATIVA", () => {
  it("o ON olha 12 × 12 pares e acha 12", () => {
    const c = comparacoes({ filtro: "sem" });
    expect(c).toHaveLength(144);
    expect(c.filter((x) => x.casou)).toHaveLength(12);
  });

  it("INNER: 12 linhas — um aluno com duas tentativas vira duas linhas, e quem não tem nenhuma some", () => {
    const l = linhasDaJuncao({ tipo: "inner", filtro: "sem" });
    expect(l).toHaveLength(12);
    expect(ids(l).filter((x) => x === 1)).toHaveLength(2);
    expect(ids(l)).not.toContain(12);
  });

  it("LEFT: 17 linhas — os 5 sem tentativa voltam, com NULL", () => {
    const l = linhasDaJuncao({ tipo: "left", filtro: "sem" });
    expect(l).toHaveLength(17);
    expect(l.filter((x) => x.tentativa === null).map((x) => x.aluno.id_aluno)).toEqual([4, 6, 9, 11, 12]);
    expect(semPar({ filtro: "sem" }).map((a) => a.id_aluno)).toEqual([4, 6, 9, 11, 12]);
  });

  it("LEFT + filtro no WHERE dá o mesmo que INNER: o NULL não passa em vl_nota >= 7", () => {
    const where = linhasDaJuncao({ tipo: "left", filtro: "where" });
    const inner = linhasDaJuncao({ tipo: "inner", filtro: "where" });
    expect(where).toHaveLength(8);
    expect(comoResultado(where)).toEqual(comoResultado(inner));
  });

  it("LEFT + filtro no ON mantém todo aluno: 8 pares e 6 alunos com NULL", () => {
    const on = linhasDaJuncao({ tipo: "left", filtro: "on" });
    expect(on).toHaveLength(14);
    expect(on.filter((x) => x.tentativa === null).map((x) => x.aluno.id_aluno)).toEqual([2, 4, 6, 9, 11, 12]);
  });

  it("COUNT(*) conta a linha do NULL; COUNT(te.id_tentativa) não", () => {
    const estrela = grupos({ tipo: "left", filtro: "sem", contagem: "estrela" });
    const coluna = grupos({ tipo: "left", filtro: "sem", contagem: "coluna" });
    const de = (gs: typeof estrela, id: number) => gs.find((g) => g.aluno.id_aluno === id)?.qt;
    expect(de(estrela, 12)).toBe(1);
    expect(de(coluna, 12)).toBe(0);
    expect(de(estrela, 1)).toBe(2);
    expect(de(coluna, 7)).toBe(2);
    expect(estrela).toHaveLength(12);
    expect(grupos({ tipo: "inner", filtro: "sem", contagem: "estrela" })).toHaveLength(7);
  });

  it("a consulta 3 da entrega é este LEFT JOIN, filtrado pelos ativos sem par", () => {
    const sem = linhasDaJuncao({ tipo: "left", filtro: "sem" }).filter((l) => l.tentativa === null && l.aluno.st_ativo === "S").map((l) => l.aluno.id_aluno);
    expect([...sem].sort()).toEqual(consulta3(bancoInicial()).linhas.map((r) => r[0]).sort());
  });

  it("o SQL muda com cada decisão", () => {
    expect(sqlDaJuncao({ tipo: "inner", filtro: "sem" })).toContain("INNER JOIN T_TENTATIVA te");
    expect(sqlDaJuncao({ tipo: "left", filtro: "on" })).toContain("AND te.vl_nota >= 7");
    expect(sqlDaJuncao({ tipo: "left", filtro: "where" })).toContain("WHERE te.vl_nota >= 7");
    expect(sqlDaJuncao({ tipo: "left", filtro: "sem", contagem: "estrela" })).toContain("COUNT(*)");
    expect(resultadoDaJuncao({ tipo: "left", filtro: "sem", contagem: "coluna" }).colunas).toContain("QT_TENTATIVAS");
  });
});

describe("juntar à mão", () => {
  it("o ON recusa o par de outro aluno, a nota baixa com o filtro no ON e a tentativa já ligada", () => {
    expect(ligar([], 1, 3, { filtro: "sem" })).toEqual({ ok: false, motivo: "outro-aluno" });
    expect(ligar([], 2, 3, { filtro: "on" })).toEqual({ ok: false, motivo: "nota-baixa" });
    const r = ligar([], 1, 1, { filtro: "sem" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(ligar(r.ligacoes, 1, 1, { filtro: "sem" })).toEqual({ ok: false, motivo: "ja-ligada" });
  });

  it("ligando todos os pares, o resultado do leitor é o do banco", () => {
    for (const o of [
      { tipo: "inner", filtro: "sem" },
      { tipo: "left", filtro: "sem" },
      { tipo: "left", filtro: "on" },
      { tipo: "left", filtro: "where" },
    ] as const) {
      let ls: readonly Ligacao[] = [];
      for (const c of comparacoes(o).filter((x) => x.casou)) {
        const r = ligar(ls, c.aluno, c.tentativa, o);
        if (r.ok) ls = r.ligacoes;
      }
      const a = andamento(ls, o);
      expect(a.completo).toBe(true);
      expect(comoResultado(a.linhas)).toEqual(comoResultado(linhasDaJuncao(o)));
    }
  });
});
