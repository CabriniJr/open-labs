import { expect, test } from "@playwright/test";

async function scrub(page: import("@playwright/test").Page, fraction: number) {
  const range = page.getByRole("slider", { name: "Timeline" });
  const max = Number(await range.getAttribute("max"));
  await range.fill(String(Math.round(max * fraction)));
}

test("o lab toca o filme da propagação e mostra o traceparent no fio", async ({ page }) => {
  await page.goto("labs/hard-context-and-baggage/");
  const lab = page.getByTestId("context-lab");
  await lab.scrollIntoViewIfNeeded();
  await expect(lab.getByRole("img", { name: /Sequence diagram/ })).toBeVisible();
  await lab.getByRole("button", { name: /Inject: context becomes a header/ }).click();
  await expect(lab.locator(".ctxlab-tp")).toBeVisible();
  await expect(lab.locator(".dui-stage")).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("o proxy que descarta headers transforma um pedido em dois traces", async ({ page }) => {
  await page.goto("labs/hard-context-and-baggage/");
  const lab = page.getByTestId("context-lab");
  await lab.scrollIntoViewIfNeeded();
  await expect(lab.locator(".ctxlab-status")).toHaveText("1 request · 1 trace");
  await lab.getByText("Proxy forwards headers").click();
  await expect(lab.locator(".ctxlab-status")).toHaveText("1 request · 2 traces");
  await scrub(page, 1);
  await expect(lab.getByText("orphan — no parent context")).toBeVisible();
});
