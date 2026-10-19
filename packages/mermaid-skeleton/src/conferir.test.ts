import { World } from "@ovh/depth-core";
import type { WorldSpec, WorldState } from "@ovh/depth-core";
import { describe, expect, it } from "vitest";
import { compileSkeleton } from "./compile.js";
import { conferirDesenho, observarCanais, relatoDeDivergencias } from "./conferir.js";
import { parseSkeleton } from "./parse.js";
import type { NodeOverride } from "./compile.js";

/**
 * O desenho de prova: duas folhas e dois canais rotulados, um para cada forma
 * de mentira. Ele existe no mínimo necessário para que cada teste mude **uma**
 * coisa — o nome da porta ou o nome do kind — e nada mais.
 */
const DESENHO = `---
id: conferencia
title: Uma fonte que fala por duas portas
---
flowchart LR
  gen[gen]:::no
  a[a]:::no
  b[b]:::no

  gen -- "esq:carga" --> a
  gen -- "dir:aviso" --> b

  classDef no family:processor,kind:router
`;

/** Emite por `esq` e por `dir`, com os kinds que o desenho promete. */
const gerador: NodeOverride = {
  leaf: true,
  init: () => ({}),
  behavior: (state, _inbox, ctx) => ({
    state,
    out: [
      { port: "esq", message: ctx.emit("carga", 1) },
      { port: "dir", message: ctx.emit("aviso", 1) },
    ],
  }),
};

const recebe: NodeOverride = {
  leaf: true,
  init: () => ({ got: 0 }),
  behavior: (state, inbox) => ({
    state: { got: (state as { got: number }).got + inbox.length },
    out: [],
  }),
};

function montar(fonte: string, overrides: Record<string, NodeOverride>) {
  const p = parseSkeleton(fonte);
  if (!p.ok) throw new Error("parse falhou: " + p.errors.join("\n"));
  const c = compileSkeleton(p.value, { overrides });
  if (!c.ok) throw new Error("compile falhou: " + c.errors.join("\n"));
  return { sk: p.value, spec: c.world };
}

function rodar(spec: ReturnType<typeof montar>["spec"], ticks = 8): readonly WorldState[] {
  const world = new World(spec);
  const estados: WorldState[] = [];
  for (let i = 0; i < ticks; i += 1) {
    world.advance(1);
    estados.push(world.state);
  }
  return estados;
}

const OVERRIDES = { gen: gerador, a: recebe, b: recebe };

describe("conferirDesenho", () => {
  it("desenho honesto não acusa nada", () => {
    const { sk, spec } = montar(DESENHO, OVERRIDES);
    const divs = conferirDesenho(sk, spec, observarCanais(rodar(spec)));
    expect(divs, `\n${relatoDeDivergencias(divs)}`).toEqual([]);
  });

  it("acusa o fio que sai de porta onde nada é emitido", () => {
    // `esq` virou `esquerda` no desenho; o comportamento segue emitindo por
    // `esq`. É o erro de uma letra num rótulo.
    const { sk, spec } = montar(DESENHO.replace('"esq:carga"', '"esquerda:carga"'), OVERRIDES);
    const divs = conferirDesenho(sk, spec, observarCanais(rodar(spec)));
    expect(divs).toHaveLength(1);
    expect(divs[0]?.canal).toBe("gen.esquerda");
    expect(divs[0]?.problema).toBe("sem-trafego");
  });

  it("acusa o rótulo que nomeia outro kind", () => {
    const { sk, spec } = montar(DESENHO.replace('"dir:aviso"', '"dir:alarme"'), OVERRIDES);
    const divs = conferirDesenho(sk, spec, observarCanais(rodar(spec)));
    expect(divs).toHaveLength(1);
    expect(divs[0]?.canal).toBe("gen.dir");
    expect(divs[0]?.problema).toBe("kind-divergente");
    expect(divs[0]?.detalhe).toMatch(/declara "alarme" e viajou \["aviso"\]/u);
  });

  it("canal mudo é relatado UMA vez, e não duas", () => {
    // Sem tráfego não há kind para comparar. Acusar as duas coisas pelo mesmo
    // defeito faria o relato contar mentiras pela metade.
    const { sk, spec } = montar(DESENHO.replace('"esq:carga"', '"esquerda:outro"'), OVERRIDES);
    const divs = conferirDesenho(sk, spec, observarCanais(rodar(spec)));
    expect(divs).toHaveLength(1);
    expect(divs[0]?.problema).toBe("sem-trafego");
  });

  it("acha as duas mentiras quando as duas estão lá", () => {
    const fonte = DESENHO.replace('"esq:carga"', '"esquerda:carga"').replace(
      '"dir:aviso"',
      '"dir:alarme"',
    );
    const { sk, spec } = montar(fonte, OVERRIDES);
    const divs = conferirDesenho(sk, spec, observarCanais(rodar(spec)));
    expect(divs.map((d) => d.problema).sort()).toEqual(["kind-divergente", "sem-trafego"]);
  });

  it("rótulo sem kind não tem promessa a conferir", () => {
    // `"esq"` sem `:` é porta anônima pelo lado do kind: o parser lê o rótulo
    // inteiro como messageKind quando não há `:`, então o teste usa o caso em
    // que a porta é a padrão e o rótulo é só o kind.
    const fonte = `---
id: sem-kind
title: Um canal sem promessa
---
flowchart LR
  gen[gen]:::no
  a[a]:::no
  gen -- "carga" --> a

  classDef no family:processor,kind:router
`;
    const sem: NodeOverride = {
      leaf: true,
      init: () => ({}),
      behavior: (state, _inbox, ctx) => ({
        state,
        out: [{ port: "out", message: ctx.emit("carga", 1) }],
      }),
    };
    const { sk, spec } = montar(fonte, { gen: sem, a: recebe });
    const divs = conferirDesenho(sk, spec, observarCanais(rodar(spec)));
    expect(divs).toEqual([]);
  });
});

describe("a pré-condição de folhas", () => {
  /*
    `observarCanais` indexa por `item.from`, o emissor REAL — a folha lá no
    fundo. Um fio declarado saindo de um composto nunca casa com essa chave:
    quem emite por aquela porta é um filho, e a cadeia de bornes liga os dois.

    Medido na rodada em que isto nasceu: na CPU, 67 de 68 fios que a conta
    ingênua chamaria de mortos saem de composto e carregam carga normalmente.
    Sem a guarda, a conferência devolve uma lista de mentiras e a próxima pessoa
    a ler o teste acredita nela. Por isso ela levanta.
  */
  it("levanta quando um fio sai de composto, em vez de mentir", () => {
    // Montado à mão, e não pelo parser, porque o parser não deixa — é o que o
    // próximo teste prova. Este cobre o uso da conferência num `WorldSpec`
    // escrito em TS, que é como alguém a apontaria para um lab de CPU.
    const spec: WorldSpec = {
      id: "na-mao",
      seed: 1,
      root: {
        id: "raiz",
        kind: "composite",
        label: "raiz",
        children: [
          {
            id: "bloco",
            kind: "composite",
            label: "bloco",
            children: [{ id: "dentro", kind: "sink", label: "dentro", ...recebe }],
          },
          { id: "fora", kind: "sink", label: "fora", ...recebe },
        ],
      },
      wires: [{ from: "bloco", port: "saida", to: "fora" }],
      params: {},
    };
    const { sk } = montar(DESENHO, OVERRIDES);
    expect(() => conferirDesenho(sk, spec, new Map())).toThrow(/fio saindo de composto/u);
    expect(() => conferirDesenho(sk, spec, new Map())).toThrow(/bloco\.saida/u);
  });

  it("o parser não deixa um `.mmd` ligar fio num subgraph — nas DUAS ordens", () => {
    /*
      É isto que faz a pré-condição ser rede de segurança, e não a guarda
      principal, para o caminho do mmd: um composto só nasce de um `subgraph`,
      e `ensureNode` recusa id de aresta que já seja subgraph. Medido nas duas
      ordens, porque a checagem olha `ctx.subgraphs`, que é preenchido na
      leitura — a ordem inversa poderia escapar, e não escapa: ela cai em
      "colide com outro id já usado".

      Vale fixar aqui, e não só em `parse.test.ts`, porque é a premissa de que
      `conferirDesenho` depende. Se um dia o parser passar a aceitar, este teste
      cai junto com a razão escrita.
    */
    const subgraphAntes = `---
id: sub-antes
title: O subgraph vem antes da aresta
---
flowchart LR
  subgraph bloco[Bloco]
    direction LR
    dentro[dentro]:::no
  end
  fora[fora]:::no
  bloco -- "saida:carga" --> fora

  classDef no family:processor,kind:router
`;
    const subgraphDepois = `---
id: sub-depois
title: A aresta vem antes do subgraph
---
flowchart LR
  bloco -- "saida:carga" --> fora[fora]:::no
  subgraph bloco[Bloco]
    direction LR
    dentro[dentro]:::no
  end

  classDef no family:processor,kind:router
`;
    const antes = parseSkeleton(subgraphAntes);
    expect(antes.ok).toBe(false);
    if (!antes.ok) expect(antes.errors.join("\n")).toMatch(/"bloco" já é subgraph/u);

    const depois = parseSkeleton(subgraphDepois);
    expect(depois.ok).toBe(false);
    if (!depois.ok) expect(depois.errors.join("\n")).toMatch(/colide com outro id já usado/u);
  });

  it("não levanta por composto que não tem fio saindo dele", () => {
    // O caso da `anatomia`: a raiz é composta, e nenhum fio parte dela. Recusar
    // esse mundo tiraria a conferência justamente do lab que a motivou.
    const { sk, spec } = montar(DESENHO, OVERRIDES);
    expect(spec.root.children?.length).toBeGreaterThan(0);
    expect(() => conferirDesenho(sk, spec, observarCanais(rodar(spec)))).not.toThrow();
  });
});

describe("observarCanais", () => {
  it("lê flight, e não settled — comportamento de commit não aparece em settled", () => {
    const { spec } = montar(DESENHO, OVERRIDES);
    const estados = rodar(spec);
    expect(estados.every((e) => Object.keys(e.settled).length === 0)).toBe(true);
    const canais = observarCanais(estados);
    expect([...canais.keys()].sort()).toEqual(["gen.dir", "gen.esq"]);
  });

  it("acumula ao longo do run, e não só no último tick", () => {
    const { spec } = montar(DESENHO, OVERRIDES);
    expect(observarCanais(rodar(spec, 1)).size).toBeGreaterThan(0);
    expect(observarCanais([]).size).toBe(0);
  });
});
