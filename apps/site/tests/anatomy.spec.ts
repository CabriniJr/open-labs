import { expect, test } from "@playwright/test";

/**
 * O lab da anatomia, na tela.
 *
 * O que se cobra aqui são as **conclusões erradas** que o desenho tem de
 * produzir. É incomum, e é o ponto: derrubar um cabeçalho não pode dar erro —
 * tem de dar duas árvores plausíveis. Se um dia isso deixar de acontecer, o lab
 * parou de ensinar o que acontece de verdade.
 */

async function rodando(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("labs/anatomy-of-a-trace/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 20_000 });
  await expect
    .poll(async () => page.locator(".dui-stage__trilho").count(), { timeout: 15_000 })
    .toBeGreaterThan(0);
  await expect
    .poll(async () => (await page.locator(".anatomia-lab__resumo").textContent()) ?? "", {
      timeout: 25_000,
    })
    .toContain("trace");
}

const escolher = (page: import("@playwright/test").Page, rotulo: string) =>
  page.locator(".anatomia-lab__campo").filter({ hasText: rotulo }).getByRole("combobox");

test("o caminho feliz é uma árvore só, com os quatro serviços", async ({ page }) => {
  await rodando(page);

  await expect(page.locator(".anatomia-lab__resumo")).toHaveAttribute("data-arvores", "1");
  const galhos = page.locator(".anatomia-lab__galhos li").filter({ hasNotText: "trace " });
  await expect(galhos).toHaveCount(4);
  await expect(galhos.first()).toContainText("gateway");
});

test("derrubar o cabeçalho dá DUAS árvores, e nenhum erro", async ({ page }) => {
  await rodando(page);
  await escolher(page, "drop the header").selectOption("2");

  await expect
    .poll(async () => page.locator(".anatomia-lab__resumo").getAttribute("data-arvores"), {
      timeout: 30_000,
    })
    .toBe("2");
  await expect(page.locator(".anatomia-lab__resumo")).toContainText("none of them knows");
  // As duas fecham: quatro spans no total, e nenhum órfão para denunciar.
  const galhos = page.locator(".anatomia-lab__galhos li").filter({ hasNotText: "trace " });
  await expect(galhos).toHaveCount(4);
  await expect(page.locator('.anatomia-lab__galhos li[data-orfao="true"]')).toHaveCount(0);
});

test("sem instrumentação no meio, a árvore fecha com um salto a menos", async ({ page }) => {
  await rodando(page);
  await escolher(page, "uninstrumented service").selectOption("3");

  await expect
    .poll(
      async () =>
        page.locator(".anatomia-lab__galhos li").filter({ hasNotText: "trace " }).count(),
      { timeout: 30_000 },
    )
    .toBe(3);
  // Continua UMA árvore, e ela não se sabe incompleta — é o caso que engana.
  await expect(page.locator(".anatomia-lab__resumo")).toHaveAttribute("data-arvores", "1");
  await expect(page.locator(".anatomia-lab__resumo")).toContainText("exported nothing");
});
