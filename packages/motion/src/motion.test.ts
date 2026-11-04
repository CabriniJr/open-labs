import { describe, expect, it } from "vitest";
import { film } from "./choreography.js";
import { frameAt, viewBox } from "./frame.js";
import { arc, elbow, line, pathLength, poseAt, pt } from "./geometry.js";
import { sequence } from "./layout.js";
import { Timeline } from "./timeline.js";

describe("timeline", () => {
  it("holds the fallback before the first frame and interpolates between frames", () => {
    const tl = new Timeline();
    tl.add("a", "x", { t: 100, v: 0, ease: "step" });
    tl.add("a", "x", { t: 200, v: 10, ease: "linear" });
    expect(tl.sample("a", "x", 50, 7)).toBe(7);
    expect(tl.sample("a", "x", 150, 7)).toBe(5);
    expect(tl.sample("a", "x", 999, 7)).toBe(10);
  });

  it("switches text at the keyframe instead of blending it", () => {
    const tl = new Timeline();
    tl.add("a", "label", { t: 0, v: "one" });
    tl.add("a", "label", { t: 100, v: "two" });
    expect(tl.sample("a", "label", 99, "")).toBe("one");
    expect(tl.sample("a", "label", 100, "")).toBe("two");
  });

  it("is a pure function of time: seeking backwards gives the same value", () => {
    const tl = new Timeline();
    tl.add("a", "x", { t: 0, v: 0 });
    tl.add("a", "x", { t: 1000, v: 1 });
    const forward = [0, 250, 500, 750].map((t) => tl.sample("a", "x", t, 0));
    const backward = [750, 500, 250, 0].map((t) => tl.sample("a", "x", t, 0)).reverse();
    expect(backward).toEqual(forward);
  });
});

describe("geometry", () => {
  it("parametrises by arc length", () => {
    const p = line(pt(0, 0), pt(100, 0));
    expect(pathLength(p)).toBeCloseTo(100);
    expect(poseAt(p, 0.25).x).toBeCloseTo(25);
    expect(poseAt(p, 2).x).toBeCloseTo(100);
  });

  it("walks curves end to end", () => {
    for (const p of [arc(pt(0, 0), pt(100, 50)), elbow(pt(0, 0), pt(100, 80))]) {
      expect(poseAt(p, 0)).toMatchObject({ x: 0, y: 0 });
      const end = poseAt(p, 1);
      expect(end.x).toBeCloseTo(100);
    }
  });
});

describe("choreography", () => {
  const build = () => {
    const f = film<string>({ width: 400, height: 200, gap: 100 });
    f.add({ type: "node", id: "a", box: { x: 0, y: 0, w: 40, h: 20 }, label: "A" });
    f.add({ type: "node", id: "b", box: { x: 300, y: 0, w: 40, h: 20 }, hidden: true });
    f.add({ type: "token", id: "m", path: line(pt(40, 10), pt(300, 10)), hidden: true });
    f.chapter({ id: "one", title: "One", body: "first", detail: "d1" }, (d) => {
      d.send("m", { dur: 1000 });
      d.show("b", { dur: 200 });
    });
    f.chapter({ id: "two", title: "Two", body: "second" }, (d) => {
      d.together(
        (p) => p.glow("a", 1, { dur: 300, wait: true }),
        (p) => p.to("b", { dx: 50 }, { dur: 800 }),
      );
      d.beat({ title: "after", detail: "d2" });
      d.set("a", { label: "A′" });
      d.camera({ focus: ["b"], pad: 10 });
    });
    return f.build();
  };

  it("runs verbs in sequence and chapters back to back, with the gap between them", () => {
    const fm = build();
    expect(fm.chapters.map((c) => [c.start, c.end])).toEqual([
      [0, 1200],
      [1300, 3000],
    ]);
  });

  it("moves a token along its path and hides it on arrival", () => {
    const fm = build();
    const at = (t: number) => frameAt(fm, t).entities.find((e) => e.spec.id === "m")!.state;
    expect(at(0).opacity).toBe(0);
    expect(at(500).progress).toBeCloseTo(0.5, 1);
    expect(at(500).opacity).toBe(1);
    expect(at(1300).opacity).toBe(0);
  });

  it("runs `together` in parallel: the chapter waits for the longest verb", () => {
    const fm = build();
    const b = (t: number) => frameAt(fm, t).entities.find((e) => e.spec.id === "b")!.state;
    expect(b(1300 + 800).dx).toBeCloseTo(50);
    const a = frameAt(fm, 1300 + 300).entities.find((e) => e.spec.id === "a")!.state;
    expect(a.glow).toBeCloseTo(1);
  });

  it("carries the author's detail and steps to the frame", () => {
    const fm = build();
    expect(frameAt(fm, 10).detail).toBe("d1");
    expect(frameAt(fm, 1350).detail).toBe("d1");
    const later = frameAt(fm, 2200);
    expect(later.detail).toBe("d2");
    expect(later.step?.title).toBe("after");
    expect(later.entities.find((e) => e.spec.id === "a")!.state.label).toBe("A′");
  });

  it("frames the camera on its focus", () => {
    const fm = build();
    const end = frameAt(fm, fm.duration);
    const vb = viewBox(fm, end.camera);
    expect(vb.x).toBeLessThanOrEqual(350 - 10);
    expect(vb.x + vb.w).toBeGreaterThanOrEqual(390 + 10);
    expect(end.camera.zoom).toBeGreaterThan(1);
  });

  it("keeps each `together` track sequential inside", () => {
    const f = film({ width: 100, height: 100, gap: 0 });
    f.add({ type: "node", id: "a", box: { x: 0, y: 0, w: 10, h: 10 } });
    f.add({ type: "node", id: "b", box: { x: 0, y: 0, w: 10, h: 10 } });
    f.chapter({ id: "c", title: "c", body: "" }, (d) => {
      d.together(
        (x) => x.to("a", { dx: 10 }, { dur: 100 }).to("a", { dy: 10 }, { dur: 100 }),
        (x) => x.to("b", { dx: 10 }, { dur: 50 }),
      );
    });
    const fm = f.build();
    expect(fm.chapters[0]!.end).toBe(200);
    const a = frameAt(fm, 150).entities.find((e) => e.spec.id === "a")!.state;
    expect(a.dx).toBe(10);
    expect(a.dy).toBeGreaterThan(0);
    expect(a.dy).toBeLessThan(10);
  });

  it("refuses unknown and duplicate entities", () => {
    const f = film({ width: 10, height: 10 });
    f.add({ type: "note", id: "n", at: pt(0, 0) });
    expect(() => f.add({ type: "note", id: "n", at: pt(0, 0) })).toThrow(/twice/);
    expect(() => f.chapter({ id: "c", title: "c", body: "" }, (d) => d.show("ghost"))).toThrow(/Unknown/);
  });
});

describe("sequence layout", () => {
  it("spreads lanes across the width and draws messages between them", () => {
    const s = sequence({ lanes: ["a", "b", "c"], width: 600, margin: 20, headWidth: 100 });
    expect(s.x("a")).toBe(70);
    expect(s.x("c")).toBe(530);
    const m = s.message("a", "c", 0);
    expect(poseAt(m, 0).x).toBeGreaterThan(70);
    expect(poseAt(m, 1).x).toBeLessThan(530);
    expect(() => s.x("z")).toThrow();
  });
});
