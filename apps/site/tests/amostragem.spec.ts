import { expect, test } from "@playwright/test";

/**
 * O lab da amostragem — e o que só a página responde.
 *
 * As três teses têm teste de unidade em `world.test.ts`, comparando dois runs
 * do mesmo mundo; repeti-las aqui seria pagar caro por uma segunda opinião
 * pior. O que se cobra aqui é o que é da tela:
 *
 * 1. o placar responde a pergunta do plantão com TRÊS números, porque há três
 *    maneiras de o trace do erro não estar lá;
 * 2. mexer num controle muda o número — a resposta sai do estado;
 * 3. o terceiro número, o do trace quebrado, só acende quando o roteamento
 *    para de conhecer trace. É o defeito que nenhum contador de produção
 *    reporta, e aqui ele é medido.
 */

const LAB = "labs/head-and-tail-sampling/";

const PLACAR = ".amostragem-lab__resposta";

async function abrir(page: import("@playwright/test").Page): Promise<void> {
  await page.goto(LAB);
  // A ilha é `client:only`, então o palco só existe depois de hidratar: estar
  // visível aqui já quer dizer "escutando", diferente do `client:visible` do
  // lab da cardinalidade.
  await expect(page.locator(".amostragem-lab")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".dui-stage").first()).toBeVisible({ timeout: 20_000 });
}

const numeroDe = async (page: import("@playwright/test").Page, i: number): Promise<number> => {
  const texto = (await page.locator(PLACAR).nth(i).locator("b").textContent()) ?? "0";
  return Number(texto.replace(/[^\d]/gu, ""));
};

/** Posições do placar, na ordem em que a página as escreve. */
const INTEIROS = 0;
const CORTADOS = 1;
const QUEBRADOS = 2;

test("o placar responde com TRÊS números, porque há três maneiras de faltar", async ({ page }) => {
  await abrir(page);
  await expect(page.locator(PLACAR)).toHaveCount(3);
  await expect(page.locator(".amostragem-lab__placar")).toContainText("Is its trace in the backend");
  // Na linha de base, os dois modos de perda estão em zero e o trace chega.
  expect(await numeroDe(page, CORTADOS)).toBe(0);
  expect(await numeroDe(page, QUEBRADOS)).toBe(0);
  await expect.poll(async () => numeroDe(page, INTEIROS), { timeout: 20_000 }).toBeGreaterThan(0);
});

test("subir o head sampler corta trace COM ERRO, e o número é do run", async ({ page }) => {
  await abrir(page);
  await page.getByRole("slider", { name: /head sampler keeps/u }).fill("4");
  // O corte aparece sozinho, tick a tick: é a tese 1 na tela.
  await expect.poll(async () => numeroDe(page, CORTADOS), { timeout: 25_000 }).toBeGreaterThan(0);
  await expect(page.locator(PLACAR).nth(CORTADOS)).toContainText("never arrived");
});

test("desligar o roteamento por trace entrega trace QUEBRADO", async ({ page }) => {
  await abrir(page);
  await expect(page.locator(PLACAR).nth(QUEBRADOS)).toContainText("keeps each trace whole");

  await page.getByRole("checkbox", { name: /routes by/u }).uncheck();
  await expect.poll(async () => numeroDe(page, QUEBRADOS), { timeout: 25_000 }).toBeGreaterThan(0);
  // E a frase muda para o que o número quer dizer: está lá, sem o span do erro.
  await expect(page.locator(PLACAR).nth(QUEBRADOS)).toContainText("missing the span that failed");
});

test("cada gateway mostra os números DELE, e não a soma dos dois", async ({ page }) => {
  /*
    A guarda contra a mentira pequena que a primeira versão desta página tinha:
    os dois painéis mostravam a soma, o que afirma o contrário do lab — que
    cada instância decide com o pedaço que recebeu. Com roteamento por trace e
    ids alternando entre os dois, os dois contadores têm de divergir em algum
    momento.
  */
  await abrir(page);
  /*
    Um trace por segundo, e aí a simetria quebra: com roteamento por trace os
    ids alternam entre as duas instâncias, então enquanto um gateway segura um
    trace o outro está vazio. Com o tráfego padrão os dois recebem um trace por
    tick e seguram a MESMA quantidade — o painel somado passaria, e o teste
    diria que mediu algo quando não mediu. Esta é a razão de o controle de
    tráfego existir na página.
  */
  await page.getByRole("slider", { name: /traces per second/u }).fill("1");
  await page.getByRole("slider", { name: /decision window/u }).fill("3");

  // A leitura de cada caixa é o número que ela publica no palco.
  const leitura = (id: string) => page.locator(`[data-id="${id}"] .dui-stage__leitura`).first();
  await expect(leitura("gatewayA")).toBeVisible({ timeout: 20_000 });
  await expect(leitura("gatewayB")).toBeVisible({ timeout: 20_000 });

  await expect
    .poll(
      async () => {
        const a = (await leitura("gatewayA").textContent()) ?? "";
        const b = (await leitura("gatewayB").textContent()) ?? "";
        // Vazio dos dois lados seria "iguais" por acidente: a espera acima já
        // garante que há texto, e isto garante que a comparação mediu algo.
        return a === "" || b === "" ? "vazio" : a === b ? "iguais" : "diferentes";
      },
      { timeout: 25_000 },
    )
    .toBe("diferentes");
});
