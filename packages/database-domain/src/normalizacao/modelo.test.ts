import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DADOS } from "../telecentro/dados.js";
import { tabela, type NomeDaTabela } from "../telecentro/esquema.js";
import { anomaliasDa, createTable, ETAPAS, perdidosAoApagar, tabelasDa } from "./modelo.js";

describe("da planilha às tabelas", () => {
  it("a planilha tem uma linha por aluno; a 1FN, uma por tentativa", () => {
    expect(tabelasDa("planilha")[0]?.linhas).toHaveLength(12);
    expect(tabelasDa("1fn")[0]?.linhas).toHaveLength(12);
    expect(tabelasDa("2fn").map((t) => t.nome)).toEqual(["ALUNO_2FN", "TENTATIVA_2FN", "AVALIACAO_2FN"]);
  });

  it("a 3FN são as tabelas reais do banco, com os mesmos dados do 02-dml.sql", () => {
    for (const t of tabelasDa("3fn")) {
      const nome = t.real as NomeDaTabela;
      const real = tabela(nome);
      expect(t.chave).toEqual([real.pk]);
      const idx = t.colunas.map((c) => real.colunas.findIndex((x) => x.nome === c));
      expect(idx.every((i) => i >= 0)).toBe(true);
      const esperado = DADOS[nome].linhas.map((l) => idx.map((i, k) => (t.colunas[k] === "vl_nota" ? Number(l[i]).toFixed(2) : (l[i] ?? null))));
      expect(t.linhas).toEqual(esperado);
    }
  });

  it("renomear o telecentro: 4 células na planilha, 5 na 1FN, 4 na 2FN, 1 na 3FN", () => {
    expect(ETAPAS.map((e) => anomaliasDa(e).renomear)).toEqual([4, 5, 4, 1]);
  });

  it("um telecentro sem alunos só cabe na 3FN", () => {
    expect(ETAPAS.map((e) => anomaliasDa(e).telecentroSemAluno)).toEqual([false, false, false, true]);
  });

  it("na 1FN, quem nunca fez avaliação não tem onde ficar: 7 de 12 alunos", () => {
    expect(ETAPAS.map((e) => anomaliasDa(e).alunos)).toEqual([12, 7, 12, 12]);
  });

  it("apagar as tentativas de Splunk leva o lab e o handbook junto — até a 2FN separar a avaliação", () => {
    expect(perdidosAoApagar("1fn")).toEqual([
      "nm_avaliacao=Checkpoint: onde o parsing acontece",
      "nm_fase=Where a byte stream becomes events",
      "nm_handbook=Splunk Visual Handbook",
      "nm_lab=Where parsing happens, and what it costs",
    ]);
    expect(perdidosAoApagar("planilha").length).toBe(3);
    expect(perdidosAoApagar("2fn")).toEqual([]);
    expect(perdidosAoApagar("3fn")).toEqual([]);
  });

  it("o CREATE TABLE de cada tabela é o mesmo do database/01-ddl.sql", () => {
    const ddl = readFileSync(new URL("../../../../database/01-ddl.sql", import.meta.url), "utf8").replaceAll("\r\n", "\n");
    for (const nome of ["T_ALUNO", "T_TELECENTRO", "T_TENTATIVA"] as const) {
      const primeiro = Math.max(...DADOS[nome].linhas.map((l) => Number(l[0]))) + 1;
      expect(ddl).toContain(createTable(nome, primeiro));
    }
  });
});
