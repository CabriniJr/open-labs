import { expect, test } from "@playwright/test";

/**
 * O que só a página responde. As regras sobre a definição e sobre a extração têm
 * teste de unidade; repeti-las aqui seria pagar caro por uma segunda opinião pior.
 */

test("a explicação não aparece antes de o leitor se comprometer", async ({ page }) => {
  await page.goto("labs/providers/");
  const secao = page.locator(".exercicio").first();
  await secao.scrollIntoViewIfNeeded();
  await expect(secao.locator(".exercicio__porque")).toHaveCount(0);
});

test("o caminho por TECLADO encaixa o bloco, sem arraste nenhum", async ({ page }) => {
  await page.goto("labs/providers/");
  const secao = page.locator(".exercicio").first();
  await secao.scrollIntoViewIfNeeded();
  // A tecla não espera nada sozinha: mandada antes de a ilha hidratar, ela cai no
  // vão entre o HTML do servidor e o React, e some sem erro.
  await expect(secao).toHaveAttribute("data-vivo", "true", { timeout: 15_000 });

  const primeiro = secao.locator(".exercicio__bloco").first();
  await primeiro.focus();
  await page.keyboard.press("Enter");

  await expect(secao.locator(".exercicio__porque").first()).toBeVisible();
  await expect(secao.locator('.exercicio__lacuna[data-cheia="true"]')).toBeVisible();
});

test("a escolha não se refaz, e o placar do mapa conta o de primeira", async ({ page }) => {
  await page.goto("labs/providers/");
  const secao = page.locator(".exercicio").first();
  await secao.scrollIntoViewIfNeeded();

  await expect(secao).toHaveAttribute("data-vivo", "true", { timeout: 15_000 });

  const certo = secao.locator(".exercicio__bloco[data-veredito]").first();
  await secao.locator(".exercicio__bloco").first().click();
  await expect(secao.locator(".exercicio__bloco").first()).toBeDisabled();
  await expect(certo).toHaveAttribute("data-veredito", /certo|errado/u);

  await page.goto("handbooks/otel/");
  await expect(page.locator(".roadmap__placar").first()).toContainText("first try");
});
