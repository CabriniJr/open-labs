import { describe, expect, it } from "vitest";
import { lerManifesto } from "./ler.js";
import { conferirArquivosDeArtigo } from "./conferir.js";
import { EXEMPLARES } from "./conformance/exemplares.js";

/**
 * Cada recusa aqui é um defeito que já aconteceu neste repositório, ou que a
 * página não tem como sobreviver. Um teste por defeito, e **cada um quebra o
 * exemplar de um jeito só** — assim a mensagem que ele cobra é a mensagem que o
 * autor vai ler.
 */
const EXEMPLAR = EXEMPLARES.find((e) => e.yaml !== undefined)!.yaml!;

const comTroca = (de: string, para: string): ReturnType<typeof lerManifesto> => {
  expect(EXEMPLAR, `o exemplar não contém "${de}"`).toContain(de);
  return lerManifesto(EXEMPLAR.replace(de, para), "exemplar quebrado");
};

const texto = (r: ReturnType<typeof lerManifesto>): string => r.problemas.join(" | ");

describe("o manifesto recusa o que a página não sobrevive", () => {
  it("chave desconhecida é recusada, e não ignorada", () => {
    /*
      O defeito mais caro já visto aqui é o item que desaparece em silêncio.
      `titulo:` em vez de `title:` num item seria exatamente isso — e com schema
      permissivo o handbook publicaria com um item sem título.
    */
    const r = comTroca("subject: conformance", "subjet: conformance");
    expect(r.handbook).toBeUndefined();
    expect(texto(r)).toMatch(/subjet|unrecognized|subject/iu);
  });

  it("item pronto sem href é recusado", () => {
    const r = comTroca("status: coming", "status: available");
    expect(texto(r)).toContain("convite que não abre");
  });

  it("item não-pronto COM href é recusado", () => {
    const r = comTroca("    phase: 1", "    phase: 1\n    href: handbooks/exemplar/articles/x");
    expect(texto(r)).toContain("link morto");
  });

  it("item em fase que não existe é recusado", () => {
    const r = comTroca("    phase: 1", "    phase: 7");
    expect(texto(r)).toContain("fase 7");
  });

  it("fase sem nenhum item é recusada", () => {
    const r = comTroca(
      "  - number: 1\n    title: The only phase",
      "  - number: 1\n    title: The only phase",
    );
    expect(r.problemas).toEqual([]);
    const comFaseVazia = lerManifesto(
      EXEMPLAR.replace(
        "articles:",
        "  - number: 2\n    title: An empty phase\n    line: Nothing lives here.\n\narticles:",
      ),
      "exemplar quebrado",
    );
    expect(texto(comFaseVazia)).toContain("degrau faltando");
  });

  it("cor que o medidor de contraste não lê é recusada", () => {
    // `rebeccapurple` é CSS válido e o medidor de contraste deste projeto não
    // sabe lê-lo: tema que não se mede é tema que pode nascer ilegível.
    const r = comTroca('accent: "#425cc7"', "accent: rebeccapurple");
    expect(texto(r)).toContain("hex");
  });

  it("handbook sem mantenedor é recusado", () => {
    const r = comTroca("maintainers:\n  - name: OpenLabs\n    github: CabriniJr", "maintainers: []");
    expect(texto(r)).toMatch(/maintainers/u);
  });

  it("id com maiúscula ou espaço é recusado", () => {
    const r = comTroca("id: exemplar", "id: Exemplar Bonito");
    expect(texto(r)).toContain("minúsculas");
  });

  it("YAML inválido é recusado dizendo que é YAML", () => {
    const r = lerManifesto("apiVersion: [:", "quebrado");
    expect(texto(r)).toContain("YAML inválido");
  });
});

describe("o arquivo do artigo e o manifesto contam a mesma história", () => {
  const h = lerManifesto(EXEMPLAR, "exemplar").handbook!;

  it("artigo anunciado como pronto sem arquivo é link morto", () => {
    const pronto = {
      ...h,
      articles: [
        {
          id: "the-only-article",
          title: "x",
          status: "available" as const,
          phase: 1,
          href: "handbooks/exemplar/articles/the-only-article",
        },
      ],
    };
    const p = conferirArquivosDeArtigo(pronto, []);
    expect(p.join(" ")).toContain("não existe como arquivo");
  });

  it("artigo escrito e anunciado como coming fica invisível", () => {
    const p = conferirArquivosDeArtigo(h, ["the-only-article"]);
    expect(p.join(" ")).toContain("invisível");
  });

  it("arquivo que o manifesto nem lista é recusado também", () => {
    const p = conferirArquivosDeArtigo(h, ["um-texto-solto"]);
    expect(p.join(" ")).toContain("ninguém chega nele");
  });
});
