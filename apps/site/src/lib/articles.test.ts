import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { HANDBOOKS } from "../data/handbooks.js";

const src = join(dirname(fileURLToPath(import.meta.url)), "..");
const raiz = join(src, "content", "articles");

interface Artigo {
  readonly handbook: string;
  readonly slug: string;
  readonly frontmatter: string;
  readonly corpo: string;
}

const artigos: readonly Artigo[] = readdirSync(raiz, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .flatMap((dir) =>
    readdirSync(join(raiz, dir.name))
      .filter((f) => f.endsWith(".md"))
      .map((f) => {
        const bruto = readFileSync(join(raiz, dir.name, f), "utf8");
        const casou = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(bruto);
        if (casou === null) throw new Error(`${dir.name}/${f} não tem frontmatter`);
        return {
          handbook: dir.name,
          slug: f.replace(/\.md$/, ""),
          frontmatter: casou[1] ?? "",
          corpo: casou[2] ?? "",
        };
      }),
  );

const caso = (a: Artigo) => [`${a.handbook}/${a.slug}`, a] as const;

it("existe artigo para testar", () => {
  expect(artigos.length).toBeGreaterThan(0);
});

/**
 * A promessa desta camada é fonte primária de verdade. Uma fonte listada e
 * nunca citada é enfeite bibliográfico; uma citação apontando para uma fonte
 * que não existe é uma âncora morta que o leitor só descobre clicando. As duas
 * metades são cobradas, porque uma sozinha deixa a outra passar.
 */
describe("as fontes primárias sustentam o texto", () => {
  it.each(artigos.map(caso))("%s: toda fonte listada é citada no corpo", (_id, artigo) => {
    const declaradas = [...artigo.frontmatter.matchAll(/^\s*-\s*id:\s*(\S+)/gm)].map(
      (m) => m[1] ?? "",
    );
    expect(declaradas.length).toBeGreaterThan(0);
    const citadas = new Set(
      [...artigo.corpo.matchAll(/#src-([a-z0-9-]+)/g)].map((m) => m[1] ?? ""),
    );
    for (const id of declaradas) {
      expect([...citadas], `a fonte "${id}" está na lista e ninguém a cita`).toContain(id);
    }
  });

  it.each(artigos.map(caso))("%s: toda citação aponta para uma fonte real", (_id, artigo) => {
    const declaradas = new Set(
      [...artigo.frontmatter.matchAll(/^\s*-\s*id:\s*(\S+)/gm)].map((m) => m[1] ?? ""),
    );
    for (const m of artigo.corpo.matchAll(/#src-([a-z0-9-]+)/g)) {
      expect([...declaradas], `o corpo cita "${m[1]}", que não está na lista`).toContain(m[1]);
    }
  });

  it.each(artigos.map(caso))("%s: um link de fonte é http, não inventado", (_id, artigo) => {
    for (const m of artigo.frontmatter.matchAll(/^\s*url:\s*"([^"]+)"/gm)) {
      expect(m[1]).toMatch(/^https:\/\//);
    }
  });
});

/**
 * O drill-down é o formato, não um adorno: o artigo responde na primeira
 * leitura e guarda o degrau seguinte. Um artigo sem nenhum degrau é um artigo
 * que não está usando esta camada.
 */
describe("o drill-down textual", () => {
  it.each(artigos.map(caso))("%s: tem pelo menos um degrau", (_id, artigo) => {
    expect(artigo.corpo).toMatch(/^>\s*\[!deeper\]/m);
  });

  it.each(artigos.map(caso))("%s: todo degrau tem linha em branco e corpo", (_id, artigo) => {
    const linhas = artigo.corpo.split("\n");
    for (let i = 0; i < linhas.length; i++) {
      if (!/^>\s*\[!deeper\]/.test(linhas[i] ?? "")) continue;
      expect(linhas[i + 1]?.trim(), `degrau na linha ${i + 1} sem linha em branco`).toBe(">");
      expect(linhas[i + 2]?.trim(), `degrau na linha ${i + 1} sem corpo`).toMatch(/^>\s*\S/);
    }
  });
});

/**
 * O artigo e o catálogo dizem a mesma coisa ou o site mente numa das duas
 * pontas: um artigo escrito e anunciado como "coming" fica invisível, e um
 * anunciado como pronto sem arquivo é link morto em produção.
 */
describe("os artigos e o catálogo contam a mesma história", () => {
  const doCatalogo = HANDBOOKS.flatMap((h) =>
    h.articles.map((a) => ({ handbook: h.id, ...a })),
  );

  it("todo artigo escrito está anunciado como pronto", () => {
    for (const artigo of artigos) {
      const item = doCatalogo.find(
        (a) => a.handbook === artigo.handbook && a.id === artigo.slug,
      );
      expect(item, `${artigo.handbook}/${artigo.slug} não está no catálogo`).toBeDefined();
      expect(item?.status, `${artigo.slug} está escrito e anunciado como ${item?.status}`).toBe(
        "available",
      );
      expect(item?.href).toBe(`handbooks/${artigo.handbook}/articles/${artigo.slug}`);
    }
  });

  it("todo artigo anunciado como pronto existe como arquivo", () => {
    const escritos = new Set(artigos.map((a) => `${a.handbook}/${a.slug}`));
    for (const item of doCatalogo.filter((a) => a.status === "available")) {
      expect([...escritos]).toContain(`${item.handbook}/${item.id}`);
    }
  });

  it.each(artigos.map(caso))("%s: título e fase batem com o catálogo", (_id, artigo) => {
    const item = HANDBOOKS.find((h) => h.id === artigo.handbook)?.articles.find(
      (a) => a.id === artigo.slug,
    );
    const titulo = /^title:\s*"(.+)"$/m.exec(artigo.frontmatter)?.[1];
    const fase = Number(/^phase:\s*(\d+)$/m.exec(artigo.frontmatter)?.[1]);
    expect(titulo).toBe(item?.title);
    expect(fase).toBe(item?.phase);
  });
});

/**
 * Um link relativo escrito com um `../` a menos aponta para uma página que não
 * existe, e o build não reclama: HTML estático não valida link. Este teste
 * resolve cada um contra a URL real do artigo.
 */
describe("os links internos dos artigos abrem", () => {
  const rotas = new Set(
    [
      "/",
      "/labs/",
      "/handbooks/",
      "/docs/",
      ...HANDBOOKS.map((h) => `/handbooks/${h.id}/`),
      // A página de crédito do modelo de referência é rota de verdade, e um
      // artigo pode apontar para ela.
      ...HANDBOOKS.filter((h) => h.reference !== undefined).map(
        (h) => `/${h.reference!.href}/`,
      ),
      ...HANDBOOKS.flatMap((h) => [...h.labs, ...h.articles])
        .filter((i) => i.href !== undefined)
        .map((i) => `/${i.href}/`),
    ].map((r) => r.replace(/\/{2,}/g, "/")),
  );

  it.each(artigos.map(caso))("%s", (_id, artigo) => {
    const base = `/handbooks/${artigo.handbook}/articles/${artigo.slug}/`;
    for (const m of artigo.corpo.matchAll(/\]\((\.\.?\/[^)]+)\)/g)) {
      const alvo = posix.resolve(base, m[1] ?? "") + "/";
      expect([...rotas], `${m[1]} vai parar em ${alvo}, que não é página`).toContain(
        alvo.replace(/\/{2,}/g, "/"),
      );
    }
  });
});
