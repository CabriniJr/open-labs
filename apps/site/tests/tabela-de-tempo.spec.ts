import { expect, test } from "@playwright/test";

/**
 * A tabela de tempo é a segunda projeção do mesmo run que o palco anima — o
 * slide 43 do deck, e não uma tabela à parte. O terceiro teste é o que
 * importa: ele cobra que as duas vistas não podem divergir, que é a tese do
 * projeto num caso que veio de fora.
 */

test("a tabela de tempo cresce conforme o programa roda", async ({ page }) => {
  await page.goto("/labs/micro");
  const linhas = page.locator("[data-linha-de-tempo]");
  const antes = await linhas.count();
  for (let i = 0; i < 12; i++) {
    await page.getByRole("button", { name: /step|next tick/i }).click();
  }
  expect(await linhas.count()).toBeGreaterThan(antes);
});

test("coluna que não mudou fica vazia, como na tabela original", async ({ page }) => {
  await page.goto("/labs/micro");
  for (let i = 0; i < 6; i++) {
    await page.getByRole("button", { name: /step|next tick/i }).click();
  }
  // A segunda transação carrega o acumulador e não toca o IR.
  const linha = page.locator("[data-linha-de-tempo]").nth(2);
  await expect(linha.locator("[data-coluna='ir']")).toHaveText("");
});

test("a tabela e o palco contam a mesma história: o AC da última linha é o AC do palco", async ({
  page,
}) => {
  await page.goto("/labs/micro");
  // No enquadramento inicial a CPU chega fechada — o AC só existe como o seu
  // próprio objeto no palco depois de entrar no processador.
  await page
    .getByRole("group", { name: "Framing" })
    .getByRole("button", { name: "processor", exact: true })
    .click();
  for (let i = 0; i < 12; i++) {
    await page.getByRole("button", { name: /step|next tick/i }).click();
  }
  const naTabela = await page
    .locator("[data-linha-de-tempo] [data-coluna='ac']:not(:empty)")
    .last()
    .textContent();
  const noPalco = await page
    .locator(".dui-stage__objeto[data-id='ac'] .dui-stage__leitura")
    .textContent();
  expect(naTabela?.trim()).toBe(noPalco?.trim());
});

test("a tabela é a projeção mais grossa: menos linhas do que ticks", async ({ page }) => {
  await page.goto("/labs/micro");
  for (let i = 0; i < 12; i++) {
    await page.getByRole("button", { name: /step|next tick/i }).click();
  }
  expect(await page.locator("[data-linha-de-tempo]").count()).toBeLessThan(12);
});
