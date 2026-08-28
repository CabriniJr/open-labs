import { Engine } from "@ovh/depth-core";
import { describe, expect, it } from "vitest";
import { heroScenario } from "./scenario.js";

describe("heroScenario", () => {
  it("declara os níveis flow e payload", () => {
    expect(heroScenario.levels).toEqual(["flow", "payload"]);
  });

  it("começa sem spans emitidos", () => {
    const e = new Engine(heroScenario, { propagate: true });
    expect(e.state.spans).toEqual([]);
  });

  it("com propagação ligada, o span filho aponta para o pai", () => {
    const e = new Engine(heroScenario, { propagate: true });
    e.advance(20);
    const [root, child] = e.state.spans;
    expect(root).toBeDefined();
    expect(child).toBeDefined();
    expect(child!.parentSpanId).toBe(root!.spanId);
    expect(child!.traceId).toBe(root!.traceId);
  });

  it("com propagação desligada, o filho vira raiz de outro trace", () => {
    const e = new Engine(heroScenario, { propagate: false });
    e.advance(20);
    const [root, child] = e.state.spans;
    expect(child!.parentSpanId).toBeUndefined();
    expect(child!.traceId).not.toBe(root!.traceId);
  });

  it("o header transportado é um traceparent válido quando há propagação", () => {
    const e = new Engine(heroScenario, { propagate: true });
    e.advance(12);
    expect(e.state.header).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });

  it("não transporta header quando a propagação está desligada", () => {
    const e = new Engine(heroScenario, { propagate: false });
    e.advance(12);
    expect(e.state.header).toBeNull();
  });

  it("é determinístico", () => {
    const a = new Engine(heroScenario, { propagate: true });
    const b = new Engine(heroScenario, { propagate: true });
    a.advance(30);
    b.advance(30);
    expect(a.state).toEqual(b.state);
  });
});
