import { expect, test } from "@playwright/test";

/**
 * O lab é uma ilha `client:only`: nada dele existe no HTML do servidor, então
 * todo teste começa esperando o palco aparecer.
 */
test("a máquina de pilha desenha, roda e responde", async ({ page }) => {
  await page.goto("labs/rpn/");
  const palco = page.locator(".dui-stage");
  await expect(palco).toBeVisible({ timeout: 15_000 });

  // As peças existem como peças, e não como caixas com nome bonito.
  for (const peca of ["expression tape", "belt", "dispatcher", "stack", "operator"]) {
    await expect(palco.getByText(peca, { exact: true })).toBeVisible();
  }

  // A pilha é um `store`, e um store é desenhado como estante: a prateleira é
  // o que o separa de quem processa.
  const pilha = palco.locator('.dui-stage__objeto[data-id="pilha"]').first();
  await expect(pilha.locator(".dui-stage__prateleira")).toHaveCount(1);

  // 3 4 + 2 5 + * = 49, e o número sai do que as peças fizeram.
  await expect(page.locator(".rpn-lab__resultado")).toHaveText("49", { timeout: 30_000 });
});

test("o que a pilha guarda aparece na caixa, com o topo marcado", async ({ page }) => {
  await page.goto("labs/rpn/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

  const pilha = page.locator('.dui-stage__objeto[data-id="pilha"]').first();
  await expect(
    pilha.locator('.dui-stage__conteudo g[data-ativo="true"] .dui-stage__linha-chave'),
  ).toHaveText("top", { timeout: 30_000 });
});

test("expressão que não fecha é recusada antes de rodar", async ({ page }) => {
  await page.goto("labs/rpn/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

  await page.getByLabel("Postfix expression").fill("3 +");
  await page.getByRole("button", { name: "Load and restart" }).click();

  // Recusar aqui é o que impede o travamento silencioso: um operador que
  // encontrasse a pilha curta não emitiria nada, e a máquina pararia sem dizer.
  const erro = page.locator(".rpn-lab__erros li").first();
  await expect(erro).toContainText("symbol 2");
  await expect(erro).toContainText("two values");
});

test("dividir por zero não vira zero", async ({ page }) => {
  await page.goto("labs/rpn/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

  await page.getByLabel("Postfix expression").fill("7 0 /");
  await page.getByRole("button", { name: "Load and restart" }).click();
  await expect(page.locator(".rpn-lab__resultado")).toContainText("7 / 0", { timeout: 30_000 });
});

test("o lab não rola na horizontal", async ({ page }) => {
  await page.goto("labs/rpn/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
