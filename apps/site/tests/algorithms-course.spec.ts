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

test("sorting race: three classes on one clock — sorted input puts selection last, and the O(n) class never compares", async ({ page }) => {
  const erros = vigiar(page);
  await page.goto("labs/sorting-race/");
  const vit = page.getByTestId("sorting-showcase");
  await expect(vit.getByRole("button", { name: /The O\(n²\) class/ })).toBeVisible();
  await vit.getByRole("button", { name: "▶ Play the showcase" }).click();
  await expect(vit.getByRole("progressbar").first()).not.toHaveAttribute("aria-valuenow", "0", { timeout: 10_000 });
  await page.getByRole("tab", { name: /Simulation/ }).click();
  const sim = page.getByTestId("sorting-race");
  await sim.getByLabel("Input", { exact: true }).selectOption("sorted");
  await sim.getByLabel("Items", { exact: true }).selectOption("64");
  const linhas = sim.locator("table").last().locator("tbody tr");
  await expect(linhas.first()).toContainText(/Bubble sort|Insertion sort/);
  await expect(linhas.last()).toContainText("Selection sort");
  await expect(linhas.last()).toContainText("2016");
  await sim.getByLabel("Race clock, in steps").fill("2016");
  await expect(sim.locator(".barras-cartao[data-fim]")).toHaveCount(3);
  await expect(sim.getByRole("progressbar").first()).toHaveAttribute("aria-valuenow", "100");
  await sim.getByRole("button", { name: /Linear \(no comparisons\)/ }).click();
  for (const nome of ["Counting sort", "Radix sort (LSD)"]) await expect(linhas.filter({ hasText: nome }).locator("td").nth(2)).toHaveText("0");
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

test("shortest path on the real map: the exact class agrees, greedy loses minutes, and the race finishes", async ({ page }) => {
  const erros = vigiar(page);
  await page.goto("labs/shortest-path/");
  const vit = page.getByTestId("path-showcase");
  await expect(vit.getByRole("button", { name: /Dijkstra: a wave of equal time/ })).toBeVisible({ timeout: 20_000 });
  await vit.getByRole("button", { name: "▶ Play the showcase" }).click();
  await expect(vit.getByRole("progressbar").first()).not.toHaveAttribute("aria-valuenow", "0", { timeout: 10_000 });
  await page.getByRole("tab", { name: /Simulation/ }).click();
  const sim = page.getByTestId("path-sim");
  const placar = sim.locator("table", { hasText: "The scoreboard" });
  await expect(placar.locator("tbody tr")).toHaveCount(3, { timeout: 20_000 });
  for (const nome of ["Dijkstra", "A*", "Bidirectional Dijkstra"]) {
    const linha = placar.locator("tr", { has: page.locator("td", { hasText: new RegExp(`^${nome.replace("*", "\\*")}$`) }) });
    await expect(linha).toContainText("6 min 29 s");
    await expect(linha).toContainText("yes");
  }
  await sim.getByRole("button", { name: "Fast, no guarantee" }).click();
  await expect(placar.locator("tr", { hasText: "Greedy best-first" })).toContainText("no, +24 s");
  await sim.getByLabel("Race clock, in steps").fill(await sim.getByLabel("Race clock, in steps").getAttribute("max") ?? "0");
  await expect(sim.locator(".mapa-legenda li[data-fim]")).toHaveCount(3);
  await sim.getByRole("button", { name: "Side by side" }).click();
  await expect(sim.locator(".mapa-cartao")).toHaveCount(3);
  await expect(sim.getByText(/OpenStreetMap contributors/)).toBeVisible();
  await semRolagemNemErro(page, erros);
});

test("shortest path: drag a figure to move a stop, add stops, and load a scenario from who-wins-where", async ({ page }) => {
  const erros = vigiar(page);
  await page.goto("labs/shortest-path/");
  await page.getByRole("tab", { name: /Simulation/ }).click();
  const sim = page.getByTestId("path-sim");
  const bonecos = sim.locator(".boneco__corpo");
  await expect(bonecos).toHaveCount(2, { timeout: 20_000 });
  // Arrastar o boneco do destino para longe: a parada deixa de ser o Mercadão.
  const parada2 = sim.getByLabel("Stop 2", { exact: true });
  await expect(parada2.locator("option:checked")).toHaveText("Mercadão");
  // O boneco respira o tempo todo (nunca "para", e o scroll do Playwright espera parar):
  // rola-se pelo DOM até ele ficar no meio da janela.
  await bonecos.nth(1).evaluate((el) => el.scrollIntoView({ block: "center" }));
  const b = (await bonecos.nth(1).boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + 15);
  await page.mouse.down();
  for (let k = 1; k <= 10; k += 1) await page.mouse.move(b.x + b.width / 2 - 12 * k, b.y + 15 + 9 * k, { steps: 2 });
  await page.mouse.up();
  await expect(parada2.locator("option:checked")).not.toHaveText("Mercadão");
  // Teclado: o boneco também anda pelas setas.
  await bonecos.nth(0).focus();
  const antes = await sim.getByLabel("Stop 1", { exact: true }).inputValue();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await expect(sim.getByLabel("Stop 1", { exact: true })).not.toHaveValue(antes);
  await sim.getByRole("button", { name: "+ Add a stop" }).click();
  await expect(bonecos).toHaveCount(3);
  await expect(sim.getByText(/Shortest order:/)).toContainText("→");
  // Quem vence onde: seis cenários, e carregar um põe os bonecos dele no mapa.
  const tabela = sim.locator("table", { hasText: "Who wins where" });
  await expect(tabela.getByRole("button", { name: "Race it" })).toHaveCount(6, { timeout: 30_000 });
  await tabela.locator("tr", { hasText: "Four errands" }).getByRole("button", { name: "Race it" }).click();
  await expect(bonecos).toHaveCount(4);
  await expect(tabela.locator("tr", { hasText: "Behind one-way streets" }).locator("td[data-melhor]")).toContainText("658");
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

test("real time: the growth lab times the algorithms on this device and reports it", async ({ page }) => {
  const erros = vigiar(page);
  await page.goto("labs/how-work-grows/");
  await page.getByRole("tab", { name: /Simulation/ }).click();
  const g = page.getByTestId("growth-chart");
  await g.getByRole("button", { name: "Time it on this device" }).click();
  await expect(g.getByRole("button", { name: "Measured time" })).toBeEnabled({ timeout: 60_000 });
  await expect(g.getByRole("img", { name: /Measured time per run/ })).toBeVisible();
  await expect(g.locator("tr", { hasText: "O(n)" }).first()).toContainText(/ns|µs|ms/);
  await semRolagemNemErro(page, erros);
});
