import { expect, test } from "@playwright/test";

/**
 * Seguir a carga: clicar num item e ver o corpo dele, e o trajeto, e o que cada
 * parada mudou.
 *
 * É a ideia nº 7 do `DECISIONS.md` — e ela existia só no herói da landing.
 * Estes testes cobram as duas metades: que dá para **pegar** o item (ele anda e
 * é recriado a cada tick, e sem uma área de clique de verdade acertá-lo era
 * pontaria), e que o painel mostra **o que mudou**, que é o mecanismo
 * acontecendo em vez de uma legenda dizendo que ele acontece.
 */

async function seguirOPrimeiro(page: import("@playwright/test").Page, lab: string): Promise<void> {
  await page.goto(lab);
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 20_000 });
  await expect
    .poll(async () => page.locator(".dui-stage__carga-grupo[data-chave]").count(), {
      timeout: 25_000,
    })
    .toBeGreaterThan(0);
  // Pausar antes de clicar: perseguir alvo móvel faz o teste falhar por sorte.
  await page.getByRole("button", { name: "Pause" }).click();
  await page.locator(".dui-stage__carga-grupo[data-chave]").first().click();
  await expect(page.locator(".carga-painel")).toBeVisible();
}

test("na anatomia, o trajeto mostra o traceparent reescrito a cada salto", async ({ page }) => {
  test.setTimeout(60_000);
  await seguirOPrimeiro(page, "labs/anatomy-of-a-trace/");

  await page.getByRole("button", { name: "Run" }).click();

  // Quatro paradas: a chegada e os três saltos entre serviços. O span exportado
  // é PRODUTO da requisição, e não parada dela — misturado, cada linha acusava
  // duas mudanças e o leitor lia ruído no lugar do mecanismo.
  await expect
    .poll(async () => page.locator(".dui-trilha__estacao").count(), { timeout: 30_000 })
    .toBeGreaterThanOrEqual(4);

  const paradas = await page.locator(".dui-trilha__estacao").allTextContents();
  // A primeira estação é a ORIGEM: ninguém chegou nela por um salto, então ela
  // não tem delta. `first sighting` é da chegada seguinte.
  expect(paradas[1]).toContain("first sighting");
  expect(paradas.slice(2).every((p) => p.includes("traceparent"))).toBe(true);

  // E o campo que mudou está marcado no corpo, no lugar em que ele mora.
  await expect(page.locator('.dui-trilha .dui-inspector__line[data-changed="true"]')).not.toHaveCount(0);
});

test("nos pilares, o trajeto mostra o que cada gravador joga fora", async ({ page }) => {
  test.setTimeout(60_000);
  await seguirOPrimeiro(page, "labs/three-pillars/");

  await page.getByRole("button", { name: "Run" }).click();

  await expect
    .poll(
      async () =>
        (await page.locator(".dui-trilha__estacao").allTextContents()).join(" | "),
      { timeout: 30_000 },
    )
    .toContain("metric-store");

  const paradas = await page.locator(".dui-trilha__estacao").allTextContents();
  const doTracer = paradas.find((p) => p.includes("trace-store")) ?? "";
  const doMedidor = paradas.find((p) => p.includes("metric-store")) ?? "";
  const doLog = paradas.find((p) => p.includes("log-store")) ?? "";

  /*
    A comparação é contra a CHEGADA no serviço, e não contra o braço anterior:
    num leque, "o que o log tem de diferente da métrica" é uma pergunta que
    ninguém fez. Cada braço responde o que guardou da mesma coisa — e é por isso
    que o tracer não perde nada e os outros dois perdem.
  */
  expect(doTracer).not.toContain("duration_ms");
  expect(doMedidor).toContain("duration_ms");
  expect(doLog).toContain("route");
});
