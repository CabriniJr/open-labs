// packages/splunk-domain/src/baldes/fios.test.ts
//
// O desenho do `baldes.mmd` contra o run dele: canal mudo e rótulo que nomeia
// outro kind.
//
// O cenário em que as quatro portas acordam é o do índice pequeno — com os
// limites de verdade, nada congela em menos de vinte e cinco dias simulados, e
// a porta do congelamento ficaria muda num run curto. Isso não é um defeito do
// desenho: é o lab dizendo que congelar é raro até o dia em que não é.
import { World, emissoesPerdidas } from "@ovh/depth-core";
import type { WorldState } from "@ovh/depth-core";
import {
  conferirDesenho,
  observarCanais,
  parseSkeleton,
  relatoDeDivergencias,
} from "@ovh/mermaid-skeleton";
import { describe, expect, it } from "vitest";
import BALDES_MMD from "./baldes.mmd?raw";
import { baldesWorld } from "./world.js";

const esqueleto = () => {
  const parsed = parseSkeleton(BALDES_MMD);
  if (!parsed.ok) throw new Error(`baldes.mmd inválido: ${parsed.errors.join(" | ")}`);
  return parsed.value;
};

const rodar = (params: Readonly<Record<string, number>> = {}, ticks = 200) => {
  const spec = baldesWorld(params);
  const world = new World(spec);
  const estados: WorldState[] = [];
  for (let i = 0; i < ticks; i += 1) {
    world.advance(1);
    estados.push(world.state);
  }
  return { spec, estados, ultimo: world.state };
};

/** Índice pequeno e morno curto: a escada inteira se move, e congela. */
const ESCADA_INTEIRA = { "max-warm": 6, "max-total-gb": 8 };

describe("o desenho do baldes.mmd não mente sobre o run", () => {
  it("com a escada inteira em movimento, nenhum canal fica mudo", () => {
    const { spec, estados } = rodar(ESCADA_INTEIRA);
    const divs = conferirDesenho(esqueleto(), spec, observarCanais(estados));
    expect(divs, `\n${relatoDeDivergencias(divs)}`).toEqual([]);
  });

  it("são as quatro arestas do mmd, todas com kind declarado", () => {
    const sk = esqueleto();
    const dados = sk.edges.filter((e) => e.line === "data");
    expect(dados).toHaveLength(4);
    expect(dados.every((e) => e.messageKind !== null)).toBe(true);
  });

  it("a escada é uma corrente, e a ordem dos estados é propriedade do desenho", () => {
    /*
      A ordem é a lição: um balde não escolhe para onde vai, ele envelhece.
      Um desenho em que o quente alcançasse o congelado diretamente ensinaria
      que existe atalho, e não existe — todo balde passa pelos quatro estados.
    */
    const sk = esqueleto();
    const proximo = (de: string) => sk.edges.filter((e) => e.from === de).map((e) => e.to);
    expect(proximo("eventos")).toEqual(["quente"]);
    expect(proximo("quente")).toEqual(["morno"]);
    expect(proximo("morno")).toEqual(["frio"]);
    expect(proximo("frio")).toEqual(["congelado"]);
    expect(proximo("congelado")).toEqual([]);
  });

  it("o que vira balde vira balde no QUENTE, e nunca antes", () => {
    // A primeira aresta carrega evento; as outras três carregam balde. É onde
    // a unidade da fase muda, e é por isso que todo limite daqui para frente é
    // de tamanho ou de tempo, nunca de contagem de eventos.
    const sk = esqueleto();
    const kinds = sk.edges.filter((e) => e.line === "data").map((e) => e.messageKind);
    expect(kinds).toEqual(["evento", "balde", "balde", "balde"]);
  });
});

describe("em cada cenário, o que carrega carrega o kind declarado", () => {
  const CENARIOS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
    "defaults de verdade": {},
    "escada inteira": ESCADA_INTEIRA,
    "congelando por idade": { "max-warm": 2, "retencao-dias": 2, "horas-por-tick": 24 },
    "com arquivo": { ...ESCADA_INTEIRA, arquivar: 1 },
    "baldes pequenos": { "max-data-size-mb": 100, "max-warm": 20, "max-total-gb": 4 },
    "volume alto": { "gb-por-dia": 400, ...ESCADA_INTEIRA },
    "parado": { "gb-por-dia": 0 },
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

  it("num run curto, a porta do congelamento fica muda — e é o esperado", () => {
    // A prova de que o cenário da escada inteira exercita algo. Com os limites
    // de verdade e vinte ticks, nada envelheceu o bastante para sair.
    const { spec, estados } = rodar({}, 20);
    const mudos = conferirDesenho(esqueleto(), spec, observarCanais(estados))
      .filter((d) => d.problema === "sem-trafego")
      .map((d) => d.canal)
      .sort();
    expect(mudos).toEqual(["frio.congela", "morno.rola"]);
  });
});
