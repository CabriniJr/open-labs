import { frameAt, type Film } from "@ovh/motion";
import { describe, expect, it } from "vitest";
import { CAPITULOS_DA_JUNCAO, filmeDaJuncao, type DetalheDaJuncao } from "./filme.js";

const fim = (f: Film<DetalheDaJuncao>, id: string) => {
  const c = f.chapters.find((x) => x.id === id);
  if (c === undefined) throw new Error(id);
  return frameAt(f, c.end - 50);
};
const peca = (q: ReturnType<typeof fim>, id: string) => q.entities.find((e) => e.spec.id === id)?.state;

describe("o filme do JOIN", () => {
  it("tem os capítulos do roteiro, com as mesmas durações para qualquer opção de junção", () => {
    const a = filmeDaJuncao({ tipo: "left" });
    const b = filmeDaJuncao({ tipo: "inner" });
    expect(a.chapters.map((c) => c.id)).toEqual([...CAPITULOS_DA_JUNCAO]);
    expect(a.chapters.slice(0, 3).map((c) => [c.start, c.end])).toEqual(b.chapters.slice(0, 3).map((c) => [c.start, c.end]));
  });

  it("depois do ON, os 12 pares estão desenhados", () => {
    const q = fim(filmeDaJuncao(), "on");
    for (let te = 1; te <= 12; te += 1) expect(peca(q, `par:${te}`)?.progress).toBe(1);
  });

  it("LEFT mostra NULL para quem não tem par; INNER apaga a pessoa", () => {
    const left = fim(filmeDaJuncao({ tipo: "left" }), "sem-par");
    expect(peca(left, "nulo:12")?.opacity).toBe(1);
    expect(left.detail?.resultado?.total).toBe(17);
    const inner = fim(filmeDaJuncao({ tipo: "inner" }), "sem-par");
    expect(peca(inner, "nulo:12")?.opacity).toBe(0);
    expect(peca(inner, "a:12")?.dim).toBeGreaterThan(0.5);
    expect(inner.detail?.resultado?.total).toBe(12);
  });

  it("filtro no WHERE com LEFT: o NULL cai e o resultado é o do INNER (8 linhas)", () => {
    const q = fim(filmeDaJuncao({ tipo: "left", filtro: "where" }), "filtro");
    expect(q.detail?.resultado?.total).toBe(8);
    expect(q.detail?.linhas).toContainEqual(["LEFT JOIN", "became INNER"]);
    expect(peca(q, "nulo:12")?.dim).toBeGreaterThan(0.5);
  });

  it("filtro no ON com LEFT: 14 linhas, e a aluna 2 (nota 6) ganha um NULL", () => {
    const q = fim(filmeDaJuncao({ tipo: "left", filtro: "on" }), "filtro");
    expect(q.detail?.resultado?.total).toBe(14);
    expect(peca(q, "nulo:2")?.opacity).toBe(1);
  });

  it("COUNT(*) dá 1 a quem nunca tentou, em vermelho; COUNT(coluna) dá 0", () => {
    const estrela = fim(filmeDaJuncao({ tipo: "left", contagem: "estrela" }), "contar");
    expect(peca(estrela, "a:12")?.sublabel).toBe("COUNT(*) = 1");
    expect(peca(estrela, "a:12")?.tone).toBe("live");
    const coluna = fim(filmeDaJuncao({ tipo: "left", contagem: "coluna" }), "contar");
    expect(peca(coluna, "a:12")?.sublabel).toBe("COUNT(te.id_tentativa) = 0");
    expect(peca(coluna, "nulo:2")?.opacity).toBe(0);
  });
});
