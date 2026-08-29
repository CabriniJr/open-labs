import { expect, test, type Page } from "@playwright/test";

/**
 * O herói é uma ilha `client:visible`: o HTML vem pronto do servidor, mas os
 * controles só respondem depois de hidratar. Sem esperar, um `fill` no scrub
 * cai no vazio de vez em quando e o teste falha sem que nada esteja quebrado.
 * O sinal é do próprio Astro: a ilha larga o atributo `ssr` ao hidratar.
 */
async function aguardarHidratacao(page: Page): Promise<void> {
  // `client:visible` só hidrata quando a ilha entra na tela: em telefone o
  // herói começa abaixo da dobra, então rolar até ele faz parte da espera.
  const ilha = page.locator("astro-island:has(.hero-sim)");
  await ilha.scrollIntoViewIfNeeded();
  await expect(ilha).not.toHaveAttribute("ssr", /.*/);
}

test("the landing loads and the hero hydrates", async ({ page }) => {
  await page.goto("");

  await expect(page.locator("h1")).toContainText("actually works");
  await expect(page.locator(".hero-sim")).toBeVisible();
  await expect(page.getByRole("img", { name: "Service flow" })).toBeVisible();
});

test("turning propagation off breaks the trace", async ({ page }) => {
  await page.goto("");

  await aguardarHidratacao(page);

  const heroSim = page.locator(".hero-sim");
  await heroSim.getByRole("checkbox").uncheck();

  await page.getByRole("slider", { name: "Timeline" }).fill("22");

  await expect(heroSim).toContainText("orphan trace");

  const inspectorText = await heroSim.locator(".dui-inspector__body").innerText();
  const traceIds = [...inspectorText.matchAll(/"traceId":\s*"([^"]+)"/g)].map((m) => m[1]);
  expect(traceIds.length).toBeGreaterThanOrEqual(2);
  expect(new Set(traceIds).size).toBe(2);
});

test("with propagation on, both spans share the trace", async ({ page }) => {
  await page.goto("");

  await aguardarHidratacao(page);

  const heroSim = page.locator(".hero-sim");
  await page.getByRole("slider", { name: "Timeline" }).fill("22");

  const inspectorText = await heroSim.locator(".dui-inspector__body").innerText();
  const traceIds = [...inspectorText.matchAll(/"traceId":\s*"([^"]+)"/g)].map((m) => m[1]);
  expect(traceIds.length).toBeGreaterThanOrEqual(2);
  expect(new Set(traceIds).size).toBe(1);
  expect(inspectorText).toContain("parentSpanId");
});

test("the timeline lets you stop and read the payload", async ({ page }) => {
  await page.goto("");

  await aguardarHidratacao(page);

  const heroSim = page.locator(".hero-sim");
  await page.getByRole("slider", { name: "Timeline" }).fill("20");

  await expect(heroSim.getByRole("button", { name: "Play" })).toBeVisible();
  await expect(heroSim.locator(".dui-inspector__body")).toContainText("resourceSpans");
});

/**
 * Os dois mexem no MESMO progresso guardado no navegador, e um limpa o que o
 * outro acabou de escrever quando rodam em paralelo. Em série eles não se
 * atropelam — e o que se testa aqui é justamente a memória entre recargas, que
 * por definição não é isolada por aba.
 */
test.describe.serial("progresso do mapa", () => {
  test("the map tracks progress and it survives a reload", async ({ page }) => {
    // No RISC-V, e não mais no OTel: só se marca o que abre, e hoje quem tem lab
    // no ar é este handbook. O OTel voltou a ter todos os nós como caminho
    // declarado, que é a verdade dele.
    await page.goto("handbooks/riscv/");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();

    const roadmap = page.locator(".roadmap");
    await roadmap.scrollIntoViewIfNeeded();

    await expect(roadmap.locator(".roadmap__progress-count")).toHaveText("0 of 6");

    const marcar = page.getByRole("button", { name: /Mark The single-cycle datapath as done/i });
    await marcar.click();

    await expect(roadmap.locator(".roadmap__progress-count")).toHaveText("1 of 6");

    await page.reload();
    await roadmap.scrollIntoViewIfNeeded();

    await expect(roadmap.locator(".roadmap__progress-count")).toHaveText("1 of 6");
    await expect(
      page.getByRole("button", { name: /Mark The single-cycle datapath as done/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("os dois handbooks contam o progresso separado", async ({ page }) => {
    // Eles compartilhavam a chave do localStorage enquanto só um tinha mapa.
    // Marcar um lab de CPU não pode adiantar o roadmap de OpenTelemetry.
    await page.goto("handbooks/riscv/");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    const marcar = page.getByRole("button", { name: /Mark The single-cycle datapath as done/i });
    await marcar.scrollIntoViewIfNeeded();
    await marcar.click();
    await expect(page.locator(".roadmap__progress-count")).toHaveText("1 of 6");

    await page.goto("handbooks/otel/");
    await expect(page.locator(".roadmap__progress-count")).toHaveText("0 of 13");
  });
});

test("the page does not scroll horizontally", async ({ page }) => {
  await page.goto("");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
