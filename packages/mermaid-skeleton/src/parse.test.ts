import { describe, expect, it } from "vitest";
import { parseSkeleton } from "./parse.js";

const anatomy = `---
id: otel-anatomy
title: One request, four processes, four exports
seed: 1
levels: [flow]
params:
  requisicoes-por-tick: 1
---
flowchart LR
  edge([edge]):::source
  subgraph servicos[Serviços]
    direction LR
    gateway[gateway]:::servico
    checkout[checkout]:::servico
    payments[payments]:::servico
    ledger[ledger]:::servico
  end
  backend[(backend)]:::sink

  edge     -- "req" --> gateway
  gateway  -- "req" --> checkout
  checkout -- "req" --> payments
  payments -- "req" --> ledger

  gateway  -. "span" .-> backend
  checkout -. "span" .-> backend
  payments -. "span" .-> backend
  ledger   -. "span" .-> backend

  classDef source  family:processor,kind:source
  classDef servico family:processor,kind:pipeline
  classDef sink    family:processor,kind:sink
`;

describe("parseSkeleton", () => {
  it("aceita a anatomia inteira", () => {
    const r = parseSkeleton(anatomy);
    expect(r.ok === false ? r.errors : []).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("resolve o id e o title do front-matter", () => {
    const r = parseSkeleton(anatomy);
    if (!r.ok) throw new Error(r.errors.join("\n"));
    expect(r.value.id).toBe("otel-anatomy");
    expect(r.value.title).toBe("One request, four processes, four exports");
    expect(r.value.direction).toBe("LR");
  });

  it("preserva o front-matter sem interpretar", () => {
    const r = parseSkeleton(anatomy);
    if (!r.ok) throw new Error(r.errors.join("\n"));
    expect(r.value.frontMatter["params"]).toEqual({ "requisicoes-por-tick": 1 });
    expect(r.value.frontMatter["levels"]).toEqual(["flow"]);
  });

  it("põe os quatro serviços dentro do subgraph servicos", () => {
    const r = parseSkeleton(anatomy);
    if (!r.ok) throw new Error(r.errors.join("\n"));
    const dentro = r.value.nodes.filter((n) => n.parent === "servicos").map((n) => n.id);
    expect(dentro).toEqual(["gateway", "checkout", "payments", "ledger"]);
    const servicos = r.value.subgraphs.find((g) => g.id === "servicos");
    expect(servicos?.children).toEqual(["gateway", "checkout", "payments", "ledger"]);
    expect(servicos?.direction).toBe("LR");
  });

  it("resolve kind e family via classDef", () => {
    const r = parseSkeleton(anatomy);
    if (!r.ok) throw new Error(r.errors.join("\n"));
    const edge = r.value.nodes.find((n) => n.id === "edge")!;
    expect(edge.kind).toBe("source");
    expect(edge.family).toBe("processor");
    const gw = r.value.nodes.find((n) => n.id === "gateway")!;
    expect(gw.kind).toBe("pipeline");
    const bk = r.value.nodes.find((n) => n.id === "backend")!;
    expect(bk.kind).toBe("sink");
    expect(bk.shape).toBe("cylinder");
  });

  it("distingue linha de dado e de controle pela semântica do rótulo, não pelo traço", () => {
    const r = parseSkeleton(anatomy);
    if (!r.ok) throw new Error(r.errors.join("\n"));
    // Todas as arestas da anatomia carregam dado — as pontilhadas para o backend
    // são ênfase visual, não controle (§Nota 1 do exemplo).
    for (const e of r.value.edges) {
      expect(e.line).toBe("data");
    }
    const spanEdges = r.value.edges.filter((e) => e.messageKind === "span");
    expect(spanEdges).toHaveLength(4);
    expect(spanEdges.every((e) => e.stroke === "dotted")).toBe(true);
    const reqEdges = r.value.edges.filter((e) => e.messageKind === "req");
    expect(reqEdges).toHaveLength(4);
    expect(reqEdges.every((e) => e.stroke === "solid")).toBe(true);
  });

  it("interpreta rótulo com prefixo control: como linha de controle", () => {
    const fonte = `---
id: exemplo
title: Exemplo
---
flowchart LR
  clock -. "control:tick" .-> gate
`;
    const r = parseSkeleton(fonte);
    if (!r.ok) throw new Error(r.errors.join("\n"));
    expect(r.value.edges[0]?.line).toBe("control");
    expect(r.value.edges[0]?.messageKind).toBe("tick");
  });

  it("interpreta prefixo `porta:kind` como porta nomeada na origem", () => {
    const fonte = `---
id: exemplo
title: Exemplo
---
flowchart LR
  router -- "out:pago" --> aprovado
`;
    const r = parseSkeleton(fonte);
    if (!r.ok) throw new Error(r.errors.join("\n"));
    expect(r.value.edges[0]?.fromPort).toBe("out");
    expect(r.value.edges[0]?.messageKind).toBe("pago");
  });

  it("recusa kind fora do catálogo", () => {
    const fonte = `---
id: exemplo
title: Exemplo
---
flowchart LR
  a[a]:::x
  classDef x kind:foo
`;
    const r = parseSkeleton(fonte);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.join("\n")).toMatch(/kind "foo" não é do catálogo/);
  });

  it("recusa subgraph sem end", () => {
    const fonte = `---
id: x
title: X
---
flowchart LR
  subgraph g[G]
    a[a]
`;
    const r = parseSkeleton(fonte);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.join("\n")).toMatch(/sem "end"/);
  });

  it("recusa front-matter sem id", () => {
    const fonte = `---
title: Sem id
---
flowchart LR
  a --> b
`;
    const r = parseSkeleton(fonte);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.join("\n")).toMatch(/id/);
  });

  it("aceita o corpo dentro de uma cerca ```mermaid", () => {
    const fonte = `---
id: fenced
title: Fenced
---
\`\`\`mermaid
flowchart LR
  a --> b
\`\`\`
`;
    const r = parseSkeleton(fonte);
    expect(r.ok === false ? r.errors : []).toEqual([]);
  });
});
