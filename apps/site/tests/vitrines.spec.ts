import { expect, test } from "@playwright/test";

test("a vitrine do Collector desce até o envelope OTLP, e a simulação continua lá", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.goto("labs/collector-pipeline/#showcase");
  const vit = page.getByTestId("collector-showcase");
  await expect(vit).toBeVisible();
  await vit.getByRole("button", { name: /what goes on the wire/ }).click();
  await vit.getByRole("button", { name: "Pause" }).click();
  await expect(vit.locator(".cpuvit-niveis li[data-on]")).toHaveText("envelope");
  await expect(vit.locator(".mo-packets")).toContainText("ExportTraceServiceRequest");
  await page.getByRole("tab", { name: /Simulation/ }).click();
  await expect(page.locator("svg.dui-stage").first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(erros).toEqual([]);
});
