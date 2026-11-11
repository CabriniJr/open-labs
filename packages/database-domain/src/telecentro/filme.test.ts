import { frameAt } from "@ovh/motion";
import { describe, expect, it } from "vitest";
import { CAIXAS_DO_BANCO, CAPITULOS_DO_BANCO, filmeDoBanco, LIGACOES_DO_BANCO, OPCOES_DO_BANCO, type ErroDoFilme } from "./filme.js";

const fim = (f: ReturnType<typeof filmeDoBanco>, id: string) => {
  const c = f.chapters.find((x) => x.id === id);
  if (c === undefined) throw new Error(id);
  return frameAt(f, c.end - 50);
};

describe("o filme do banco", () => {
  it("tem os capítulos na ordem do roteiro", () => {
    expect(filmeDoBanco().chapters.map((c) => c.id)).toEqual([...CAPITULOS_DO_BANCO]);
  });

  it("as ligações saem e chegam nas bordas das tabelas certas", () => {
    expect(LIGACOES_DO_BANCO).toHaveLength(10);
    for (const l of LIGACOES_DO_BANCO) {
      const a = CAIXAS_DO_BANCO[l.filha];
      const b = CAIXAS_DO_BANCO[l.pai];
      expect([a.x, a.x + a.w]).toContain(l.naFilha.x);
      expect([b.x, b.x + b.w]).toContain(l.noPai.x);
      expect(l.naFilha.y).toBeGreaterThan(a.y);
      expect(l.naFilha.y).toBeLessThan(a.y + a.h);
    }
  });

  it("depois do INSERT, T_ALUNO diz 13 linhas e a resposta é a do motor", () => {
    const q = fim(filmeDoBanco(), "insert");
    expect(q.entities.find((e) => e.spec.id === "T_ALUNO")?.state.sublabel).toBe("13 rows");
    expect(q.detail?.resposta).toEqual({ ok: true, texto: "1 row inserted." });
  });

  const esperado: Record<ErroDoFilme, string> = { nota: "ORA-02290", pai: "ORA-02291", repetido: "ORA-00001" };
  for (const [erro, codigo] of Object.entries(esperado) as [ErroDoFilme, string][]) {
    it(`a escrita errada "${erro}" é recusada com ${codigo}`, () => {
      const q = fim(filmeDoBanco({ ...OPCOES_DO_BANCO, erro }), "recusa");
      expect(q.detail?.resposta?.ok).toBe(false);
      expect(q.detail?.resposta?.texto.startsWith(codigo)).toBe(true);
      expect(q.step?.title).toBe(codigo);
    });
  }

  it("a consulta 3 com LEFT traz a aluna nova; com INNER volta vazia", () => {
    const left = fim(filmeDoBanco(), "left").detail?.resultado;
    expect(left?.total).toBe(4);
    expect(left?.linhas.map((l) => l[0])).toContain("Nina Prado Lopes");
    expect(fim(filmeDoBanco({ ...OPCOES_DO_BANCO, juncao: "inner" }), "left").detail?.resultado?.total).toBe(0);
  });

  it("o GROUP BY conta a aluna nova no telecentro 1", () => {
    const r = fim(filmeDoBanco(), "agrupar").detail?.resultado;
    expect(r?.linhas.find((l) => l[0] === "Telecentro Jardim Ângela")?.[2]).toBe(4);
  });

  it("trocar a opção não muda o relógio dos capítulos que não dependem dela", () => {
    const a = filmeDoBanco();
    const b = filmeDoBanco({ ...OPCOES_DO_BANCO, juncao: "inner" });
    expect(a.chapters.slice(0, 5).map((c) => [c.start, c.end])).toEqual(b.chapters.slice(0, 5).map((c) => [c.start, c.end]));
  });
});
