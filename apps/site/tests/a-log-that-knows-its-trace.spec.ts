import { expect, test } from "@playwright/test";

test("a log that knows its trace: fields link, text does not, and a bare worker has no context", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.goto("labs/a-log-that-knows-its-trace/");
  const lab = page.getByTestId("log-lab");
  await expect(lab).toBeVisible();
  await lab.getByRole("button", { name: "Start a span" }).click();
  await lab.getByRole("button", { name: "log.info(…)" }).click();
  await expect(lab.locator("tbody tr").first().locator("td").last()).toHaveText("POST /checkout");

  await lab.getByText("Hand the context to new threads").click();
  await lab.getByRole("button", { name: "Spawn a worker thread" }).click();
  await lab.getByRole("radio", { name: "worker thread" }).click();
  await lab.getByRole("button", { name: "log.info(…)" }).click();
  await expect(lab.locator("tbody tr").nth(1).locator("td").last()).toHaveText("nothing (no context)");

  await lab.getByText("Log bridge installed").click();
  await lab.getByRole("button", { name: "Start a span" }).click();
  await lab.getByRole("button", { name: "log.info(…)" }).click();
  await expect(lab.locator("tbody tr").first().locator("td").last()).toHaveText("nothing (id in text)");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(erros).toEqual([]);
});

test("a log that knows its trace: the showcase ends on the backend join", async ({ page }) => {
  await page.goto("labs/a-log-that-knows-its-trace/#showcase");
  const vit = page.getByTestId("log-showcase");
  await expect(vit).toBeVisible();
  await vit.getByRole("button", { name: /joins on fields/ }).click();
  await vit.getByRole("button", { name: "Pause" }).click();
  await expect(vit.locator(".cpuvit-linhas")).toContainText("linked to a span3");
});
