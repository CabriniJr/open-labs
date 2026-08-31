import { expect, test } from "@playwright/test";

/**
 * O artigo é a teoria da fase. Estes testes andam o que a página promete: que
 * ela abre a partir do handbook, que o degrau é uma escolha do leitor e não um
 * parágrafo já aberto, e que as fontes citadas no texto levam a algum lugar.
 */
test("an article opens from the handbook and carries its phase", async ({ page }) => {
  await page.goto("handbooks/cpu/");

  await page.getByRole("link", { name: "From transistor to adder" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toContainText("From transistor to adder");
  await expect(page.locator(".article__eyebrow")).toContainText("phase 2");
  await expect(page.locator(".article__meta")).toContainText("min read");

  // O tema é do handbook, e não o da casa: um handbook de CPU pintado com a
  // cor de outro assunto foi exatamente o defeito que isto guarda.
  await expect(page.locator("html")).toHaveAttribute("data-domain", "cpu");
});

test("the drill-down is closed until the reader opens it", async ({ page }) => {
  await page.goto("handbooks/cpu/articles/from-transistor-to-adder/");

  const degrau = page.locator("details.drill").first();
  await expect(degrau).not.toHaveAttribute("open", "");
  await expect(degrau.locator("p").first()).toBeHidden();

  await degrau.locator("summary").click();
  await expect(degrau.locator("p").first()).toBeVisible();
});

test("every source cited in the text lands on a listed source", async ({ page }) => {
  await page.goto("handbooks/cpu/articles/from-transistor-to-adder/");

  const citacoes = page.locator('.article__prose a[href^="#src-"]');
  const quantas = await citacoes.count();
  expect(quantas).toBeGreaterThan(0);

  for (let i = 0; i < quantas; i++) {
    const href = await citacoes.nth(i).getAttribute("href");
    await expect(page.locator(`${href}`)).toHaveCount(1);
  }

  await expect(page.getByRole("heading", { name: "Primary sources" })).toBeVisible();
});

test("the article points at the lab of its own phase", async ({ page }) => {
  await page.goto("handbooks/cpu/articles/from-transistor-to-adder/");

  await page.locator(".article__meta").getByRole("link", { name: /open the lab/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Adding, gate by gate");
});
