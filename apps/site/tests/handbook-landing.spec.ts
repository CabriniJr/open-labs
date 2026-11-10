import { expect, test } from "@playwright/test";
import { HANDBOOKS } from "../src/data/handbooks.js";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("openlabs-language-v1")) localStorage.setItem("openlabs-language-v1", "en");
  });
});

for (const handbook of HANDBOOKS) {
  test(`${handbook.id}: the landing tells the path as chapters, without horizontal scroll`, async ({ page }) => {
    await page.goto(`handbooks/${handbook.id}/`);
    await expect(page.locator(".hb-hero h1")).toContainText(handbook.name);
    await expect(page.locator(".hb-chapter")).toHaveCount(handbook.phases.length);
    // Toda foto mostra de quem é e sob qual licença.
    for (const figure of await page.locator(".hb-story figure.hb-image").all()) {
      await expect(figure.locator("figcaption")).toContainText(/CC|Public domain/u);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("chapters appear as the reader scrolls to them", async ({ page }) => {
  await page.goto("handbooks/otel/");
  const last = page.locator(".hb-chapter").last().locator("h3");
  await expect(page.locator("html")).toHaveClass(/hb-reveal/u);
  await expect(last).not.toHaveClass(/is-in/u);
  await last.scrollIntoViewIfNeeded();
  await expect(last).toHaveClass(/is-in/u);
  await expect(last).toHaveCSS("opacity", "1");
});

test("without JavaScript nothing is hidden", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${baseURL}handbooks/otel/`);
  await expect(page.locator(".hb-chapter h3").last()).toHaveCSS("opacity", "1");
  await context.close();
});

test("the cover resumes where the reader stopped", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("ovh:progress:v1", '["three-pillars"]'));
  await page.goto("handbooks/otel/");
  const resume = page.locator("[data-hb-resume]");
  await expect(resume.locator("[data-hb-resume-label]")).toHaveText("Continue learning");
  // O primeiro pendente na ordem da trilha é o primeiro artigo da fase 1.
  await expect(resume.locator("[data-hb-resume-title]")).toHaveText("What a signal is");
  await expect(page.locator("#phase-1 [data-chapter-progress]")).toHaveText(/^1\//u);
});
