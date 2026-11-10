import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("openlabs-language-v1")) localStorage.setItem("openlabs-language-v1", "en");
  });
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
  const mark = page.locator(".course-step [data-course-complete]");
  await mark.click();
  await expect(trail.locator("[data-course-count]")).toHaveText(/^2 \/ /);
  await page.reload();
  trail = await openTrail(page);
  await expect(mark).toHaveAttribute("aria-pressed", "true");
  await expect(trail.locator("[data-course-count]")).toHaveText(/^2 \/ /);
  await mark.click();
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
  // O mapa é uma ilha React: antes da hidratação, o clique cai no HTML e se perde.
  await expect(page.locator(".roadmap")).toHaveAttribute("data-vivo", "true");
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
  await expect(trail.locator(".course-trail__summary > span")).toHaveText("Trilha de aprendizagem");
  await trail.locator('[data-available="true"] button').first().click();
  await expect(trail.locator("[data-course-next-label]")).toHaveText("Continue de onde parou");
  await expect(trail.locator('[data-available="true"] button').first()).toHaveAttribute("aria-label", "Alternar conclusão da atividade");
});

test("the end of an activity offers the next step, and completing it moves forward", async ({ page }) => {
  await page.goto("handbooks/otel/");
  const trail = await openTrail(page);
  await trail.locator("[data-course-continue]").click();
  const step = page.locator(".course-step");
  await expect(step.locator("[data-course-complete]")).toBeVisible();
  const next = await step.locator('a[rel="next"] > span').textContent();
  await step.locator("[data-course-advance]").click();
  await expect(page.locator("h1")).toContainText(next!.trim());
  // A página anterior ficou concluída, e o painel aponta a nova como atual.
  const done = page.locator('.course-trail [data-course-item][data-done="true"]');
  await expect(done).toHaveCount(1);
  await expect(page.locator('.course-trail li:has([aria-current="page"])')).toHaveAttribute("data-done", "false");
  // Concluir aqui troca o atalho por "desfazer" e destaca o próximo.
  await step.locator("[data-course-complete]").click();
  await expect(step.locator("[data-course-advance]")).toBeHidden();
  await expect(step).toHaveAttribute("data-done", "true");
});

test("an article inside the path shows one next step, not two", async ({ page }) => {
  await page.goto("handbooks/otel/articles/what-a-signal-is/");
  await expect(page.locator(".course-step")).toHaveCount(1);
  await expect(page.locator(".article__around")).toHaveCount(0);
});

test("closing a phase marks it complete, and the collapsed bar still shows progress", async ({ page }) => {
  await page.goto("handbooks/otel/");
  const trail = await openTrail(page);
  const phase = trail.locator(".course-trail__phase").first();
  for (const button of await phase.locator("[data-course-toggle]").all()) await button.click();
  await expect(phase).toHaveAttribute("data-complete", "true");
  const total = await phase.locator('[data-available="true"]').count();
  await trail.locator(":scope > summary").click();
  await expect(trail.locator("[data-course-chip]")).toBeVisible();
  await expect(trail.locator("[data-course-chip]")).toHaveText(new RegExp(`^${total} / `));
});
