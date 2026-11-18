import { expect, test } from "@playwright/test";

const semRolagemNemErro = async (page: import("@playwright/test").Page, erros: string[]) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(erros).toEqual([]);
};

test("who comes back: the showcase loads the sessions and the simulation matches the notebook", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.goto("labs/who-comes-back/");
  await expect(page.getByTestId("return-showcase")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("tab", { name: /Simulation/ }).click();
  const sim = page.getByTestId("return-sim");
  // Com todas as variáveis e a divisão por pessoa, as métricas são as do notebook.
  await expect(sim.getByTestId("return-linear")).toContainText("0.844");
  await expect(sim.getByTestId("return-linear")).toContainText("0.613");
  await expect(sim.getByTestId("return-logistic")).toContainText("0.737 · 0.556 · 0.634");
  await expect(sim).toContainText("No one is in both sets");
  // A divisão por linha vaza.
  await sim.getByRole("button", { name: "Split by row (leaks)" }).click();
  await expect(sim).toContainText("people have sessions in both sets");
  await sim.getByRole("button", { name: "Split by person" }).click();
  // O corte move a matriz.
  const antes = await sim.getByTestId("return-matrix").innerText();
  await sim.getByRole("slider", { name: "Cut-off probability" }).fill("0.7");
  await expect(sim.getByTestId("return-matrix")).not.toHaveText(antes);
  // Sem nenhuma variável, o lab recusa.
  for (const caixa of await sim.getByRole("checkbox").all()) await caixa.uncheck();
  await expect(sim.getByRole("alert")).toContainText("at least one input");
  await semRolagemNemErro(page, erros);
});
