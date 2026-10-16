import { World } from "@ovh/depth-core";
import type { WorldState } from "@ovh/depth-core";
import { describe, expect, it } from "vitest";
import { amostragemWorld, hashDoTrace } from "./world.js";
import { estadoDaAmostragem } from "./estado.js";
import type { EstadoDaAmostragem } from "./estado.js";

/**
 * O que estes testes cobram são as **três teses**, e cada uma só se prova
 * comparando dois regimes do mesmo mundo:
 *
 * 1. head sampling perde erro na proporção do tráfego, porque decide antes de o
 *    erro existir;
 * 2. tail sampling guarda todo erro que chega até ele — e cobra memória por
 *    isso;
 * 3. tail sampling com roteamento que não conhece trace entrega trace
 *    **quebrado**, que é pior que trace faltando.
 *
 * Nenhuma delas é afirmação de texto: todas são diferenças entre dois runs.
 */

const rodar = (params: Record<string, number> = {}, ticks = 40): EstadoDaAmostragem => {
  const world = new World(amostragemWorld(params));
  world.advance(ticks);
  return estadoDaAmostragem(world.state);
};

const estadoCru = (params: Record<string, number> = {}, ticks = 40): WorldState => {
  const world = new World(amostragemWorld(params));
  world.advance(ticks);
  return world.state;
};

describe("o mundo da amostragem", () => {
  it("é válido: nenhum fio solto, nenhum laço combinacional", () => {
    expect(() => new World(amostragemWorld())).not.toThrow();
  });

  it("o trace sai inteiro da aplicação, e o erro mora no último span", () => {
    /*
      A ordem é a tese inteira: se o erro estivesse no primeiro span, um head
      sampler poderia em princípio vê-lo. Ele está no último, que acontece
      depois da decisão — e isto é do modelo, não do texto da página.
    */
    const s = estadoCru({ "traces-por-tick": 1, "spans-por-trace": 3, "erro-a-cada": 2 }, 6);
    const app = s.nodes["app"] as { readonly tracesIniciados: number; readonly comErro: number };
    expect(app.tracesIniciados).toBeGreaterThan(0);
    // Um a cada dois: a conta fecha com o parâmetro, não com um número escrito.
    expect(app.comErro).toBe(Math.floor(app.tracesIniciados / 2));
  });

  it("sem amostragem nenhuma, nada é cortado e todo trace chega inteiro", () => {
    // A linha de base do lab: `head-mantem-1-em: 1` e `tail-mantem-1-em: 1`.
    const e = rodar({ "head-mantem-1-em": 1, "tail-mantem-1-em": 1 });
    expect(e.headCortados).toBe(0);
    expect(e.cortadosNoTail).toBe(0);
    expect(e.quebrados).toBe(0);
    expect(e.completos).toBeGreaterThan(0);
    expect(e.errosQuebrados).toBe(0);
  });
});

describe("tese 1: head sampling decide antes de o erro existir", () => {
  it("ligar o head corta TRACES COM ERRO, e o tail não tem como desfazer", () => {
    const sem = rodar({ "head-mantem-1-em": 1 });
    const com = rodar({ "head-mantem-1-em": 4 });

    expect(sem.errosCortadosNoHead).toBe(0);
    expect(com.errosCortadosNoHead).toBeGreaterThan(0);
    // E o que o backend tem de erro cai: o dado não chegou aos gateways.
    expect(com.errosInteiros).toBeLessThan(sem.errosInteiros);
  });

  it("a decisão é por TRACE: ou todos os spans passam, ou nenhum passa", () => {
    /*
      É o parent-based do sampler padrão, e é o que impede trace furado na
      origem. Verificável sem olhar desenho: todo trace que chegou ao backend
      com o head ligado chegou com todos os seus spans.
    */
    const e = rodar({ "head-mantem-1-em": 3, "rotear-por-trace": 1 });
    expect(e.completos).toBeGreaterThan(0);
    expect(e.quebrados).toBe(0);
  });

  it("a taxa do head é um HASH do id, e não o resto da divisão", () => {
    /*
      Esta é a guarda da armadilha que a primeira versão do lab tinha: com
      `trace % N` e "um erro a cada 4", pedir "1 em 4" guardava exatamente os
      traces com erro — o lab provaria o contrário do que ensina.

      A cobrança é direta: com as duas periodicidades alinhadas, o head tem de
      cortar erro. Se alguém trocar o hash por um resto de divisão, isto cai.
    */
    const e = rodar({ "head-mantem-1-em": 4, "erro-a-cada": 4 });
    expect(e.errosCortadosNoHead).toBeGreaterThan(0);
  });

  it("o embaralhador não é a identidade nem periódico no id", () => {
    const restos = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((n) => hashDoTrace(n * 4) % 4));
    // Múltiplos de 4 caindo em restos diferentes: é o que um resto de divisão
    // nunca faria.
    expect(restos.size).toBeGreaterThan(1);
  });
});

describe("tese 2: tail sampling guarda o erro, e cobra memória", () => {
  it("todo trace com erro que chega ao tail é mantido, por política", () => {
    const e = rodar({ "head-mantem-1-em": 1, "tail-mantem-1-em": 8, "rotear-por-trace": 1 });
    // Nenhum erro foi cortado no head, e o tail mantém todos os que decidiu.
    expect(e.errosCortadosNoHead).toBe(0);
    expect(e.mantidosPorErro).toBeGreaterThan(0);
    expect(e.errosInteiros).toBe(e.mantidosPorErro);
    // E ele cortou os sem erro: é amostragem, e não "guardar tudo".
    expect(e.cortadosNoTail).toBeGreaterThan(0);
  });

  it("a janela maior retém mais spans AGORA: o custo é um número do run", () => {
    const curta = rodar({ "espera-do-tail": 1 });
    const longa = rodar({ "espera-do-tail": 6 });
    expect(longa.retidosNoTail).toBeGreaterThan(curta.retidosNoTail);
  });

  it("o que o tail corta é contado por quem cortou, separado do head", () => {
    const e = rodar({ "head-mantem-1-em": 3, "tail-mantem-1-em": 6 });
    const quem = e.descartesPorQuem.map((d) => d.quem);
    expect(quem).toContain("head sampler");
    // Os dois gateways contam separados: somar apagaria onde a perda nasceu.
    expect(quem.some((q) => q.startsWith("gateway"))).toBe(true);
    expect(e.descartesTotal).toBeGreaterThan(0);
  });
});

describe("tese 3: sem roteamento por trace, o trace chega QUEBRADO", () => {
  it("rodízio por chegada parte traces entre os dois gateways", () => {
    const porTrace = rodar({ "rotear-por-trace": 1, "spans-por-trace": 3 });
    const porChegada = rodar({ "rotear-por-trace": 0, "spans-por-trace": 3 });

    expect(porTrace.quebrados).toBe(0);
    expect(porChegada.quebrados).toBeGreaterThan(0);
  });

  it("e o trace quebrado com erro é o defeito que ninguém reporta", () => {
    /*
      O pior resultado do lab, e é por isso que ele tem contador próprio: o
      trace está no backend, tem cara de trace completo, e o span que falhou
      não está nele. Em produção nada acusa isso — o backend não sabe quantos
      spans o trace tinha.
    */
    const e = rodar({ "rotear-por-trace": 0, "spans-por-trace": 3, "erro-a-cada": 2 });
    expect(e.errosQuebrados).toBeGreaterThan(0);
  });

  it("com um span por trace, o roteamento não muda nada — e isso é honesto", () => {
    /*
      A guarda contra provar demais: o defeito é do trace que tem mais de um
      span. Com um span só, não há o que partir, e os dois modos têm de dar o
      mesmo resultado. Se este teste reprovar, o modelo está quebrando traces
      por algum outro motivo.
    */
    const a = rodar({ "spans-por-trace": 1, "rotear-por-trace": 1 });
    const b = rodar({ "spans-por-trace": 1, "rotear-por-trace": 0 });
    expect(a.quebrados).toBe(0);
    expect(b.quebrados).toBe(0);
  });
});
