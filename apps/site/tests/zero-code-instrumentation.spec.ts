import { expect, test } from "@playwright/test";

test("zero-code: the agent leaves 150 ms dark, and a manual span lights its own step", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.goto("labs/zero-code-instrumentation/");
  const lab = page.getByTestId("zerocode-lab");
  await expect(lab).toBeVisible();
  const veredito = lab.getByTestId("zc-veredito");
  await expect(veredito).toContainText("150 ms of 240 ms unexplained");
  await lab.locator("label[for=zc-regras]").click();
  await expect(veredito).toContainText("80 ms of 240 ms unexplained");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(erros).toEqual([]);
});

test("zero-code: the showcase ends on the dark middle", async ({ page }) => {
  await page.goto("labs/zero-code-instrumentation/#showcase");
  const vit = page.getByTestId("zerocode-showcase");
  await expect(vit).toBeVisible();
  await vit.getByRole("button", { name: /the middle is dark/ }).click();
  await vit.getByRole("button", { name: "Pause" }).click();
  await expect(vit.locator(".cpuvit-linhas")).toContainText("unexplained150 ms");
});
