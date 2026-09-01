import { describe, expect, it } from "vitest";
import { familyOf, indexTree, World } from "@ovh/depth-core";
import type { WorldSpec } from "@ovh/depth-core";
import { otelWorld } from "./world.js";

const arvoreDe = (spec: WorldSpec) => indexTree(spec.root, spec.channels);

describe("a árvore do processo instrumentado", () => {
  it("o mundo é válido — o construtor de World valida", () => {
    expect(() => new World(otelWorld())).not.toThrow();
  });

  it("o mundo sem SDK também é válido", () => {
    expect(() => new World(otelWorld({ semSdk: true }))).not.toThrow();
  });

  it("o mundo com dois providers também é válido", () => {
    expect(() => new World(otelWorld({ segundoProvider: true }))).not.toThrow();
  });

  it("o recurso é PLACA: sem behavior, e nenhum fio o toca", () => {
    const spec = otelWorld();
    const arvore = arvoreDe(spec);
    for (const id of ["resource-traces", "resource-logs", "resource-metrics", "propagators", "views", "span-limits"]) {
      const o = arvore.byId.get(id);
      expect(o, id).toBeDefined();
      expect(o?.kind, id).toBe("static");
      expect(familyOf("static")).toBe("plate");
      expect(o?.behavior, id).toBeUndefined();
      expect(spec.wires.some((w) => w.from === id || w.to === id), id).toBe(false);
    }
  });

  it("os propagadores penduram no PROCESSO, não em provider nenhum", () => {
    expect(arvoreDe(otelWorld()).parent.get("propagators")).toBe("process");
  });

  it("o collector está FORA do processo", () => {
    expect(arvoreDe(otelWorld()).parent.get("collector")).toBe("host");
  });

  it("o amostrador tem três saídas, e a do meio não vai para o exportador", () => {
    const spec = otelWorld();
    const saidas = spec.wires.filter((w) => w.from === "sampler" && (w.line ?? "data") === "data");
    expect(new Set(saidas.map((w) => w.port))).toEqual(new Set(["sampled", "recorded", "dropped"]));

    // A do meio entra no processador. O que a impede de sair é a recusa da
    // fila, e ela tem porta própria — não se confunde com fila cheia.
    const recorded = saidas.find((w) => w.port === "recorded");
    expect(recorded?.to).toBe("span-processors");
    expect(spec.wires.some((w) => w.from === "queue" && w.port === "unsampled")).toBe(true);
  });

  it("o flush do provider desce por CONTROLE para todos os processadores registrados", () => {
    const doFlush = otelWorld().wires.filter((w) => w.from === "trace-flush");
    expect(doFlush.length).toBeGreaterThan(1);
    expect(doFlush.every((w) => w.line === "control" && w.toPort !== undefined)).toBe(true);
  });

  it("a linha entre o amostrador e a porta de logs é de CONTROLE e cruza fronteira de provider", () => {
    const spec = otelWorld();
    const arvore = arvoreDe(spec);
    const cruza = spec.wires.find((w) => w.from === "sampler" && w.to === "trace-gate");
    expect(cruza?.line).toBe("control");
    expect(arvore.parent.get("sampler")).toBe("tracer-provider");
    expect(arvore.parent.get("trace-gate")).toBe("logger-provider");
  });

  it("o canal é aresta, e não filho de ninguém", () => {
    const spec = otelWorld();
    const arvore = arvoreDe(spec);
    expect(arvore.byId.has("otlp-out")).toBe(true);
    expect(arvore.parent.has("otlp-out")).toBe(false);
    expect(spec.wires.filter((w) => w.channel === "otlp-out").length).toBe(3);
  });

  it("os três provedores existem, e só um deles tem amostrador", () => {
    const arvore = arvoreDe(otelWorld());
    for (const id of ["tracer-provider", "logger-provider", "meter-provider"]) {
      expect(arvore.byId.get(id)?.kind, id).toBe("composite");
      expect(arvore.parent.get(id), id).toBe("process");
    }
    // A ausência é conteúdo: o LoggerProvider só configura processadores.
    expect([...arvore.byId.values()].filter((o) => o.kind === "router").length).toBe(1);
  });

  it("quem guarda é diferente dos dois lados: fila de um, banco do outro", () => {
    const arvore = arvoreDe(otelWorld());
    expect(arvore.byId.get("queue")?.kind).toBe("buffer");
    expect(arvore.byId.get("log-queue")?.kind).toBe("buffer");
    expect(arvore.byId.get("points")?.kind).toBe("store");
  });

  it("nenhum kind novo nasceu: todos saem do catálogo de onze", () => {
    const doCatalogo = new Set([
      "composite", "source", "router", "switch", "pipeline",
      "buffer", "store", "sink", "sequencer", "channel", "static",
    ]);
    for (const o of arvoreDe(otelWorld()).byId.values()) {
      expect(doCatalogo.has(o.kind), o.id).toBe(true);
    }
  });

  it("o mundo anda, e o span chega do outro lado do canal", () => {
    const mundo = new World(otelWorld());
    mundo.advance(20);
    const estado = mundo.state.nodes["collector"] as { readonly spans: number };
    expect(estado.spans).toBeGreaterThan(0);
  });
});
