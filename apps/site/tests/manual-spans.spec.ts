import { expect, test } from "@playwright/test";

test("manual spans: forgetting end() loses the parent and orphans the child", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.goto("labs/manual-spans/");
  const lab = page.getByTestId("manual-lab");
  await expect(lab).toBeVisible();

  await lab.getByRole("button", { name: "Run to the end" }).click();
  await expect(lab.getByTestId("man-veredito")).toHaveText("Every span ended and arrived.");
  await expect(lab.getByTestId("mem-checkout")).toContainText("dropped after end: order.total");

  await lab.getByRole("button", { name: "Comment out line 6" }).click();
  await lab.getByRole("button", { name: "Run to the end" }).click();
  await expect(lab.getByTestId("man-veredito")).toContainText("Never exported: checkout");
  await expect(lab.locator("tbody tr")).toHaveCount(1);
  await expect(lab.locator("tbody tr td").last()).toHaveText("orphan");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(erros).toEqual([]);
});

test("manual spans: the showcase rebuilds with end() commented out", async ({ page }) => {
  await page.goto("labs/manual-spans/#showcase");
  const vit = page.getByTestId("manual-showcase");
  await expect(vit).toBeVisible();
  await vit.getByText("Comment out span.end()").click();
  await vit.getByRole("button", { name: /what the backend got/ }).click();
  await vit.getByRole("button", { name: "Pause" }).click();
  await expect(vit.locator(".cpuvit-linhas")).toContainText("orphans1");
});
