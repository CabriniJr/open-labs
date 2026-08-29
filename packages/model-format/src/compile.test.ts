import { DROP, World, resolveTarget } from "@ovh/depth-core";
import { describe, expect, it } from "vitest";
import { compileSource } from "./compile.js";

/** Um modelet só com os kinds que o motor tem hoje. */
const hoje = `
modelet: fila-simples
version: 1
title: Fila com descarte
state: approximate
ports:
  in:      { role: data, direction: in,  accepts: item }
  out:     { role: data, direction: out, emits: item }
  dropped: { role: data, direction: drop, emits: item }
params:
  queue_capacity: { type: int, default: 4, unit: items }
children:
  queue: { kind: buffer, capacity: { param: queue_capacity } }
wires:
  - { from: in,         to: queue.in }
  - { from: queue.out,  to: out }
  - { from: queue.drop, to: dropped }
teaches:
  - phenomenon: a fila enche e passa a descartar
    perturbation: entrada mais rápida que a saída
    watch: [queue.occupancy, dropped.rate]
`;

const erros = (fonte: string): string => {
  const r = compileSource(fonte);
  expect(r.ok).toBe(false);
  return r.ok ? "" : r.errors.join(" | ");
};

describe("compileModelet", () => {
  it("compila e o mundo roda dez ticks sem lançar", () => {
    const r = compileSource(hoje);
    expect(r.ok === false ? r.errors : []).toEqual([]);
    if (!r.ok) return;
    const world = new World(r.world);
    world.advance(10);
    expect(world.tick).toBe(10);
  });

  it("o fenômeno que o modelet promete acontece de fato: a fila enche e descarta", () => {
    const cheia = `
modelet: fila-cheia
version: 1
title: Fila que enche
state: approximate
ports:
  out:     { role: data, direction: out, emits: item }
  dropped: { role: data, direction: drop, emits: item }
params:
  ritmo: { type: int, default: 3, unit: items }
children:
  gen:   { kind: source, rate: { param: ritmo } }
  queue: { kind: buffer, capacity: 1, drain: 1 }
wires:
  - { from: gen.out,    to: queue.in }
  - { from: queue.out,  to: out }
  - { from: queue.drop, to: dropped }
teaches:
  - phenomenon: a fila enche e passa a descartar
    perturbation: entrada mais rápida que a saída
    watch: [queue.occupancy, dropped.rate]
`;
    const r = compileSource(cheia);
    if (!r.ok) throw new Error(r.errors.join(" | "));
    const world = new World(r.world);
    world.advance(20);
    expect(world.state.ledger["out:queue.drop"] ?? 0).toBeGreaterThan(0);
  });

  it("params viram WorldSpec.params com os defaults", () => {
    const r = compileSource(hoje);
    if (!r.ok) throw new Error(r.errors.join(" | "));
    expect(r.world.params).toEqual({ queue_capacity: 4 });
    expect(r.params).toEqual([{ name: "queue_capacity", type: "int", unit: "items", value: 4 }]);
  });

  it("porta de descarte vira fio para DROP", () => {
    const r = compileSource(hoje);
    if (!r.ok) throw new Error(r.errors.join(" | "));
    const drop = r.world.wires.find((w) => w.from === "queue" && w.port === "drop");
    expect(drop?.to).toBe(DROP);
  });

  it("duração vira milissegundos, com a unidade declarada ao lado", () => {
    const comDuracao = `
modelet: fonte-simples
version: 1
title: Fonte
state: opaque
ports:
  out: { role: data, direction: out, emits: item }
params:
  ritmo:          { type: int, default: 2, unit: items }
  flush_interval: { type: duration, default: 5s }
children:
  gen: { kind: source, rate: { param: ritmo }, drain: { param: flush_interval } }
wires:
  - { from: gen.out, to: out }
teaches:
  - phenomenon: a fonte emite em ritmo constante
    perturbation: nenhuma
    watch: [out]
`;
    // `source` não implementa `drain`: o argumento é recusado, e é isso que
    // impede uma duração de virar um número que ninguém lê.
    expect(erros(comDuracao)).toMatch(/drain/);
  });

  it("fio de controle chega ao WorldSpec e a fiação de dado não o segue", () => {
    const comControle = `
modelet: contorno
version: 1
title: Contorno com linha de controle
state: opaque
ports:
  pausa: { role: control, direction: in }
  aviso: { role: control, direction: out }
  in:    { role: data, direction: in, accepts: item }
  out:   { role: data, direction: out, emits: item }
children:
  queue: { kind: buffer, capacity: 8 }
wires:
  - { from: pausa,     to: aviso, line: control }
  - { from: in,        to: queue.in }
  - { from: queue.out, to: out }
teaches:
  - phenomenon: o sinal atravessa sem carga
    perturbation: nenhuma
    watch: [pausa, aviso]
`;
    const r = compileSource(comControle);
    if (!r.ok) throw new Error(r.errors.join(" | "));
    const controles = r.world.wires.filter((w) => w.line === "control");
    expect(controles).toHaveLength(1);
    // Sinal chega numa entrada nomeada, e o nome é o da porta de destino.
    expect(controles[0]?.toPort).toBe("aviso");

    const tree = new World(r.world).tree;
    // A fiação de dado é cega para controle: o que sai de "@in-pausa" não tem
    // destino de dado nenhum, mesmo havendo um fio declarado.
    expect(resolveTarget(tree, r.world.wires, "@in-pausa", "out")).toBeNull();
    expect(resolveTarget(tree, r.world.wires, "@in-in", "out")).toBe("queue");
  });

  it("recusa fio de controle que liga um filho: nenhum kind de hoje tem porta de controle", () => {
    expect(erros(hoje.replace("to: queue.in }", "to: queue.in, line: control }"))).toMatch(/onda 1/);
  });

  it("aceita duas linhas de dado saindo da mesma porta: o leque é nativo no motor", () => {
    // O `tee` existia para replicar carga, e saiu do catálogo quando a junção
    // virou nativa — ele seria um segundo mecanismo para o mesmo fenômeno.
    const fanout = hoje.replace(
      "  - { from: queue.drop, to: dropped }",
      "  - { from: queue.drop, to: dropped }\n  - { from: queue.out,  to: dropped }",
    );
    const r = compileSource(fanout);
    if (!r.ok) throw new Error(r.errors.join(" | "));
    expect(r.world.wires.filter((w) => w.from === "queue" && w.port === "out")).toHaveLength(2);
  });

  it("recusa kind de onda futura dizendo em que onda ele chega", () => {
    const msg = erros(hoje.replace("kind: buffer", "kind: clock"));
    expect(msg).toMatch(/clock/);
    expect(msg).toMatch(/onda 1/);
  });

  it("recusa kind da onda 3 com a onda certa", () => {
    expect(erros(hoje.replace("kind: buffer", "kind: probe"))).toMatch(/onda 3/);
  });

  it("recusa kind digitado errado listando os disponíveis", () => {
    const msg = erros(hoje.replace("kind: buffer", "kind: bufer"));
    expect(msg).toMatch(/digitação/);
    expect(msg).toMatch(/source, buffer, sink/);
  });

  it("recusa kind que o motor tem mas o compilador não monta, dizendo por quê", () => {
    expect(erros(hoje.replace("kind: buffer", "kind: router"))).toMatch(/política de rota/);
  });

  it("recusa porta de filho que o kind não tem — emissão sem entrega é sumiço silencioso", () => {
    expect(erros(hoje.replace("from: queue.out", "from: queue.saida"))).toMatch(/"saida"/);
  });

  it("recusa entrar por uma porta de saída do filho", () => {
    expect(erros(hoje.replace("to: queue.in }", "to: queue.out }"))).toMatch(/não recebe pela porta/);
  });

  it("recusa argumento que o kind não implementa", () => {
    expect(erros(hoje.replace("kind: buffer, capacity", "kind: buffer, on_full: 1, capacity"))).toMatch(
      /on_full/,
    );
  });

  it("recusa parâmetro enum onde o kind espera número", () => {
    const ruim = hoje.replace(
      "  queue_capacity: { type: int, default: 4, unit: items }",
      "  queue_capacity: { type: enum, values: [a, b], default: a }",
    );
    expect(erros(ruim)).toMatch(/inventar a correspondência/);
  });
});
