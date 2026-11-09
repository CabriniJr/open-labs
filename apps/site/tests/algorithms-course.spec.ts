import { expect, test, type Page } from "@playwright/test";

/**
 * O curso de algoritmos: um gesto real por lab, e o resultado que o modelo
 * deriva — não o texto que alguém escreveu na página.
 */
async function semRolagemNemErro(page: Page, erros: string[]) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(erros).toEqual([]);
}

function vigiar(page: Page): string[] {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  return erros;
}

test("sorting race: on a sorted input quicksort finishes last and bubble first", async ({ page }) => {
  const erros = vigiar(page);
  await page.goto("labs/sorting-race/");
  await expect(page.getByTestId("sorting-showcase")).toBeVisible();
  await expect(page.getByTestId("sorting-showcase").getByRole("button", { name: /Eight items on a shelf/ })).toBeVisible();
  await page.getByRole("tab", { name: /Simulation/ }).click();
  const sim = page.getByTestId("sorting-race");
  await sim.getByLabel("Input", { exact: true }).selectOption("sorted");
  await sim.getByLabel("Items", { exact: true }).selectOption("64");
  const linhas = sim.locator("table").first().locator("tbody tr");
  await expect(linhas.first()).toContainText(/Bubble sort|Insertion sort/);
  await expect(linhas.last()).toContainText(/Quicksort|Selection sort/);
  await expect(sim.locator("table").first()).toContainText("2016");
  // O relógio anda e a pista termina.
  await sim.getByLabel("Race clock, in steps").fill("2016");
  await expect(sim.locator(".algo-pista[data-fim]")).toHaveCount(5);
  await semRolagemNemErro(page, erros);
});

test("sorting race: a list the reader types is refused where it breaks", async ({ page }) => {
  const erros = vigiar(page);
  await page.goto("labs/sorting-race/");
  await page.getByRole("tab", { name: /Simulation/ }).click();
  const sim = page.getByTestId("sorting-race");
  await sim.getByLabel("Or type your own list").fill("4 x 2");
  await expect(sim.getByRole("alert")).toContainText("item 2");
  await sim.getByLabel("Or type your own list").fill("3 3 3 3");
  await expect(sim.getByRole("alert")).toHaveCount(0);
  await semRolagemNemErro(page, erros);
});

test("growth: the doubling test at n = 4096 names the classes, and the exponential is not run", async ({ page }) => {
  const erros = vigiar(page);
  await page.goto("labs/how-work-grows/");
  await expect(page.getByTestId("growth-showcase")).toBeVisible();
  await page.getByRole("tab", { name: /Simulation/ }).click();
  const sim = page.getByTestId("growth-chart");
  await sim.getByLabel("Pick n").fill("11");
  const tabela = sim.locator("table");
  await expect(tabela).toContainText("At n = 4096");
  await expect(tabela.locator("tr", { hasText: "O(n²)" })).toContainText("8,386,560");
  await expect(tabela.locator("tr", { hasText: "O(n²)" })).toContainText("×4.00");
  await expect(tabela.locator("tr", { hasText: "O(2ⁿ)" })).toContainText("not run");
  await semRolagemNemErro(page, erros);
});

test("graph: two points, then directed — the matrix stops being symmetric", async ({ page }) => {
  const erros = vigiar(page);
  await page.goto("labs/what-is-a-graph/");
  await page.getByRole("tab", { name: /Simulation/ }).click();
  const sim = page.getByTestId("graph-editor");
  await expect(sim).toContainText("two points and one edge");
  await sim.getByText("Directed (arrows)").click();
  const matriz = sim.locator("table", { hasText: "Adjacency matrix" });
  await expect(matriz.locator("tbody tr").nth(0)).toContainText("5");
  await expect(matriz.locator("tbody tr").nth(1)).not.toContainText("5");
  // Ligar um ponto a ele mesmo é recusado, com a razão.
  await sim.getByLabel("From", { exact: true }).selectOption("A");
  await sim.getByLabel("To", { exact: true }).selectOption("A");
  await sim.getByRole("button", { name: "Link them" }).click();
  await expect(sim.getByRole("alert")).toContainText("itself");
  await semRolagemNemErro(page, erros);
});

test("shortest path: the scoreboard says greedy and BFS are not fastest, and a negative road is refused", async ({ page }) => {
  const erros = vigiar(page);
  await page.goto("labs/shortest-path/");
  const vit = page.getByTestId("path-showcase");
  await expect(vit.getByRole("button", { name: /The city is a graph/ })).toBeVisible();
  await page.getByRole("tab", { name: /Simulation/ }).click();
  const sim = page.getByTestId("path-sim");
  const placar = sim.locator("table", { hasText: "The competition on this map" });
  await expect(placar.locator("tr", { hasText: "Dijkstra" })).toContainText("yes");
  await expect(placar.locator("tr", { hasText: "A*" })).toContainText("yes");
  await expect(placar.locator("tr", { hasText: "Greedy best-first" })).toContainText("no (+42 min)");
  await expect(placar.locator("tr", { hasText: "Breadth-first" })).toContainText("no (+29 min)");
  await sim.getByRole("button", { name: "Jump to the end" }).click();
  await expect(sim.locator(".algo-veredito")).toContainText("26 min");
  await sim.getByText("Magic ferry: −10 minutes").click();
  await expect(sim.getByRole("alert")).toContainText("Bellman-Ford");
  await semRolagemNemErro(page, erros);
});

test("change: {1, 3, 4} for 6 — greedy three coins, the table two, and the counter-example is found", async ({ page }) => {
  const erros = vigiar(page);
  await page.goto("labs/greedy-change/");
  await page.getByRole("tab", { name: /Simulation/ }).click();
  const sim = page.getByTestId("change-sim");
  await expect(sim.getByRole("list", { name: "Greedy coins" }).getByRole("listitem")).toHaveCount(3);
  await expect(sim.getByRole("list", { name: "Optimal coins" }).getByRole("listitem")).toHaveCount(2);
  await expect(sim).toContainText("smallest amount where greedy loses with {1, 3, 4} is 6");
  await sim.getByRole("button", { name: "Brazilian real (cents)" }).click();
  await expect(sim).toContainText("canonical");
  await semRolagemNemErro(page, erros);
});

test("real time: both labs time the algorithms on this device and report it", async ({ page }) => {
  const erros = vigiar(page);
  await page.goto("labs/how-work-grows/");
  await page.getByRole("tab", { name: /Simulation/ }).click();
  const g = page.getByTestId("growth-chart");
  await g.getByRole("button", { name: "Time it on this device" }).click();
  await expect(g.getByRole("button", { name: "Measured time" })).toBeEnabled({ timeout: 60_000 });
  await expect(g.getByRole("img", { name: /Measured time per run/ })).toBeVisible();
  await expect(g.locator("tr", { hasText: "O(n)" }).first()).toContainText(/ns|µs|ms/);

  await page.goto("labs/sorting-race/");
  await page.getByRole("tab", { name: /Simulation/ }).click();
  const s = page.getByTestId("sorting-race");
  await s.getByLabel("Items to time", { exact: true }).selectOption("500");
  await s.getByRole("button", { name: "Measure", exact: true }).click();
  await expect(s.locator("table", { hasText: "Median of 5 runs" }).locator("tbody tr")).toHaveCount(5, { timeout: 60_000 });
  await semRolagemNemErro(page, erros);
});
