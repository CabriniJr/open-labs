import { expect, test } from "@playwright/test";

test("disconnected signals: candidates grow with traffic; trace_id makes it one", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.goto("labs/disconnected-signals/");
  const lab = page.getByTestId("incident-lab");
  await expect(lab).toBeVisible();
  const veredito = lab.getByTestId("inc-veredito");
  await expect(veredito).toContainText("32 candidate traces");
  await lab.getByRole("radio", { name: "80 req/s" }).click();
  await expect(veredito).toContainText("118 candidate traces");
  await lab.getByText("trace_id on the log line").click();
  await expect(veredito).toContainText("1 candidate trace");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(erros).toEqual([]);
});

test("disconnected signals: the showcase ends on the cost", async ({ page }) => {
  await page.goto("labs/disconnected-signals/#showcase");
  const vit = page.getByTestId("incident-showcase");
  await expect(vit).toBeVisible();
  await vit.getByRole("button", { name: /the price of the missing id/ }).click();
  await vit.getByRole("button", { name: "Pause" }).click();
  await expect(vit.locator(".cpuvit-linhas")).toContainText("candidates32");
});
