// packages/otel-domain/src/anatomia/fios.test.ts
//
// O desenho da anatomia contra o run dela.
//
// Duas das três formas de o `.mmd` mentir sem falhar moram em
// `@ovh/mermaid-skeleton/conferir` — fio sem emissão e rótulo que nomeia outro
// kind. A terceira (emissão sem fio) é do motor, não do formato, e está em
// `../sem-perda.test.ts` junto com os outros labs.
//
// Nos três casos o mundo é válido, o run roda e nenhum erro aparece. É o que
// torna o conjunto necessário: o formato não falha alto, ele ensina outra coisa.
import { World, emissoesPerdidas } from "@ovh/depth-core";
import { conferirDesenho, observarCanais, parseSkeleton, relatoDeDivergencias } from "@ovh/mermaid-skeleton";
import type { WorldState } from "@ovh/depth-core";
import { describe, expect, it } from "vitest";
import ANATOMY_MMD from "./anatomy.mmd?raw";
import { anatomiaWorld } from "./world.js";

const esqueleto = () => {
  const parsed = parseSkeleton(ANATOMY_MMD);
  if (!parsed.ok) throw new Error(`anatomy.mmd inválido: ${parsed.errors.join(" | ")}`);
  return parsed.value;
};

const rodar = (params: Record<string, number> = {}, ticks = 20) => {
  const spec = anatomiaWorld(params);
  const world = new World(spec);
  const estados: WorldState[] = [];
  for (let i = 0; i < ticks; i += 1) {
    world.advance(1);
    estados.push(world.state);
  }
  return { spec, estados, ultimo: world.state };
};

describe("o desenho do anatomy.mmd não mente sobre o run", () => {
  it("no caminho feliz, nenhum canal fica mudo e nenhum rótulo nomeia outro kind", () => {
    const { spec, estados } = rodar();
    const divs = conferirDesenho(esqueleto(), spec, observarCanais(estados));
    expect(divs, `\n${relatoDeDivergencias(divs)}`).toEqual([]);
  });

  it("são as oito arestas do mmd, e não um subconjunto que por acaso passa", () => {
    // Sem isto a conferência acima passaria com lista vazia se alguém quebrasse
    // o parser: zero aresta é zero aresta divergente.
    const sk = esqueleto();
    expect(sk.edges.filter((e) => e.line === "data")).toHaveLength(8);
    expect(sk.edges.every((e) => e.messageKind !== null)).toBe(true);
  });

  it("o único composto é a raiz, e nenhum fio sai dela", () => {
    // A premissa de `conferirDesenho`, cobrada aqui também: ela levanta se um
    // fio sair de composto, e o dia em que a anatomia ganhar um subgraph com
    // fio é o dia em que esta suíte precisa decidir o que fazer. O parser hoje
    // recusa aresta em id de subgraph (provado em `conferir.test.ts`), então
    // isto é rede de segunda camada.
    const { spec } = rodar({}, 1);
    expect(() => conferirDesenho(esqueleto(), spec, new Map())).not.toThrow(
      /fio saindo de composto/u,
    );
  });
});

describe("e com os parâmetros de defeito ligados", () => {
  /*
    Os defeitos que o lab ensina mudam quais portas emitem: um serviço sem
    instrumentação para de exportar span, e derrubar o cabeçalho corta o que
    segue para frente. Então canal mudo aqui é ESPERADO, e cobrar lista vazia
    seria cobrar que o lab não ensinasse.

    O que continua valendo nos cenários é a outra metade: um canal que carrega
    tem de carregar o kind que o rótulo promete. Isso não depende de parâmetro
    nenhum, e é por isso que estes testes filtram por `kind-divergente`.
  */
  const CENARIOS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
    "cabeçalho derrubado no meio": { "derrubar-cabecalho-em": 2 },
    "um serviço sem instrumentação": { "sem-instrumentacao": 2 },
    "amostragem ignorada embaixo": { "taxa-de-amostragem": 0.5, "ignorar-amostragem": 1 },
    "nada amostrado": { "taxa-de-amostragem": 0 },
  };

  for (const [nome, params] of Object.entries(CENARIOS)) {
    it(`${nome}: o que carrega carrega o kind declarado`, () => {
      const { spec, estados, ultimo } = rodar(params);
      const divs = conferirDesenho(esqueleto(), spec, observarCanais(estados)).filter(
        (d) => d.problema === "kind-divergente",
      );
      expect(divs, `\n${relatoDeDivergencias(divs)}`).toEqual([]);
      // E nenhuma emissão cai no vácuo em cenário de defeito tampouco: um
      // caminho que o parâmetro desliga tem de ficar mudo nas DUAS pontas.
      expect(emissoesPerdidas(ultimo)).toEqual([]);
    });
  }

  it("`nada amostrado` de fato silencia os canais de export", () => {
    // A prova de que os cenários acima exercitam algo: sem esta, o filtro por
    // `kind-divergente` passaria mesmo se os parâmetros não mudassem nada.
    const { spec, estados } = rodar({ "taxa-de-amostragem": 0 });
    const mudos = conferirDesenho(esqueleto(), spec, observarCanais(estados))
      .filter((d) => d.problema === "sem-trafego")
      .map((d) => d.canal);
    expect(mudos.length).toBeGreaterThan(0);
    expect(mudos.every((c) => c.endsWith(".export"))).toBe(true);
  });
});
