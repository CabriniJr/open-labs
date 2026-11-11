import { expect, test } from "@playwright/test";

test("database: the showcase opens first and the last chapter follows the join switch", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.goto("labs/telecentro-database/");
  const vit = page.getByTestId("database-showcase");
  await expect(vit).toBeVisible();
  await expect(vit.getByRole("button", { name: /LEFT OUTER JOIN: keep who has no partner/ })).toBeVisible();
  await vit.getByText("LEFT OUTER JOIN in query 3").click();
  await expect(vit.getByRole("button", { name: /INNER JOIN where LEFT was needed/ })).toBeVisible();
  // O diagrama mostra as dez tabelas, com as chaves.
  await expect(vit.locator(".bd-tabela")).toHaveCount(10);
  // "O que é o quê": os conceitos, as 10 relações com a cardinalidade e cada tabela coluna por coluna.
  const dic = page.locator(".bdd");
  await expect(dic.locator(".bdd-relacoes tbody tr")).toHaveCount(10);
  await expect(dic.locator(".bdd-tabela")).toHaveCount(10);
  await expect(dic.locator("#bd-T_ALUNO")).toContainText("→ T_TELECENTRO");
  await expect(dic.getByText("Foreign key (FK)")).toBeVisible();

  // O passo a passo no Oracle: sete passos, e os scripts para baixar são os do repositório.
  const oracle = page.getByTestId("database-oracle");
  await expect(oracle.locator(".bdo-passo")).toHaveCount(7);
  await expect(oracle).toContainText("ORA-02291");
  const ddl = await page.request.get("labs/telecentro-database/01-ddl.sql");
  expect(ddl.ok()).toBe(true);
  expect(await ddl.text()).toContain("CREATE TABLE T_TENTATIVA");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(erros).toEqual([]);
});

test("database: the simulation refuses what Oracle refuses, and the queries read the rows you wrote", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.goto("labs/telecentro-database/");
  await page.getByRole("tab", { name: /Simulation/ }).click();
  const sim = page.getByTestId("database-simulation");
  await expect(sim).toBeVisible();

  // Um erro clássico: a nota fora da regra.
  await sim.getByRole("button", { name: "Grade 11" }).click();
  await expect(sim.getByRole("log")).toContainText("ORA-02290: check constraint (OPENLABS.CK_TENTATIVA_NOTA) violated");

  // Uma linha válida entra, e a consulta 3 passa a mostrá-la.
  await sim.getByRole("combobox").selectOption("T_ALUNO");
  await sim.getByRole("button", { name: "Run INSERT" }).click();
  await expect(sim.getByRole("log")).toContainText("1 row inserted.");
  await sim.getByRole("tab", { name: "Query 3" }).click();
  await expect(sim).toContainText("Nina Prado Lopes");

  // Com INNER JOIN, a mesma pergunta volta vazia.
  await sim.getByText("LEFT OUTER JOIN (off: INNER JOIN)").click();
  await expect(sim).toContainText("no rows selected");

  // Apagar um pai com filhos: a chave estrangeira protege os dois lados.
  await sim.getByRole("button", { name: "Delete telecentre 1" }).click();
  await expect(sim.getByRole("log")).toContainText("ORA-02292");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(erros).toEqual([]);
});
