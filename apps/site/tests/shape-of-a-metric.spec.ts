import { expect, test } from "@playwright/test";

test("the shape of a metric: a restart makes a naive cumulative backend read negative requests", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.goto("labs/the-shape-of-a-metric/");
  const lab = page.getByTestId("metric-lab");
  await expect(lab).toBeVisible();
  for (let i = 0; i < 3; i += 1) await lab.getByRole("button", { name: /Fast request/ }).click();
  await lab.getByRole("button", { name: "Collect now" }).click();
  await lab.getByRole("button", { name: "Restart the process" }).click();
  await lab.getByRole("button", { name: /Slow request/ }).click();
  await lab.getByRole("button", { name: "Collect now" }).click();
  await expect(lab.locator("tbody tr").nth(1).locator("td").last()).toHaveText("-2");
  await lab.getByText("Backend honours start time").click();
  await expect(lab.locator("tbody tr").nth(1).locator("td").last()).toHaveText("1");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(erros).toEqual([]);
});

test("the shape of a metric: the showcase switches temporality and rebuilds the film", async ({ page }) => {
  await page.goto("labs/the-shape-of-a-metric/#showcase");
  const vit = page.getByTestId("metric-showcase");
  await expect(vit).toBeVisible();
  await vit.getByRole("radio", { name: "delta" }).click();
  await vit.getByRole("button", { name: /what the backend concludes/ }).click();
  await vit.getByRole("button", { name: "Pause" }).click();
  await expect(vit.locator(".cpuvit-niveis li[data-on]")).toHaveText("backend");
});
