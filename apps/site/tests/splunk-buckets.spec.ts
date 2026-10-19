import { expect, test } from "@playwright/test";

/**
 * O lab dos baldes — e o que só a página responde.
 *
 * As teses têm teste de unidade em `world.test.ts`, que mede a janela contra o
 * volume em vários regimes. O que se cobra aqui é o que é da tela:
 *
 * 1. os dois números ficam **lado a lado** — a janela medida e a retenção
 *    configurada —, porque a distância entre eles é o lab;
 * 2. enquanto nada congelou, a janela NÃO é reportada: a página não chama o
 *    tempo que ela está rodando de limite do sistema;
 * 3. mexer no volume, que é o único controle que não está em arquivo nenhum,
 *    muda a janela;
 * 4. a configuração incoerente aparece como aviso, e não como número errado.
 */

const LAB = "labs/splunk-buckets/";

const PLACAR = ".splunk-baldes__resposta";

/** Posições do placar, na ordem em que a página as escreve. */
const JANELA = 0;
const RETENCAO = 1;
const QUAL_LIMITE = 2;
const DESTINO = 3;

async function abrir(page: import("@playwright/test").Page): Promise<void> {
  await page.goto(LAB);
  await expect(page.locator(".splunk-baldes")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".dui-stage").first()).toBeVisible({ timeout: 20_000 });
}

const textoDe = async (page: import("@playwright/test").Page, i: number): Promise<string> =>
  (await page.locator(PLACAR).nth(i).locator("b").textContent()) ?? "";

const diasDe = async (page: import("@playwright/test").Page, i: number): Promise<number> =>
  Number((await textoDe(page, i)).replace(/[^\d]/gu, ""));

test("a janela medida e a retenção configurada ficam lado a lado", async ({ page }) => {
  await abrir(page);
  await expect(page.locator(PLACAR)).toHaveCount(4);
  await expect(page.locator(".splunk-baldes__placar")).toContainText("How far back can you search");

  // A retenção é a do default de verdade, e a página a escreve em dias.
  expect(await diasDe(page, RETENCAO)).toBe(2184);
  await expect(page.locator(PLACAR).nth(RETENCAO)).toContainText("frozenTimePeriodInSecs");
});

test("enquanto nada congelou, a janela não é reportada — e a página diz por quê", async ({
  page,
}) => {
  await abrir(page);
  // Nos primeiros ticks o índice está enchendo: a janela é um travessão, e a
  // nota explica que nada saiu ainda.
  expect(await textoDe(page, JANELA)).toBe("—");
  await expect(page.locator(PLACAR).nth(JANELA)).toContainText("still filling");
  await expect(page.locator(PLACAR).nth(QUAL_LIMITE)).toContainText("nothing frozen yet");
});

test("com o tempo, a janela aparece e o limite que a produziu é o de TAMANHO", async ({
  page,
}) => {
  await abrir(page);
  // 500 GB a 20 GB por dia: o índice enche em vinte e cinco dias simulados, e
  // um tick vale doze horas. Acelerar o relógio é o que mantém este teste
  // dentro de um tempo razoável — e é um controle da própria página.
  await page.getByRole("slider", { name: /one tick is/u }).fill("48");

  await expect.poll(async () => diasDe(page, JANELA), { timeout: 40_000 }).toBeGreaterThan(0);
  // E ela é uma fração minúscula dos 2 184 dias configurados.
  expect(await diasDe(page, JANELA)).toBeLessThan(200);
  await expect(page.locator(PLACAR).nth(QUAL_LIMITE)).toContainText("size");
  await expect(page.locator(PLACAR).nth(DESTINO)).toContainText("Freezing means removing");
});

test("a configuração incoerente aparece como AVISO, não como número errado", async ({ page }) => {
  /*
    A região em que este modelo não vale: o morno sozinho cabendo mais que o
    índice inteiro. A página tem de dizer isso em vez de desenhar uma janela
    que ela não sabe calcular — é a diferença entre um limite declarado e uma
    mentira pequena.
  */
  await abrir(page);
  await expect(page.locator(".splunk-baldes__aviso")).toHaveCount(0);

  await page.getByRole("slider", { name: /maxTotalDataSizeMB/u }).fill("50");
  const aviso = page.locator(".splunk-baldes__aviso");
  await expect(aviso).toBeVisible();
  await expect(aviso).toContainText("incoherent");
  await expect(aviso).toContainText("maxWarmDBCount");

  // E baixar o morno o resolve, que é o que o aviso manda fazer.
  await page.getByRole("slider", { name: /maxWarmDBCount/u }).fill("20");
  await expect(aviso).toHaveCount(0);
});

test("ligar o arquivo troca o destino sem mexer em QUANTO congela", async ({ page }) => {
  await abrir(page);
  await page.getByRole("slider", { name: /one tick is/u }).fill("48");
  await expect.poll(async () => diasDe(page, JANELA), { timeout: 40_000 }).toBeGreaterThan(0);

  await expect(page.locator(PLACAR).nth(DESTINO)).toContainText("deleted");
  await page.getByRole("checkbox", { name: /coldToFrozenDir/u }).check();
  await expect(page.locator(PLACAR).nth(DESTINO)).toContainText("archived");
  // A janela não se move: o arquivo não guarda nada dentro do índice.
  await expect(page.locator(PLACAR).nth(DESTINO)).toContainText("raw data only");
});
