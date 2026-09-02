import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { World } from "@ovh/depth-core";
import { estadoOtel } from "./estado.js";
import { otelWorld } from "./world.js";

const rodar = (ticks: number, params: Record<string, number> = {}, seed = 1): World => {
  const w = new World(otelWorld({ seed, params }));
  w.advance(ticks);
  return w;
};

describe("o leitor de estado, e a conservação que impede o painel de mentir", () => {
  it("nada aparece nem desaparece na decisão: criados = amostrados + gravados + descartados", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }),
        fc.integer({ min: 0, max: 40 }),
        fc.integer({ min: 0, max: 10 }),
        (semente, ticks, decimos) => {
          const w = rodar(ticks, { "sampling-ratio": decimos / 10, "record-only": decimos % 2 }, semente);
          const e = estadoOtel(w.state);
          // O que o app criou ainda pode estar em voo para o amostrador: o que
          // fecha é o que ELE decidiu, e é isso que o painel mostra.
          expect(e.amostrados + e.gravadosSemSair + e.descartadosPeloSampler).toBe(e.decididos);
          expect(e.decididos).toBeLessThanOrEqual(e.criados);
        },
      ),
      { numRuns: 60 },
    );
  });

  it("o que saiu da fila, mais o que ela recusou, mais o que está nela, fecha com o que entrou", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 60 }), fc.integer({ min: 1, max: 8 }), (ticks, fila) => {
        const w = rodar(ticks, { "max-queue-size": fila, "spans-per-tick": 3 });
        const e = estadoOtel(w.state);
        // `saiuDaFila`, e não `exportados`: entre a fila e o exportador há uma
        // aresta, e o lote que está nela ainda não chegou. Fechar a conta com
        // `exportados` esconderia justamente o lote em voo — o que o processo
        // perde quando morre sem flush.
        expect(e.saiuDaFila + e.naFila + e.descartadosPelaFila + e.recusadosPorNaoAmostrado).toBe(
          e.entraramNaFila,
        );
      }),
      { numRuns: 60 },
    );
  });

  it("os pontos são linhas, e o colapso não muda a soma", () => {
    const largo = estadoOtel(rodar(40, { "cardinality-limit": 2000 }).state);
    const estreito = estadoOtel(rodar(40, { "cardinality-limit": 3 }).state);
    const soma = (p: readonly { readonly valor: number }[]): number =>
      p.reduce((a, b) => a + b.valor, 0);
    expect(soma(estreito.pontos)).toBe(soma(largo.pontos));
    expect(estreito.pontos.length).toBeLessThan(largo.pontos.length);
    expect(estreito.colapsados).toBeGreaterThan(0);
  });

  it("no-op: o que o app criou é o que a folha engoliu, e o collector recebeu zero", () => {
    // O processo para no tick 20 e o mundo anda até 25: sem isso o último span
    // ainda estaria na aresta, e o teste cobraria do contador uma coisa que
    // não chegou nele. Travessia custa tick, e a conta tem de saber disso.
    const w = new World(otelWorld({ semSdk: true, params: { "shutdown-at": 20 } }));
    w.advance(25);
    const e = estadoOtel(w.state);
    expect(e.engolidosPeloNoop).toBe(e.criados);
    expect(e.exportados).toBe(0);
    expect(e.recebidosPeloCollector).toBe(0);
  });

  it("o leitor não cava o estado cru: um mundo qualquer devolve números, não undefined", () => {
    const e = estadoOtel(new World(otelWorld()).state);
    for (const [chave, valor] of Object.entries(e)) {
      if (Array.isArray(valor) || typeof valor === "boolean") continue;
      expect(Number.isFinite(valor), chave).toBe(true);
    }
  });
});
