import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("openlabs-language-v1")) localStorage.setItem("openlabs-language-v1", "en");
  });
});

const bench = (page: import("@playwright/test").Page) => page.locator(".lab-bench");

test("focus mode gives the lab the whole screen, with its own Break it beside it", async ({ page }) => {
  await page.goto("labs/three-pillars/");
  await expect(bench(page)).toHaveAttribute("data-bench", "ready");
  await page.locator("[data-bench-focus]").click();
  await expect(bench(page)).toHaveAttribute("data-focus", "true");
  const box = await bench(page).boundingBox();
  const vp = page.viewportSize()!;
  expect(Math.round(box!.width)).toBe(vp.width);
  expect(Math.round(box!.height)).toBe(vp.height);
  await expect(bench(page).locator(".bench-guide h2")).toHaveText(/^Break it/u);
  // O lab continua vivo dentro do foco: trocar de modo funciona.
  await bench(page).getByRole("tab", { name: /Showcase/u }).click();
  await expect(bench(page).locator(".modos")).toHaveAttribute("data-modo", "showcase");
  await page.locator("[data-bench-focus]").click();
  await expect(bench(page)).toHaveAttribute("data-focus", "false");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("auto layout follows the screen's orientation", async ({ page }) => {
  await page.goto("labs/three-pillars/");
  await page.locator("[data-bench-focus]").click();
  const vp = page.viewportSize()!;
  await expect(bench(page)).toHaveAttribute("data-layout", vp.height > vp.width ? "stack" : "side");
  await page.setViewportSize({ width: Math.max(vp.width, vp.height), height: Math.min(vp.width, vp.height) });
  await expect(bench(page)).toHaveAttribute("data-layout", "side");
  await page.setViewportSize({ width: Math.min(vp.width, vp.height), height: Math.max(vp.width, vp.height) });
  await expect(bench(page)).toHaveAttribute("data-layout", "stack");
});

test("the reader's arrangement is kept: layout, side and guide size", async ({ page }) => {
  await page.goto("labs/three-pillars/");
  await page.locator("[data-bench-focus]").click();
  await page.locator('.bench-bar button[data-layout="stack"]').click();
  await page.locator("[data-bench-swap]").click();
  await expect(bench(page)).toHaveAttribute("data-layout", "stack");
  await expect(bench(page)).toHaveAttribute("data-side", "start");
  const before = await bench(page).evaluate((el) => Number((el as HTMLElement).style.getPropertyValue("--bench-guide")));
  await page.locator(".bench-split").focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  const after = await bench(page).evaluate((el) => Number((el as HTMLElement).style.getPropertyValue("--bench-guide")));
  expect(after).toBeGreaterThan(before);
  await page.reload();
  await page.locator("[data-bench-focus]").click();
  await expect(bench(page)).toHaveAttribute("data-layout", "stack");
  await expect(bench(page)).toHaveAttribute("data-side", "start");
  await expect(page.locator('.bench-bar button[data-layout="stack"]')).toHaveAttribute("aria-checked", "true");
});

test("the focus button never changes the saved arrangement by itself", async ({ page }) => {
  await page.goto("labs/three-pillars/");
  await page.locator("[data-bench-focus]").click();
  await page.locator("[data-bench-focus]").click();
  await page.locator("[data-bench-focus]").click();
  await expect(page.locator('.bench-bar button[data-layout="auto"]')).toHaveAttribute("aria-checked", "true");
});

test("a lab with no Break it opens as stage only, without layout controls", async ({ page }) => {
  await page.goto("labs/cpu/");
  await page.keyboard.press("f");
  await expect(bench(page)).toHaveAttribute("data-focus", "true");
  await expect(bench(page)).toHaveAttribute("data-layout", "stage");
  await expect(page.locator(".bench-bar__layout")).toBeHidden();
  await expect(page.locator(".bench-guide")).toHaveCount(0);
});

test("the guide is a copy: the page keeps its own Break it, with no duplicated ids", async ({ page }) => {
  await page.goto("labs/three-pillars/");
  await page.locator("[data-bench-focus]").click();
  await expect(page.locator(".lab-prosa h2").first()).toHaveText(/^Break it/u);
  const dupes = await page.evaluate(() => {
    const ids = [...document.querySelectorAll("[id]")].map((el) => el.id);
    return ids.filter((id, i) => ids.indexOf(id) !== i);
  });
  expect(dupes).toEqual([]);
});
