import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { World } from "@ovh/depth-core";
import { parseTraceparent } from "../traceparent.js";
import { attribute } from "../otlp.js";
import { envelopesDe, envelopeUnico } from "./envelope.js";
import { RECURSO_DO_PROCESSO, RECURSO_DO_SEGUNDO, ROTULOS } from "./labels.js";
import { otelWorld } from "./world.js";

const esperado = (attrs: readonly { readonly chave: string; readonly valor: string }[]) =>
  attrs.map((a) => attribute(a.chave, a.valor));

describe("o envelope OTLP é a árvore do SDK, vista do outro lado", () => {
  it("INVARIANTE: o resource do envelope é a placa do provider que o emitiu", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 50 }), fc.integer({ min: 0, max: 40 }), (semente, ticks) => {
        const mundo = new World(otelWorld({ seed: semente }));
        mundo.advance(ticks);
        for (const emVoo of envelopesDe(mundo.state)) {
          for (const rs of emVoo.envelope.resourceSpans) {
            // (⊆) não inventa campo
            expect(rs.resource.attributes).toEqual(esperado(RECURSO_DO_PROCESSO));
            // (⊇) e o escopo é o que o app usou
            expect(rs.scopeSpans.length).toBeGreaterThan(0);
            expect(rs.scopeSpans.every((ss) => ss.scope.name === ROTULOS.escopo)).toBe(true);
          }
        }
      }),
      { numRuns: 80 },
    );
  });

  it("com dois providers, cada envelope carrega o recurso DO SEU — e é por isso que o backend perde a correlação", () => {
    const mundo = new World(otelWorld({ segundoProvider: true, params: { "scheduled-delay": 2 } }));
    const vistos = new Map<string, unknown>();
    for (let i = 0; i < 40; i += 1) {
      mundo.advance(1);
      for (const emVoo of envelopesDe(mundo.state)) {
        for (const rs of emVoo.envelope.resourceSpans) vistos.set(emVoo.de, rs.resource.attributes);
      }
    }
    expect(vistos.get("span-exporter")).toEqual(esperado(RECURSO_DO_PROCESSO));
    expect(vistos.get("span-exporter-b")).toEqual(esperado(RECURSO_DO_SEGUNDO));
    // Nada falhou. Nenhum erro. Dois resourceSpans com service.name diferente.
    expect(vistos.size).toBe(2);
  });

  it("o resource está UMA CAMADA ACIMA dos spans, e nenhum span carrega service.name", () => {
    const mundo = new World(otelWorld({ params: { "scheduled-delay": 2 } }));
    let olhou = 0;
    for (let i = 0; i < 30; i += 1) {
      mundo.advance(1);
      for (const emVoo of envelopesDe(mundo.state)) {
        for (const rs of emVoo.envelope.resourceSpans) {
          expect(rs.resource.attributes.some((a) => a.key === "service.name")).toBe(true);
          for (const ss of rs.scopeSpans) {
            for (const span of ss.spans) {
              expect(span.attributes.some((a) => a.key === "service.name")).toBe(false);
              olhou += 1;
            }
          }
        }
      }
    }
    expect(olhou).toBeGreaterThan(0);
  });

  it("o bit sampled do traceparent concorda com a porta pela qual o span saiu", () => {
    const mundo = new World(otelWorld({ params: { "scheduled-delay": 2, "sampling-ratio": 0.5 } }));
    let conferidos = 0;
    for (let i = 0; i < 40; i += 1) {
      mundo.advance(1);
      for (const emVoo of envelopesDe(mundo.state)) {
        for (const header of emVoo.traceparents) {
          const lido = parseTraceparent(header);
          expect(lido, header).not.toBeNull();
          // Só o que saiu pela porta `sampled` chega ao canal: a fila recusa o
          // resto por porta própria. Então todo header no canal tem o bit alto.
          expect(lido?.sampled, header).toBe(true);
          conferidos += 1;
        }
      }
    }
    expect(conferidos).toBeGreaterThan(0);
  });

  it("o traceparent é válido pelo W3C — id fora de formato não sai deste modelo", () => {
    const mundo = new World(otelWorld({ params: { "scheduled-delay": 2 } }));
    mundo.advance(12);
    for (const emVoo of envelopesDe(mundo.state)) {
      for (const header of emVoo.traceparents) {
        expect(parseTraceparent(header)).not.toBeNull();
      }
    }
  });

  it("num tick sem lote no canal, não há envelope — o L3 não inventa tráfego", () => {
    const mundo = new World(otelWorld({ params: { "scheduled-delay": 10_000 } }));
    mundo.advance(3);
    expect(envelopesDe(mundo.state)).toEqual([]);
    expect(envelopeUnico(mundo.state)).toBeUndefined();
  });
});
