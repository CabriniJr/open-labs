import { expect, test } from "@playwright/test";

test("join: the showcase follows the join switch, and pairing by hand reaches the database's result", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.goto("labs/join-by-hand/");
  const vit = page.getByTestId("join-showcase");
  await expect(vit).toBeVisible();
  await vit.getByRole("radio", { name: "INNER JOIN" }).check();
  await expect(vit.getByRole("button", { name: /INNER JOIN drops who has no partner/ })).toBeVisible();

  await page.getByRole("tab", { name: /Simulation/ }).click();
  const sim = page.getByTestId("join-simulation");
  await expect(sim).toBeVisible();
  // Um par errado: a tentativa 3 é do aluno 2.
  await sim.getByRole("button", { name: /^1 · Ana Beatriz Souza/ }).click();
  await sim.getByRole("button", { name: /^Attempt 3,/ }).click();
  await expect(sim.getByRole("status")).toContainText("ON is false");
  // Um par certo.
  await sim.getByRole("button", { name: /^Attempt 1,/ }).click();
  await expect(sim).toContainText("1 of 12 pairs found");
  // O banco completa; com LEFT, o resultado tem 17 linhas.
  await sim.getByRole("button", { name: "Let the database pair them" }).click();
  await expect(sim).toContainText("12 of 12 pairs found");
  await expect(sim).toContainText("Your rows are the database's rows: 17.");
  // Filtro no WHERE: o LEFT vira INNER.
  await sim.getByRole("radio", { name: "in WHERE" }).check();
  await expect(sim).toContainText("The database's result · 8 rows");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(erros).toEqual([]);
});
