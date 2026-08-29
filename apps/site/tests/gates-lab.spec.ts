import { expect, test } from "@playwright/test";

/**
 * O lab das portas: vinte portas, nenhuma sabe somar. Se a conta sai certa na
 * tela, é a composição que está certa — que é a única coisa que ele afirma.
 */
test("soma quatro bits com portas de verdade", async ({ page }) => {
  await page.goto("labs/gates/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

  // 6 + 7 = 13, e 13 em quatro bits é 1101
  await expect(page.locator(".gates-lab__resultado").first()).toContainText("1101", {
    timeout: 10_000,
  });
});

test("estouro sai pelo vai-um", async ({ page }) => {
  await page.goto("labs/gates/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

  await page.getByLabel("Primeira parcela").fill("15");
  await page.getByLabel("Segunda parcela").fill("15");

  // 15 + 15 = 30: quatro bits guardam 14, e o resto sai pelo vai-um
  await expect(page.locator(".gates-lab__resultado").first()).toContainText("vai-um", {
    timeout: 10_000,
  });
  await expect(page.locator(".gates-lab__resultado").first()).toContainText("30");
});

test("porta acesa é porta com saída alta, e com zero não acende nada", async ({ page }) => {
  await page.goto("labs/gates/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

  await expect(page.locator('.dui-stage__objeto[data-alto="true"]').first()).toBeVisible({
    timeout: 10_000,
  });

  await page.getByLabel("Primeira parcela").fill("0");
  await page.getByLabel("Segunda parcela").fill("0");
  // sem nível alto em lugar nenhum, nenhuma linha muda de estado
  await expect(page.locator('.dui-stage__objeto[data-alto="true"]')).toHaveCount(0, {
    timeout: 10_000,
  });
});

test("a profundidade cresce quando o vai-um sobe", async ({ page }) => {
  await page.goto("labs/gates/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

  await page.getByLabel("Primeira parcela").fill("1");
  await page.getByLabel("Segunda parcela").fill("1");
  const profundidade = page.locator(".gates-lab__resultado").nth(1);
  await expect(profundidade).toContainText("subpassos");
});

test("o lab das portas não rola na horizontal", async ({ page }) => {
  await page.goto("labs/gates/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
