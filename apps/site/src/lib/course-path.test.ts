import { describe, expect, it } from "vitest";
import { HANDBOOKS } from "../data/handbooks";
import { coursePath, positionOf } from "./course-path";

const otel = HANDBOOKS.find((h) => h.id === "otel")!;

describe("course path", () => {
  const path = coursePath(otel);

  it("walks phases in order, article before lab inside a phase", () => {
    const phases = path.available.map((s) => s.phase);
    expect(phases).toEqual([...phases].sort((a, b) => a - b));
    for (const phase of path.phases) {
      expect(phase.stops.map((s) => s.kind).join(",")).toMatch(/^(Article,?)*(Lab,?)*$/);
    }
  });

  it("only published stops with a link count, and ids never collide", () => {
    expect(path.available.every((s) => s.href && s.status === "available")).toBe(true);
    const ids = path.available.map((s) => `${s.key}|${s.progressId}`);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps the roadmap's legacy key and id for labs drawn on the map", () => {
    const pillars = path.available.find((s) => s.id === "three-pillars")!;
    expect(pillars.key).toBe(otel.map!.storageKey);
    expect(pillars.progressId).toBe("three-pillars");
    const article = path.available.find((s) => s.kind === "Article")!;
    expect(article.key).toBe("ovh:course:otel:v1");
    expect(article.progressId).toBe(`article:${article.id}`);
  });

  it("finds previous and next around the current page, and nothing outside the path", () => {
    const [first, second, third] = path.available;
    const middle = positionOf(path, second!.href!);
    expect(middle.previous).toBe(first);
    expect(middle.next).toBe(third);
    expect(middle.index).toBe(2);
    expect(positionOf(path, first!.href!).previous).toBeUndefined();
    expect(positionOf(path, path.available.at(-1)!.href!).next).toBeUndefined();
    expect(positionOf(path, "/nowhere/").current).toBeUndefined();
  });

  it("resolves hrefs through the site's base path", () => {
    const first = path.available[0]!;
    expect(positionOf(path, `/base${first.href}`, (h) => `/base${h}`).current).toBe(first);
  });
});
