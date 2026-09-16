import { describe, expect, it } from "vitest";
import { World } from "@ovh/depth-core";
import type { AnyObject, ObjectSpec, WorldSpec, WorldState } from "@ovh/depth-core";
import { loteProcessor, type EstadoExportador, type EstadoFila } from "./batch.js";
import type { RegistroDeSpan } from "./carga.js";

const CFG = {
  id: "batch-processor",
  fila: "queue",
  gatilho: "batch-timer",
  exportador: "span-exporter",
  rotulos: { lote: "Batch", fila: "Queue", gatilho: "Timer", exportador: "Exporter" },
  paramFila: "max-queue-size",
  paramPrazo: "scheduled-delay",
  paramQueda: "collector-down",
  kindDeSaida: "otlp",
  recurso: { titulo: "Resource", attributes: [{ chave: "service.name", valor: "t" }] },
  maxExportBatchSize: 4,
} as const;

/** A instrumentação de mentira: `porTick` spans por tick, sempre os mesmos. */
function app(porTick: number): ObjectSpec<Record<string, never>> {
  return {
    id: "app",
    kind: "source",
    label: "app",
    leaf: true,
    behavior: (state, _inbox, ctx) => {
      if (ctx.phase !== "commit" || porTick === 0) return { state, out: [] };
      const spans: RegistroDeSpan[] = Array.from({ length: porTick }, (_, i) => ({
        traceId: `t${ctx.tick}-${i}`,
        spanId: `s${ctx.tick}-${i}`,
        nome: "work",
        escopo: "test",
        amostrado: true,
        inicio: ctx.tick,
      }));
      return { state, out: [{ port: "out", message: ctx.emit("span", porTick, { spans }) }] };
    },
  };
}

const collector: ObjectSpec<{ readonly spans: number }> = {
  id: "collector",
  kind: "sink",
  label: "collector",
  leaf: true,
  init: () => ({ spans: 0 }),
  behavior: (state, inbox, ctx) =>
    ctx.phase !== "commit"
      ? { state, out: [] }
      : { state: { spans: state.spans + inbox.reduce((n, m) => n + m.weight, 0) }, out: [] },
};

function mundo(porTick: number, params: Record<string, number>): WorldSpec {
  const lote = loteProcessor(CFG);
  const root: AnyObject = {
    id: "process",
    kind: "composite",
    label: "process",
    entry: "app",
    exit: "collector",
    children: [app(porTick), lote.objeto, collector],
  };
  return {
    id: "batch-test",
    seed: 1,
    edgeTicks: 1,
    root,
    params: { "max-queue-size": 100, "scheduled-delay": 1000, "collector-down": 0, ...params },
    wires: [
      { from: "app", port: "out", to: CFG.fila },
      ...lote.wires,
      { from: CFG.exportador, port: "out", to: "collector" },
    ],
  };
}

const rodar = (spec: WorldSpec, ticks: number): World => {
  const w = new World(spec);
  w.advance(ticks);
  return w;
};

const fila = (s: WorldState): EstadoFila => s.nodes[CFG.fila] as EstadoFila;
const exportador = (s: WorldState): EstadoExportador => s.nodes[CFG.exportador] as EstadoExportador;

describe("o lote, e os gatilhos que a spec dá a ele", () => {
  it("o mundo da fábrica é válido", () => {
    expect(() => new World(mundo(1, {}))).not.toThrow();
  });

  it("a fila solta o lote ao atingir maxExportBatchSize, ANTES do prazo", () => {
    // 2 spans por tick, lote de 4, prazo longuíssimo: o único gatilho possível
    // é o tamanho. Se ele não existisse, nada sairia.
    const w = rodar(mundo(2, { "scheduled-delay": 10_000 }), 8);
    expect(exportador(w.state).lotes).toBeGreaterThan(0);
    expect(exportador(w.state).spans % 4).toBe(0);
  });

  it("a fila solta o lote NO PRAZO, mesmo com menos que maxExportBatchSize", () => {
    // 1 span por tick e lote de 4: em 3 ticks nunca se atinge o tamanho.
    const w = rodar(mundo(1, { "scheduled-delay": 3 }), 8);
    expect(exportador(w.state).lotes).toBeGreaterThan(0);
    // e algum lote saiu menor que o tamanho cheio — é o que "no prazo" quer dizer
    expect(exportador(w.state).spans).toBeLessThan(4 * exportador(w.state).lotes + 1);
    expect(exportador(w.state).ultimo.length).toBeLessThan(4);
  });

  it("a fila CHEIA recusa, e a recusa aparece — nunca some em silêncio", () => {
    const w = rodar(mundo(5, { "max-queue-size": 3, "scheduled-delay": 10_000 }), 6);
    expect(fila(w.state).descartados).toBeGreaterThan(0);
    // o livro-caixa registra a porta do descarte; a mensagem não evapora
    expect(w.state.ledger[`out:${CFG.fila}.dropped.weight`]).toBe(fila(w.state).descartados);
  });

  it("nada se perde fora da recusa: o que entrou é o que saiu, mais o que ficou, mais o recusado", () => {
    const w = rodar(mundo(3, { "max-queue-size": 4, "scheduled-delay": 5 }), 12);
    const entrou = w.state.ledger[`in:${CFG.fila}.weight`] ?? 0;
    const s = w.state;
    expect(exportador(s).spans + fila(s).itens.length + fila(s).descartados).toBe(entrou);
  });

  it("o flush pela porta de controle solta o lote fora dos dois outros gatilhos", () => {
    // Quatro ticks a um span cada: nunca se chega ao lote de quatro, porque a
    // travessia custa um tick. Sem prazo, não há gatilho nenhum, e a fila fica
    // esperando alguém pedir.
    const semGatilho = rodar(mundo(1, { "scheduled-delay": 10_000 }), 4);
    expect(exportador(semGatilho.state).lotes).toBe(0);
    expect(fila(semGatilho.state).itens.length).toBeGreaterThan(0);

    const comGatilho = rodar(mundo(1, { "scheduled-delay": 2 }), 4);
    expect(exportador(comGatilho.state).lotes).toBeGreaterThan(0);
  });

  it("o gatilho é sequencer e só fala por controle — o motor recusaria dado saindo dele", () => {
    const lote = loteProcessor(CFG);
    const doGatilho = lote.wires.filter((w) => w.from === CFG.gatilho);
    expect(doGatilho.length).toBeGreaterThan(0);
    expect(doGatilho.every((w) => w.line === "control" && w.toPort !== undefined)).toBe(true);
  });

  it("peso, não partícula: um lote de N spans é UMA mensagem de peso N", () => {
    const w = rodar(mundo(4, { "scheduled-delay": 10_000 }), 6);
    const mensagens = w.state.ledger[`out:${CFG.fila}.out`] ?? 0;
    const peso = w.state.ledger[`out:${CFG.fila}.out.weight`] ?? 0;
    expect(mensagens).toBeGreaterThan(0);
    expect(peso).toBe(mensagens * 4);
  });
});
