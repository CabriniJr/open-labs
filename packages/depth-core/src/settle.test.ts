// packages/depth-core/src/settle.test.ts
import { describe, expect, it } from "vitest";
import { initialWorld, stepWorld } from "./scheduler.js";
import { spec } from "./settle.test-fixture.js";
import { indexTree } from "./tree.js";

const tree = indexTree(spec.root);

function rodar(ticks: number) {
  let estado = initialWorld(tree);
  for (let i = 0; i < ticks; i += 1) estado = stepWorld(spec, tree, estado, spec.params);
  return estado;
}

describe("fase de acomodação", () => {
  it("atravessa dois estágios combinacionais dentro do mesmo tick", () => {
    // A fonte emite no tick 1 e a mensagem chega em "a" no tick 2 (edgeTicks 1).
    // Aí ela atravessa a -> b -> acc SEM custar tick nenhum: no fim do tick 2 o
    // acumulador já viu 0 + 1 + 1 = 2.
    expect((rodar(2).nodes.acc as { ultimo: number }).ultimo).toBe(2);
  });

  it("o que acomoda não guarda: o estado devolvido na acomodação é descartado", () => {
    // "a" e "b" não declaram init, então o estado deles é o objeto vazio da
    // construção. Se a acomodação escrevesse estado, isto mudaria.
    const estado = rodar(4);
    expect(estado.nodes.a).toEqual({});
    expect(estado.nodes.b).toEqual({});
  });

  it("mensagem que acomoda não fica em trânsito: ela chegou dentro do tick", () => {
    const emVoo = rodar(3).flight.map((f) => `${f.from}->${f.to}`);
    expect(emVoo).not.toContain("a->b");
    expect(emVoo).not.toContain("b->acc");
  });

  it("o livro-caixa conta a acomodação como tráfego normal de porta", () => {
    // Acomodar não é ficar invisível: quem emitiu, emitiu.
    const estado = rodar(3);
    expect(estado.ledger["out:a.out"]).toBeGreaterThan(0);
    expect(estado.ledger["in:acc"]).toBeGreaterThan(0);
  });

  it("substeps conta a profundidade do caminho combinacional deste tick", () => {
    // a (0) -> b (1) -> acc (2): três níveis, então três subpassos.
    expect(rodar(2).substeps).toBe(3);
  });

  it("mundo sem aresta acomodada tem zero subpassos e não muda de comportamento", () => {
    const semAcomodar = {
      ...spec,
      wires: spec.wires.map((w) => ({ ...w, timing: "clocked" as const })),
    };
    let estado = initialWorld(tree);
    for (let i = 0; i < 3; i += 1) estado = stepWorld(semAcomodar, tree, estado, spec.params);
    expect(estado.substeps).toBe(0);
  });

  it("diz em que subpasso cada objeto rodou, e é a profundidade dele no caminho", () => {
    // Sem isto, mostrar a acomodação acontecendo dentro do tick exigiria que o
    // desenho adivinhasse a ordem — o que é a mesma coisa que inventá-la.
    const estado = rodar(2);
    expect(estado.substepOf.a).toBe(0);
    expect(estado.substepOf.b).toBe(1);
    expect(estado.substepOf.acc).toBe(2);
    // quem não participou da acomodação não aparece: não é zero, é ausente
    expect(estado.substepOf.fonte).toBeUndefined();
  });
});

describe("o que a acomodação emitiu fica observável", () => {
  it("guarda o valor que saiu, e não só quantas mensagens saíram", () => {
    // A fonte manda 0; "a" soma 1 e "b" soma outro. O livro-caixa diria só que
    // cada um emitiu uma vez — e "uma vez" não distingue um 1 de um 2.
    const estado = rodar(2);
    expect(estado.settled["a.out"]?.map((m) => m.data.n)).toEqual([1]);
    expect(estado.settled["b.out"]?.map((m) => m.data.n)).toEqual([2]);
  });

  it("não inventa e não omite: bate com o `out:` do livro-caixa, chave a chave", () => {
    // As duas metades do invariante. Só a primeira (⊆) deixaria passar uma
    // emissão sumida em silêncio, que é o defeito que este projeto persegue.
    //
    // O livro-caixa é acumulado desde o tick 0 e `settled` é DESTE tick, então
    // o que se compara é a diferença entre dois ticks — que é exatamente o que
    // a tela já faz para saber o que mudou.
    const antes = rodar(2);
    const estado = rodar(3);
    const delta = (chave: string): number =>
      (estado.ledger[chave] ?? 0) - (antes.ledger[chave] ?? 0);

    const acomodadas = Object.entries(estado.settled);
    expect(acomodadas.length).toBeGreaterThan(0);

    for (const [chave, mensagens] of acomodadas) {
      expect(delta(`out:${chave}`)).toBe(mensagens.length);
    }

    // ⊇: toda porta que acomoda e que o livro-caixa contou está aqui. A fonte
    // emite por aresta cronometrada, então ela é a única que fica de fora.
    const acomodam = new Set(
      spec.wires
        .filter((w) => (w.timing ?? "clocked") === "settle")
        .map((w) => `${w.from}.${w.port}`),
    );
    for (const chave of Object.keys(estado.ledger)) {
      if (!chave.startsWith("out:") || chave.endsWith(".weight")) continue;
      const nu = chave.slice("out:".length);
      if (!acomodam.has(nu)) continue;
      expect(Object.keys(estado.settled)).toContain(nu);
    }
  });

  it("o confronto não entra: emissão de porta cronometrada fica de fora", () => {
    // "fonte.out" emite todo tick, e por aresta de relógio. Se ela aparecesse
    // aqui, `settled` deixaria de significar "o que acomodou".
    const estado = rodar(3);
    expect(estado.ledger["out:fonte.out"]).toBeGreaterThan(0);
    expect(estado.settled["fonte.out"]).toBeUndefined();
  });

  it("um tick sem acomodação não deixa resíduo do tick anterior", () => {
    // `settled` é do tick, como o livro-caixa: carregá-lo adiante faria a tela
    // mostrar uma porta acesa por causa de um valor que já passou.
    expect(initialWorld(tree).settled).toEqual({});
    expect(rodar(1).settled).toEqual({});
  });
});
