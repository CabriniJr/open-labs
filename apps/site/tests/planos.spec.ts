import { expect, test } from "@playwright/test";

/**
 * Os dois planos do palco.
 *
 * A esteira carrega coisa; o circuito carrega comando. São as duas redes que
 * uma fábrica tem, e antes desta separação a diferença ficava por conta da cor
 * — um canal só, e o pior deles para quem tem dificuldade com vermelho e preto.
 *
 * O que estes testes seguram é a **altura**: o circuito é desenhado depois, e é
 * isso que o põe por cima. Uma mudança que reordene os grupos apaga a figura
 * inteira sem quebrar teste nenhum — a não ser este.
 */
for (const lab of ["labs/cpu/", "labs/micro/"]) {
  test(`${lab}: o circuito é um plano à parte, e ele fica por cima`, async ({ page }) => {
    await page.goto(lab);
    await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator(".dui-stage__trilho").count(), { timeout: 10_000 })
      .toBeGreaterThan(0);

    // Nenhuma linha de controle fora do circuito, e nenhuma de dado dentro.
    const controleForaDoCircuito = await page
      .locator('.dui-stage__fios .dui-stage__fio[data-linha="control"]')
      .count();
    expect(controleForaDoCircuito, "linha de controle desenhada junto das esteiras").toBe(0);

    const dadoNoCircuito = await page
      .locator(".dui-stage__circuito .dui-stage__fio:not([data-linha='control'])")
      .count();
    expect(dadoNoCircuito, "esteira desenhada dentro do circuito").toBe(0);

    const controleNoCircuito = await page
      .locator('.dui-stage__circuito .dui-stage__fio[data-linha="control"]')
      .count();
    expect(controleNoCircuito, "nenhuma linha de controle na tela").toBeGreaterThan(0);

    // E a ordem no documento, que é o que decide quem cobre quem.
    const depois = await page.evaluate(() => {
      const esteiras = document.querySelector(".dui-stage__fios");
      const circuito = document.querySelector(".dui-stage__circuito");
      if (esteiras === null || circuito === null) return null;
      // 4 = DOCUMENT_POSITION_FOLLOWING: o circuito vem depois das esteiras.
      return (esteiras.compareDocumentPosition(circuito) & 4) !== 0;
    });
    expect(depois, "o circuito não está depois das esteiras no documento").toBe(true);
  });
}
