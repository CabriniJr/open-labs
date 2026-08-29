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
  await expect(page.locator(".doc-toc")).toBeVisible();
  await expect(page.locator(".doc__around-link").first()).toBeVisible();

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

  // Termo que só existe no menu lateral: `data-pagefind-ignore` tem que valer.
  await campo.fill("Toda a documentação");
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
