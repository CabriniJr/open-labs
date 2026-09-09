import type { Page } from "@playwright/test";

/**
 * Os dois temas, porque um defeito de cor pode existir só num deles — e o da
 * moldura existia só no escuro.
 *
 * Pelo botão do próprio site, e não escrevendo o atributo na marra nem
 * emulando a preferência do sistema: as duas tentativas anteriores não
 * trocaram o tema, e o laço passava medindo o mesmo caso duas vezes. Um laço
 * de temas que não troca o tema é um teste que finge cobrir dois casos e cobre
 * um — e é por isso que cada teste daqui prova, no fim, que a troca aconteceu.
 *
 * Mora aqui, e não dentro de uma spec, porque duas specs cobram contraste nos
 * dois papéis. Duas cópias divergem, e a que divergir vai ser justamente a que
 * finge trocar o tema.
 */
export async function noTema(page: Page, tema: "light" | "dark") {
  const botao = page.locator("[data-theme-toggle]").first();
  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    const atual = await page.evaluate(() => document.documentElement.dataset.theme);
    if (atual === tema) return;
    await botao.click();
  }
  throw new Error(`o botão de tema não chegou em ${tema}`);
}
