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

describe("placa (kind static)", () => {
  /*
    A placa entrou no catálogo nativo sem sintaxe nova, e a razão é que ela não
    precisava de nenhuma: o `ObjectSpec` de uma placa é `{ id, kind, label,
    leaf }` e nada mais — sem `init`, sem `behavior`, porque `indexTree` recusa
    placa que aja. O desenho já traz os três campos que sobram.

    A recusa anterior falava do conteúdo dela. Isso vale para conteúdo rico (um
    recurso com atributos, uma tabela de limites) — e esse conteúdo nunca
    chegou ao motor nem pelo caminho do TS: o `placa()` do lab dos provedores
    passa o título como `label` e para aí.
  */
  const comPlaca = `---
id: com-placa
title: Uma fonte, um sumidouro, e uma placa que ninguém atravessa
---
flowchart LR
  gen[gen]:::src
  out[out]:::snk
  recurso[Resource]:::nota
  gen -- "item" --> out

  classDef src  family:processor,kind:source
  classDef snk  family:processor,kind:sink
  classDef nota family:plate,kind:static
`;

  it("compila, e o mundo roda com a placa dentro", () => {
    const r = compile(comPlaca);
    expect(r.ok === false ? r.errors : []).toEqual([]);
    if (!r.ok) throw new Error("não compilou");
    expect(() => new World(r.world)).not.toThrow();
  });

  it("a placa é folha, sem init e sem behavior — placa que age não é placa", () => {
    const r = compile(comPlaca);
    if (!r.ok) throw new Error(r.errors.join("\n"));
    const placa = r.world.root.children?.find((c) => c.id === "recurso");
    expect(placa).toEqual({ id: "recurso", kind: "static", label: "Resource", leaf: true });
  });

  it("recusa fio que CHEGA na placa, dizendo o que placa é", () => {
    const r = compile(`---
id: fio-na-placa
title: Alguém ligou um fio na placa
---
flowchart LR
  gen[gen]:::src
  recurso[Resource]:::nota
  gen -- "item" --> recurso

  classDef src  family:processor,kind:source
  classDef nota family:plate,kind:static
`);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("devia recusar");
    expect(r.errors.join("\n")).toMatch(/placa "recurso"/u);
    expect(r.errors.join("\n")).toMatch(/nunca atravessado/u);
  });

  it("recusa fio que SAI da placa, que é o caso provadamente morto", () => {
    // Placa nunca tem behavior, então nunca emite: um fio saindo dela não
    // carregaria nada em nenhum tick. É recusável na compilação, sem run.
    const r = compile(`---
id: fio-da-placa
title: A placa virou fonte
---
flowchart LR
  recurso[Resource]:::nota
  out[out]:::snk
  recurso -- "item" --> out

  classDef snk  family:processor,kind:sink
  classDef nota family:plate,kind:static
`);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("devia recusar");
    expect(r.errors.join("\n")).toMatch(/fio sai da placa "recurso"/u);
  });

  it("a placa não entra na contagem de fios: ela não é fiada", () => {
    const r = compile(comPlaca);
    if (!r.ok) throw new Error(r.errors.join("\n"));
    expect(r.world.wires.every((w) => w.from !== "recurso" && w.to !== "recurso")).toBe(true);
  });
});
