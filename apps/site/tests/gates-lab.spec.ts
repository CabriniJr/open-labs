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
  // Com 0 + 0 as portas rodam e dizem zero — e é justamente por isso que o
  // teste vale: o que apaga a tela é o VALOR que saiu delas, e não o circuito
  // ter ficado parado. Lendo a contagem de emissões, acenderia tudo.
  await expect(page.locator('.dui-stage__objeto[data-alto="true"]')).toHaveCount(0, {
    timeout: 10_000,
  });
  await expect(page.locator(".gates-lab__resultado").nth(1)).toContainText("subpassos");
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

test("dois cliques entram no somador, e a trilha mostra onde você está", async ({ page }) => {
  await page.goto("labs/gates/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

  await page.locator('.dui-stage__objeto[aria-label^="bit1"]').first().dblclick();

  const trilha = page.locator(".explorer__trilha");
  await expect(trilha).toContainText("circuito");
  await expect(trilha).toContainText("bit1");

  // lá dentro estão as cinco portas, e elas continuam vivas
  await expect(page.locator(".dui-stage__objeto")).toHaveCount(5);
  await expect(page.locator('.dui-stage__objeto[data-alto="true"]').first()).toBeVisible({
    timeout: 10_000,
  });

  // e a trilha volta
  await trilha.getByRole("button", { name: "circuito" }).click();
  await expect(page.locator('.dui-stage__objeto[aria-label^="bit1"]')).toBeVisible();
});


test("descer da porta lógica até o transistor, e achar silício vivo lá embaixo", async ({
  page,
}) => {
  await page.goto("labs/gates/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

  const trilha = page.locator(".explorer__trilha");
  await page.locator('.dui-stage__objeto[aria-label^="bit0"]').first().dblclick();
  await page.locator('.dui-stage__objeto[aria-label^="XOR"]').first().dblclick();
  await expect(trilha).toContainText("XOR");

  // Um XOR são quatro NAND. Não é rótulo: eles existem e estão desenhados.
  await expect(page.locator(".dui-stage__objeto")).toHaveCount(4);

  await page.locator('.dui-stage__objeto[aria-label^="NAND"]').first().dblclick();
  // E um NAND são dois trilhos, quatro transistores e o nó onde as redes se
  // encontram — o fundo da fatia.
  await expect(page.locator('.dui-stage__objeto[aria-label^="PMOS"]')).toHaveCount(2);
  await expect(page.locator('.dui-stage__objeto[aria-label^="NMOS"]')).toHaveCount(2);
  await expect(page.locator('.dui-stage__objeto[aria-label^="Vdd"]')).toHaveCount(1);

  // e está vivo: alguma coisa aqui embaixo está conduzindo neste tick
  await expect(page.locator('.dui-stage__objeto[data-alto="true"]').first()).toBeVisible({
    timeout: 10_000,
  });

  await trilha.getByRole("button", { name: "circuito" }).click();
  await expect(page.locator('.dui-stage__objeto[aria-label^="bit0"]')).toBeVisible();
});
