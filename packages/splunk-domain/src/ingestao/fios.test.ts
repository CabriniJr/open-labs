// packages/splunk-domain/src/ingestao/fios.test.ts
//
// O desenho do `ingestao.mmd` contra o run dele: canal que não carrega nada, e
// rótulo que nomeia outro kind.
//
// Este lab tem uma particularidade que os outros não têm, e ela é o motivo de o
// cenário completo aqui envolver **mexer num parâmetro no meio do run**: as
// duas linhas entre o nível do meio e o indexador são exclusivas por
// construção. Com um forwarder intermediário só a de bloco cru carrega; com um
// heavy forwarder só a de evento. Não existe parametrização estática em que as
// duas acendam, porque isso seria uma topologia que não existe — o que existe é
// alguém trocar a topologia, que é precisamente o gesto que o leitor faz na
// página. O run do teste é esse gesto.
import { World, emissoesPerdidas } from "@ovh/depth-core";
import type { WorldState } from "@ovh/depth-core";
import {
  conferirDesenho,
  observarCanais,
  parseSkeleton,
  relatoDeDivergencias,
} from "@ovh/mermaid-skeleton";
import { describe, expect, it } from "vitest";
import INGESTAO_MMD from "./ingestao.mmd?raw";
import { ingestaoWorld } from "./world.js";

const esqueleto = () => {
  const parsed = parseSkeleton(INGESTAO_MMD);
  if (!parsed.ok) throw new Error(`ingestao.mmd inválido: ${parsed.errors.join(" | ")}`);
  return parsed.value;
};

/** Um run simples, com os parâmetros parados. */
const rodar = (params: Readonly<Record<string, number>> = {}, ticks = 120) => {
  const spec = ingestaoWorld(params);
  const world = new World(spec);
  const estados: WorldState[] = [];
  for (let i = 0; i < ticks; i += 1) {
    world.advance(1);
    estados.push(world.state);
  }
  return { spec, estados, ultimo: world.state };
};

/**
 * O run em que as duas naturezas de carga atravessam: começa com forwarder
 * intermediário e vira heavy forwarder no meio do caminho.
 */
const rodarTrocandoATopologia = (ticks = 120) => {
  const spec = ingestaoWorld({ "meio-cozinha": 0 });
  const world = new World(spec);
  const estados: WorldState[] = [];
  for (let i = 0; i < ticks; i += 1) {
    world.advance(1);
    estados.push(world.state);
    if (i === Math.floor(ticks / 2)) world.setParam("meio-cozinha", 1);
  }
  return { spec, estados, ultimo: world.state };
};

describe("o desenho do ingestao.mmd não mente sobre o run", () => {
  it("trocando a topologia no meio do run, nenhum canal fica mudo", () => {
    const { spec, estados } = rodarTrocandoATopologia();
    const divs = conferirDesenho(esqueleto(), spec, observarCanais(estados));
    expect(divs, `\n${relatoDeDivergencias(divs)}`).toEqual([]);
  });

  it("são as cinco arestas do mmd, todas com kind declarado", () => {
    const sk = esqueleto();
    const dados = sk.edges.filter((e) => e.line === "data");
    expect(dados).toHaveLength(5);
    expect(dados.every((e) => e.messageKind !== null)).toBe(true);
  });

  it("é uma esteira, e não um leque: cada nó tem um sucessor", () => {
    /*
      A forma é o argumento. Um desenho em que o parsing pudesse acontecer em
      dois lugares sugeriria que a fase se divide, e ela não se divide: ela
      acontece uma vez. A única bifurcação do desenho é a do meio para o
      indexador, e as duas pontas chegam no MESMO nó de propósito.
    */
    const sk = esqueleto();
    const sucessores = (de: string) =>
      [...new Set(sk.edges.filter((e) => e.from === de).map((e) => e.to))].sort();
    expect(sucessores("app")).toEqual(["uf"]);
    expect(sucessores("uf")).toEqual(["meio"]);
    expect(sucessores("meio")).toEqual(["idx"]);
    expect(sucessores("idx")).toEqual(["indice"]);
  });

  it("o que sai do forwarder universal é BLOCO, e isso é propriedade do desenho", () => {
    /*
      Se alguém trocar este rótulo para `evento`, o lab continua rodando e passa
      a ensinar que o forwarder universal parseia — que é a crença número um da
      tabela de mal-entendidos desta página.
    */
    const sk = esqueleto();
    const doUf = sk.edges.filter((e) => e.from === "uf" && e.line === "data");
    expect(doUf).toHaveLength(1);
    expect(doUf[0]?.messageKind).toBe("bloco");
  });

  it("as duas linhas do meio carregam naturezas diferentes, e o desenho diz qual", () => {
    const sk = esqueleto();
    const doMeio = sk.edges.filter((e) => e.from === "meio" && e.line === "data");
    expect(
      doMeio.map((e) => `${e.fromPort}:${e.messageKind}`).sort(),
    ).toEqual(["cozido:evento", "cru:bloco"]);
  });
});

describe("em cada cenário, o que carrega carrega o kind declarado", () => {
  const CENARIOS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
    "props no indexador, sem heavy forwarder": { "props-em": 2, "meio-cozinha": 0 },
    "props no indexador, com heavy forwarder": { "props-em": 2, "meio-cozinha": 1 },
    "props no forwarder universal": { "props-em": 0, "meio-cozinha": 0 },
    "props no meio, com heavy forwarder": { "props-em": 1, "meio-cozinha": 1 },
    "registro de uma linha só": { "multilinha-a-cada": 0 },
    "stack trace enorme": { "linhas-do-registro": 60, "multilinha-a-cada": 5 },
    "parado": { "registros-por-tick": 0 },
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

  it("com uma topologia só, a OUTRA linha fica muda — e é o esperado", () => {
    // A prova de que o run que troca a topologia exercita algo. Sem ela, a
    // conferência de canal mudo passaria com parâmetros inertes.
    const mudos = (params: Readonly<Record<string, number>>) => {
      const { spec, estados } = rodar(params);
      return conferirDesenho(esqueleto(), spec, observarCanais(estados))
        .filter((d) => d.problema === "sem-trafego")
        .map((d) => d.canal)
        .sort();
    };
    expect(mudos({ "meio-cozinha": 0 })).toEqual(["meio.cozido"]);
    expect(mudos({ "meio-cozinha": 1 })).toEqual(["meio.cru"]);
  });
});
