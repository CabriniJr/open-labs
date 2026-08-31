import { describe, expect, it } from "vitest";
import { LIMIAR_CHEIO, LIMIAR_ENTRA, encaixar, quantoAparece, tabelaLegivel } from "./lod.js";

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
