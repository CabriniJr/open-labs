import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { STATIC_HOST, STATIC_LABS } from "./index.js";
it("as versões do host correspondem aos runtimes compilados e as três formas têm caso concreto", () => {
  const host = JSON.parse(readFileSync(new URL("../../../apps/runner/package.json", import.meta.url), "utf8"));
  expect(STATIC_HOST.version).toBe(host.version);
  for (const runtime of STATIC_HOST.runtimes) {
    const pkg = JSON.parse(readFileSync(new URL(`../../${runtime.id}/package.json`, import.meta.url), "utf8"));
    expect(runtime.version).toBe(pkg.version);
  }
  expect(new Set(STATIC_LABS.map((l) => l.interaction.kind))).toEqual(new Set(["flow", "state", "direct"]));
});
