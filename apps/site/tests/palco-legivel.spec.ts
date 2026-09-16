import { expect, test } from "@playwright/test";

/**
 * O palco tem de caber o leitor.
 *
 * O texto do desenho é medido em **unidades da vista**, não em pixels: um rótulo
 * de 11 unidades chega na tela multiplicado pela escala com que o palco foi
 * projetado. Enquanto a altura saía da proporção e a largura era o que sobrava
 * depois da ficha e do painel, essa escala era 0,62 num monitor de 2560 — e o
 * rótulo chegava com menos de sete pixels. Legível é conta, não gosto, e por
 * isso está aqui como número.
 */

/** O que o palco escreve, em unidades da vista. Espelha `stage.css`. */
const ROTULO_EM_UNIDADES = 12;

/**
 * O piso, e ele é honesto sobre o que dá para conseguir sem tela cheia.
 *
 * Numa tela de 1280 por 720, uma vista de mil e duzentas por setecentas unidades
 * ocupa quase o monitor inteiro: não existe arranjo que ponha o rótulo em nove
 * pixels ali dentro. O que existe é o palco tomar a largura toda — a ficha e o
 * painel descem — e a tela cheia para quem quer mais. Oito é o que a página
 * entrega sozinha; a tela cheia leva o mesmo rótulo a dezoito.
 */
const MINIMO_LEGIVEL_PX = 8;

async function escalaDoPalco(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate(() => {
    const svg = document.querySelector(".dui-stage");
    if (svg === null) return 0;
    const vb = (svg.getAttribute("viewBox") ?? "").split(/\s+/u).map(Number);
    const caixa = svg.getBoundingClientRect();
    if (vb.length !== 4 || vb[2] === undefined || vb[3] === undefined) return 0;
    // `preserveAspectRatio` padrão encaixa pelo lado que aperta.
    return Math.min(caixa.width / vb[2], caixa.height / vb[3]);
  });
}

test.describe("o palco cabe o leitor", () => {
  test("o rótulo do desenho chega legível na tela", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "a régua é a da tela de trabalho");
    await page.goto("labs/providers/");
    await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

    const escala = await escalaDoPalco(page);
    expect(escala, "o palco não foi projetado").toBeGreaterThan(0);
    expect(
      ROTULO_EM_UNIDADES * escala,
      `rótulo chegando com ${(ROTULO_EM_UNIDADES * escala).toFixed(1)}px`,
    ).toBeGreaterThanOrEqual(MINIMO_LEGIVEL_PX);
  });

  test("o palco tem altura própria e o canto redimensiona", async ({ page }) => {
    await page.goto("labs/providers/");
    await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

    const palco = page.locator(".explorer__palco");
    // Altura própria, e não derivada da proporção da vista: sem isso não há o
    // que arrastar, porque a caixa não tem altura para ceder.
    await expect(palco).toHaveCSS("resize", "vertical");

    const medidas = await palco.evaluate((n) => {
      const svg = n.querySelector(".dui-stage");
      return {
        palco: Math.round(n.getBoundingClientRect().height),
        stage: Math.round(svg?.getBoundingClientRect().height ?? 0),
      };
    });
    // O desenho preenche a altura que o palco der. Se ele voltar a derivar a
    // altura da proporção, os dois números descolam e este teste cai.
    expect(medidas.stage).toBe(medidas.palco);
  });

  test("o botão de tela cheia existe e diz o próprio estado", async ({ page }) => {
    await page.goto("labs/providers/");
    await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

    const botao = page.getByRole("button", { name: /full screen/iu });
    await expect(botao).toBeVisible();
    // O estado vem do documento, e não do clique: sair com Esc não passa pelo
    // botão, e um botão que mente sobre o próprio estado é pior que não ter.
    await expect(botao).toHaveAttribute("aria-pressed", "false");
  });
});
