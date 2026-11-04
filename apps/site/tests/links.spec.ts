import { expect, test } from "@playwright/test";

/**
 * Nenhum link interno aponta para o nada.
 *
 * Não havia guarda para isto, e o buraco apareceu do jeito que buracos
 * aparecem: escrevi `handbooks/otel/labs/three-pillars` numa página de lab nova,
 * o Astro construiu sem reclamar, o build ficou verde, e o link levava a 404.
 * Duas guardas vizinhas já existiam, e nenhuma pegava isto — vale dizer quais,
 * para ninguém achar que esta é duplicada: `articles.spec.ts` confere as fontes
 * citadas dentro de um artigo, e `articles.test.ts` resolve os links relativos
 * escritos no markdown dos artigos. As duas param na prosa dos artigos. O que
 * faltava era o `<a href>` de qualquer página RENDERIZADA — e foi numa página de
 * lab que o link quebrado entrou.
 *
 * O que se cobra é só o que é nosso: âncora interna. Link externo fica de fora
 * de propósito — depender de rede num teste é trocar uma guarda por um flake, e
 * link morto na OpenTelemetry é problema deles e não falha do build.
 *
 * O percurso parte da raiz e segue os links internos: assim uma página nova
 * entra na varredura por estar ligada ao site, e não por alguém lembrar de
 * acrescentá-la a uma lista.
 */

/**
 * O href RESOLVIDO, e deixar o navegador resolver é a parte que importa.
 *
 * `getAttribute("href")` devolve o que está escrito — e metade dos links deste
 * site é relativa (`../outro-artigo/`), porque artigo linka irmão. Resolver isso
 * à mão foi a primeira tentativa e deu cinco falsos positivos de uma vez: a
 * propriedade `a.href` já vem absoluta, com as regras do próprio HTML.
 */
async function alvosDaPagina(page: import("@playwright/test").Page): Promise<readonly string[]> {
  const origem = new URL(page.url()).origin;
  const brutos = await page.locator("a[href]").evaluateAll((as) =>
    as.map((a) => ({
      resolvido: (a as HTMLAnchorElement).href,
      escrito: a.getAttribute("href") ?? "",
    })),
  );
  return brutos
    .filter(({ escrito }) => !escrito.startsWith("#") && !/^(mailto|tel):/u.test(escrito))
    // Só o que é nosso: link externo fica de fora de propósito, porque depender
    // de rede num teste troca uma guarda por um flake.
    .filter(({ resolvido }) => resolvido.startsWith(origem))
    .map(({ resolvido }) => new URL(resolvido).pathname);
}

test("nenhum link interno do site aponta para o nada", async ({ page, request }) => {
  test.setTimeout(180_000);

  const porVisitar = [""];
  const visitadas = new Set<string>();
  /** caminho quebrado -> páginas que o citam. O relato nomeia as duas pontas. */
  const quebrados = new Map<string, Set<string>>();
  const verificados = new Map<string, boolean>();

  while (porVisitar.length > 0 && visitadas.size < 80) {
    const atual = porVisitar.shift();
    if (atual === undefined || visitadas.has(atual)) continue;
    visitadas.add(atual);

    await page.goto(atual === "" ? "." : atual);
    const alvos = await alvosDaPagina(page);

    for (const alvo of alvos) {
      let ok = verificados.get(alvo);
      if (ok === undefined) {
        // `request` não executa JS e não roda o navegador: é a checagem barata,
        // e para "existe?" é a checagem certa.
        const resposta = await request.get(alvo);
        ok = resposta.ok();
        verificados.set(alvo, ok);
      }

      if (!ok) {
        const quem = quebrados.get(alvo) ?? new Set<string>();
        quem.add(atual === "" ? "(landing)" : atual);
        quebrados.set(alvo, quem);
        continue;
      }

      // Só HTML entra no percurso: seguir um `.svg` ou um `.pdf` não acrescenta
      // link nenhum e gastaria a cota de páginas.
      const ehPagina = !/\.[a-z0-9]{2,5}$/iu.test(alvo) || alvo.endsWith(".html");
      if (ehPagina && !visitadas.has(alvo)) porVisitar.push(alvo);
    }
  }

  // A varredura precisa ter andado: zero página visitada seria verde sem medir.
  expect(visitadas.size, "a varredura não saiu da landing").toBeGreaterThan(5);

  const relato = [...quebrados]
    .map(([alvo, quem]) => `  ${alvo} — citado em ${[...quem].join(", ")}`)
    .join("\n");
  expect([...quebrados.keys()], `\nlink interno para o nada:\n${relato}`).toEqual([]);
});
