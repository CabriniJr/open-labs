import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import manifest from "../data/imagens.manifest.json";
import credits from "../data/imagens.credits.json";
import { HANDBOOKS } from "../data/handbooks";

const assets = fileURLToPath(new URL("../assets/handbooks/", import.meta.url));
const files = existsSync(assets)
  ? readdirSync(assets, { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => relative(assets, join(e.parentPath, e.name)).replaceAll("\\", "/").replace(/\.jpg$/u, ""))
  : [];
const table = credits as Record<string, { file: string; alt: string; author: string; license: string; source: string }>;

describe("curated handbook images", () => {
  it("every file on disk has a credit, and every credit a file", () => {
    expect(files.sort()).toEqual(Object.keys(table).sort());
  });

  it("credits are what the manifest asked for — nothing stale, nothing missing", () => {
    expect(Object.keys(table).sort()).toEqual(Object.keys(manifest).sort());
    for (const [name, entry] of Object.entries(manifest as Record<string, { file: string }>)) expect(table[name]!.file).toBe(entry.file);
  });

  it("only licenses that allow reuse with attribution, with author, source and alt text", () => {
    for (const [name, c] of Object.entries(table)) {
      expect(c.license, name).toMatch(/^(CC BY(-SA)? [\d.]+|CC0|Public domain)/iu);
      expect(c.author.length, name).toBeGreaterThan(0);
      expect(c.source, name).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/u);
      expect(c.alt.length, name).toBeGreaterThan(15);
    }
  });

  it("a tidied credit keeps the author the API named", () => {
    for (const [name, c] of Object.entries(table as Record<string, { author: string; authorSource?: string }>)) {
      if (c.authorSource === undefined) continue;
      // Cada nome do crédito arrumado aparece no texto original da API.
      const words = c.author.replace(/\(.*?\)|derivative work|;|:/gu, " ").split(/\s+/u).filter((w) => w.length > 2);
      for (const word of words) expect(c.authorSource.toLowerCase(), name).toContain(word.toLowerCase());
    }
  });

  it("every alt text has its Portuguese version beside it", () => {
    for (const [name, entry] of Object.entries(manifest as Record<string, { altPt?: string }>)) expect(entry.altPt?.length ?? 0, name).toBeGreaterThan(15);
  });

  it("names point at a real handbook and phase", () => {
    for (const name of Object.keys(table)) {
      const [id, slot] = name.split("/");
      const handbook = HANDBOOKS.find((h) => h.id === id);
      expect(handbook, name).toBeDefined();
      if (slot === "hero") continue;
      const n = Number(/^phase-(\d+)$/u.exec(slot ?? "")?.[1]);
      expect(handbook!.phases.some((p) => p.number === n), name).toBe(true);
    }
  });

  it("stays light: no source image over 600 KB", () => {
    for (const name of files) expect(statSync(join(assets, `${name}.jpg`)).size, name).toBeLessThan(600_000);
  });
});
