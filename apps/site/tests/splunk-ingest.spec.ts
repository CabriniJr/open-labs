import { expect, test } from "@playwright/test";

/**
 * O lab da ingestão do Splunk — e o que só a página responde.
 *
 * A tabela-verdade tem teste de unidade em `world.test.ts`, que roda os seis
 * casos contra o modelo; repeti-la aqui seria pagar caro por uma segunda
 * opinião pior. O que se cobra aqui é o que é da tela:
 *
 * 1. o **veredito** existe e diz as três coisas: onde o arquivo está, quem
 *    executa a fase, e se vale. É a única coisa da página que muda de cor por
 *    decisão de configuração em vez de acúmulo do run;
 * 2. mover o `props.conf` entre as máquinas muda o veredito e o número;
 * 3. ligar o heavy forwarder **quebra** uma configuração que estava certa, sem
 *    ninguém tocar no arquivo. É o defeito que o lab existe para mostrar, e na
 *    tela ele é uma frase trocando mais um contador subindo.
 */

const LAB = "labs/splunk-ingest/";

const PLACAR = ".splunk-ingest__resposta";
const VEREDITO = ".splunk-ingest__veredito";

/** Posições do placar, na ordem em que a página as escreve. */
const INTEIROS = 0;
const PARTIDOS = 1;
const POR_REGISTRO = 2;

async function abrir(page: import("@playwright/test").Page): Promise<void> {
  await page.goto(LAB);
  // A ilha é `client:only`: estar visível já quer dizer "hidratada e rodando".
  await expect(page.locator(".splunk-ingest")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".dui-stage").first()).toBeVisible({ timeout: 20_000 });
}

const numeroDe = async (page: import("@playwright/test").Page, i: number): Promise<number> => {
  const texto = (await page.locator(PLACAR).nth(i).locator("b").textContent()) ?? "0";
  return Number(texto.replace(/[^\d]/gu, ""));
};

const propsEm = async (
  page: import("@playwright/test").Page,
  maquina: RegExp,
): Promise<void> => {
  await page.getByRole("radio", { name: maquina }).check();
};

test("o veredito diz as três coisas, e começa valendo", async ({ page }) => {
  await abrir(page);
  const veredito = page.locator(VEREDITO);
  await expect(veredito).toBeVisible();
  // O padrão da página é a única combinação simples que funciona: props no
  // indexador, sem heavy forwarder.
  await expect(veredito).toContainText("indexer");
  await expect(veredito).toContainText("takes effect");
  await expect(veredito).toHaveAttribute("data-vale", "sim");

  // E o índice enche com o stack trace inteiro.
  await expect(page.locator(PLACAR)).toHaveCount(3);
  await expect.poll(async () => numeroDe(page, INTEIROS), { timeout: 30_000 }).toBeGreaterThan(0);
  expect(await numeroDe(page, PARTIDOS)).toBe(0);
});

test("mover o props.conf para o forwarder universal o torna inerte", async ({ page }) => {
  await abrir(page);
  await propsEm(page, /universal forwarder/u);

  const veredito = page.locator(VEREDITO);
  await expect(veredito).toHaveAttribute("data-vale", "nao");
  await expect(veredito).toContainText("no effect at all");

  // E o stack trace entra em pedaços, sem nada reclamar.
  await expect.poll(async () => numeroDe(page, PARTIDOS), { timeout: 30_000 }).toBeGreaterThan(0);
  await expect(page.locator(PLACAR).nth(PARTIDOS)).toContainText("nothing reports it");
  // O terceiro número é o preço: um registro, doze eventos.
  await expect.poll(async () => numeroDe(page, POR_REGISTRO), { timeout: 30_000 }).toBe(12);
});

test("ligar o heavy forwarder quebra um props.conf que ninguém tocou", async ({ page }) => {
  /*
    A tese do lab na tela, e a razão de este teste existir separado do unitário:
    o que se afirma aqui é que a PÁGINA mostra a mudança sem que nada além do
    switch tenha mexido. O rádio continua no indexador durante todo o teste.
  */
  await abrir(page);
  const veredito = page.locator(VEREDITO);
  await expect(veredito).toHaveAttribute("data-vale", "sim");

  await page.getByRole("checkbox", { name: /heavy forwarder/u }).check();

  await expect(veredito).toHaveAttribute("data-vale", "nao");
  await expect(veredito).toContainText("no effect at all");
  // O rádio NÃO mudou: é o mesmo arquivo, na mesma máquina.
  await expect(page.getByRole("radio", { name: /indexer/u })).toBeChecked();
  await expect.poll(async () => numeroDe(page, PARTIDOS), { timeout: 30_000 }).toBeGreaterThan(0);
});

test("a caixa de cada máquina publica a FASE que ela executa", async ({ page }) => {
  /*
    O palco é onde a regra fica legível antes de ser lida: o forwarder diz
    "input", e o nome da fase de parsing aparece em uma caixa só — a que a
    executa. Duas caixas dizendo "parsing" seria o desenho contradizendo o
    próprio lab.
  */
  await abrir(page);
  const caixa = (id: string) => page.locator(`[data-id="${id}"]`).first();
  await expect(caixa("uf")).toBeVisible({ timeout: 20_000 });

  await expect(caixa("uf")).toContainText("input");
  await expect(caixa("idx")).toContainText("parsing");
  await expect(caixa("meio")).not.toContainText("parsing");

  // Com o heavy forwarder, a palavra muda de caixa.
  await page.getByRole("checkbox", { name: /heavy forwarder/u }).check();
  await expect(caixa("meio")).toContainText("parsing");
  await expect(caixa("idx")).toContainText("indexing only");
});

test("o atraso entre escrever e pesquisar é o bloco de 64 KiB, e ele aparece", async ({
  page,
}) => {
  await abrir(page);
  // A leitura do forwarder conta blocos, e o buffer está no conteúdo da caixa:
  // os dois juntos são a explicação do atraso que o operador encontra primeiro.
  const uf = page.locator('[data-id="uf"]').first();
  await expect(uf).toBeVisible({ timeout: 20_000 });
  await expect(uf).toContainText("64");
  await expect.poll(async () => (await uf.textContent()) ?? "", { timeout: 30_000 }).toMatch(
    /blocks/u,
  );
});
