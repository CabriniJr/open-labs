import { describe, expect, it } from "vitest";
import { findViolations, verdict } from "./check-boundaries.mjs";

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

  it("vigia o formato do modelo, que também é agnóstico", () => {
    const found = findViolations(
      "packages/model-format/src/compile.ts",
      "// o collector chega aqui",
    );
    expect(found).toHaveLength(1);
  });

  it("não acusa o vocabulário do formato", () => {
    const found = findViolations(
      "packages/model-format/src/schema.ts",
      "const port = { role: 'data', direction: 'drop' }; // fio, kind, parâmetro",
    );
    expect(found).toEqual([]);
  });

  it("ignora arquivos fora dos pacotes agnósticos", () => {
    const source = 'import { parseTraceparent } from "@ovh/otel-domain";';
    expect(findViolations("apps/site/src/labs/hero/scenario.ts", source)).toEqual([]);
  });
});

describe("guarda ampliada: protocolo também é domínio", () => {
  it("acusa gRPC no motor", () => {
    const found = findViolations("packages/depth-core/src/x.ts", "// fala grpc aqui");
    expect(found).toHaveLength(1);
  });

  it("acusa spanprocessor no motor", () => {
    const found = findViolations("packages/depth-core/src/x.ts", "const spanprocessor = 1;");
    expect(found).toHaveLength(1);
  });

  it("acusa sampler no motor", () => {
    const found = findViolations("packages/depth-ui/src/x.tsx", "// o sampler decide");
    expect(found).toHaveLength(1);
  });

  it("não acusa vocabulário do motor", () => {
    const found = findViolations(
      "packages/depth-core/src/x.ts",
      "const kind = 'pipeline'; // router, buffer, composite",
    );
    expect(found).toEqual([]);
  });
});

describe("verdict: um verde precisa ter lido alguma coisa", () => {
  it("falha quando nenhum arquivo foi varrido, dizendo onde rodar", () => {
    const { code, report } = verdict(0, []);
    expect(code).toBe(1);
    expect(report).toMatch(/nenhum arquivo casou/);
    expect(report).toMatch(/diretório errado/);
  });

  it("imprime quantos arquivos foram varridos no sucesso", () => {
    const { code, report } = verdict(23, []);
    expect(code).toBe(0);
    expect(report).toBe("Fronteira motor↔domínio intacta (23 arquivos).");
  });

  it("a violação vence a contagem", () => {
    const { code, report } = verdict(23, [
      { filePath: "packages/depth-core/src/x.ts", reason: 'usa vocabulário de domínio "otlp"' },
    ]);
    expect(code).toBe(1);
    expect(report).toMatch(/depth-core\/src\/x\.ts/);
  });
});
