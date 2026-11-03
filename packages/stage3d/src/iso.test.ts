import { line, pt } from "@ovh/motion";
import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { deslocamentoNoChao, distanciaParaCaber, distanciaPerspectivaParaCaber, ISO_AZIMUTE, ISO_ELEVACAO, meiaAlturaParaCaber, pontoNoAr, pontosDoCaminho, posicaoDaCamera } from "./iso.js";

describe("isometric camera", () => {
  it("keeps all eight scene corners inside perspective bounds across orbit angles and aspect ratios", () => {
    for (const aspect of [1, 16 / 9, 9 / 16]) for (const azimuth of [0, Math.PI / 4, Math.PI / 2, Math.PI]) {
      const d = distanciaPerspectivaParaCaber(1280, 720, aspect, azimuth);
      const camera = new PerspectiveCamera(40, aspect, 1, 8000);
      const pos = posicaoDaCamera({ x: 0, y: 0, z: 0 }, azimuth, ISO_ELEVACAO, d);
      camera.position.set(pos.x, pos.y, pos.z); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
      for (const x of [-640, 640]) for (const z of [-360, 360]) for (const y of [0, 64]) {
        const ndc = new Vector3(x, y, z).project(camera);
        expect(Math.abs(ndc.x)).toBeLessThanOrEqual(1.000001);
        expect(Math.abs(ndc.y)).toBeLessThanOrEqual(1.000001);
        expect(ndc.z).toBeGreaterThan(-1); expect(ndc.z).toBeLessThan(1);
      }
    }
  });

  it("frames a perspective lens with the same visible height", () => {
    const halfHeight = 400, fov = 40;
    const distance = distanciaParaCaber(halfHeight, fov);
    expect(distance * Math.tan(fov * Math.PI / 360)).toBeCloseTo(halfHeight);
    expect(distanciaParaCaber(800, fov)).toBeCloseTo(distance * 2);
  });

  it("maps a horizontal drag onto the camera's right axis without changing height", () => {
    const a = deslocamentoNoChao(30, 0, 0, ISO_ELEVACAO, 2);
    expect(a.x).toBe(-60); expect(a.z).toBe(0);
    const b = deslocamentoNoChao(30, 0, Math.PI / 2, ISO_ELEVACAO, 2);
    expect(b.x).toBeCloseTo(0); expect(b.z).toBeCloseTo(60);
  });
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
