import { describe, expect, it } from "vitest";
import { World } from "@ovh/depth-core";
import { avaliar, lerExpressao, rpnWorld } from "./rpn.js";
import type { EstadoPilha, EstadoVisor, Token } from "./rpn.js";
import { conteudoDaCaixa } from "./conteudo.js";

function tokensDe(fonte: string): readonly Token[] {
  const r = lerExpressao(fonte);
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join("\n"));
  return r.tokens;
}

/** Roda até a máquina parar de mudar, ou até desistir. Devolve o visor. */
function rodar(fonte: string, limite = 400): { visor: EstadoVisor; ticks: number } {
  const tokens = tokensDe(fonte);
  const mundo = new World(rpnWorld(tokens));
  for (let i = 0; i < limite; i += 1) {
    mundo.advance(1);
    const visor = mundo.state.nodes.visor as EstadoVisor;
    const fita = mundo.state.nodes.fita as { readonly pos: number };
    const pilha = mundo.state.nodes.pilha as EstadoPilha;
    const acabou = fita.pos === tokens.length && pilha.itens.length === 1;
    if (acabou || visor.erro !== undefined) return { visor, ticks: i + 1 };
  }
  throw new Error(`a máquina não terminou "${fonte}" em ${limite} ticks`);
}

describe("ler a expressão", () => {
  it("recusa o que não fecha, dizendo qual símbolo", () => {
    const r = lerExpressao("3 +");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]?.posicao).toBe(2);
    expect(r.errors[0]?.message).toContain("two values");
  });

  it("recusa o que sobra na pilha", () => {
    const r = lerExpressao("1 2 3 +");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]?.message).toContain("leaves 2 values");
  });

  it("recusa o que não é número nem operador", () => {
    const r = lerExpressao("1 dois +");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]?.message).toContain("neither a whole number");
  });

  it("aceita negativos, que são número e não subtração", () => {
    expect(avaliar(tokensDe("-3 4 +"))).toBe(1);
  });
});

/**
 * O teste que sustenta a peça toda: a máquina composta tem que concordar com a
 * conta escrita de um jeito só.
 *
 * A armadilha que ele existe para pegar é de compasso, e não de aritmética:
 * dois operadores seguidos são dois resultados voltando pela borda de relógio,
 * e uma fita que andasse por conta própria daria o segundo operador à pilha
 * antes de o primeiro resultado ter chegado. A conta sairia errada **em
 * silêncio**, que é a única espécie de defeito que este projeto trata como
 * inaceitável.
 */
describe("a máquina composta concorda com a conta", () => {
  const casos = [
    "3 4 +",
    "3 4 + 2 *",
    "3 4 2 * +",
    "1 2 3 4 + + +",
    "3 4 + 2 5 + *",
    "20 3 /",
    "-7 2 *",
    "10 4 - 3 - 1 -",
  ];

  for (const fonte of casos) {
    it(`"${fonte}"`, () => {
      const esperado = avaliar(tokensDe(fonte));
      expect(esperado).toBeDefined();
      const { visor } = rodar(fonte);
      expect(visor.erro).toBeUndefined();
      expect(visor.resultados.at(-1)).toBe(esperado);
    });
  }

  it("expressão maior custa mais tempo, e é o trabalho que cobra", () => {
    expect(rodar("3 4 + 2 5 + *").ticks).toBeGreaterThan(rodar("3 4 +").ticks);
  });
});

describe("dividir por zero", () => {
  it("não vira zero: vira erro dito em voz alta, e a máquina para", () => {
    const { visor } = rodar("7 0 /");
    expect(visor.erro).toContain("7 / 0");
    expect(visor.resultados).toEqual([]);
  });
});

describe("o que cada caixa guarda", () => {
  it("a pilha mostra o topo em cima, marcado", () => {
    const tokens = tokensDe("3 4 + 2 *");
    const mundo = new World(rpnWorld(tokens));
    mundo.advance(12);
    const linhas = conteudoDaCaixa(mundo.state, tokens)("pilha") ?? [];
    expect(linhas.length).toBeGreaterThan(0);
    expect(linhas[0]?.chave).toBe("top");
    expect(linhas[0]?.ativo).toBe(true);
  });

  it("a fita mostra a expressão, e nada mais inventa tabela", () => {
    const tokens = tokensDe("3 4 +");
    const mundo = new World(rpnWorld(tokens));
    mundo.advance(3);
    const conteudo = conteudoDaCaixa(mundo.state, tokens);
    expect((conteudo("fita") ?? []).map((l) => l.valor)).toEqual(["3", "4", "+"]);
    expect(conteudo("despachante")).toBeUndefined();
  });
});
