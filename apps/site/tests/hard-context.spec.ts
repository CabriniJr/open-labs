import { expect, test } from "@playwright/test";

async function scrub(page: import("@playwright/test").Page, fraction: number) {
  const range = page.getByRole("slider", { name: "Timeline" });
  const max = Number(await range.getAttribute("max"));
  // O passo do controle é 10 ms: um valor fora do passo é recusado pelo navegador.
  await range.fill(String(Math.round((max * fraction) / 10) * 10));
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

test("as três vistas andam no mesmo relógio, e a isométrica desenha em WebGL", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.goto("labs/hard-context-and-baggage/");
  const lab = page.getByTestId("context-lab");
  await lab.scrollIntoViewIfNeeded();
  await lab.getByRole("radio", { name: "Topology" }).click();
  await expect(lab.locator("svg.mo-stage")).toHaveCount(1);
  await lab.getByRole("radio", { name: "Iso" }).click();
  // O three.js desce sob demanda; o canvas aparece quando ele chega.
  await expect(lab.locator(".iso-stage canvas")).toHaveCount(1, { timeout: 15_000 });
  await scrub(page, 0.5);
  await expect(lab.locator(".mo-narration")).toContainText(/Fan-out|instrumented/);
  await lab.getByRole("radio", { name: "Sequence" }).click();
  await expect(lab.locator(".iso-stage")).toHaveCount(0);
  expect(erros).toEqual([]);
});
