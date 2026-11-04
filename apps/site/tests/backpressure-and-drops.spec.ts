import { expect, test } from "@playwright/test";

test("backpressure: with the limiter the edge refuses; without it, the process dies and takes the queue", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.goto("labs/backpressure-and-drops/");
  const lab = page.getByTestId("pressure-lab");
  await expect(lab).toBeVisible();
  const contadores = lab.getByTestId("pr-contadores");

  await lab.getByRole("radio", { name: "queue_size 15" }).click();
  await lab.getByText("Backend up").click();
  for (let i = 0; i < 3; i += 1) await lab.getByRole("button", { name: "5 ticks" }).click();
  await expect(contadores).toContainText("refused at the edge50");
  await expect(contadores).toContainText("lost in the crash0");

  await lab.getByText("memory_limiter", { exact: true }).click();
  await lab.getByText("Backend up").click();
  await lab.getByText("Backend up").click();
  for (let i = 0; i < 3; i += 1) await lab.getByRole("button", { name: "5 ticks" }).click();
  await expect(contadores).toContainText("lost in the crash90");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(erros).toEqual([]);
});

test("backpressure: the showcase names the outcome after the options", async ({ page }) => {
  await page.goto("labs/backpressure-and-drops/#showcase");
  const vit = page.getByTestId("pressure-showcase");
  await expect(vit).toBeVisible();
  await expect(vit.getByRole("button", { name: /The queue is full/ })).toBeVisible();
  await vit.getByRole("radio", { name: "queue_size 15" }).click();
  await vit.getByText("memory_limiter in the pipeline").click();
  await expect(vit.getByRole("button", { name: /the process dies/ })).toBeVisible();
});
