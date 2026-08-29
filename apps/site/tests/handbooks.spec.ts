import { expect, test } from "@playwright/test";

/**
 * O catálogo é a promessa da capa: se a landing anuncia um handbook e a página
 * dele não abre, o site mente. Estes testes andam o caminho inteiro.
 */
test("the landing lists the handbooks and each one opens", async ({ page }) => {
  await page.goto("");

  const cartoes = page.locator(".handbooks .hb-card");
  await expect(cartoes).toHaveCount(2);

  await cartoes.filter({ hasText: "RISC-V" }).click();
  await expect(page.locator("h1")).toContainText("RISC-V");
});

test("a handbook page shows roadmap, articles and labs", async ({ page }) => {
  await page.goto("handbooks/riscv/");

  await expect(page.getByRole("heading", { name: "Roadmap" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Articles and labs" })).toBeVisible();
  await expect(page.locator(".hb-phase")).toHaveCount(6);
  await expect(page.locator(".hb-group")).toHaveCount(6);
  await expect(page.locator(".hb-item").first()).toContainText("coming");
});

test("only the OpenTelemetry handbook draws the interactive map", async ({ page }) => {
  await page.goto("handbooks/otel/");
  await expect(page.locator(".roadmap")).toBeVisible();

  await page.goto("handbooks/riscv/");
  await expect(page.locator(".roadmap")).toHaveCount(0);
});

test("the handbooks index links back into each handbook", async ({ page }) => {
  await page.goto("handbooks/");

  await expect(page.locator(".hb-card")).toHaveCount(2);
  await page.locator(".hb-card").first().click();
  await expect(page.locator("h1")).toContainText("OpenTelemetry");
});

test("handbook pages do not scroll horizontally", async ({ page }) => {
  for (const rota of ["handbooks/", "handbooks/otel/", "handbooks/riscv/"]) {
    await page.goto(rota);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, rota).toBeLessThanOrEqual(1);
  }
});
