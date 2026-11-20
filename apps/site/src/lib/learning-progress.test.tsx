import { afterEach, describe, expect, it, vi } from "vitest";
import { PROGRESS_EVENT, readProgress, writeProgress } from "./learning-progress";

afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe("learning progress", () => {
  it("keeps existing roadmap IDs and filters invalid or duplicate entries", () => {
    localStorage.setItem("ovh:progress:v1", '["three-pillars",3,"three-pillars","providers"]');
    expect(readProgress("ovh:progress:v1")).toEqual(["three-pillars", "providers"]);
    localStorage.setItem("invalid", "not JSON");
    expect(readProgress("invalid")).toEqual([]);
  });
  it("notifies the roadmap and sidebar of changes in the same window", () => {
    const listener = vi.fn();
    window.addEventListener(PROGRESS_EVENT, listener);
    expect(writeProgress("course-a", ["article:a"])).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
    expect(readProgress("course-a")).toEqual(["article:a"]);
    expect(readProgress("course-b")).toEqual([]);
    window.removeEventListener(PROGRESS_EVENT, listener);
  });
  it("keeps session progress when browser storage refuses writes", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(writeProgress("blocked", ["lab:a"])).toBe(false);
    expect(readProgress("blocked")).toEqual(["lab:a"]);
    writeProgress("blocked", []);
    expect(readProgress("blocked")).toEqual([]);
  });
});
