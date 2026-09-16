import { describe, expect, it } from "vitest";
import { World } from "@ovh/depth-core";
import { estadoDosPilares } from "./estado.js";
import { latenciaDe, pilaresWorld } from "./world.js";

/**
 * Os testes deste lab são de **conservação e de recusa**.
 *
 * Conservação: o que a fonte emitiu tem de fechar com o que os três guardaram —
 * um painel com números plausíveis e errados passa em qualquer outro teste.
 *
 * Recusa: o medidor **não** pode conseguir responder "quais". É a tese do lab, e
 * se um dia o modelo mudar e ele conseguir, este teste cai — que é exatamente o
 * que se quer, porque aí a tese passou a ser falsa no modelo.
 */

const rodar = (ticks: number, params: Record<string, number> = {}) => {
  const world = new World(pilaresWorld(params));
  world.advance(ticks);
  return world;
};

describe("as mesmas requisições, três gravadores", () => {
  it("o mundo é válido", () => {
    expect(() => new World(pilaresWorld())).not.toThrow();
  });

  it("o que a fonte emitiu é o que cada um viu — nenhum inventa, nenhum perde", () => {
    const world = rodar(12, { "requisicoes-por-tick": 3, "registrar-tudo": 1 });
    const e = estadoDosPilares(world.state, 250);

    const doMedidor = e.baldes.reduce((total, b) => total + b.contagem, 0);
    /*
      Os três gravadores estão a um salto do serviço, então o que eles viram é o
      que o serviço atendeu **menos o que ainda está no fio**. A conservação é
      cobrada entre eles — que é onde ela tem de valer — e o serviço entra como
      teto: ninguém pode ter guardado mais do que aconteceu.
    */
    expect(doMedidor).toBe(e.linhas.length + e.caladas);
    expect(doMedidor).toBeLessThanOrEqual(e.atendidas);
    expect(doMedidor).toBeGreaterThan(0);
  });

  it("o registrador só tem o que o código escolheu dizer", () => {
    const calado = estadoDosPilares(rodar(10, { "registrar-tudo": 0 }).state, 250);
    const falante = estadoDosPilares(rodar(10, { "registrar-tudo": 1 }).state, 250);

    expect(calado.caladas).toBeGreaterThan(0);
    expect(falante.caladas).toBe(0);
    expect(falante.linhas.length).toBeGreaterThan(calado.linhas.length);
    // E o que ficou calado não está em lugar nenhum do log — nem some do resto.
    expect(calado.atendidas).toBe(falante.atendidas);
  });

  it("um atributo a mais é uma série por valor distinto, e o excedente colapsa", () => {
    const sem = estadoDosPilares(rodar(12, { "atributo-por-usuario": 0 }).state, 250);
    // Com folga no limite, a explosão aparece inteira: rota × status × usuário.
    const solto = estadoDosPilares(
      rodar(12, { "atributo-por-usuario": 1, "limite-de-series": 100 }).state,
      250,
    );
    expect(solto.series.length).toBeGreaterThan(sem.series.length);
    expect(solto.seriesColapsadas).toBe(0);

    // Com o limite apertado, o excedente COLAPSA — não é recusado, é somado
    // junto. Mesma memória finita da fila do lote, outra mentira.
    const apertado = estadoDosPilares(
      rodar(12, { "atributo-por-usuario": 1, "limite-de-series": 6 }).state,
      250,
    );
    expect(apertado.series.length).toBeLessThanOrEqual(6);
    expect(apertado.seriesColapsadas).toBeGreaterThan(0);

    // Nada é perdido nem contado duas vezes: é o que a spec garante do overflow.
    const contadas = apertado.series.reduce((total, s) => total + s.valor, 0);
    const noHistograma = apertado.baldes.reduce((total, b) => total + b.contagem, 0);
    expect(contadas + apertado.seriesColapsadas).toBe(noHistograma);
  });
});

describe("a pergunta, e quem consegue respondê-la", () => {
  it("o tracer responde QUAIS, com as linhas que ele guardou", () => {
    const e = estadoDosPilares(rodar(20).state, 250);
    expect(e.acimaDoLimite).toBeGreaterThan(0);
    expect(e.resposta.trace.responde).toBe(true);
    expect(e.resposta.trace.texto).toMatch(/#\d+/u);
  });

  it("o medidor NUNCA responde quais — é a tese do lab", () => {
    for (const limite of [50, 100, 250, 300, 500]) {
      const e = estadoDosPilares(rodar(20).state, limite);
      expect(e.resposta.metric.responde, `limite ${limite}`).toBe(false);
    }
  });

  it("numa borda de balde ele conta; fora dela, nem isso", () => {
    // A diferença entre "não sei quem" e "não sei nem quantos" é o histograma
    // inteiro, e ela sai do modelo: o balde foi decidido antes da medição.
    const naBorda = estadoDosPilares(rodar(20).state, 250);
    const noMeio = estadoDosPilares(rodar(20).state, 300);
    expect(naBorda.resposta.metric.texto).toMatch(/measurements landed above/u);
    expect(noMeio.resposta.metric.texto).toMatch(/cannot even count/u);
  });

  it("o log responde só se o código falou daquilo", () => {
    const calado = estadoDosPilares(rodar(20, { "registrar-tudo": 0, "erro-a-cada": 0 }).state, 250);
    expect(calado.resposta.log.responde).toBe(false);
    expect(calado.resposta.log.texto).toMatch(/without the code saying a word/u);
  });
});

describe("a latência é do modelo, e não de um sorteio", () => {
  it("o mesmo run duas vezes conta a mesma história", () => {
    const a = estadoDosPilares(rodar(15).state, 250);
    const b = estadoDosPilares(rodar(15).state, 250);
    expect(a.spans.map((s) => s.latencia)).toEqual(b.spans.map((s) => s.latencia));
  });

  it("tem cauda: quase tudo rápido, e um pico raro", () => {
    const amostra = Array.from({ length: 34 }, (_, i) => latenciaDe(i + 1));
    const rapidas = amostra.filter((l) => l <= 250).length;
    expect(rapidas).toBeGreaterThan(amostra.length / 2);
    expect(Math.max(...amostra)).toBeGreaterThan(1000);
  });
});

describe("o histograma se lê como histograma", () => {
  it("os baldes saem em ordem, e não na ordem em que apareceram", () => {
    // Fora de ordem ele vira tabela de números soltos, e a forma da
    // distribuição — a coisa que um histograma existe para mostrar — some.
    const e = estadoDosPilares(rodar(20).state, 250);
    const limites = e.baldes.map((b) => Number(b.nome.match(/\d+/u)?.[0] ?? 0));
    expect(limites).toEqual([...limites].sort((a, b) => a - b));
    expect(e.baldes.at(-1)?.nome.startsWith(">")).toBe(true);
  });
});
