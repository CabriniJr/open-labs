import { describe, expect, it } from "vitest";
import { DILATACAO_MAXIMA, PISO_DA_TRAVESSIA, dilatarPara, relogioDaCamada } from "./tempo.js";

describe("a dilatação por dimensão", () => {
  it("na superfície não dilata nada", () => {
    expect(dilatarPara(1, 1)).toBe(1);
  });

  it("mais fundo é mais devagar, na proporção da escala", () => {
    expect(dilatarPara(1, 0.5)).toBe(2);
    expect(dilatarPara(2, 0.5)).toBe(4);
  });

  /** Um interior minúsculo pediria a carga parada, que parece defeito. */
  it("tem teto", () => {
    expect(dilatarPara(1, 0.001)).toBe(DILATACAO_MAXIMA);
    expect(dilatarPara(DILATACAO_MAXIMA, 0.5)).toBe(DILATACAO_MAXIMA);
  });

  it("um interior maior que a caixa não acelera o tempo", () => {
    // Não acontece com encaixe uniforme, e se acontecer o certo é não mexer:
    // acelerar aqui seria inventar uma dimensão que o modelo não tem.
    expect(dilatarPara(1, 4)).toBe(1);
  });

  it("uma escala impossível não vira NaN na tela", () => {
    expect(dilatarPara(2, 0)).toBe(2);
    expect(dilatarPara(2, Number.NaN)).toBe(2);
  });
});

describe("o relógio de uma camada", () => {
  /**
   * A promessa do tick: quem tem mais eventos os tem mais curtos, e a sequência
   * inteira cabe dentro dele. Sem isso o leitor veria metade de uma acomodação.
   */
  it("divide o mesmo tick entre os eventos da camada", () => {
    expect(relogioDaCamada(900, 3, 1).etapaMs).toBe(300);
    expect(relogioDaCamada(900, 45, 1).etapaMs).toBe(20);
  });

  it("uma camada sem evento nenhum não divide por zero", () => {
    expect(relogioDaCamada(900, 0, 1).etapaMs).toBe(900);
  });

  /**
   * O piso é proporcional ao tick, e não fixo. Fixo, o controle de compasso
   * quase não mexia na viagem da carga: acelerar o mundo deixava o item
   * andando no mesmo passo, e o controle parecia quebrado.
   */
  it("a viagem responde ao compasso", () => {
    const devagar = relogioDaCamada(1800, 45, 1).travessiaMs;
    const rapido = relogioDaCamada(300, 45, 1).travessiaMs;
    expect(devagar).toBeGreaterThan(rapido * 2);
    expect(rapido).toBeCloseTo(300 * PISO_DA_TRAVESSIA, 5);
  });

  it("mais fundo, a carga atravessa mais devagar", () => {
    const raso = relogioDaCamada(900, 45, 1).travessiaMs;
    const fundo = relogioDaCamada(900, 45, 4).travessiaMs;
    expect(fundo).toBeGreaterThan(raso);
  });

  it("a travessia nunca pisa em mais de um tick por dimensão", () => {
    for (const dilatacao of [1, 2, 4, 8]) {
      for (const etapas of [1, 3, 45, 300]) {
        const { travessiaMs } = relogioDaCamada(900, etapas, dilatacao);
        expect(travessiaMs).toBeLessThanOrEqual(900 * dilatacao);
        expect(travessiaMs).toBeGreaterThan(0);
      }
    }
  });
});
