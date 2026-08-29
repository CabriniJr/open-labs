import { describe, expect, it } from "vitest";
import { familyOf } from "./model.js";
import type { Kind } from "./model.js";

describe("familyOf", () => {
  it("contêiner não é processador — organizar não é agir sobre a carga", () => {
    expect(familyOf("composite")).toBe("container");
    expect(familyOf("pipeline")).toBe("container");
  });

  it("separa cano, placa e processador", () => {
    expect(familyOf("channel")).toBe("conduit");
    expect(familyOf("static")).toBe("plate");
    expect(familyOf("source")).toBe("processor");
    expect(familyOf("router")).toBe("processor");
    expect(familyOf("buffer")).toBe("processor");
    expect(familyOf("sink")).toBe("processor");
  });

  it("todo kind tem família", () => {
    const todos: readonly Kind[] = [
      "composite", "pipeline", "source", "router",
      "buffer", "sink", "channel", "static",
    ];
    for (const k of todos) expect(familyOf(k)).toBeDefined();
  });
});
