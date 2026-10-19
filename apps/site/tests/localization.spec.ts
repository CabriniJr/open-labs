import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { assessmentDigest, readAssessments } from "@ovh/handbook-format/contract";

async function choose(page: Page, language: "en" | "pt-BR") {
  await page.getByRole("button", { name: /Open settings|Abrir configurações/, exact: true }).click();
  await page.getByRole("combobox", { name: /Language|Idioma/, exact: true }).selectOption(language);
  await expect(page.locator("html")).toHaveAttribute("lang", language);
  await page.getByRole("button", { name: /Close settings|Fechar configurações/, exact: true }).click();
}
const bank = readAssessments(JSON.parse(readFileSync(new URL("../../../handbooks/kubernetes/assessments.json", import.meta.url), "utf8")));
const browserErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => { const errors: string[] = []; browserErrors.set(page, errors); page.on("pageerror", (e) => errors.push(e.message)); });
test.afterEach(({ page }) => { expect(browserErrors.get(page)).toEqual([]); });
test("português na primeira visita aguarda o commit das ilhas antes de traduzir", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("openlabs-language-v1", "pt-BR"));
  for (const [route, selector] of [["", ".hero-sim"], ["handbooks/otel/", ".roadmap"], ["labs/cardinality-and-the-bill/", ".cardinalidade"], ["labs/pod-lifecycle/", ".predicao"]]) {
    await page.goto(route!);
    const island = page.locator(`astro-island:has(${selector})`).first();
    await island.scrollIntoViewIfNeeded();
    await expect(island).toHaveAttribute("data-locale-hydrated", "true");
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  }
});
test("hambúrguer persiste idioma e tema, mantém manifesto nativo e fecha por Escape", async ({ page }) => {
  await page.goto("labs/pod-lifecycle/");
  const original = await page.locator(".podlab-editor textarea").inputValue();
  await choose(page, "pt-BR");
  await expect(page.getByRole("button", { name: "Aplicar manifesto", exact: true })).toBeVisible();
  expect(await page.locator(".podlab-editor textarea").inputValue()).toBe(original);
  await page.getByRole("button", { name: "Abrir configurações", exact: true }).click();
  await page.getByRole("combobox", { name: "Aparência", exact: true }).selectOption("dark");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Abrir configurações", exact: true })).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload(); await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("handbooks/kubernetes/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Handbook Visual de Kubernetes");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test("avaliação em português conserva gabarito e código e exporta respostas originais", async ({ page }) => {
  await page.goto("handbooks/kubernetes/#assessment");
  const player = page.getByTestId("assessment-player"); await player.scrollIntoViewIfNeeded();
  await expect(player).toHaveAttribute("data-hydrated", "true");
  const code = await player.locator(".assessment-code code").first().textContent();
  await choose(page, "pt-BR");
  await expect(player.locator("[data-question-id=restart-identity] h3")).toContainText("UID do Pod");
  await player.locator("input[value=same-uid]").check();
  await player.locator(".assessment-submit button[type=submit]").click();
  await player.locator(".assessment-submit button[type=submit]").click();
  await expect(player.locator(".assessment-result h3")).toHaveText("Nota 0,71 / 10");
  await expect(player.locator(".assessment-resolution h4").first()).toHaveText("Por que esta resposta");
  await expect(player.locator('[data-question-id=startup-sequence] .assessment-resolution')).toContainText("O ReplicaSet cria o objeto Pod → O scheduler atribui o Pod a um nó → O kubelet inicia o contêiner → O Pod fica Ready no lab");
  await expect(player.locator('[data-question-id=does-this-pod-fit] .assessment-resolution')).toContainText("Um request de 3000m não cabe");
  expect(await player.locator(".assessment-code code").first().textContent()).toBe(code);
  const pending = page.waitForEvent("download"); await player.getByRole("button", { name: "Baixar relatório da tentativa", exact: true }).click();
  const stream = await (await pending).createReadStream(); const chunks: Buffer[] = []; if (!stream) throw new Error("No report"); for await (const c of stream) chunks.push(Buffer.from(c));
  const report = JSON.parse(Buffer.concat(chunks).toString()); expect(report.bank.digest).toBe(assessmentDigest(bank)); expect(report.answers["restart-identity"]).toBe("same-uid");
  await choose(page, "en"); await expect(player.locator(".assessment-result h3")).toHaveText("Grade 0.71 / 10");
});
test("documentação e busca oferecem as duas línguas com links preservados", async ({ page }) => {
  await page.goto("docs/localization/"); await choose(page, "pt-BR");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Idioma|Língua/);
  const search = page.getByRole("searchbox"); await search.fill("avaliações");
  await expect(page.locator(".doc-search__hit").first()).toBeVisible();
  await expect(page.locator(".doc-search__hit").first()).toHaveAttribute("href", /\/docs\//);
  await choose(page, "en"); await search.fill("assessment");
  await expect(page.locator(".doc-search__hit").first()).toContainText(/assessment|Assessment/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Language and appearance");
});
test("Studio traduz controles e conserva fontes editáveis", async ({ page }) => {
  await page.goto("studio/"); await expect(page.getByTestId("handbook-studio")).toHaveAttribute("data-hydrated", "true");
  const source = await page.getByRole("textbox", { name: "Edit handbook.yaml", exact: true }).inputValue();
  await choose(page, "pt-BR");
  await expect(page.getByRole("button", { name: "Exportar bundle", exact: true })).toBeVisible();
  expect(await page.locator(".studio-editor > textarea").inputValue()).toBe(source);
  await page.getByRole("button", { name: "Avaliações", exact: true }).click();
  await expect(page.getByRole("button", { name: "Aprovar esta questão", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Nome do educador", exact: true })).toBeVisible();
});
