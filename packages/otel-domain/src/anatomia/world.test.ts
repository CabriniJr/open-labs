import { describe, expect, it } from "vitest";
import { World } from "@ovh/depth-core";
import { estadoDaAnatomia } from "./estado.js";
import { anatomiaWorld } from "./world.js";

/**
 * Os testes deste lab cobram as **conclusões erradas** que o desenho tem de
 * produzir.
 *
 * É incomum e é o ponto: derrubar um cabeçalho não pode dar erro — tem de dar
 * **duas árvores plausíveis**. Um serviço sem instrumentação não pode faltar na
 * árvore: os filhos dele têm de se pendurar no avô, e a árvore tem de fechar
 * parecendo completa. Se um dia isso deixar de acontecer, o lab parou de ensinar
 * o que acontece de verdade.
 */

const rodar = (ticks: number, params: Record<string, number> = {}) => {
  const world = new World(anatomiaWorld(params));
  world.advance(ticks);
  return estadoDaAnatomia(world.state);
};

describe("o caminho feliz: uma requisição, uma árvore", () => {
  it("o mundo é válido", () => {
    expect(() => new World(anatomiaWorld())).not.toThrow();
  });

  it("os quatro serviços exportam, e vira UMA árvore com quatro spans", () => {
    const e = rodar(10);
    expect(e.arvores).toHaveLength(1);
    expect(e.arvores[0]?.spans).toBe(4);
    expect(e.orfaos).toBe(0);
    expect(e.saltosSemSpan).toEqual([]);
  });

  it("a árvore tem uma raiz só, e ela é o gateway", () => {
    const e = rodar(10);
    expect(e.arvores[0]?.raizes).toHaveLength(1);
    expect(e.arvores[0]?.raizes[0]?.span.servico).toBe("gateway");
  });

  it("cada span sabe o pai, e nada além dele", () => {
    // É a tese em forma de tipo: não existe campo para "a árvore" em lugar
    // nenhum do span.
    const e = rodar(10);
    const raiz = e.arvores[0]?.raizes[0];
    expect(raiz?.span.parentId).toBeUndefined();
    expect(raiz?.filhos[0]?.span.parentId).toBe(raiz?.span.spanId);
  });
});

describe("derrubar o cabeçalho não quebra nada — e é esse o problema", () => {
  it("vira DUAS árvores completas para uma requisição, sem erro nenhum", () => {
    const e = rodar(10, { "derrubar-cabecalho-em": 2 });
    expect(e.arvores).toHaveLength(2);
    expect(e.arvores.reduce((total, a) => total + a.spans, 0)).toBe(4);
    // Nenhuma das duas se sabe incompleta: as duas têm raiz própria e fecham.
    for (const arvore of e.arvores) expect(arvore.raizes).toHaveLength(1);
  });

  it("o serviço de baixo registra que começou um trace que não devia", () => {
    // É a única pista que existe DENTRO do processo, e ninguém olha para ela.
    const e = rodar(10, { "derrubar-cabecalho-em": 2 });
    const payments = e.porServico.find((s) => s.servico === "payments");
    expect(payments?.raizesInesperadas).toBeGreaterThan(0);
  });
});

describe("um serviço sem instrumentação: o salto some e a árvore fecha", () => {
  it("três spans em vez de quatro, e nenhum órfão", () => {
    // Ele repassa o cabeçalho, então o filho se pendura no AVÔ. A árvore fecha
    // com um salto a menos e continua parecendo completa — é o caso que engana.
    const e = rodar(10, { "sem-instrumentacao": 3 });
    expect(e.arvores).toHaveLength(1);
    expect(e.arvores[0]?.spans).toBe(3);
    expect(e.orfaos).toBe(0);
  });

  it("de fora dá para nomear o salto que sumiu; de dentro da árvore, não", () => {
    const e = rodar(10, { "sem-instrumentacao": 3 });
    expect(e.saltosSemSpan).toContain("payments");
    // E o ledger continua na árvore, pendurado em quem não o chamou.
    expect(e.arvores[0]?.servicos).toContain("ledger");
    expect(e.arvores[0]?.servicos).not.toContain("payments");
  });
});

describe("a decisão de amostragem viaja, ou o desenho vira fragmento", () => {
  it("com a taxa em zero, nada chega: a decisão é da raiz e ela vale para todos", () => {
    const e = rodar(10, { "taxa-de-amostragem": 0 });
    expect(e.spansChegados).toBe(0);
  });

  it("cada um decidindo por si produz FRAGMENTO, e não excesso", () => {
    // Metade de uma árvore é pior que nenhuma: ela parece evidência.
    const e = rodar(20, { "taxa-de-amostragem": 0.5, "ignorar-amostragem": 1 });
    const incompletas = e.arvores.filter((a) => a.spans > 0 && a.spans < 4);
    expect(incompletas.length + e.orfaos).toBeGreaterThan(0);
  });
});

describe("não existe evento de fim de trace: o backend espera e desiste", () => {
  it("o painel mostra uma requisição que já assentou, e não a mais nova", () => {
    // A mais nova está sempre com um span no fio. Mostrá-la daria uma árvore
    // pela metade, e o leitor não teria como saber que a culpa é do relógio —
    // o lab acusaria um defeito que não existe.
    const world = new World(anatomiaWorld());
    world.advance(12);
    const e = estadoDaAnatomia(world.state);
    const maisNova = e.porServico[0]?.ultimaN ?? 0;
    expect(e.ultimaRequisicao).toBeLessThan(maisNova);
    expect(e.ultimaRequisicao).toBeGreaterThan(0);
    // E ela está inteira: é isso que a espera compra.
    expect(e.arvores[0]?.spans).toBe(4);
  });
});
