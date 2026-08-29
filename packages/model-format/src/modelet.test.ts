import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseModelet } from "./modelet.js";

/**
 * O exemplo da §3 de `docs/model-format.md`, encolhido.
 *
 * Diferença do plano: `queue` referencia `queue_capacity`. O fixture do plano
 * declarava o parâmetro e não o usava, o que a própria regra "parâmetro morto é
 * erro" — escrita no mesmo plano — recusa.
 */
const bom = `
modelet: batch-processor
version: 1
title: Processador com fila e lote
state: refined
ports:
  in:      { role: data, direction: in,  accepts: item }
  out:     { role: data, direction: out, emits: item-batch }
  dropped: { role: data, direction: drop, emits: item }
params:
  queue_capacity: { type: int, default: 2048, unit: items }
children:
  queue:   { kind: buffer, capacity: { param: queue_capacity } }
  batcher: { kind: batch }
wires:
  - { from: in,          to: queue.in }
  - { from: queue.out,   to: batcher.in }
  - { from: queue.drop,  to: dropped }
  - { from: batcher.out, to: out }
teaches:
  - phenomenon: a fila enche e passa a descartar
    perturbation: burst na entrada
    watch: [queue.occupancy, dropped.rate]
not_modeled:
  - alocação de memória do SDK
`;

const erros = (fonte: string): string => {
  const r = parseModelet(fonte);
  expect(r.ok).toBe(false);
  return r.ok ? "" : r.errors.join(" | ");
};

describe("parseModelet", () => {
  it("aceita um modelet completo", () => {
    const r = parseModelet(bom);
    expect(r.ok === false ? r.errors : []).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("resolve as pontas dos fios, para ninguém precisar partir string depois", () => {
    const r = parseModelet(bom);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.wires[0]).toEqual({
      from: { at: "self", port: "in" },
      to: { at: "child", child: "queue", port: "in" },
      line: "data",
    });
  });

  it("recusa fio que sai de porta inexistente, e diz qual", () => {
    expect(
      erros(bom.replace("from: in,          to: queue.in", "from: entrada, to: queue.in")),
    ).toMatch(/entrada/);
  });

  it("recusa fio que entra em filho inexistente", () => {
    expect(erros(bom.replace("to: batcher.in", "to: fantasma.in"))).toMatch(/fantasma/);
  });

  it("recusa porta declarada e nunca ligada — porta órfã é desenho que mente", () => {
    const orfa = bom.replace(
      "params:",
      "  sobrando: { role: data, direction: out, emits: item }\nparams:",
    );
    expect(erros(orfa)).toMatch(/sobrando/);
  });

  it("recusa porta de entrada usada como destino: o fio entraria pelo lado de fora", () => {
    const invertida = bom.replace("from: in,          to: queue.in", "from: queue.out, to: in");
    expect(erros(invertida)).toMatch(/"in"/);
  });

  it("recusa parâmetro declarado e nunca usado", () => {
    expect(
      erros(bom.replace("children:", "  nunca_usado: { type: int, default: 1, unit: items }\nchildren:")),
    ).toMatch(/nunca_usado/);
  });

  it("recusa filho que referencia parâmetro inexistente — a outra metade da igualdade", () => {
    expect(erros(bom.replace("{ param: queue_capacity }", "{ param: capacidade }"))).toMatch(
      /capacidade/,
    );
  });

  it("exige teaches: um lab que não diz o que ensina não é um lab", () => {
    expect(erros(bom.replace(/teaches:[\s\S]*?not_modeled:/, "not_modeled:"))).not.toBe("");
  });

  it("recusa watch que aponta para o que não existe", () => {
    expect(erros(bom.replace("watch: [queue.occupancy", "watch: [inexistente.occupancy"))).toMatch(
      /inexistente/,
    );
  });

  it("acusa YAML inválido sem estourar", () => {
    expect(erros("modelet: [isto: não fecha")).not.toBe("");
  });

  it("acusa YAML que não é um mapa", () => {
    expect(erros("- um\n- dois\n")).not.toBe("");
  });

  it("acumula todos os erros de uma vez, para o autor não consertar em N rodadas", () => {
    const r = parseModelet(
      bom
        .replace("to: batcher.in", "to: fantasma.in")
        .replace("children:", "  nunca_usado: { type: int, default: 1, unit: items }\nchildren:"),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.length).toBeGreaterThanOrEqual(2);
  });

  it("recusa nome de porta com ponto: a ponta do fio ficaria ambígua", () => {
    expect(erros(bom.replace("dropped:", "drop.ped:").replace("to: dropped", "to: drop.ped"))).toMatch(
      /drop\.ped/,
    );
  });
});

describe("propriedade: fios usados == portas declaradas", () => {
  it("tirar qualquer fio deixa uma porta órfã, e o erro nomeia essa porta", () => {
    const linhas = [
      "  - { from: in,          to: queue.in }",
      "  - { from: queue.out,   to: batcher.in }",
      "  - { from: queue.drop,  to: dropped }",
      "  - { from: batcher.out, to: out }",
    ] as const;
    // Cada fio removido é uma porta que deixa de ser usada — menos os fios
    // internos, que não tocam porta do modelet. A tabela diz o que esperar.
    const orfaDe: readonly (string | null)[] = ["in", null, "dropped", "out"];

    fc.assert(
      fc.property(fc.integer({ min: 0, max: linhas.length - 1 }), (i) => {
        const linha = linhas[i];
        const esperada = orfaDe[i];
        if (linha === undefined || esperada === undefined) return;
        const r = parseModelet(bom.replace(`${linha}\n`, ""));
        if (esperada === null) {
          // fio interno: nenhuma porta fica órfã, mas o filho perde a ligação
          expect(r.ok).toBe(true);
          return;
        }
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.errors.join(" ")).toContain(esperada);
      }),
      { numRuns: 20 },
    );
  });
});
