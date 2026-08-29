import { expect, test } from "@playwright/test";

test("a documentação abre com os quatro temas", async ({ page }) => {
  await page.goto("docs/");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Documentação");
  for (const tema of ["Comece por aqui", "O motor", "Escrever um lab", "Andamento"]) {
    await expect(page.getByRole("heading", { name: tema, level: 2 })).toBeVisible();
  }
});

test("um capítulo mostra tempo de leitura, sumário e vizinhos", async ({ page }) => {
  await page.goto("docs/theory/");

  await expect(page.locator(".doc__meta")).toContainText("min de leitura");
  await expect(page.locator(".doc__around-link").first()).toBeVisible();

  // O sumário é uma coluna própria: acima de 1100px ele aparece, abaixo sai de
  // cena de propósito — em telas estreitas roubaria a largura do texto.
  const largura = page.viewportSize()?.width ?? 0;
  const sumario = page.locator(".doc-toc");
  if (largura >= 1100) await expect(sumario).toBeVisible();
  else await expect(sumario).toBeHidden();

  // O índice à esquerda marca onde o leitor está.
  await expect(page.locator('.doc-sidebar a[aria-current="page"]')).toHaveCount(1);
});

test("o link de editar aponta para o arquivo real no GitHub", async ({ page }) => {
  await page.goto("docs/theory/");

  await expect(page.getByRole("link", { name: "Editar no GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/CabriniJr/otel-visual-handbook/edit/main/docs/theory.md",
  );
});

test("a busca acha o conteúdo e ignora a navegação", async ({ page }) => {
  await page.goto("docs/theory/");

  const campo = page.getByRole("searchbox");
  await expect(campo).toBeVisible();

  // Termo que só existe no corpo de um documento.
  await campo.fill("Ptolemy");
  await expect(page.locator(".doc-search__hit").first()).toBeVisible();

  // Frase que só existe no menu lateral. Entre aspas, porque sem elas o
  // Pagefind casa as palavras separadas — e "documentação" está no corpo de
  // quase todo documento. Aqui o que se testa é `data-pagefind-ignore`.
  await campo.fill('"Toda a documentação"');
  await expect(page.locator(".doc-search__hit")).toHaveCount(0);
});

test("a tecla / foca a busca sem digitar a barra no campo", async ({ page }) => {
  await page.goto("docs/theory/");

  await page.keyboard.press("/");
  const campo = page.getByRole("searchbox");
  await expect(campo).toBeFocused();
  await expect(campo).toHaveValue("");
});

test("o tema escolhido sobrevive ao reload", async ({ page }) => {
  await page.goto("docs/");

  const raiz = page.locator("html");
  await page.getByRole("button", { name: "Alternar tema claro e escuro" }).click();
  const escolhido = await raiz.getAttribute("data-theme");
  expect(escolhido === "dark" || escolhido === "light").toBe(true);

  await page.reload();
  await expect(raiz).toHaveAttribute("data-theme", escolhido!);
});

test("a landing leva à documentação e mostra os quatro níveis", async ({ page }) => {
  await page.goto("");

  await expect(page.locator(".levels__item")).toHaveCount(4);
  await expect(page.locator(".docs-state")).toContainText("The written record");

  await page.getByRole("link", { name: "Read the documentation" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Documentação");
});

test("nada rola na horizontal em 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 720 });
  for (const rota of ["", "docs/", "docs/theory/"]) {
    await page.goto(rota);
    const excedeu = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(excedeu, `"${rota}" rola na horizontal em 360px`).toBe(false);
  }
});

test("cada página tem um só h1 e não pula nível de título", async ({ page }) => {
  for (const rota of ["", "docs/", "docs/theory/", "docs/model-format/", "docs/PROGRESS/"]) {
    await page.goto(rota);
    const niveis = await page.evaluate(() =>
      [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) => Number(h.tagName[1])),
    );

    const h1 = niveis.filter((n) => n === 1).length;
    expect(h1, `"${rota}" tem ${h1} h1`).toBe(1);

    // Pular de h2 para h4 quebra a navegação por títulos do leitor de tela.
    const pulos = niveis.filter((n, i) => i > 0 && n > niveis[i - 1]! + 1);
    expect(pulos, `"${rota}" pula nível de título`).toEqual([]);
  }
});

test("o foco é visível em tudo que se alcança pelo teclado", async ({ page }) => {
  await page.goto("docs/theory/");

  // Percorrido com Tab de verdade, e não com `focus()`: `:focus-visible` só
  // vale quando o navegador entende que a interação foi por teclado.
  const vistos: string[] = [];
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("Tab");
    const foco = await page.evaluate(() => {
      const el = document.activeElement;
      if (el === null || el === document.body) return null;
      const s = getComputedStyle(el);
      return {
        onde: el.outerHTML.slice(0, 80),
        estilo: s.outlineStyle,
        largura: parseFloat(s.outlineWidth),
      };
    });
    if (foco === null) continue;
    vistos.push(foco.onde);
    expect(foco.estilo, `sem contorno de foco: ${foco.onde}`).not.toBe("none");
    expect(foco.largura, `contorno de foco fino demais: ${foco.onde}`).toBeGreaterThanOrEqual(2);
  }

  expect(new Set(vistos).size, "o Tab não andou pela página").toBeGreaterThan(5);
});

test("em tela estreita o índice vem recolhido, e abre num toque", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 720 });
  await page.goto("docs/theory/");

  const dobra = page.locator(".doc__fold");
  expect(await dobra.evaluate((el: HTMLDetailsElement) => el.open)).toBe(false);
  await expect(page.locator(".doc-sidebar")).toBeHidden();

  // `> summary` porque cada tema do índice também é um `<details>`.
  await page.locator(".doc__fold > summary").click();
  await expect(page.locator(".doc-sidebar")).toBeVisible();
});

test("em tela larga o índice é a coluna da esquerda, sempre aberta", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("docs/theory/");

  await expect(page.locator(".doc-sidebar")).toBeVisible();
  // O resumo é um controle que não controla nada aqui: fora de cena.
  await expect(page.locator(".doc__fold > summary")).toBeHidden();
});
