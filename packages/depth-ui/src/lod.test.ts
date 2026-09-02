import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  EXPOENTE_DA_TINTA,
  LIMIAR_CHEIO,
  LIMIAR_ENTRA,
  PONTO_LEGIVEL,
  TINTA_LEGIVEL,
  encaixar,
  notacaoDeFechada,
  opacidadeDoRosto,
  quantoAparece,
  tabelaLegivel,
  tintaDoInterior,
} from "./lod.js";

describe("quanto do interior aparece", () => {
  it("longe, o interior não existe", () => {
    expect(quantoAparece(0)).toBe(0);
    expect(quantoAparece(LIMIAR_ENTRA)).toBe(0);
    expect(quantoAparece(LIMIAR_ENTRA - 0.001)).toBe(0);
  });

  it("perto, o interior está inteiro", () => {
    expect(quantoAparece(LIMIAR_CHEIO)).toBe(1);
    expect(quantoAparece(10)).toBe(1);
  });

  /** A rampa é a decisão: sem ela a descida volta a ser um corte. */
  it("no meio, os dois níveis coexistem", () => {
    const meio = quantoAparece((LIMIAR_ENTRA + LIMIAR_CHEIO) / 2);
    expect(meio).toBeCloseTo(0.5, 5);
  });

  it("cresce sem voltar atrás", () => {
    let anterior = -1;
    for (let f = 0; f <= 1; f += 0.01) {
      const agora = quantoAparece(f);
      expect(agora).toBeGreaterThanOrEqual(anterior);
      expect(agora).toBeGreaterThanOrEqual(0);
      expect(agora).toBeLessThanOrEqual(1);
      anterior = agora;
    }
  });

  it("um quadro de largura zero não vira NaN na tela", () => {
    expect(quantoAparece(Number.NaN)).toBe(0);
    expect(quantoAparece(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe("o encaixe do interior na caixa", () => {
  it("é uniforme: a proporção do esquemático não se perde", () => {
    // Caixa larga, moldura quadrada: quem aperta é a altura.
    const { escala, dx, dy } = encaixar({ w: 200, h: 50 }, { width: 100, height: 100 });
    expect(escala).toBe(0.5);
    expect(dx).toBe(75);
    expect(dy).toBe(0);
  });

  it("centra a folga, e não empurra para um canto", () => {
    const { dx, dy } = encaixar({ w: 100, h: 100 }, { width: 100, height: 50 });
    // 100/100 contra 100/50: aperta pela largura, sobra altura.
    expect(dx).toBe(0);
    expect(dy).toBe(25);
  });

  it("cabe inteiro: nada do interior fica fora da caixa", () => {
    for (const caixa of [
      { w: 30, h: 300 },
      { w: 300, h: 30 },
      { w: 77, h: 41 },
    ]) {
      const moldura = { width: 1100, height: 850 };
      const { escala, dx, dy } = encaixar(caixa, moldura);
      expect(dx).toBeGreaterThanOrEqual(-1e-9);
      expect(dy).toBeGreaterThanOrEqual(-1e-9);
      expect(moldura.width * escala + 2 * dx).toBeCloseTo(caixa.w, 6);
      expect(moldura.height * escala + 2 * dy).toBeCloseTo(caixa.h, 6);
    }
  });
});

describe("uma tabela dentro de uma caixa", () => {
  it("é legível bem antes de o interior de um contêiner aparecer", () => {
    // A vista de cima do caminho de dados: 1180 unidades de quadro. Nela a
    // memória ocupa um quinto da largura — longe do limiar do interior — e é
    // exatamente ali que se quer ver o que ela guarda.
    expect(tabelaLegivel(1180)).toBe(true);
    expect(quantoAparece(250 / 1180)).toBe(0);
  });

  it("some quando a linha ficaria menor que um traço", () => {
    // Um quadro de dez mil unidades é o desenho inteiro visto de muito longe:
    // ali a linha tem menos de um pixel, e desenhá-la seria sujeira.
    expect(tabelaLegivel(10_000)).toBe(false);
  });
});

describe("a tinta do interior sobe rápido, e sem degrau", () => {
  /*
    O piso está proibido pela spec §2: se o interior nunca descesse abaixo de
    0,4, ele saltaria de 0 para 0,4 no instante em que a rampa começa. Um piso é
    um degrau com outro nome, e degrau é justamente o que não pode existir.
  */
  it("as pontas não mentem", () => {
    expect(tintaDoInterior(0)).toBe(0);
    expect(tintaDoInterior(1)).toBe(1);
  });

  it("no primeiro sexto da rampa o interior já é legível", () => {
    // É a afirmação de legibilidade virando número: sem isto, "sobe rápido" é
    // opinião.
    expect(tintaDoInterior(0.15)).toBeGreaterThanOrEqual(TINTA_LEGIVEL);
  });

  it("cresce sem voltar atrás", () => {
    let anterior = -1;
    for (let a = 0; a <= 1; a += 0.01) {
      const agora = tintaDoInterior(a);
      expect(agora).toBeGreaterThanOrEqual(anterior);
      anterior = agora;
    }
  });

  it("fora da faixa, não inventa tinta", () => {
    expect(tintaDoInterior(-1)).toBe(0);
    expect(tintaDoInterior(2)).toBe(1);
  });

  it("o expoente é o que faz a curva subir, e ele é menor que 1", () => {
    // Com expoente 1 a curva é a reta de hoje, e o platô do fantasma volta.
    expect(EXPOENTE_DA_TINTA).toBeLessThan(1);
    expect(EXPOENTE_DA_TINTA).toBeGreaterThan(0);
  });
});

describe("a notação de fechada se desfaz na rampa", () => {
  it("no começo, é exatamente o que existe hoje", () => {
    const n = notacaoDeFechada(0);
    expect(n.tracejado).toBe("8 4");
    expect(n.preenchimento).toBe(1);
  });

  it("no fim, não resta marca de fechada nenhuma", () => {
    // Vão zero é traço contínuo, e preenchimento zero é contorno e nada mais:
    // a caixa chegou na `moldura`, que é uma forma que o sistema já tem.
    const n = notacaoDeFechada(1);
    expect(n.tracejado.split(" ")[1]).toBe("0");
    expect(n.preenchimento).toBe(0);
  });

  it("o vão do tracejado só encolhe", () => {
    let anterior = Number.POSITIVE_INFINITY;
    for (let a = 0; a <= 1; a += 0.01) {
      const vao = Number(notacaoDeFechada(a).tracejado.split(" ")[1]);
      expect(vao).toBeLessThanOrEqual(anterior);
      anterior = vao;
    }
  });

  it("o preenchimento só cede", () => {
    let anterior = Number.POSITIVE_INFINITY;
    for (let a = 0; a <= 1; a += 0.01) {
      const p = notacaoDeFechada(a).preenchimento;
      expect(p).toBeLessThanOrEqual(anterior);
      anterior = p;
    }
  });

  it("fora da faixa, não inventa notação", () => {
    expect(notacaoDeFechada(-1).preenchimento).toBe(1);
    expect(notacaoDeFechada(2).preenchimento).toBe(0);
  });
});

describe("as duas metades da mesma ligação andam juntas", () => {
  /*
    O invariante da spec §4. Ele não cobra números; cobra que não exista ponto
    algum da rampa em que a moldura diga uma coisa e o interior mostre outra.
  */
  it("onde a tinta sobe, a marca de fechada cai", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (x, y) => {
          const [menor, maior] = x <= y ? [x, y] : [y, x];
          const tintaSobe = tintaDoInterior(maior) >= tintaDoInterior(menor);
          const vaoCai =
            Number(notacaoDeFechada(maior).tracejado.split(" ")[1]) <=
            Number(notacaoDeFechada(menor).tracejado.split(" ")[1]);
          const preenchimentoCede =
            notacaoDeFechada(maior).preenchimento <= notacaoDeFechada(menor).preenchimento;
          return tintaSobe && vaoCai && preenchimentoCede;
        },
      ),
      { numRuns: 500 },
    );
  });

  it("nas pontas não há contradição", () => {
    // Fechada de verdade: nenhuma tinta no interior, notação de fechada inteira.
    expect(tintaDoInterior(0)).toBe(0);
    expect(notacaoDeFechada(0).preenchimento).toBe(1);
    // Aberta de verdade: interior inteiro, nenhuma marca de fechada.
    expect(tintaDoInterior(1)).toBe(1);
    expect(notacaoDeFechada(1).preenchimento).toBe(0);
    expect(Number(notacaoDeFechada(1).tracejado.split(" ")[1])).toBe(0);
  });

  it("o `more inside` sai antes de o interior ficar legível", () => {
    /*
      O critério da spec §3.3, e ele é o que resolve a contradição na tela: uma
      promessa de que há algo dentro, sobreposta ao dentro já desenhado, é a
      tela dizendo o contrário do que mostra.
    */
    expect(opacidadeDoRosto(PONTO_LEGIVEL)).toBe(0);
    expect(tintaDoInterior(PONTO_LEGIVEL)).toBeCloseTo(TINTA_LEGIVEL, 6);
    expect(opacidadeDoRosto(0)).toBe(1);
  });
});
