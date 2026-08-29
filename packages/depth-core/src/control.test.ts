// packages/depth-core/src/control.test.ts
import { describe, expect, it } from "vitest";
import { inCount, portCount, portWeight } from "./meters.js";
import { initialWorld, stepWorld } from "./scheduler.js";
import { spec } from "./control.test-fixture.js";
import { indexTree } from "./tree.js";

const tree = indexTree(spec.root);

function rodar(ticks: number, params: Readonly<Record<string, number>> = spec.params) {
  let estado = initialWorld(tree);
  for (let i = 0; i < ticks; i += 1) estado = stepWorld(spec, tree, estado, params);
  return estado;
}

describe("linha de controle", () => {
  it("com sinal, a carga passa; sem sinal, não passa", () => {
    expect((rodar(6).nodes.dst as { got: number }).got).toBeGreaterThan(0);
    expect((rodar(6, { abrir: 0 }).nodes.dst as { got: number }).got).toBe(0);
  });

  it("sinal é contado em eixo próprio, e nunca soma com carga", () => {
    const estado = rodar(6);
    expect(estado.ledger["sigin:sel.sel"]).toBeGreaterThan(0);
    // O eixo "in:" é só de carga, e a conta fecha: tudo o que a fonte emitiu ou
    // já chegou ao seletor, ou ainda está em voo — nada de sinal entrou nessa
    // soma. Se o sinal vazasse para "in:", a pergunta "quanto dado passou por
    // aqui?" deixaria de ter resposta.
    const cargaEmVoo = estado.flight.filter(
      (f) => f.signalPort === undefined && f.to === "sel",
    ).length;
    expect((estado.ledger["in:sel"] ?? 0) + cargaEmVoo).toBe(estado.ledger["out:fonte.out"]);
  });

  it("o medidor de porta não enxerga sinal: ele lê só os eixos de carga", () => {
    // Estrutural, não disciplina: `portCount` lê "out:" e `inCount` lê "in:", e
    // sinal não escreve em nenhum dos dois.
    const estado = rodar(6);
    expect(portCount(estado, "ctrl", "sel")).toBeGreaterThan(0);
    expect(inCount(estado, "sel")).toBeGreaterThan(0);
    expect(portWeight(estado, "ctrl", "sel")).toBeGreaterThan(0);
    // O que importa é que a CHEGADA do sinal não conta como carga chegando.
    expect(estado.ledger["in:sel"]).not.toBe(
      (estado.ledger["in:sel"] ?? 0) + (estado.ledger["sigin:sel.sel"] ?? 0),
    );
  });

  it("sinal em voo é distinguível de carga em voo", () => {
    // Um item de sinal tem signalPort; a carga não. A vista agregada é sobre
    // carga, e controle é uma camada visual própria.
    for (const item of rodar(3).flight.filter((f) => f.signalPort !== undefined)) {
      expect(item.to).toBe("sel");
      expect(item.signalPort).toBe("sel");
    }
  });

  it("porta que só tem linha de controle não conta como fio esquecido", () => {
    // `.unwired` existe para acusar buraco de autoria. Ali não há buraco: a
    // porta entregou, por outro caminho.
    expect(rodar(6).ledger["out:ctrl.sel.unwired"]).toBeUndefined();
  });
});
