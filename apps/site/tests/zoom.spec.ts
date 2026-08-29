import { expect, test } from "@playwright/test";

/**
 * O zoom contínuo: descer deixou de ser uma troca de tela e virou uma
 * aproximação. Estes testes cobram os três fatos que sustentam isso — o
 * interior aparece dentro da caixa, ele some ao afastar, e o gesto de
 * aproximar não rola a página.
 *
 * Só no desktop, e isso é uma lacuna declarada e não um teste frouxo: o gesto
 * de aproximar num aparelho de toque é a pinça, que ainda não existe. Emular
 * roda de mouse num Pixel 7 mediria uma coisa que ninguém faz — e ela para
 * sozinha em 2×, porque o Chromium trata a roda como zoom de página ali.
 */
test.skip(({ isMobile }) => isMobile === true, "o gesto de toque é a pinça, e ela não existe ainda");

/**
 * Rola a roda sobre o palco, com ele visível.
 *
 * O ponto tem que estar **dentro da janela**: o palco fica no meio de uma
 * página longa, e apontar para um ponto fora dela faz o clique cair em outro
 * lugar — o teste então mede um zoom que ninguém pediu.
 */
const rolar = async (
  page: import("@playwright/test").Page,
  cliques: number,
  delta: number,
) => {
  const palco = page.locator("svg.dui-stage");
  await palco.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const caixa = await palco.boundingBox();
  const janela = page.viewportSize();
  if (caixa === null || janela === null) throw new Error("o palco não está na tela");

  // O ponto tem que estar dentro do palco **e** dentro da janela ao mesmo
  // tempo: numa tela curta o meio do palco cai fora, o clique vai parar em
  // outro lugar, e o teste mede um zoom que ninguém pediu.
  const faixa = (inicio: number, tamanho: number, limite: number) => {
    const a = Math.max(0, inicio);
    const b = Math.min(limite, inicio + tamanho);
    return (a + b) / 2;
  };
  const x = faixa(caixa.x, caixa.width, janela.width);
  const y = faixa(caixa.y, caixa.height, janela.height);

  for (let i = 0; i < cliques; i++) {
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, delta);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(400);
};

const aproximar = (page: import("@playwright/test").Page, cliques: number) =>
  rolar(page, cliques, -120);

const afastar = (page: import("@playwright/test").Page, cliques: number) =>
  rolar(page, cliques, 120);

const zoom = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const svg = document.querySelector("svg.dui-stage");
    const vb = (svg?.getAttribute("viewBox") ?? "0 0 1 1").split(" ").map(Number);
    return 1100 / (vb[2] ?? 1);
  });

test("aproximar uma porta revela o interior dela, dentro dela", async ({ page }) => {
  await page.goto("labs/gates/");
  await page.waitForSelector("g.dui-stage__objeto");

  // De longe, o interior não existe no desenho — não está escondido por CSS.
  await expect(page.locator(".dui-stage__interior")).toHaveCount(0);
  expect(await zoom(page)).toBeCloseTo(1, 1);

  await aproximar(page, 14);

  expect(await zoom(page)).toBeGreaterThan(3);
  const interiores = page.locator(".dui-stage__interior");
  expect(await interiores.count()).toBeGreaterThan(0);

  // E o que apareceu é circuito, não uma miniatura: as portas de dentro do XOR
  // são NANDs, e elas estão desenhadas.
  await expect(
    page.locator(".dui-stage__interior .dui-stage__rotulo").filter({ hasText: "NAND" }).first(),
  ).toBeVisible();
});

test("afastar devolve a caixa fechada", async ({ page }) => {
  await page.goto("labs/gates/");
  await page.waitForSelector("g.dui-stage__objeto");
  await aproximar(page, 14);
  expect(await zoom(page), "a roda não aproximou").toBeGreaterThan(3);
  expect(await page.locator(".dui-stage__interior").count()).toBeGreaterThan(0);

  await afastar(page, 30);

  expect(await zoom(page)).toBeCloseTo(1, 1);
  await expect(page.locator(".dui-stage__interior")).toHaveCount(0);
});

/**
 * `onWheel` do React vira ouvinte passivo: `preventDefault` não faz nada e o
 * gesto de aproximar rola a página. O sintoma manda procurar no lugar errado,
 * porque o desenho fica parado e quem se mexe é a página.
 */
test("aproximar não rola a página", async ({ page }) => {
  await page.goto("labs/gates/");
  await page.waitForSelector("g.dui-stage__objeto");
  // O palco entra em cena antes da medida: quem rola aqui é o teste, e medir
  // com essa rolagem dentro da conta acusaria a roda de uma coisa que ela não
  // fez.
  await page.locator("svg.dui-stage").scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  const antes = await page.evaluate(() => window.scrollY);
  await aproximar(page, 6);
  expect(await page.evaluate(() => window.scrollY)).toBe(antes);
  expect(await zoom(page)).toBeGreaterThan(1.2);
});
