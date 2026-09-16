import { World } from "@ovh/depth-core";
import { describe, expect, it } from "vitest";
import { compileSkeleton } from "./compile.js";
import { parseSkeleton } from "./parse.js";

function compile(source: string, opts: Parameters<typeof compileSkeleton>[1] = {}) {
  const p = parseSkeleton(source);
  if (!p.ok) throw new Error("parse falhou: " + p.errors.join("\n"));
  return compileSkeleton(p.value, opts);
}

const trivial = `---
id: pipeline-simples
title: Fonte enche a fila e a fila esvazia
params:
  queue_capacity: 4
---
flowchart LR
  gen[gen]:::src
  q[q]:::buf
  out[out]:::snk
  gen -- "item" --> q
  q   -- "item" --> out
  q   -- "item" --> descarte[descarte]:::snk

  classDef src family:processor,kind:source
  classDef buf family:processor,kind:buffer
  classDef snk family:processor,kind:sink
`;

describe("compileSkeleton", () => {
  it("compila um source→buffer→sink e o motor roda o mundo por 5 ticks", () => {
    const r = compile(trivial, {
      args: {
        gen: { rate: 2 },
        q: { capacity: { param: "queue_capacity" }, drain: 1 },
      },
    });
    expect(r.ok === false ? r.errors : []).toEqual([]);
    if (!r.ok) return;

    expect(r.world.id).toBe("pipeline-simples");
    expect(r.world.params).toEqual({ queue_capacity: 4 });
    expect(r.world.root.kind).toBe("composite");
    expect(r.world.root.children?.map((c) => c.id)).toEqual(["gen", "q", "out", "descarte"]);

    const w = new World(r.world);
    w.advance(5);
    expect(w.tick).toBe(5);
  });

  it("resolve porta drop do buffer quando declarada explicitamente", () => {
    const r = compile(trivial);
    if (!r.ok) throw new Error(r.errors.join("\n"));
    const wireDrop = r.world.wires.find((w) => w.to === "descarte");
    // Porta padrão da primeira saída é `out`; para `drop` o autor tem que dizer
    // com o prefixo do rótulo — o `-- "item" --> descarte` sem prefixo pega `out`.
    // Este teste guarda a decisão: nenhum silêncio, autor pede `drop`.
    expect(wireDrop?.port).toBe("out");
  });

  it("aceita `drop:` no rótulo como porta explícita do buffer", () => {
    const fonte = `---
id: com-drop
title: Buffer descarta pela porta drop
---
flowchart LR
  gen[gen]:::src
  q[q]:::buf
  ok[ok]:::snk
  lixo[lixo]:::snk
  gen -- "item" --> q
  q   -- "out:item"  --> ok
  q   -- "drop:item" --> lixo

  classDef src family:processor,kind:source
  classDef buf family:processor,kind:buffer
  classDef snk family:processor,kind:sink
`;
    const r = compile(fonte);
    expect(r.ok === false ? r.errors : []).toEqual([]);
    if (!r.ok) return;
    expect(r.world.wires.find((w) => w.to === "ok")?.port).toBe("out");
    expect(r.world.wires.find((w) => w.to === "lixo")?.port).toBe("drop");
  });

  it("subgraph vira composite recursivo", () => {
    const fonte = `---
id: com-subgraph
title: Um grupo no meio
---
flowchart LR
  gen[gen]:::src
  subgraph mid[Meio]
    q[q]:::buf
  end
  out[out]:::snk
  gen -- "item" --> q
  q   -- "item" --> out

  classDef src family:processor,kind:source
  classDef buf family:processor,kind:buffer
  classDef snk family:processor,kind:sink
`;
    const r = compile(fonte);
    expect(r.ok === false ? r.errors : []).toEqual([]);
    if (!r.ok) return;
    const mid = r.world.root.children?.find((c) => c.id === "mid");
    expect(mid?.kind).toBe("composite");
    expect(mid?.children?.map((c) => c.id)).toEqual(["q"]);
    // Nós de topo: gen, mid (composite com q dentro), out
    expect(r.world.root.children?.map((c) => c.id)).toEqual(["gen", "mid", "out"]);
  });

  it("recusa kind fora do catálogo do compilador", () => {
    const fonte = `---
id: com-router
title: Router ainda não
---
flowchart LR
  a[a]:::src
  r[r]:::rt
  b[b]:::snk
  a -- "item" --> r
  r -- "item" --> b
  classDef src family:processor,kind:source
  classDef rt  family:processor,kind:router
  classDef snk family:processor,kind:sink
`;
    const r = compile(fonte);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.join("\n")).toMatch(/router/);
  });

  it("recusa nó sem classDef aplicado (kind indefinido)", () => {
    const fonte = `---
id: sem-kind
title: X
---
flowchart LR
  a[a]
  b[b]:::snk
  a -- "item" --> b
  classDef snk family:processor,kind:sink
`;
    const r = compile(fonte);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.join("\n")).toMatch(/nó "a" não tem kind/);
  });

  it("recusa fio de controle para folha (nenhum kind atual tem porta de controle)", () => {
    const fonte = `---
id: com-controle
title: Controle
---
flowchart LR
  gen[gen]:::src
  q[q]:::buf
  gen -. "control:tick" .-> q
  classDef src family:processor,kind:source
  classDef buf family:processor,kind:buffer
`;
    const r = compile(fonte);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.join("\n")).toMatch(/porta de controle/);
  });

  it("params numéricos do front-matter chegam em WorldSpec.params", () => {
    const r = compile(trivial);
    if (!r.ok) throw new Error(r.errors.join("\n"));
    expect(r.world.params).toEqual({ queue_capacity: 4 });
  });

  it("recusa param não-numérico com mensagem clara", () => {
    const fonte = `---
id: bad-param
title: X
params:
  taxa: "1s"
---
flowchart LR
  a[a]:::src
  b[b]:::snk
  a -- "item" --> b
  classDef src family:processor,kind:source
  classDef snk family:processor,kind:sink
`;
    const r = compile(fonte);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.join("\n")).toMatch(/precisa ser número/);
  });

  it("recusa aresta partindo de nó inexistente", () => {
    const p = parseSkeleton(`---
id: bad-edge
title: X
---
flowchart LR
  a[a]:::src --> b[b]:::snk
  classDef src family:processor,kind:source
  classDef snk family:processor,kind:sink
`);
    if (!p.ok) throw new Error(p.errors.join("\n"));
    // Injeta uma aresta órfã pra provar o path de erro.
    const bad = {
      ...p.value,
      edges: [
        ...p.value.edges,
        { from: "fantasma", to: "a", label: null, stroke: "solid" as const, line: "data" as const, fromPort: null, toPort: null, messageKind: null },
      ],
    };
    const r = compileSkeleton(bad);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.join("\n")).toMatch(/parte de "fantasma"/);
  });
});
