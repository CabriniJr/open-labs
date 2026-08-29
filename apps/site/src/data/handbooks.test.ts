import { describe, expect, it } from "vitest";
import { HANDBOOKS, handbookOf, readyCount, type Handbook } from "./handbooks.js";

/**
 * O catálogo é a promessa da landing. Um item apontando para uma fase que não
 * existe some da página sem aviso — é exatamente a mentira silenciosa que este
 * projeto trata como o pior defeito, então ela morre aqui e não no navegador.
 */
function itens(handbook: Handbook) {
  return [...handbook.articles, ...handbook.labs];
}

describe("catálogo do OpenLabs", () => {
  it("tem id único por handbook", () => {
    const ids = HANDBOOKS.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("acha handbook por id, e não inventa o que não existe", () => {
    expect(handbookOf("otel")?.name).toContain("OpenTelemetry");
    expect(handbookOf("nao-existe")).toBeUndefined();
  });

  it.each(HANDBOOKS.map((h) => [h.id, h] as const))(
    "%s: toda fase é numerada uma vez só e em ordem",
    (_id, handbook) => {
      const numeros = handbook.phases.map((f) => f.number);
      expect(new Set(numeros).size).toBe(numeros.length);
      expect([...numeros].sort((a, b) => a - b)).toEqual(numeros);
    },
  );

  it.each(HANDBOOKS.map((h) => [h.id, h] as const))(
    "%s: todo artigo e todo lab caem numa fase que existe",
    (_id, handbook) => {
      const fases = new Set(handbook.phases.map((f) => f.number));
      for (const item of itens(handbook)) {
        expect(fases.has(item.phase), `${item.id} está na fase ${item.phase}`).toBe(true);
      }
    },
  );

  it.each(HANDBOOKS.map((h) => [h.id, h] as const))(
    "%s: nenhuma fase fica vazia dos dois lados",
    (_id, handbook) => {
      for (const fase of handbook.phases) {
        const daFase = itens(handbook).filter((item) => item.phase === fase.number);
        expect(daFase.length, `fase ${fase.number} (${fase.title}) sem nada`).toBeGreaterThan(0);
      }
    },
  );

  it.each(HANDBOOKS.map((h) => [h.id, h] as const))(
    "%s: id de item não se repete",
    (_id, handbook) => {
      const ids = itens(handbook).map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    },
  );

  it("conta como pronto só o que está pronto", () => {
    expect(readyCount([])).toBe(0);
    expect(
      readyCount([
        { id: "a", title: "A", status: "available", phase: 1 },
        { id: "b", title: "B", status: "coming", phase: 1 },
      ]),
    ).toBe(1);
  });
});

/**
 * O catálogo tem que dizer a verdade sobre o que já dá para abrir.
 *
 * O defeito que originou estes testes: o handbook do RISC-V anunciava
 * "Assemble and run your own program" como **coming** enquanto o lab do caminho
 * de dados já estava no ar fazendo exatamente isso. Ninguém mentiu de propósito
 * — havia duas listas escritas à mão para o mesmo fato, e elas divergiram.
 *
 * A correção de verdade foi juntar as fontes (os labs saem do mapa). Estes
 * testes são a trava: se alguém escrever uma segunda lista de novo, o desacordo
 * morre aqui.
 */
describe("o catálogo não promete o que não abre, nem esconde o que abre", () => {
  it.each(HANDBOOKS.map((h) => [h.id, h] as const))(
    "%s: todo item pronto tem para onde levar",
    (_id, handbook) => {
      const mudos = itens(handbook)
        .filter((item) => item.status === "available" && (item.href ?? "") === "")
        .map((item) => item.id);
      // Um item "pronto" sem link é um convite que não abre nada.
      expect(mudos).toEqual([]);
    },
  );

  it.each(HANDBOOKS.map((h) => [h.id, h] as const))(
    "%s: nada que ainda não existe leva a algum lugar",
    (_id, handbook) => {
      const prometidos = itens(handbook)
        .filter((item) => item.status === "coming" && (item.href ?? "") !== "")
        .map((item) => item.id);
      expect(prometidos).toEqual([]);
    },
  );

  it.each(HANDBOOKS.filter((h) => h.map !== undefined).map((h) => [h.id, h] as const))(
    "%s: o mapa e a lista de labs contam a mesma história",
    (_id, handbook) => {
      const doMapa = handbook.map!.labs.map((lab) => ({
        id: lab.id,
        status: lab.status,
      }));
      const daLista = handbook.labs.map((lab) => ({ id: lab.id, status: lab.status }));
      expect(daLista).toEqual(doMapa);
    },
  );

  it("os labs que existem de verdade estão marcados como prontos", () => {
    // As páginas que o site publica hoje. Escrito à mão de propósito: é a
    // âncora fora do catálogo, e sem ela os dois lados poderiam concordar
    // estando os dois errados.
    const NO_AR = ["labs/gates", "labs/cpu"];
    const linkados = new Set(
      HANDBOOKS.flatMap((h) => itens(h))
        .filter((item) => item.status === "available")
        .map((item) => item.href),
    );
    for (const pagina of NO_AR) {
      expect([...linkados], `${pagina} está no ar e ninguém aponta para ele`).toContain(pagina);
    }
  });
});
