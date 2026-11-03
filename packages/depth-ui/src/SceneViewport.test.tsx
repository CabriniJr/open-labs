import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SceneViewport } from "./SceneViewport.js";
import type { SpatialScene } from "./spatial.js";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const scene: SpatialScene = { width: 400, height: 200, paths: [], nodes: [{ id: "a", x: 20, y: 20, w: 80, h: 40, label: "Alpha", sublabel: "42" }] };

it("keeps the original diagram mounted and lazily builds spatial geometry", () => {
  const source = vi.fn(() => scene);
  render(<SceneViewport scene={source} label="Example"><svg data-testid="original"><text>Original</text></svg></SceneViewport>);
  const original = screen.getByTestId("original");
  expect(source).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Isometric" }));
  expect(source).toHaveBeenCalledTimes(1);
  expect(original.isConnected).toBe(true);
  expect(original.parentElement?.hidden).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "2D" }));
  expect(screen.getByTestId("original")).toBe(original);
  expect(original.parentElement?.hidden).toBe(false);
});

it("selects and opens the same model part from a spatial view", () => {
  const select = vi.fn(), open = vi.fn();
  render(<SceneViewport scene={scene} label="Example" onSelect={select} onOpen={open}><svg /></SceneViewport>);
  fireEvent.click(screen.getByRole("button", { name: "3D" }));
  const part = screen.getByRole("button", { name: "Alpha: 42" });
  fireEvent.click(part); expect(select).toHaveBeenCalledWith("a");
  fireEvent.keyDown(part, { key: "Enter" }); expect(open).toHaveBeenCalledWith("a");
});

it("camera keys do not reach a parent timeline and reset restores framing", () => {
  const parent = vi.fn();
  render(<div onKeyDown={parent}><SceneViewport scene={scene} label="Example"><svg /></SceneViewport></div>);
  fireEvent.click(screen.getByRole("button", { name: "3D" }));
  const view = screen.getByRole("img", { name: "Example" });
  const top = () => view.querySelector(".scene-node__top")?.getAttribute("points");
  const initial = top();
  fireEvent.keyDown(view, { key: "ArrowRight" });
  expect(top()).not.toBe(initial); expect(parent).not.toHaveBeenCalled();
  fireEvent.keyDown(view, { key: "0" }); expect(top()).toBe(initial);
});

it("interpolates an in-flight item without rebuilding the model or advancing its clock", () => {
  vi.spyOn(performance, "now").mockReturnValue(1000);
  let nextFrame: FrameRequestCallback | undefined;
  vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => { nextFrame = callback; return 1; }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const moving: SpatialScene = { ...scene, startedAt: 1000, markers: [{ id: "item", x: 20, y: 100, z: 10, next: { x: 350, y: 100, z: 10 }, duration: 1000 }] };
  const before = JSON.stringify(moving);
  const { container } = render(<SceneViewport scene={moving} label="Moving"><svg /></SceneViewport>);
  fireEvent.click(screen.getByRole("button", { name: "Isometric" }));
  const marker = container.querySelector(".scene-marker")!;
  expect(marker.getAttribute("transform")).toBe("translate(0 0)");
  act(() => { nextFrame?.(1500); });
  expect(marker.getAttribute("transform")).not.toBe("translate(0 0)");
  expect(JSON.stringify(moving)).toBe(before);
});
