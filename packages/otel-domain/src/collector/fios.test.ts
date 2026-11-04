// packages/otel-domain/src/collector/fios.test.ts
//
// O desenho do `collector.mmd` contra o run dele, pelas mesmas duas guardas da
// anatomia: fio que não carrega nada, e rótulo que nomeia outro kind.
//
// A diferença em relação à anatomia é o cenário, e ela importa: **duas das dez
// arestas deste lab são portas de recusa**, e no caminho feliz elas ficam
// mudas de propósito — um collector sem pressão e sem filtro não descarta
// nada, e cobrar o contrário seria cobrar que o lab não ensinasse.
//
// Então a conferência de canal mudo roda no cenário em que TODAS as portas
// acordam, e a de kind roda em todos.
import { World, emissoesPerdidas } from "@ovh/depth-core";
import type { WorldState } from "@ovh/depth-core";
import {
  conferirDesenho,
  observarCanais,
  parseSkeleton,
  relatoDeDivergencias,
} from "@ovh/mermaid-skeleton";
import { describe, expect, it } from "vitest";
import COLLECTOR_MMD from "./collector.mmd?raw";
import { collectorWorld } from "./world.js";

const esqueleto = () => {
  const parsed = parseSkeleton(COLLECTOR_MMD);
  if (!parsed.ok) throw new Error(`collector.mmd inválido: ${parsed.errors.join(" | ")}`);
  return parsed.value;
};

const rodar = (params: Record<string, number> = {}, ticks = 24) => {
  const spec = collectorWorld(params);
  const world = new World(spec);
  const estados: WorldState[] = [];
  for (let i = 0; i < ticks; i += 1) {
    world.advance(1);
    estados.push(world.state);
  }
  return { spec, estados, ultimo: world.state };
};

/** Pressão e filtro ligados: é o único cenário em que as dez portas emitem. */
const TUDO_ACESO = {
  "spans-por-tick": 5,
  "limite-de-memoria": 2,
  "filtrar-health-checks": 1,
};

describe("o desenho do collector.mmd não mente sobre o run", () => {
  it("com todas as portas acesas, nenhum canal fica mudo e nenhum rótulo mente", () => {
    const { spec, estados } = rodar(TUDO_ACESO);
    const divs = conferirDesenho(esqueleto(), spec, observarCanais(estados));
    expect(divs, `\n${relatoDeDivergencias(divs)}`).toEqual([]);
  });

  it("são as dez arestas do mmd, todas com kind declarado", () => {
    const sk = esqueleto();
    const dados = sk.edges.filter((e) => e.line === "data");
    expect(dados).toHaveLength(10);
    expect(dados.every((e) => e.messageKind !== null)).toBe(true);
  });

  it("o leque está no DESENHO: duas arestas saem da mesma porta do receiver", () => {
    /*
      A tese do lab é uma propriedade do esqueleto, e por isso é cobrável aqui
      sem rodar nada. Se alguém der a cada pipeline a sua própria porta de
      saída no receiver, o lab continua rodando igual e para de ensinar que o
      receiver não sabe quantas pipelines existem.
    */
    const sk = esqueleto();
    const doReceiver = sk.edges.filter((e) => e.from === "receiver" && e.line === "data");
    expect(doReceiver).toHaveLength(2);
    expect(new Set(doReceiver.map((e) => e.fromPort)).size).toBe(1);
    expect(doReceiver.map((e) => e.to).sort()).toEqual(["filtro", "limiter"]);
  });

  it("as duas portas de recusa chegam no MESMO contador", () => {
    // A outra metade da tese: as pipelines não se tocam em lugar nenhum,
    // exceto no lugar onde a perda é contada.
    const sk = esqueleto();
    const paraDescartes = sk.edges.filter((e) => e.to === "descartes");
    expect(paraDescartes.map((e) => e.from).sort()).toEqual(["filtro", "limiter"]);
  });
});

describe("em cada cenário, o que carrega carrega o kind declarado", () => {
  const CENARIOS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
    padrao: {},
    "filtro ligado": { "filtrar-health-checks": 1 },
    "sob pressão": { "spans-por-tick": 5, "limite-de-memoria": 2 },
    "tráfego baixo": { "spans-por-tick": 1, "tamanho-do-lote": 6 },
    "tudo aceso": TUDO_ACESO,
  };

  for (const [nome, params] of Object.entries(CENARIOS)) {
    it(nome, () => {
      const { spec, estados, ultimo } = rodar(params);
      const divs = conferirDesenho(esqueleto(), spec, observarCanais(estados)).filter(
        (d) => d.problema === "kind-divergente",
      );
      expect(divs, `\n${relatoDeDivergencias(divs)}`).toEqual([]);
      expect(emissoesPerdidas(ultimo)).toEqual([]);
    });
  }

  it("no caminho feliz as portas de recusa ficam mudas, e isso é o esperado", () => {
    // A prova de que o cenário `tudo aceso` exercita algo. Sem ela, o teste de
    // canal mudo passaria mesmo se os parâmetros fossem inertes.
    const { spec, estados } = rodar();
    const mudos = conferirDesenho(esqueleto(), spec, observarCanais(estados))
      .filter((d) => d.problema === "sem-trafego")
      .map((d) => d.canal)
      .sort();
    expect(mudos).toEqual(["filtro.barrado", "limiter.recusado"]);
  });
});
