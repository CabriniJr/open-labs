// packages/otel-domain/src/amostragem/fios.test.ts
//
// O desenho do `amostragem.mmd` contra o run dele, pelas mesmas guardas do lab
// do Collector: canal que não carrega nada, e rótulo que nomeia outro kind.
//
// Aqui o cenário em que TODAS as portas acordam é o cenário do desastre: head
// cortando, tail cortando, e os dois gateways decidindo. No caminho feliz
// (`1 em 1` nos dois) as portas de corte ficam mudas de propósito — não há
// amostragem nenhuma acontecendo —, e cobrar o contrário seria cobrar que o
// lab não tivesse linha de base.
import { World, emissoesPerdidas } from "@ovh/depth-core";
import type { WorldState } from "@ovh/depth-core";
import {
  conferirDesenho,
  observarCanais,
  parseSkeleton,
  relatoDeDivergencias,
} from "@ovh/mermaid-skeleton";
import { describe, expect, it } from "vitest";
import AMOSTRAGEM_MMD from "./amostragem.mmd?raw";
import { amostragemWorld } from "./world.js";

const esqueleto = () => {
  const parsed = parseSkeleton(AMOSTRAGEM_MMD);
  if (!parsed.ok) throw new Error(`amostragem.mmd inválido: ${parsed.errors.join(" | ")}`);
  return parsed.value;
};

const rodar = (params: Record<string, number> = {}, ticks = 40) => {
  const spec = amostragemWorld(params);
  const world = new World(spec);
  const estados: WorldState[] = [];
  for (let i = 0; i < ticks; i += 1) {
    world.advance(1);
    estados.push(world.state);
  }
  return { spec, estados, ultimo: world.state };
};

/** Head cortando e tail cortando: o único cenário em que as nove portas emitem. */
const TUDO_ACESO = {
  "head-mantem-1-em": 3,
  "tail-mantem-1-em": 4,
  "erro-a-cada": 3,
  "rotear-por-trace": 1,
};

describe("o desenho do amostragem.mmd não mente sobre o run", () => {
  it("com todas as portas acesas, nenhum canal fica mudo e nenhum rótulo mente", () => {
    const { spec, estados } = rodar(TUDO_ACESO);
    const divs = conferirDesenho(esqueleto(), spec, observarCanais(estados));
    expect(divs, `\n${relatoDeDivergencias(divs)}`).toEqual([]);
  });

  it("são as nove arestas do mmd, todas com kind declarado", () => {
    const sk = esqueleto();
    const dados = sk.edges.filter((e) => e.line === "data");
    expect(dados).toHaveLength(9);
    expect(dados.every((e) => e.messageKind !== null)).toBe(true);
  });

  it("o head está ANTES do leque, e isso é propriedade do desenho", () => {
    /*
      A ordem é o argumento do lab: o que o head corta nunca alcança gateway
      nenhum, então nenhuma política de tail pode recuperá-lo. Se alguém mover
      o head para depois do balanceador, o lab continua rodando e passa a
      ensinar que as duas amostragens são intercambiáveis.
    */
    const sk = esqueleto();
    const doHead = sk.edges.filter((e) => e.from === "head" && e.line === "data");
    expect(doHead.map((e) => e.to).sort()).toEqual(["balanceador", "descartes"]);
    const doBalanceador = sk.edges.filter((e) => e.from === "balanceador");
    expect(doBalanceador.map((e) => e.to).sort()).toEqual(["gatewayA", "gatewayB"]);
  });

  it("o balanceador ESCOLHE: duas portas distintas, e não um leque", () => {
    /*
      A diferença mecânica entre este lab e o do Collector, e ela é a razão de
      o desenho ter duas portas aqui: duas arestas saindo da MESMA porta
      entregariam uma cópia para cada gateway, o que é o que um receiver faz e
      o oposto do que um balanceador faz. Um span vai para um gateway ou para o
      outro.
    */
    const sk = esqueleto();
    const portas = sk.edges
      .filter((e) => e.from === "balanceador")
      .map((e) => e.fromPort)
      .sort();
    expect(new Set(portas).size).toBe(2);
    expect(portas).toEqual(["paraA", "paraB"]);
  });

  it("os dois gateways entregam no MESMO backend", () => {
    // É o que torna o trace quebrado difícil de ver: ele chega pela porta
    // certa, junto com os traces inteiros, e nada o distingue na chegada.
    const sk = esqueleto();
    const paraBackend = sk.edges.filter((e) => e.to === "backend");
    expect(paraBackend.map((e) => e.from).sort()).toEqual(["gatewayA", "gatewayB"]);
  });
});

describe("em cada cenário, o que carrega carrega o kind declarado", () => {
  const CENARIOS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
    "sem amostragem": { "head-mantem-1-em": 1, "tail-mantem-1-em": 1 },
    "só head": { "head-mantem-1-em": 4, "tail-mantem-1-em": 1 },
    "só tail": { "head-mantem-1-em": 1, "tail-mantem-1-em": 4 },
    "rota por chegada": { "rotear-por-trace": 0 },
    "janela longa": { "espera-do-tail": 8 },
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

  it("sem amostragem nenhuma, as portas de corte ficam mudas — e é o esperado", () => {
    // A prova de que o cenário `tudo aceso` exercita algo: sem ela, a
    // conferência de canal mudo passaria mesmo com parâmetros inertes.
    const { spec, estados } = rodar({ "head-mantem-1-em": 1, "tail-mantem-1-em": 1 });
    const mudos = conferirDesenho(esqueleto(), spec, observarCanais(estados))
      .filter((d) => d.problema === "sem-trafego")
      .map((d) => d.canal)
      .sort();
    expect(mudos).toEqual(["gatewayA.cortado", "gatewayB.cortado", "head.cortado"]);
  });
});
