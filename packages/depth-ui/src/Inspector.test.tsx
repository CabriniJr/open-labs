import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Inspector, toInspectorLines } from "./Inspector.js";

describe("toInspectorLines", () => {
  it("achata um objeto em linhas com caminho", () => {
    const lines = toInspectorLines({ a: { b: 1 } });
    expect(lines).toEqual([
      { path: "", text: "{", depth: 0 },
      { path: "a", text: '"a": {', depth: 1 },
      { path: "a.b", text: '"b": 1', depth: 2 },
      { path: "a", text: "}", depth: 1 },
      { path: "", text: "}", depth: 0 },
    ]);
  });

  it("marca como alterada a linha cujo caminho está no diff", () => {
    const lines = toInspectorLines({ a: { b: 1 } }, ["a.b"]);
    expect(lines.find((l) => l.path === "a.b")?.changed).toBe(true);
    expect(lines.find((l) => l.path === "a")?.changed).toBeUndefined();
  });
});

describe("Inspector", () => {
  it("renderiza os valores do objeto", () => {
    render(<Inspector value={{ status: 200 }} changedPaths={[]} />);
    expect(screen.getByText(/"status": 200/)).toBeDefined();
  });

  it("marca visualmente as linhas alteradas", () => {
    const { container } = render(
      <Inspector value={{ status: 500 }} changedPaths={["status"]} />,
    );
    expect(container.querySelectorAll("[data-changed='true']")).toHaveLength(1);
  });
});
