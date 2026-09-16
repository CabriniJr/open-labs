import { expect, test } from "@playwright/test";

/**
 * O que só a página responde. As regras sobre a definição e sobre a extração têm
 * teste de unidade; repeti-las aqui seria pagar caro por uma segunda opinião pior.
 */

test("a explicação não aparece antes de o leitor se comprometer", async ({ page }) => {
  await page.goto("labs/providers/");
  const secao = page.locator(".exercicio").first();
  await secao.scrollIntoViewIfNeeded();
  await expect(secao.locator(".exercicio__bloco").first()).toBeVisible();
  await expect(secao.locator(".exercicio__porque")).toHaveCount(0);
});

test("o caminho por TECLADO encaixa o bloco, sem arraste nenhum", async ({ page }) => {
  await page.goto("labs/providers/");
  const secao = page.locator(".exercicio").first();
  await secao.scrollIntoViewIfNeeded();

  // A ilha é `client:visible`: antes de hidratar, o botão está na tela e não
  // escuta ninguém. O clique espera por conta da checagem de ação; a tecla não
  // espera por nada, então a espera é aqui. (`ssr` sai do `astro-island` quando
  // a hidratação acaba.)
  await expect(page.locator("astro-island:has(.exercicio)").first()).not.toHaveAttribute(
    "ssr",
    /.*/u,
  );

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

  // A mesma espera do teste de teclado, e pela mesma razão: a ilha é
  // `client:visible`, e a checagem de ação do Playwright não sabe de
  // hidratação. Sem isto o clique acontece no botão que ainda não escuta
  // ninguém — falha rara, e só sob carga.
  await expect(page.locator("astro-island:has(.exercicio)").first()).not.toHaveAttribute(
    "ssr",
    /.*/u,
  );

  const escolhido = secao.locator(".exercicio__bloco").first();
  await escolhido.click();
  await expect(escolhido).toBeDisabled();
  await expect(escolhido).toHaveAttribute("data-veredito", /certo|errado/u);
  // Todo bloco recebe veredito, inclusive o que ninguém escolheu.
  await expect(secao.locator(".exercicio__bloco[data-veredito]")).toHaveCount(
    await secao.locator(".exercicio__bloco").count(),
  );

  await page.goto("handbooks/otel/");
  await expect(page.locator(".roadmap__placar").first()).toContainText("first try");
});
