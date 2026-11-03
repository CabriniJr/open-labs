import { line, pt } from "@ovh/motion";
import { describe, expect, it } from "vitest";
import { deslocamentoNoChao, ISO_AZIMUTE, ISO_ELEVACAO, meiaAlturaParaCaber, pontoNoAr, pontosDoCaminho, posicaoDaCamera } from "./iso.js";

describe("isometric camera", () => {
  it("sits on the 45° diagonal, at the true isometric elevation", () => {
    const c = posicaoDaCamera({ x: 0, y: 0, z: 0 }, ISO_AZIMUTE, ISO_ELEVACAO, 100);
    expect(c.x).toBeCloseTo(c.z);
    // Na isometria verdadeira as três componentes são iguais.
    expect(c.y).toBeCloseTo(c.x, 5);
    expect(Math.hypot(c.x, c.y, c.z)).toBeCloseTo(100);
  });

  it("fits a wide floor by width and a tall one by height", () => {
    const largo = meiaAlturaParaCaber(1000, 100, 16 / 9);
    const estreitaTela = meiaAlturaParaCaber(1000, 100, 1);
    expect(estreitaTela).toBeGreaterThan(largo);
  });

  it("keeps every floor corner inside the frame after orbiting", () => {
    for (const azimute of [0, Math.PI / 6, Math.PI / 2, Math.PI, 5 * Math.PI / 4]) {
      const w = 1200, h = 200, aspecto = 1.5;
      const meia = meiaAlturaParaCaber(w, h, aspecto, ISO_ELEVACAO, azimute);
      for (const x of [-w / 2, w / 2]) for (const z of [-h / 2, h / 2]) {
        const telaX = x * Math.cos(azimute) - z * Math.sin(azimute);
        const telaY = (x * Math.sin(azimute) + z * Math.cos(azimute)) * Math.sin(ISO_ELEVACAO);
        expect(Math.abs(telaX)).toBeLessThanOrEqual(meia * aspecto + 1e-6);
        expect(Math.abs(telaY)).toBeLessThanOrEqual(meia + 1e-6);
      }
    }
  });

  it("pans in screen directions even after a quarter orbit", () => {
    expect(deslocamentoNoChao(10, 0, 2, 0, ISO_ELEVACAO)).toEqual({ x: -20, z: 0 });
    const girado = deslocamentoNoChao(10, 0, 2, Math.PI / 2, ISO_ELEVACAO);
    expect(girado.x).toBeCloseTo(0);
    expect(girado.z).toBeCloseTo(20);
    const vertical = deslocamentoNoChao(0, 10, 1, 0, ISO_ELEVACAO);
    expect(vertical.z * Math.sin(ISO_ELEVACAO)).toBeCloseTo(-10);
  });
});

describe("paths in the air", () => {
  const p = line(pt(0, 0), pt(100, 50));
  it("maps stage y to world z and arcs between the ends", () => {
    expect(pontoNoAr(p, 0, 10, 30)).toMatchObject({ x: 0, y: 10, z: 0 });
    const meio = pontoNoAr(p, 0.5, 10, 30);
    expect(meio.y).toBeCloseTo(40);
    expect(meio.z).toBeCloseTo(25);
    expect(pontoNoAr(p, 1, 10, 30).y).toBeCloseTo(10);
  });

  it("samples only the drawn part of a path", () => {
    const metade = pontosDoCaminho(p, 0.5, 10);
    expect(metade.at(-1)!.x).toBeCloseTo(50);
  });
});
