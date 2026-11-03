import { describe, expect, it } from "vitest";
import { DEFAULT_CAMERA, projector } from "./spatial.js";

describe("spatial projection", () => {
  it("uses an isometric camera: all three axes have the same scale", () => {
    const p = projector(1000, 1000, DEFAULT_CAMERA, false);
    const o = p({ x: 500, y: 500, z: 0 });
    const length = (q: ReturnType<typeof p>) => Math.hypot(q.x - o.x, q.y - o.y);
    const x = length(p({ x: 600, y: 500 }));
    expect(length(p({ x: 500, y: 600 }))).toBeCloseTo(x, 8);
    expect(length(p({ x: 500, y: 500, z: 100 }))).toBeCloseTo(x, 8);
  });

  it("perspective makes an equal segment smaller farther from the camera", () => {
    const p = projector(1000, 1000, { ...DEFAULT_CAMERA, yaw: 0 }, true);
    const width = (y: number) => Math.abs(p({ x: 600, y }).x - p({ x: 400, y }).x);
    expect(width(900)).toBeLessThan(width(100));
  });

  it("zoom and pan change only the screen coordinates, never depth", () => {
    const point = Object.freeze({ x: 20, y: 60, z: 25 });
    const a = projector(400, 200, DEFAULT_CAMERA, true)(point);
    const b = projector(400, 200, { ...DEFAULT_CAMERA, zoom: 2, panX: 30, panY: -20 }, true)(point);
    expect(b.x).toBeCloseTo(500 + (a.x - 500) * 2 + 30);
    expect(b.y).toBeCloseTo(290 + (a.y - 290) * 2 - 20);
    expect(b.depth).toBe(a.depth);
    expect(point).toEqual({ x: 20, y: 60, z: 25 });
  });

  it("keeps extreme scene proportions finite", () => {
    for (const [w, h] of [[0, 0], [10000, 1], [1, 10000]]) {
      for (const yaw of [-8, 0, 8]) {
        const p = projector(w!, h!, { ...DEFAULT_CAMERA, yaw, tilt: 1.35, zoom: 4 }, true);
        const q = p({ x: w!, y: h!, z: 50 });
        expect(Object.values(q).every(Number.isFinite)).toBe(true);
      }
    }
  });
});
