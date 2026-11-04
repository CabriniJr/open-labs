// packages/splunk-domain/src/ingestao/world.test.ts
//
// A tabela-verdade do lab, rodando: três lugares para o `props.conf` × duas
// topologias, e só duas das seis combinações quebram o evento certo.
//
// Estes testes são a tese. Se um dia eles passarem a concordar com a intuição
// de que "o arquivo está no servidor, logo vale", o lab passou a ensinar o
// contrário do que a documentação diz.
import { World } from "@ovh/depth-core";
import { describe, expect, it } from "vitest";
import { estadoDaIngestao } from "./estado.js";
import { aQuebraVale, ingestaoWorld, quemParseia, ondeEstaOProps } from "./world.js";

const UF = 0;
const MEIO = 1;
const IDX = 2;

/** Um run longo o bastante para fechar blocos de 64K e chegar ao índice. */
function rodar(params: Readonly<Record<string, number>>, ticks = 120) {
  const world = new World(ingestaoWorld(params));
  world.advance(ticks);
  return estadoDaIngestao(world.state);
}

describe("quem executa a fase de parsing", () => {
  it("sem heavy forwarder no caminho, é o indexador", () => {
    expect(quemParseia({ "meio-cozinha": 0 })).toBe("idx");
  });

  it("com heavy forwarder no caminho, é ele — e o indexador não reprocessa", () => {
    expect(quemParseia({ "meio-cozinha": 1 })).toBe("meio");
    const e = rodar({ "meio-cozinha": 1, "props-em": MEIO });
    expect(e.parseouNoMeio).toBe(true);
    expect(e.parseouNoIndexador).toBe(false);
    expect(e.eventosJaProntos).toBeGreaterThan(0);
  });

  it("o forwarder universal NUNCA parseia, e é o que a documentação diz", () => {
    // Não existe parâmetro que mova a fase para ele. A ausência é a tese:
    // `quemParseia` tem dois valores possíveis, e "uf" não é um deles.
    for (const cozinha of [0, 1]) {
      expect(quemParseia({ "meio-cozinha": cozinha })).not.toBe("uf");
    }
  });
});

describe("a tabela-verdade: onde o arquivo está × quem executa a fase", () => {
  const CASOS: readonly (readonly [string, number, number, boolean])[] = [
    ["props no UF, parsing no indexador", UF, 0, false],
    ["props no UF, parsing no heavy forwarder", UF, 1, false],
    ["props no meio, parsing no indexador", MEIO, 0, false],
    ["props no meio, parsing no heavy forwarder", MEIO, 1, true],
    ["props no indexador, parsing no indexador", IDX, 0, true],
    ["props no indexador, parsing no heavy forwarder", IDX, 1, false],
  ];

  it.each(CASOS)("%s", (_nome, props, cozinha, vale) => {
    expect(aQuebraVale({ "props-em": props, "meio-cozinha": cozinha })).toBe(vale);
  });

  it("duas das seis combinações funcionam — e é por isso que o lab existe", () => {
    const funcionam = CASOS.filter(([, , , vale]) => vale);
    expect(funcionam).toHaveLength(2);
  });

  it("a regra é 'o arquivo está em quem executa a fase', e não uma lista", () => {
    // A guarda contra alguém reescrever `aQuebraVale` como um switch de seis
    // casos: a regra tem UMA frase, e os seis casos saem dela.
    for (const [, props, cozinha, vale] of CASOS) {
      const params = { "props-em": props, "meio-cozinha": cozinha };
      expect(ondeEstaOProps(params) === quemParseia(params)).toBe(vale);
    }
  });
});

describe("o que o índice recebe, que é o único lugar onde isso se vê", () => {
  it("com a quebra no lugar certo, um stack trace é UM evento", () => {
    const e = rodar({ "props-em": IDX, "meio-cozinha": 0 });
    expect(e.partidos).toBe(0);
    expect(e.fragmentos).toBe(0);
    expect(e.eventosNoIndice).toBeGreaterThan(0);
  });

  it("com a quebra no lugar errado, ele vira doze — e nada reclama", () => {
    const e = rodar({ "props-em": UF, "meio-cozinha": 0, "linhas-do-registro": 12 });
    expect(e.partidos).toBeGreaterThan(0);
    expect(e.eventosPorRegistroPartido).toBe(12);
  });

  it("o número de eventos por registro partido é o do parâmetro, medido no run", () => {
    for (const linhas of [4, 12, 30]) {
      const e = rodar({ "props-em": UF, "linhas-do-registro": linhas, "multilinha-a-cada": 10 });
      expect(e.eventosPorRegistroPartido, `com ${linhas} linhas`).toBe(linhas);
    }
  });

  it("mover o heavy forwarder para o caminho QUEBRA um props que estava certo", () => {
    // É o defeito que este lab existe para tornar visível: ninguém tocou no
    // arquivo, ninguém tocou na aplicação, e o índice muda.
    const antes = rodar({ "props-em": IDX, "meio-cozinha": 0 });
    const depois = rodar({ "props-em": IDX, "meio-cozinha": 1 });
    expect(antes.partidos).toBe(0);
    expect(depois.partidos).toBeGreaterThan(0);
    expect(depois.eventosNoIndice).toBeGreaterThan(antes.eventosNoIndice);
  });

  it("o índice infla com fragmentos, e a licença paga por eles", () => {
    const certo = rodar({ "props-em": IDX, "meio-cozinha": 0 });
    const errado = rodar({ "props-em": UF, "meio-cozinha": 0 });
    expect(errado.eventosNoIndice).toBeGreaterThan(certo.eventosNoIndice);
    // Os dois leram exatamente os mesmos registros: a diferença é só a quebra.
    expect(errado.registrosEscritos).toBe(certo.registrosEscritos);
  });
});

describe("a fase de input, que é a única que o forwarder universal executa", () => {
  it("o que sai dele é bloco de 64K, e o bloco só fecha quando enche", () => {
    const e = rodar({}, 3);
    expect(e.registrosEscritos).toBeGreaterThan(0);
    // Em três ticks a 40 registros de uma linha, não fecha 64 KiB.
    expect(e.blocosEnviados).toBe(0);
    expect(e.registrosNaFila).toBeGreaterThan(0);
    expect(e.enchimentoDoBloco).toBeGreaterThan(0);
    expect(e.enchimentoDoBloco).toBeLessThan(1);
  });

  it("o atraso entre escrever e poder pesquisar é o buffer, e ele é visível", () => {
    const cedo = rodar({}, 4);
    expect(cedo.eventosNoIndice).toBe(0);
    const depois = rodar({}, 40);
    expect(depois.eventosNoIndice).toBeGreaterThan(0);
  });

  it("sem tráfego nenhum, nada atravessa — e o índice fica vazio", () => {
    const e = rodar({ "registros-por-tick": 0 }, 50);
    expect(e.registrosEscritos).toBe(0);
    expect(e.eventosNoIndice).toBe(0);
  });
});
