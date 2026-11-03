import { expect, test, type Page } from "@playwright/test";

async function ready(page: Page, selector: string) {
  const island = page.locator(`astro-island:has(${selector})`).first();
  await island.scrollIntoViewIfNeeded();
  await expect(island).not.toHaveAttribute("ssr", /.*/, { timeout: 20_000 });
}

test("the live flow keeps its state, selection and navigation across projections", async ({ page }, info) => {
  await page.goto("");
  await ready(page, ".hero-sim");
  await page.getByRole("button", { name: "Pause simulation" }).click();
  const viewport = page.locator(".hero-sim .scene-viewport");
  const pausedFrame = await viewport.locator(".dui-stage").innerHTML();
  await page.waitForTimeout(850); // One complete model tick must pass without advancing.
  expect(await viewport.locator(".dui-stage").innerHTML()).toBe(pausedFrame);
  const outerTitle = await viewport.locator(".dui-stage").getAttribute("aria-label");
  await viewport.getByRole("button", { name: "Isometric", exact: true }).click();
  await expect(viewport.locator(".scene-spatial")).toBeVisible();
  await expect(viewport.locator(".dui-stage")).toBeHidden();
  await expect(viewport.locator('.scene-node[data-id="collector"]')).toBeVisible();
  await page.screenshot({ path: info.outputPath("home-isometric.png"), fullPage: true });
  await viewport.getByRole("button", { name: "3D", exact: true }).click();
  const top = viewport.locator('.scene-node[data-id="collector"] .scene-node__top');
  const initial = await top.getAttribute("points");
  await viewport.locator(".scene-spatial").focus();
  await page.keyboard.press("ArrowRight");
  await expect(top).not.toHaveAttribute("points", initial!);
  await page.keyboard.press("0");
  await expect(top).toHaveAttribute("points", initial!);
  await viewport.getByRole("button", { name: "Zoom in" }).click();
  await expect(viewport.locator(".scene-status")).toContainText("120%");
  await viewport.getByRole("button", { name: "Reset view" }).click();
  await expect(viewport.locator(".scene-status")).toContainText("100%");
  await viewport.getByRole("button", { name: "2D", exact: true }).click();
  await expect(viewport.locator(".dui-stage")).toBeVisible();
  await viewport.locator('.dui-stage__objeto[data-id="collector"]').first().dblclick();
  await expect(viewport.locator(".dui-stage")).not.toHaveAttribute("aria-label", outerTitle!);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test("the motion timeline and experiment switches survive a view change", async ({ page }, info) => {
  await page.goto("labs/hard-context-and-baggage/");
  await ready(page, ".ctxlab");
  const lab = page.getByTestId("context-lab");
  const timeline = lab.getByRole("slider", { name: "Timeline" });
  const max = Number(await timeline.getAttribute("max"));
  await timeline.fill(String(Math.round(max * .55 / 10) * 10));
  const position = await timeline.inputValue();
  const viewport = lab.locator(".scene-viewport");
  await viewport.getByRole("button", { name: "3D", exact: true }).click();
  await expect(timeline).toHaveValue(position);
  await viewport.locator(".scene-spatial").focus();
  await page.keyboard.press("ArrowRight");
  await expect(timeline).toHaveValue(position);
  await lab.getByRole("switch", { name: "Proxy forwards headers" }).click();
  await expect(lab.locator(".ctxlab-status")).toHaveText("1 request · 2 traces");
  await expect(viewport).toHaveAttribute("data-mode", "3d");
  await viewport.getByRole("button", { name: "Scene contents" }).click();
  const part = viewport.locator(".scene-contents button").first();
  await part.click();
  await expect(lab.locator(".mo-selection")).toBeVisible();
  await page.screenshot({ path: info.outputPath("context-3d.png"), fullPage: true });
  await viewport.getByRole("button", { name: "2D", exact: true }).click();
  await expect(timeline).toHaveValue(position);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test("catalog filters are shareable, reloadable and recover from empty results", async ({ page }, info) => {
  await page.goto("labs/");
  await page.getByRole("combobox", { name: "Filter by handbook" }).selectOption("otel");
  await page.getByRole("combobox", { name: "Filter by availability" }).selectOption("ready");
  await expect(page.locator('[data-lab-group="cpu"]')).toBeHidden();
  await expect(page.locator('[data-lab-group="otel"]')).toBeVisible();
  await expect(page).toHaveURL(/handbook=otel.*status=ready/);
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Filter by handbook" })).toHaveValue("otel");
  await page.screenshot({ path: info.outputPath("lab-discovery.png"), fullPage: true });
  await page.getByRole("searchbox", { name: "Search labs" }).fill("no-such-lab-xyz");
  await expect(page.getByRole("heading", { name: "No labs match these filters." })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator('[data-lab-group="cpu"]')).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search labs" })).toHaveValue("");
  await expect(page).not.toHaveURL(/handbook=|status=|q=/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});
