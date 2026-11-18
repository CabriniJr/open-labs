import { frameAt } from "@ovh/motion";
import { describe, expect, it } from "vitest";
import { filmeDaMochila } from "./filme.js";
import { CENARIOS_DA_MOCHILA, gulosa, itensDoCenario, mochila, PASSO } from "./mochila.js";

describe("filme da mochila", () => {
  it("cada cenário termina com a tabela inteira à mostra e os números do modelo no detalhe", () => {
    for (const c of CENARIOS_DA_MOCHILA) {
      const film = filmeDaMochila(c.id);
      const itens = itensDoCenario(c);
      const m = mochila(itens, c.sessao);
      const fim = frameAt(film, film.duration);
      const celulas = fim.entities.filter((e) => /^c:\d+:\d+$/.test(e.spec.id) && Number(e.state.opacity) > 0.5);
      expect(celulas, c.id).toHaveLength((itens.length + 1) * (c.sessao / PASSO + 1));
      const d = fim.detail!;
      expect(d.otimo?.pontos, c.id).toBe(m.pontos);
      expect(d.gulosa?.pontos, c.id).toBe(gulosa(itens, c.sessao).pontos);
      expect(d.contagem?.celulas, c.id).toBe(m.celulas);
      expect(d.linhas).toBe(itens.length);
    }
  });

  it("na volta, os labs que entram ficam no tom de aceito, e só eles", () => {
    const c = CENARIOS_DA_MOCHILA.find((x) => x.id === "rafa")!;
    const film = filmeDaMochila("rafa");
    const m = mochila(itensDoCenario(c), c.sessao);
    const volta = film.chapters.find((x) => x.id === "back")!;
    const quadro = frameAt(film, volta.end - 1);
    const aceitos = quadro.entities.filter((e) => /^lab:\d+$/.test(e.spec.id) && e.state.tone === "conduit").map((e) => Number(e.spec.id.split(":")[1]) - 1);
    expect(aceitos.sort((a, b) => a - b)).toEqual([...m.escolhidos]);
  });

  it("a tabela só aparece no capítulo dela: no começo não há célula à mostra", () => {
    const film = filmeDaMochila("trap");
    const inicio = frameAt(film, 1);
    expect(inicio.entities.some((e) => e.spec.id.startsWith("c:") && Number(e.state.opacity) > 0.5)).toBe(false);
  });
});
