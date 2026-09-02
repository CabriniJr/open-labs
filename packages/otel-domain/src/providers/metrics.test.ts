import { describe, expect, it } from "vitest";
import { World } from "@ovh/depth-core";
import type { AnyObject, ObjectSpec, WorldSpec, WorldState } from "@ovh/depth-core";
import { ATRIBUTO_DE_OVERFLOW, medicao, type EstadoPontos, type EstadoSaidaDeMetrica } from "./metrics.js";

const CFG = {
  pontos: "points",
  leitor: "metric-reader",
  exportador: "metric-exporter",
  rotulos: { pontos: "Points", leitor: "Reader", exportador: "Exporter" },
  paramIntervalo: "export-interval",
  paramCardinalidade: "cardinality-limit",
} as const;

/** A instrumentação: `distintas` séries por tick, uma medição em cada. */
function app(distintas: number, deslocamento = 0): ObjectSpec<Record<string, never>> {
  return {
    id: "app",
    kind: "source",
    label: "app",
    leaf: true,
    behavior: (state, _inbox, ctx) => {
      if (ctx.phase !== "commit" || distintas === 0) return { state, out: [] };
      const medidas = Array.from({ length: distintas }, (_, i) => ({
        chave: `route=/r${i + deslocamento * (ctx.tick - 1) * distintas}`,
        valor: 1,
      }));
      return {
        state,
        out: [{ port: "out", message: ctx.emit("measurement", distintas, { medidas }) }],
      };
    },
  };
}

function mundo(distintas: number, params: Record<string, number>, deslocamento = 0): WorldSpec {
  const m = medicao(CFG);
  const root: AnyObject = {
    id: "process",
    kind: "composite",
    label: "process",
    entry: "app",
    exit: CFG.exportador,
    children: [app(distintas, deslocamento), ...m.objetos],
  };
  return {
    id: "metrics-test",
    seed: 1,
    edgeTicks: 1,
    root,
    params: { "export-interval": 1000, "cardinality-limit": 2000, ...params },
    wires: [{ from: "app", port: "out", to: CFG.pontos }, ...m.wires],
  };
}

const rodar = (spec: WorldSpec, ticks: number): WorldState => {
  const w = new World(spec);
  w.advance(ticks);
  return w.state;
};

const pontos = (s: WorldState): EstadoPontos => s.nodes[CFG.pontos] as EstadoPontos;
const saida = (s: WorldState): EstadoSaidaDeMetrica => s.nodes[CFG.exportador] as EstadoSaidaDeMetrica;
const soma = (e: EstadoPontos): number => Object.values(e.linhas).reduce((a, b) => a + b, 0);

describe("as métricas são pedidas, e não empurradas", () => {
  it("o mundo é válido", () => {
    expect(() => new World(mundo(1, {}))).not.toThrow();
  });

  it("o store não emite NADA sem o reader pedir", () => {
    const s = rodar(mundo(3, { "export-interval": 10_000 }), 10);
    expect(soma(pontos(s))).toBeGreaterThan(0);
    expect(s.ledger[`out:${CFG.pontos}.out`] ?? 0).toBe(0);
    expect(saida(s).coletas).toBe(0);
  });

  it("o reader pede a cada intervalo, e é aí que o ponto sai", () => {
    const s = rodar(mundo(3, { "export-interval": 3 }), 12);
    expect(saida(s).coletas).toBeGreaterThan(0);
    // Ele PEDE: o pedido é sinal, e o sinal aparece no eixo próprio do
    // livro-caixa. Se fosse carga, isto seria zero e o desenho estaria errado.
    expect(s.ledger[`sigin:${CFG.pontos}.collect`] ?? 0).toBeGreaterThan(0);
  });

  it("acima do limite de cardinalidade os pontos COLAPSAM, e não são descartados", () => {
    // Uma série nova por tick, limite de 4: a partir da quarta, tudo vai para a
    // linha de overflow. A contagem de linhas para de crescer; a soma não.
    const s = rodar(mundo(1, { "cardinality-limit": 4, "export-interval": 10_000 }, 1), 12);
    const e = pontos(s);
    expect(Object.keys(e.linhas).length).toBe(4);
    expect(e.linhas[ATRIBUTO_DE_OVERFLOW]).toBeGreaterThan(0);
    expect(e.colapsados).toBeGreaterThan(0);
  });

  it("a soma total é conservada no colapso — colapsar não é perder", () => {
    const comLimite = rodar(mundo(1, { "cardinality-limit": 4, "export-interval": 10_000 }, 1), 12);
    const semLimite = rodar(mundo(1, { "cardinality-limit": 2000, "export-interval": 10_000 }, 1), 12);
    expect(soma(pontos(comLimite))).toBe(soma(pontos(semLimite)));
    // e nenhuma medição foi contada duas vezes: a soma é o número de medições
    expect(soma(pontos(comLimite))).toBe(comLimite.ledger[`in:${CFG.pontos}.weight`]);
  });

  it("o contraste com a fila é de FORMA: uma recusa, o outro colapsa", () => {
    // O store nunca descarta. Se um dia alguém trocar o colapso por descarte,
    // este teste é o que diz que a lição de F4 morreu.
    const s = rodar(mundo(1, { "cardinality-limit": 3, "export-interval": 10_000 }, 1), 15);
    expect(soma(pontos(s))).toBe(s.ledger[`in:${CFG.pontos}.weight`]);
    expect(s.ledger[`out:${CFG.pontos}.dropped`]).toBeUndefined();
  });

  it("o leitor é sequencer e só fala por controle", () => {
    const m = medicao(CFG);
    const doLeitor = m.wires.filter((w) => w.from === CFG.leitor);
    expect(doLeitor.length).toBeGreaterThan(0);
    expect(doLeitor.every((w) => w.line === "control" && w.toPort !== undefined)).toBe(true);
  });
});
