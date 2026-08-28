import { describe, expect, it } from "vitest";
import { findViolations } from "./check-boundaries.mjs";

describe("findViolations", () => {
  it("aceita um arquivo agnóstico", () => {
    const source = "export function render(node) { return node.label; }";
    expect(findViolations("packages/depth-ui/src/Node.tsx", source)).toEqual([]);
  });

  it("permite elementos <span> em HTML/JSX", () => {
    const source = 'export const Label = () => <span className="label">x</span>;';
    expect(findViolations("packages/depth-ui/src/Label.tsx", source)).toEqual([]);
  });

  it("acusa import do pacote de domínio", () => {
    const source = 'import { parseTraceparent } from "@ovh/otel-domain";';
    const violations = findViolations("packages/depth-core/src/engine.ts", source);
    expect(violations).toHaveLength(1);
    expect(violations[0].reason).toContain("@ovh/otel-domain");
  });

  it("acusa vocabulário de domínio", () => {
    const source = "// o OTLP chega aqui\nexport const x = 1;";
    const violations = findViolations("packages/depth-core/src/engine.ts", source);
    expect(violations).toHaveLength(1);
    expect(violations[0].reason).toContain("otlp");
  });

  it("ignora arquivos fora dos pacotes agnósticos", () => {
    const source = 'import { parseTraceparent } from "@ovh/otel-domain";';
    expect(findViolations("apps/site/src/labs/hero/scenario.ts", source)).toEqual([]);
  });
});
