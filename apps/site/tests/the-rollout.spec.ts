import { expect, test } from "@playwright/test";

test("the rollout: starting from code warns; the recommended order does not", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.goto("labs/the-rollout/");
  const lab = page.getByTestId("rollout-lab");
  await expect(lab).toBeVisible();
  const veredito = lab.getByTestId("ro-veredito");
  await expect(veredito).not.toContainText("0 steps");
  await lab.getByRole("button", { name: "Recommended order" }).click();
  await expect(veredito).toContainText("0 steps done before their prerequisites");
  await lab.getByRole("button", { name: "Move Put a Collector in the path down" }).click();
  await expect(veredito).toContainText("1 step done before");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(erros).toEqual([]);
});

test("the rollout: the showcase climbs to the plan", async ({ page }) => {
  await page.goto("labs/the-rollout/#showcase");
  const vit = page.getByTestId("rollout-showcase");
  await expect(vit).toBeVisible();
  await vit.getByRole("button", { name: /the order is the plan/ }).click();
  await vit.getByRole("button", { name: "Pause" }).click();
  await expect(vit.locator(".cpuvit-linhas")).toContainText("done before their prerequisites0");
});
