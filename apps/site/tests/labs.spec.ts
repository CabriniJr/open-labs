import { expect, test } from "@playwright/test";

/**
 * Os dois labs rodavam, estavam publicados, e ainda assim "não apareciam": o
 * único caminho até eles era o fim da página de um handbook. Este teste anda o
 * caminho curto — da navegação até o modelo desenhado na tela.
 */
test("the nav reaches the labs index, and a ready lab opens from it", async ({ page }) => {
  await page.goto("");

  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Labs" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Labs" })).toBeVisible();

  const cartoes = page.locator(".labs-card");
  expect(await cartoes.count()).toBeGreaterThan(2);

  // Um cartao "ready" que nao abre e a mentira que esta pagina existe para nao
  // contar: todo lab anunciado como pronto e um link.
  const prontos = page.locator('.labs-card[data-status="available"]');
  const quantos = await prontos.count();
  expect(quantos).toBeGreaterThan(0);
  for (let i = 0; i < quantos; i++) {
    await expect(prontos.nth(i).locator("a")).toHaveCount(1);
  }

  await page.getByRole("link", { name: "Adding, gate by gate" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Adding, gate by gate");
  // O lab não é uma figura: o desenho só existe se o modelo rodou.
  await expect(page.locator("svg .dui-stage__caixa").first()).toBeVisible();
});

test("a lab that is not written yet is not a link", async ({ page }) => {
  await page.goto("labs/");

  const emConstrucao = page.locator('.labs-card[data-status="coming"]').first();
  await expect(emConstrucao).toContainText("coming");
  await expect(emConstrucao.locator("a")).toHaveCount(0);
});
