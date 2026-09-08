import { test } from "@playwright/test";
const S = "/tmp/claude-1000/-home-guaxinim/28734b3a-502d-4bf1-86ae-66e44590bdb2/scratchpad";
test.use({ deviceScaleFactor: 2 });
test("f1 cpu", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto("labs/cpu/");
  const palco = page.locator("svg.dui-stage").first();
  await palco.waitFor({ state: "visible" });
  await page.waitForTimeout(1500);
  await palco.screenshot({ path: `${S}/f1-cpu.png` });
});
