import { expect, test } from "@playwright/test";
const S = "/tmp/claude-1000/-home-guaxinim/28734b3a-502d-4bf1-86ae-66e44590bdb2/scratchpad";
test.use({ deviceScaleFactor: 2 });
test("pilares palco", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto("labs/three-pillars/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(9000);
  await page.locator("svg.dui-stage").first().screenshot({ path: `${S}/pilares-palco.png` });
});
