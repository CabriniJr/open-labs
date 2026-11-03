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

test("o header acompanha os saltos e a inspeção preserva o instante do filme", async ({ page }) => {
  await page.goto("labs/hard-context-and-baggage/");
  const lab = page.getByTestId("context-lab");
  await lab.scrollIntoViewIfNeeded();
  const live = lab.getByTestId("live-context");
  const trace = live.locator('[data-field="trace-id"] code');
  const parent = live.locator('[data-field="parent-id"] code');
  await lab.getByRole("button", { name: "Inspect hop 1: browser to gateway" }).click();
  const firstTrace = await trace.textContent();
  const firstParent = await parent.textContent();
  await lab.getByRole("button", { name: "Inspect hop 2: gateway to checkout" }).click();
  await expect(trace).toHaveText(firstTrace!);
  await expect(parent).not.toHaveText(firstParent!);
  const time = await lab.getByRole("slider", { name: "Timeline" }).inputValue();
  await lab.getByRole("tab", { name: /Trace inspector/ }).click();
  await expect(page).toHaveURL(/#inspector$/);
  await expect(lab.getByRole("slider", { name: "Timeline" })).toHaveValue(time);
  await lab.getByRole("button", { name: /browser click checkout root/ }).click();
  await expect(lab.locator(".ctxlab-properties")).toContainText(firstParent!);
  await lab.getByRole("button", { name: "Inspect hop 5: proxy to payments" }).click();
  await lab.getByText("Proxy forwards headers").click();
  await expect(live).toContainText("No traceparent arrived");
  await scrub(page, 1);
  await expect(lab.getByRole("button", { name: /payments Charge new root/ })).toBeVisible();
  await lab.getByText("Root sampled").click();
  await expect(lab.locator(".ctxlab-inspector")).toContainText("No spans exported");
});

test("a câmera 3D permite zoom, pan, reset e pinça", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("labs/hard-context-and-baggage/");
  const lab = page.getByTestId("context-lab");
  await lab.scrollIntoViewIfNeeded();
  await lab.getByRole("radio", { name: "Iso", exact: true }).click();
  const stage = lab.locator(".iso-stage");
  await expect(stage).toHaveAttribute("data-backend", /webgpu|webgl2/, { timeout: 20000 });
  await expect(stage).toHaveAttribute("data-camera", /.+/);
  const start = await stage.getAttribute("data-camera");
  await lab.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(stage).toHaveAttribute("data-zoom", "1.25");
  await stage.focus();
  await page.keyboard.press("ArrowRight");
  await expect(stage).not.toHaveAttribute("data-camera", start!);
  await lab.getByRole("button", { name: "Reset 3D camera" }).click();
  await expect(stage).toHaveAttribute("data-camera", start!);
  await stage.scrollIntoViewIfNeeded();
  const b = (await stage.boundingBox())!;
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x - 20, y, id: 0 }, { x: x + 20, y, id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - 45, y, id: 0 }, { x: x + 45, y, id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(async () => Number(await stage.getAttribute("data-zoom"))).toBeGreaterThan(1.5);
  expect(errors).toEqual([]);
});
