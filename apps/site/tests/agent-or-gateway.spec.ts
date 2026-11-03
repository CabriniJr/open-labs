import { expect, test } from "@playwright/test";

/** Vai para o fim do capítulo que tem este título, pela linha do tempo. */
async function fimDe(page: import("@playwright/test").Page, titulo: string) {
  const lab = page.getByTestId("deployment-lab");
  const i = await lab.locator(".mo-chapter").evaluateAll((els, t) => els.findIndex((e) => e.textContent?.includes(t)), titulo);
  const fracao = await page.evaluate((idx) => {
    const pesos = [...document.querySelectorAll(".mo-scrub__seg")].map((s) => Number(getComputedStyle(s).flexGrow));
    const total = pesos.reduce((a, b) => a + b, 0);
    return pesos.slice(0, idx + 1).reduce((a, b) => a + b, 0) / total;
  }, i);
  const range = lab.getByRole("slider", { name: "Timeline" });
  const max = Number(await range.getAttribute("max"));
  await range.fill(String(Math.round((max * fracao) / 10) * 10 - 30));
}

test("atrás de um Service, nenhum gateway vê um trace inteiro; roteando por trace ID, cada um vê", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.goto("labs/agent-or-gateway/");
  const lab = page.getByTestId("deployment-lab");
  await lab.scrollIntoViewIfNeeded();
  await expect(lab.getByRole("radio", { name: "Gateway", exact: true })).toHaveAttribute("aria-checked", "true");
  await fimDe(page, "Who holds");
  await expect(lab.locator(".deplab-table")).toContainText("broken");
  await expect(lab.locator('[data-entity="nota:gateway-a"]')).toContainText("only fragments");

  await lab.getByRole("radio", { name: "Agent + gateway" }).click();
  await lab.getByText("Route by trace ID").click();
  await fimDe(page, "Who holds");
  await expect(lab.locator(".deplab-table")).toContainText("works");
  await expect(lab.locator('[data-entity="nota:gateway-a"]')).toContainText("holds a whole trace");

  await lab.getByRole("radio", { name: "Iso" }).click();
  await expect(lab.locator(".iso-stage canvas")).toHaveCount(1, { timeout: 15_000 });
  expect(erros).toEqual([]);
});

test("exportar direto abre uma conexão por Pod", async ({ page }) => {
  await page.goto("labs/agent-or-gateway/");
  const lab = page.getByTestId("deployment-lab");
  await lab.scrollIntoViewIfNeeded();
  await lab.getByRole("radio", { name: "SDK → backend" }).click();
  await expect(lab.locator(".deplab-table dd").first()).toHaveText("6");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
