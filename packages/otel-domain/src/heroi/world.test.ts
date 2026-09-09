import { World } from "@ovh/depth-core";
import { describe, expect, it } from "vitest";
import { ATRIBUTO_DO_COLLECTOR } from "./labels.js";
import { heroiWorld } from "./world.js";
import type { SpanDoHeroi } from "./carga.js";

const spansEmVoo = (state: { readonly flight: readonly { readonly message: { readonly data: Readonly<Record<string, unknown>> } }[] }): readonly SpanDoHeroi[] =>
  state.flight.flatMap((item) =>
    Array.isArray(item.message.data["spans"]) ? (item.message.data["spans"] as SpanDoHeroi[]) : [],
  );

describe("heroiWorld", () => {
  it("o serviço emite span, e ele chega ao backend", () => {
    const mundo = new World(heroiWorld());
    mundo.advance(12);
    const backend = mundo.state.nodes["backend"] as { readonly recebidos: number } | undefined;
    expect(backend?.recebidos ?? 0).toBeGreaterThan(0);
  });

  it("o collector acrescenta o atributo dele, e o serviço não", () => {
    /*
      É o fato inteiro que a trilha do herói desenha. Se o collector parar de
      enriquecer, a trilha para de ter o que mostrar — e este teste é quem
      denuncia isso antes da landing.
    */
    const mundo = new World(heroiWorld());
    const antes = new Set<string>();
    const depois = new Set<string>();
    for (let i = 0; i < 20; i += 1) {
      mundo.advance(1);
      for (const item of mundo.state.flight) {
        const spans = Array.isArray(item.message.data["spans"])
          ? (item.message.data["spans"] as SpanDoHeroi[])
          : [];
        for (const span of spans) {
          const tem = ATRIBUTO_DO_COLLECTOR in span.resource;
          (item.from === "service" ? antes : depois).add(String(tem));
        }
      }
    }
    expect(antes.has("true")).toBe(false);
    expect(depois.has("true")).toBe(true);
  });

  it("o span mantém o traceId ao atravessar o collector", () => {
    /*
      Enriquecer não é criar outro: o collector acrescenta campo e devolve a
      MESMA coisa. Se o traceId mudasse, a trilha estaria desenhando dois itens
      como se fossem um.
    */
    const mundo = new World(heroiWorld());
    const porN = new Map<number, Set<string>>();
    for (let i = 0; i < 20; i += 1) {
      mundo.advance(1);
      for (const span of spansEmVoo(mundo.state)) {
        const vistos = porN.get(span.n) ?? new Set<string>();
        vistos.add(span.traceId);
        porN.set(span.n, vistos);
      }
    }
    expect([...porN.values()].every((ids) => ids.size === 1)).toBe(true);
  });
});
