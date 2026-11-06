import { expect, test } from "@playwright/test";

test("a vitrine do Collector desce até o envelope OTLP, e a simulação continua lá", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.goto("labs/collector-pipeline/#showcase");
  const vit = page.getByTestId("collector-showcase");
  await expect(vit).toBeVisible();
  await vit.getByRole("button", { name: /what goes on the wire/ }).click();
  await vit.getByRole("button", { name: "Pause" }).click();
  await expect(vit.locator(".cpuvit-niveis li[data-on]")).toHaveText("envelope");
  await expect(vit.locator(".mo-packets")).toContainText("ExportTraceServiceRequest");
  await page.getByRole("tab", { name: /Simulation/ }).click();
  await expect(page.locator("svg.dui-stage").first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(erros).toEqual([]);
});

test("a vitrine da anatomia monta a árvore no backend, e o proxy a parte em duas", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.goto("labs/anatomy-of-a-trace/#showcase");
  const vit = page.getByTestId("anatomy-showcase");
  await expect(vit).toBeVisible();
  await vit.getByRole("button", { name: /The backend builds the tree/ }).click();
  await vit.getByRole("button", { name: "Pause" }).click();
  await expect(vit.locator(".cpuvit-niveis li[data-on]")).toHaveText("tree");
  await expect(vit.locator(".cpuvit-linhas")).toContainText("traces1");
  await vit.getByText("A proxy strips headers before payments").click();
  await vit.getByRole("button", { name: /The backend builds the tree/ }).click();
  await expect(vit.locator(".cpuvit-linhas")).toContainText("traces2");
  await page.getByRole("tab", { name: /Simulation/ }).click();
  await expect(page.locator("svg.dui-stage").first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(erros).toEqual([]);
});

test("a vitrine dos pilares: sem correlação o relógio dá quatro candidatos; com ela, um", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.goto("labs/three-pillars/#showcase");
  const vit = page.getByTestId("pillars-showcase");
  await expect(vit).toBeVisible();
  await vit.getByRole("button", { name: /Joined by the clock/ }).click();
  await vit.getByRole("button", { name: "Pause" }).click();
  await expect(vit.locator(".cpuvit-linhas")).toContainText("candidates4");
  await vit.getByText("trace_id in logs, exemplars in metrics").click();
  await vit.getByRole("button", { name: /One id through all three/ }).click();
  await expect(vit.locator(".cpuvit-linhas")).toContainText("candidates1");
  await page.getByRole("tab", { name: /Simulation/ }).click();
  await expect(page.locator("svg.dui-stage").first()).toBeVisible();
  expect(erros).toEqual([]);
});

test("a vitrine da amostragem: head perde o erro, tail roteado o guarda, tail espalhado guarda metade", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.goto("labs/head-vs-tail-sampling/#showcase");
  const vit = page.getByTestId("sampling-showcase");
  await expect(vit).toBeVisible();
  const veredito = async (modo: string, titulo: RegExp, esperado: string) => {
    await vit.getByRole("radio", { name: modo }).click();
    await vit.getByRole("button", { name: titulo }).click();
    await vit.getByRole("button", { name: "Pause" }).click();
    await expect(vit.locator(".cpuvit-linhas")).toContainText(esperado);
  };
  await veredito("Head", /never recorded/, "(error)dropped");
  await veredito("Tail, routed by trace", /kept, whole/, "(error)whole");
  await veredito("Tail, spread", /kept, in half/, "(error)only payments");
  expect(erros).toEqual([]);
});

test("a vitrine da cardinalidade monta o cubo até 2 304 000, e sem o cliente para em 288", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.goto("labs/cardinality-and-the-bill/#showcase");
  const vit = page.getByTestId("cardinality-showcase");
  await expect(vit).toBeVisible();
  await vit.getByRole("button", { name: /every point carries every key/ }).click();
  await vit.getByRole("button", { name: "Pause" }).click();
  await expect(vit.locator(".cpuvit-linhas")).toContainText("series2 304 000");
  await vit.getByText("Add enduser.id").click();
  await vit.getByRole("button", { name: /every point carries every key/ }).click();
  await expect(vit.locator(".cpuvit-linhas")).toContainText("series288");
  expect(erros).toEqual([]);
});

test("a vitrine dos providers: sem SDK nada sai; com ele, spans empurrados e um ponto puxado", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.goto("labs/providers/#showcase");
  const vit = page.getByTestId("providers-showcase");
  await expect(vit).toBeVisible();
  await vit.getByRole("button", { name: /the providers decided/ }).click();
  await vit.getByRole("button", { name: "Pause" }).click();
  await expect(vit.locator(".cpuvit-linhas")).toContainText("metric points out1");
  await vit.getByText("SDK installed").click();
  await vit.getByRole("button", { name: /the providers decided/ }).click();
  await expect(vit.locator(".cpuvit-linhas")).toContainText("spans out0");
  await expect(vit.locator(".cpuvit-linhas")).toContainText("metric points out0");
  expect(erros).toEqual([]);
});
