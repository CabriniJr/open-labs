import { expect, test } from "@playwright/test";

test("propagating through a queue: parent for one, links for a batch, orphans without injection", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.goto("labs/propagating-through-a-queue/");
  const lab = page.getByTestId("queue-lab");
  await expect(lab).toBeVisible();
  const veredito = lab.getByTestId("fila-veredito");

  await lab.getByRole("button", { name: "Publish an order" }).click();
  await lab.getByRole("button", { name: "Consume one" }).click();
  await expect(veredito).toContainText("1 traces for 1 orders · 0 orphans · 0 links");

  await lab.getByRole("button", { name: "Publish an order" }).click();
  await lab.getByRole("button", { name: "Publish an order" }).click();
  await lab.getByRole("button", { name: "Consume the batch" }).click();
  await expect(veredito).toContainText("4 traces for 3 orders · 0 orphans · 2 links");

  await lab.getByText("Producer injects traceparent into the headers").click();
  await lab.getByRole("button", { name: "Publish an order" }).click();
  await lab.getByRole("button", { name: "Consume one" }).click();
  await expect(veredito).toContainText("2 traces for 1 orders · 1 orphans · 0 links");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(erros).toEqual([]);
});

test("propagating through a queue: the batch showcase ends with links in the backend", async ({ page }) => {
  await page.goto("labs/propagating-through-a-queue/#showcase");
  const vit = page.getByTestId("queue-showcase");
  await expect(vit).toBeVisible();
  await vit.getByRole("radio", { name: "As a batch" }).click();
  await vit.getByRole("button", { name: /what the backend shows/ }).click();
  await vit.getByRole("button", { name: "Pause" }).click();
  await expect(vit.locator(".cpuvit-linhas")).toContainText("traces4");
  await expect(vit.locator(".mo-packets")).toContainText("root + 3 links");
});
