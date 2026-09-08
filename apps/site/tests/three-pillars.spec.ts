import { expect, test } from "@playwright/test";

/**
 * O lab dos três pilares, na tela.
 *
 * O que se cobra aqui é o que só a página responde — e o principal é a **tese**:
 * o medidor nunca consegue dizer QUAIS. Ela é atributo no DOM (`data-responde`)
 * porque ela é fato do modelo: se um dia o modelo mudar e a métrica passar a
 * guardar identidade, este teste cai, e é o que se quer.
 */

async function rodando(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("labs/three-pillars/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 20_000 });
  await expect
    .poll(async () => page.locator(".dui-stage__trilho").count(), { timeout: 15_000 })
    .toBeGreaterThan(0);
  // Alguns ticks: os três só têm o que mostrar depois de o serviço atender.
  await expect
    .poll(async () => (await page.locator(".pilares-lab__tick").textContent()) ?? "", {
      timeout: 20_000,
    })
    .not.toBe("t0");
}

const respostaDe = (page: import("@playwright/test").Page, nome: string) =>
  page.locator(".pilares-lab__respostas div").filter({ hasText: nome }).first();

test("o tracer responde quais; o medidor nunca", async ({ page }) => {
  await rodando(page);

  await expect
    .poll(async () => respostaDe(page, "Trace").getAttribute("data-responde"), { timeout: 20_000 })
    .toBe("true");
  await expect(respostaDe(page, "Metric")).toHaveAttribute("data-responde", "false");
  await expect(respostaDe(page, "Metric")).toContainText("cannot say which");
});

test("fora de uma borda de balde, o medidor não conta nem quantas", async ({ page }) => {
  await rodando(page);

  await page
    .locator(".pilares-lab__campo")
    .filter({ hasText: "ask: slower than" })
    .getByRole("combobox")
    .selectOption("300");

  await expect(respostaDe(page, "Metric")).toContainText("cannot even count");
  // E o tracer continua respondendo: o que muda é o que cada um guardou, e não
  // a pergunta.
  await expect(respostaDe(page, "Trace")).toHaveAttribute("data-responde", "true");
});

test("um atributo a mais estoura a cardinalidade, e o excedente colapsa", async ({ page }) => {
  await rodando(page);

  await page
    .locator(".pilares-lab__switch")
    .filter({ hasText: "metric attributes" })
    .getByRole("checkbox")
    .check();
  await page
    .locator(".pilares-lab__campo")
    .filter({ hasText: "cardinality limit" })
    .getByRole("combobox")
    .selectOption("6");

  // A linha de overflow aparece DENTRO da caixa do medidor: é o desenho
  // mostrando o colapso, e não um contador ao lado dizendo que ele houve.
  await expect
    .poll(
      async () =>
        page.locator('.dui-stage__objeto[data-id="metric-store"] .dui-stage__linha-chave').allTextContents(),
      { timeout: 25_000 },
    )
    .toContain("otel.metric.overflow");
});

test("o que o código não disse não está no log", async ({ page }) => {
  await rodando(page);

  // Com o código calado sobre o caminho feliz, o contador de "said nothing"
  // sobe — e ele é a única prova de que aquele tráfego existiu.
  await expect
    .poll(
      async () =>
        page.locator('.dui-stage__objeto[data-id="log-store"] .dui-stage__linha-chave').allTextContents(),
      { timeout: 25_000 },
    )
    .toContain("said nothing");

  await page
    .locator(".pilares-lab__switch")
    .filter({ hasText: "logs every request" })
    .getByRole("checkbox")
    .check();
  await expect
    .poll(
      async () =>
        page.locator('.dui-stage__objeto[data-id="log-store"] .dui-stage__linha-valor').allTextContents(),
      { timeout: 25_000 },
    )
    .toEqual(expect.arrayContaining([expect.stringContaining("INFO handled")]));
});
