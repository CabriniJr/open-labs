// packages/depth-core/src/validate.test.ts
import { describe, expect, it } from "vitest";
import { DROP } from "./model.js";
import type { ObjectSpec, WorldSpec } from "./model.js";
import { indexTree } from "./tree.js";
import { validateWorld } from "./validate.js";
import { World } from "./world.js";

const leaf = (id: string): ObjectSpec => ({
  id,
  kind: "sink",
  label: id,
  leaf: true,
  behavior: (state) => ({ state, out: [] }),
});

const base: WorldSpec = {
  id: "v",
  seed: 1,
  root: { id: "root", kind: "composite", label: "root", children: [leaf("a"), leaf("b")] },
  wires: [{ from: "a", port: "out", to: "b" }],
  params: {},
};

const validar = (spec: WorldSpec): void => {
  validateWorld(spec, indexTree(spec.root, spec.channels));
};

describe("validateWorld", () => {
  it("aceita um mundo bem formado", () => {
    expect(() => validar(base)).not.toThrow();
  });

  it("recusa fio que chega em quem não age, citando o id que sumiria a mensagem", () => {
    const spec: WorldSpec = {
      ...base,
      root: {
        id: "root",
        kind: "composite",
        label: "root",
        children: [leaf("a"), { id: "buraco", kind: "sink", label: "buraco", leaf: true }],
      },
      wires: [{ from: "a", port: "out", to: "buraco" }],
    };
    expect(() => validar(spec)).toThrow(/chega em "buraco", que não age/);
  });

  it("nomeia a folha de entrada quando o fio chega num contêiner que não age lá dentro", () => {
    const spec: WorldSpec = {
      ...base,
      root: {
        id: "root",
        kind: "composite",
        label: "root",
        children: [
          leaf("a"),
          {
            id: "caixa",
            kind: "pipeline",
            label: "caixa",
            children: [{ id: "buraco", kind: "sink", label: "buraco", leaf: true }],
          },
        ],
      },
      wires: [{ from: "a", port: "out", to: "caixa" }],
    };
    expect(() => validar(spec)).toThrow(/folha de entrada "buraco" não age/);
  });

  // A regra vive no fio, e não no nó, exatamente por causa deste caso: um
  // agrupamento decorativo não recebe mensagem de ninguém, logo não some com
  // nada. Escrita no nó ("toda folha de fluxo precisa de behavior"), ela
  // recusaria uma legenda.
  it("aceita agrupamento decorativo: contêiner de placas para onde nenhum fio aponta", () => {
    const spec: WorldSpec = {
      ...base,
      root: {
        id: "root",
        kind: "composite",
        label: "root",
        children: [
          leaf("a"),
          leaf("b"),
          {
            id: "legenda",
            kind: "composite",
            label: "legenda",
            children: [{ id: "nota", kind: "static", label: "nota" }],
          },
        ],
      },
    };
    expect(() => validar(spec)).not.toThrow();
  });

  it("recusa fio que parte de id inexistente", () => {
    expect(() => validar({ ...base, wires: [{ from: "fantasma", port: "out", to: "b" }] })).toThrow(
      /fio parte de "fantasma"/,
    );
  });

  it("recusa fio que chega em id inexistente, sem confundir com o descarte", () => {
    expect(() => validar({ ...base, wires: [{ from: "a", port: "out", to: "fantasma" }] })).toThrow(
      /fio chega em "fantasma"/,
    );
    expect(() => validar({ ...base, wires: [{ from: "a", port: "out", to: DROP }] })).not.toThrow();
  });

  it("recusa canal declarado num fio mas não indexado", () => {
    expect(() =>
      validar({ ...base, wires: [{ from: "a", port: "out", to: "b", channel: "pipe" }] }),
    ).toThrow(/canal "pipe"/);
  });

  it("aceita o canal quando ele está em WorldSpec.channels", () => {
    expect(() =>
      validar({
        ...base,
        channels: [{ id: "pipe", kind: "channel", label: "pipe", children: [leaf("dentro")] }],
        wires: [{ from: "a", port: "out", to: "b", channel: "pipe" }],
      }),
    ).not.toThrow();
  });

  it("recusa edgeTicks que faria a travessia sumir da tela", () => {
    expect(() => validar({ ...base, edgeTicks: 0 })).toThrow(/edgeTicks/);
    expect(() => validar({ ...base, edgeTicks: -1 })).toThrow(/edgeTicks/);
    expect(() => validar({ ...base, edgeTicks: 1.5 })).toThrow(/edgeTicks/);
    expect(() => validar({ ...base, edgeTicks: 1 })).not.toThrow();
  });

  it("recusa porta com os separadores do livro-caixa", () => {
    expect(() => validar({ ...base, wires: [{ from: "a", port: "in.weight", to: "b" }] })).toThrow(
      /separam campos no livro-caixa/,
    );
    expect(() => validar({ ...base, wires: [{ from: "a", port: "out:x", to: "b" }] })).toThrow(
      /separam campos no livro-caixa/,
    );
  });

  it("aceita duas linhas de dado saindo da mesma porta: leque é nativo", () => {
    // Até `f281ece` isto era recusado, porque o motor percorria só o primeiro
    // fio e o segundo virava desenho sem caminho. Agora ele percorre todos, e
    // recusar seria proibir uma saída que alimenta dois destinos — que é a
    // forma mais comum de esquemático que existe. Quem prova a entrega dupla é
    // `fanout.test.ts`; aqui só cai a recusa.
    const spec: WorldSpec = {
      ...base,
      root: {
        id: "root",
        kind: "composite",
        label: "root",
        children: [leaf("a"), leaf("b"), leaf("c")],
      },
      wires: [
        { from: "a", port: "out", to: "b" },
        { from: "a", port: "out", to: "c" },
      ],
    };
    expect(() => validar(spec)).not.toThrow();
  });

  it("a mesma porta pode ter uma linha de dado e uma de controle", () => {
    // A recusa é sobre carga, não sobre linhas: sinal e dado saindo do mesmo
    // lugar é justamente o que um controlador faz.
    expect(() =>
      validar({
        ...base,
        root: {
          id: "root",
          kind: "composite",
          label: "root",
          children: [leaf("a"), leaf("b"), leaf("c")],
        },
        wires: [
          { from: "a", port: "out", to: "b" },
          { from: "a", port: "out", to: "c", line: "control", toPort: "sel" },
        ],
      }),
    ).not.toThrow();
  });

  it("portas diferentes do mesmo objeto não se confundem", () => {
    expect(() =>
      validar({
        ...base,
        root: {
          id: "root",
          kind: "composite",
          label: "root",
          children: [leaf("a"), leaf("b"), leaf("c")],
        },
        wires: [
          { from: "a", port: "out", to: "b" },
          { from: "a", port: "erro", to: "c" },
        ],
      }),
    ).not.toThrow();
  });

  it("acumula todos os erros de uma vez: o autor não conserta em N rodadas", () => {
    const spec: WorldSpec = {
      ...base,
      edgeTicks: 0,
      root: {
        id: "root",
        kind: "composite",
        label: "root",
        children: [leaf("a"), { id: "buraco", kind: "sink", label: "buraco", leaf: true }],
      },
      wires: [
        { from: "fantasma", port: "out", to: "outro-fantasma" },
        { from: "a", port: "out", to: "buraco" },
      ],
    };
    let mensagem = "";
    try {
      validar(spec);
    } catch (erro) {
      mensagem = (erro as Error).message;
    }
    expect(mensagem).toMatch(/edgeTicks/);
    expect(mensagem).toMatch(/fio parte de "fantasma"/);
    expect(mensagem).toMatch(/fio chega em "outro-fantasma"/);
    expect(mensagem).toMatch(/chega em "buraco", que não age/);
  });
});

describe("World valida na construção", () => {
  it("recusa o mundo antes do primeiro tick, não em silêncio durante o run", () => {
    const spec: WorldSpec = {
      ...base,
      root: {
        id: "root",
        kind: "composite",
        label: "root",
        children: [leaf("a"), { id: "buraco", kind: "sink", label: "buraco", leaf: true }],
      },
    };
    expect(() => new World(spec)).toThrow(/mundo inválido/);
  });

  it("indexa os canais declarados: eles são arestas, mas existem na árvore", () => {
    const w = new World({
      ...base,
      channels: [{ id: "pipe", kind: "channel", label: "pipe", children: [leaf("dentro")] }],
      wires: [{ from: "a", port: "out", to: "b", channel: "pipe" }],
    });
    expect(w.tree.byId.has("pipe")).toBe(true);
    expect(w.tree.byId.has("dentro")).toBe(true);
  });
  it("recusa fio de controle sem toPort: sinal precisa de porta de destino nomeada", () => {
    // Carga entra num objeto e o motor acha a folha de entrada. Sinal não: ele
    // chega numa entrada nomeada, porque quem recebe precisa saber QUAL sinal é.
    expect(() =>
      validar({ ...base, wires: [{ from: "a", port: "out", to: "b", line: "control" }] }),
    ).toThrow(/linha de controle .* precisa de toPort/);
  });

  it("recusa carga entrando por um borne que o destino não tem", () => {
    // Antes toPort era proibido em linha de dado. Deixou de ser quando o
    // contêiner ganhou entradas nomeadas — mas entrar por um nome que não
    // existe continua sendo carga sumindo, e agora a mensagem diz quais existem.
    expect(() =>
      validar({ ...base, wires: [{ from: "a", port: "out", to: "b", toPort: "sel" }] }),
    ).toThrow(/não declara essa entrada/);
  });

  it("recusa toPort com os separadores do livro-caixa", () => {
    expect(() =>
      validar({
        ...base,
        wires: [{ from: "a", port: "out", to: "b", line: "control", toPort: "a.b" }],
      }),
    ).toThrow(/separam campos no livro-caixa/);
  });

  it("aceita linha de controle bem formada, inclusive em leque", () => {
    // Sinal em leque é a regra, não a exceção: um controle aciona vários.
    expect(() =>
      validar({
        ...base,
        root: {
          id: "root",
          kind: "composite",
          label: "root",
          children: [leaf("a"), leaf("b"), leaf("c")],
        },
        wires: [
          { from: "a", port: "out", to: "b" },
          { from: "a", port: "sel", to: "b", line: "control", toPort: "sel" },
          { from: "a", port: "sel", to: "c", line: "control", toPort: "sel" },
        ],
      }),
    ).not.toThrow();
  });

  it("recusa a mesma porta de saída com tempos diferentes", () => {
    // A porta é de um regime só. Sem isso, o ator não teria como saber, ao
    // emitir, se está na acomodação ou no confronto.
    expect(() =>
      validar({
        ...base,
        root: {
          id: "root",
          kind: "composite",
          label: "root",
          children: [leaf("a"), leaf("b"), leaf("c")],
        },
        wires: [
          { from: "a", port: "out", to: "b", timing: "settle" },
          { from: "a", port: "out", to: "c", timing: "clocked" },
        ],
      }),
    ).toThrow(/a porta "out" de "a" mistura tempos/);
  });

  it("recusa fio de controle que chega em quem não age", () => {
    // Sinal não atravessa contêiner: ele tem destinatário nomeado.
    const spec: WorldSpec = {
      ...base,
      root: {
        id: "root",
        kind: "composite",
        label: "root",
        children: [
          leaf("a"),
          leaf("b"),
          { id: "caixa", kind: "composite", label: "caixa", children: [leaf("dentro")] },
        ],
      },
      wires: [
        { from: "a", port: "out", to: "b" },
        { from: "a", port: "sel", to: "caixa", line: "control", toPort: "sel" },
      ],
    };
    expect(() => validar(spec)).toThrow(/sinal .* "caixa", que não age/);
  });
  it("recusa laço combinacional, nomeando a volta inteira", () => {
    // Em hardware isto é erro de projeto, e aqui seria um percurso que não
    // termina. Recusado na construção do mundo, que é onde a violação vira
    // impossível em vez de improvável.
    const spec: WorldSpec = {
      ...base,
      root: {
        id: "root",
        kind: "composite",
        label: "root",
        children: [leaf("a"), leaf("b")],
      },
      wires: [
        { from: "a", port: "out", to: "b", timing: "settle" },
        { from: "b", port: "out", to: "a", timing: "settle" },
      ],
    };
    expect(() => validar(spec)).toThrow(/laço combinacional/);
    expect(() => validar(spec)).toThrow(/a -> b -> a|b -> a -> b/);
  });

  it("aceita realimentação que atravessa uma borda de relógio", () => {
    // É o que um elemento de memória faz: fecha o laço, mas custando um tick. Recusar
    // isto proibiria qualquer máquina sequencial.
    expect(() =>
      validar({
        ...base,
        root: {
          id: "root",
          kind: "composite",
          label: "root",
          children: [leaf("a"), leaf("b")],
        },
        wires: [
          { from: "a", port: "out", to: "b", timing: "settle" },
          { from: "b", port: "out", to: "a", timing: "clocked" },
        ],
      }),
    ).not.toThrow();
  });

  it("recusa sequencer com aresta de dado na saída", () => {
    const spec: WorldSpec = {
      ...base,
      root: {
        id: "root",
        kind: "composite",
        label: "root",
        children: [
          { id: "uc", kind: "sequencer", label: "uc", leaf: true, behavior: (state) => ({ state, out: [] }) },
          leaf("alvo"),
        ],
      },
      // sem `line: "control"`, esta é uma linha de dado
      wires: [{ from: "uc", port: "out", to: "alvo" }],
    };
    expect(() => validar(spec)).toThrow(/sequencer/);
  });

  it("aceita sequencer que só emite por linha de controle", () => {
    const spec: WorldSpec = {
      ...base,
      root: {
        id: "root",
        kind: "composite",
        label: "root",
        children: [
          { id: "uc", kind: "sequencer", label: "uc", leaf: true, behavior: (state) => ({ state, out: [] }) },
          leaf("alvo"),
        ],
      },
      wires: [{ from: "uc", port: "op", to: "alvo", line: "control", toPort: "op" }],
    };
    expect(() => validar(spec)).not.toThrow();
  });
});
