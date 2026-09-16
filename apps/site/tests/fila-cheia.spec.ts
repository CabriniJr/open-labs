import { expect, test } from "@playwright/test";

/**
 * A fila enchendo, e a máquina avisando que está perdendo.
 *
 * O README da contraparte real diz, por escrito, que a fila enchendo é o que o
 * terminal **não** mostra. O palco também não mostrava: mostrava o descarte
 * saindo pela porta lateral, que é o resultado. A casa ocupada é a causa, e o
 * alerta é o aviso — as duas figuras que este teste segura.
 */
test("a fila mostra casa a casa, enche, e a máquina avisa que está perdendo", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto("labs/providers/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });
  await expect.poll(async () => page.locator(".dui-stage__trilho").count()).toBeGreaterThan(0);

  // A fila mora dentro do processador em lote: é preciso descer até ela.
  await page
    .getByRole("group", { name: "Framing" })
    .getByRole("button", { name: "BatchSpanProcessor", exact: true })
    .click();

  // No padrão da spec (2048) a capacidade não se conta de relance, e o palco
  // fica na barra de nível — que é a resposta certa para aquele número.
  await expect
    .poll(async () => page.locator(".dui-stage__nivel").count(), { timeout: 20_000 })
    .toBeGreaterThan(0);
  expect(await page.locator(".dui-stage__casa").count()).toBe(0);

  // "Break it" #2: a fila de quatro. Agora ela se conta, e o palco troca a
  // barra pelas casas.
  await page
    .locator(".providers-lab__campo")
    .filter({ hasText: "maxQueueSize" })
    .getByRole("combobox")
    .selectOption("4");

  await expect
    .poll(async () => page.locator(".dui-stage__casa").count(), { timeout: 20_000 })
    .toBeGreaterThan(0);

  // Ela enche — e cheia é a CAUSA do descarte que sai ao lado.
  await expect
    .poll(async () => page.locator('.dui-stage__objeto[data-cheia="true"]').count(), {
      timeout: 60_000,
      intervals: [250],
    })
    .toBeGreaterThan(0);

  // E o alerta aparece sobre quem está perdendo agora.
  await expect
    .poll(async () => page.locator('.dui-stage__objeto[data-alerta="true"]').count(), {
      timeout: 60_000,
      intervals: [250],
    })
    .toBeGreaterThan(0);

  // Alerta é sobre AGORA: ele mora no objeto que está descartando, e some no
  // tick em que ele para. Um alerta que ficasse depois de o problema passar
  // seria a porta acesa por causa de um valor que já foi — e é o defeito que
  // este projeto trata como o pior, agora em forma de figura.
  const comAlerta = page.locator('.dui-stage__objeto[data-alerta="true"]').first();
  await expect(comAlerta).toHaveAttribute("data-id", /.+/u);

  await page
    .locator(".providers-lab__campo")
    .filter({ hasText: "maxQueueSize" })
    .getByRole("combobox")
    .selectOption("2048");

  await expect
    .poll(async () => page.locator('.dui-stage__objeto[data-alerta="true"]').count(), {
      timeout: 30_000,
      intervals: [250],
    })
    .toBe(0);
});
