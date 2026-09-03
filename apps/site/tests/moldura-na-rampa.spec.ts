import { expect, test } from "@playwright/test";

/**
 * A contradição que originou a rodada, cobrada onde ela aparecia: no
 * enquadramento do SDK, as três caixas de provedor desenhavam o interior E
 * anunciavam `more inside` E mantinham a borda de fechada.
 */

async function noSdk(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("labs/providers/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });
  await page
    .getByRole("group", { name: "Framing" })
    .getByRole("button", { name: "OpenTelemetry SDK", exact: true })
    .click();
  await expect
    .poll(async () => page.locator('.dui-stage__objeto[data-id="tracer-provider"]').count())
    .toBeGreaterThan(0);
}

test("a caixa que mostra o interior não promete que há mais dentro", async ({ page }) => {
  await noSdk(page);
  const caixa = page.locator('.dui-stage__objeto[data-id="tracer-provider"]');
  const tinta = await page
    .locator('.dui-stage__interior[data-dentro="tracer-provider"]')
    .evaluate((g) => Number(g.getAttribute("opacity")));
  // O caso só tem sentido quando o interior está de fato visível.
  expect(tinta).toBeGreaterThan(0.4);
  // O interior aberto mostra os filhos, e um filho fechado (span-processors)
  // tem, com razão, o seu próprio "more inside" — essa marca não é a
  // contradição. A que se cobra é a da própria caixa, e o seletor precisa
  // ignorar o que só aparece porque o leitor está espiando lá dentro.
  //
  // A marca não sai do DOM: ela cede pela mesma opacidade do rosto que
  // desenha rótulo e título (`opacidadeDoRosto`), e some do desenho antes de
  // o interior chegar inteiro. Testar a sua presença no DOM testaria uma
  // implementação que este lab nunca teve; o que vale é o que a tela mostra.
  const opacidadeDaMarca = await caixa.evaluate((g) => {
    const propria = Array.from(g.querySelectorAll(".dui-stage__abrir")).find(
      (el) => el.closest(".dui-stage__interior") === null,
    );
    const rosto = propria?.closest(".dui-stage__rosto");
    return rosto === null || rosto === undefined
      ? Number.NaN
      : Number(getComputedStyle(rosto).opacity);
  });
  expect(opacidadeDaMarca).toBe(0);
});

test("a borda cede na mesma rampa: o vão do tracejado encolheu", async ({ page }) => {
  await noSdk(page);
  const vao = await page
    .locator('.dui-stage__objeto[data-id="tracer-provider"]')
    .evaluate((g) => {
      const caixa = g.querySelector(".dui-stage__caixa")!;
      const dash = getComputedStyle(caixa).strokeDasharray;
      return Number(dash.split(",")[1]?.trim().replace("px", "") ?? "NaN");
    });
  // Fechada de verdade tem vão 4. Com o interior aberto, ele tem de ter cedido.
  expect(vao).toBeLessThan(4);
});
