import { describe, expect, it } from "vitest";
import { decidir, PORTA_DA_DECISAO, type Amostrador } from "./sampler.js";

describe("a decisão de amostragem tem três resultados, não dois", () => {
  it("AlwaysOn devolve record-and-sample", () => {
    expect(decidir({ tipo: "always-on" }, { aleatorio: 0.9 })).toBe("record-and-sample");
  });

  it("AlwaysOff devolve drop", () => {
    expect(decidir({ tipo: "always-off" }, { aleatorio: 0.1 })).toBe("drop");
  });

  it("razão 0.1 amostra o sorteio abaixo do limiar e descarta o resto", () => {
    expect(decidir({ tipo: "ratio", razao: 0.1 }, { aleatorio: 0.05 })).toBe("record-and-sample");
    expect(decidir({ tipo: "ratio", razao: 0.1 }, { aleatorio: 0.5 })).toBe("drop");
  });

  it("parent-based herda a decisão do pai remoto", () => {
    const s: Amostrador = { tipo: "parent-based", raiz: { tipo: "always-off" } };
    expect(decidir(s, { aleatorio: 0.9, paiAmostrado: true })).toBe("record-and-sample");
    expect(decidir(s, { aleatorio: 0.1, paiAmostrado: false })).toBe("drop");
  });

  it("sem pai, o parent-based cai na raiz dele", () => {
    const s: Amostrador = { tipo: "parent-based", raiz: { tipo: "always-on" } };
    expect(decidir(s, { aleatorio: 0.9 })).toBe("record-and-sample");
  });

  it("always-record converte drop em record-only, e é assim que a porta do meio acende", () => {
    const s: Amostrador = { tipo: "always-record", raiz: { tipo: "always-off" } };
    expect(decidir(s, { aleatorio: 0.9 })).toBe("record-only");
  });

  it("always-record não rebaixa o que a raiz já amostrou", () => {
    const s: Amostrador = { tipo: "always-record", raiz: { tipo: "always-on" } };
    expect(decidir(s, { aleatorio: 0.9 })).toBe("record-and-sample");
  });

  it("cada decisão tem porta própria — o desenho não pode confundir gravado com descartado", () => {
    expect(PORTA_DA_DECISAO["record-and-sample"]).toBe("sampled");
    expect(PORTA_DA_DECISAO["record-only"]).toBe("recorded");
    expect(PORTA_DA_DECISAO.drop).toBe("dropped");
  });

  it("as três portas são distintas — duas decisões na mesma porta seriam uma decisão só", () => {
    expect(new Set(Object.values(PORTA_DA_DECISAO)).size).toBe(3);
  });
});
