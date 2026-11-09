import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("openlabs-language-v1", "en"));
});

async function openTrail(page: import("@playwright/test").Page) {
  const trail = page.locator(".course-trail");
  await expect(trail.locator("[data-course-toggle]").first()).not.toHaveAttribute("hidden");
  if (!(await trail.evaluate((node) => (node as HTMLDetailsElement).open))) await trail.locator(":scope > summary").click();
  return trail;
}

test("completion persists from handbook to article and lab, with a resumable path", async ({ page }) => {
  await page.goto("handbooks/otel/");
  let trail = await openTrail(page);
  const first = trail.locator('[data-course-item][data-available="true"]').first();
  await first.locator("button").click();
  await expect(first.locator("button")).toHaveAttribute("aria-pressed", "true");
  await expect(trail.locator("[data-course-count]")).toHaveText(/^1 \/ /);
  await trail.locator("[data-course-continue]").click();
  trail = await openTrail(page);
  await expect(trail.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(trail.locator("[data-course-count]")).toHaveText(/^1 \/ /);
  await trail.locator("[data-course-active]").click();
  await expect(trail.locator("[data-course-count]")).toHaveText(/^2 \/ /);
  await page.reload();
  trail = await openTrail(page);
  await expect(trail.locator("[data-course-active]")).toHaveAttribute("aria-pressed", "true");
  await expect(trail.locator("[data-course-count]")).toHaveText(/^2 \/ /);
  await trail.locator("[data-course-active]").click();
  await expect(trail.locator("[data-course-count]")).toHaveText(/^1 \/ /);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("legacy lab progress appears in the sidebar and changes update the roadmap", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("ovh:progress:v1", '["three-pillars"]'));
  await page.goto("handbooks/otel/");
  const trail = await openTrail(page);
  const lab = trail.locator('[data-progress-id="three-pillars"]');
  await expect(lab.locator("button")).toHaveAttribute("aria-pressed", "true");
  await expect(trail.locator("[data-course-count]")).toHaveText(/^1 \/ /);
  await lab.locator("button").click();
  await expect(page.locator(".roadmap__progress-count")).toHaveText(/^0 of /);
  await trail.locator(":scope > summary").click();
  await page.locator('.roadmap__node[data-status="available"]').first().locator("button").first().click();
  await openTrail(page);
  await expect(trail.locator("[data-course-count]")).toHaveText(/^1 \/ /);
});

test("navigation collapses and remembers the preference without causing horizontal overflow", async ({ page }) => {
  await page.goto("handbooks/cpu/");
  const trail = await openTrail(page);
  await trail.locator(":scope > summary").click();
  await expect(trail).not.toHaveAttribute("open");
  await page.reload();
  await expect(trail.locator("[data-course-toggle]").first()).not.toHaveAttribute("hidden");
  await expect(trail).not.toHaveAttribute("open");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("unpublished activities do not inflate the completion total", async ({ page }) => {
  await page.goto("handbooks/cpu/");
  const trail = await openTrail(page);
  const available = await trail.locator('[data-available="true"]').count();
  await expect(trail.locator("progress")).toHaveAttribute("max", String(available));
  await expect(trail.locator('[data-available="false"] button')).toHaveCount(0);
});

test("course links work without JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${baseURL}handbooks/otel/`);
  const trail = page.locator(".course-trail");
  await expect(trail).toHaveAttribute("open");
  await trail.locator('[data-available="true"] a').first().click();
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator('.course-trail [aria-current="page"]')).toHaveCount(1);
  await context.close();
});

test("course controls follow the Portuguese language preference", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("openlabs-language-v1", "pt-BR"));
  await page.goto("handbooks/otel/");
  await expect(page.locator("html")).toHaveAttribute("data-locale-ready", "true");
  const trail = await openTrail(page);
  await expect(trail.locator(".course-trail__summary")).toHaveText("Trilha de aprendizagem");
  await trail.locator('[data-available="true"] button').first().click();
  await expect(trail.locator("[data-course-continue]")).toHaveText("Continuar estudando →");
  await expect(trail.locator('[data-available="true"] button').first()).toHaveAttribute("aria-label", "Alternar conclusão da atividade");
});
