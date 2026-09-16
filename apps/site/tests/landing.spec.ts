import { expect, test, type Page } from "@playwright/test";
import { MAPA_OTEL } from "../src/data/roadmap.js";
import { MAPA_CPU } from "../src/data/roadmap-cpu.js";
import { noTema } from "./tema.js";

/**
 * O total do contador sai do mapa, e não de um número escrito aqui. Escrito à
 * mão ele é uma segunda fonte do mesmo fato: acrescentar um lab passa a exigir
 * lembrar deste arquivo, e quem esquecer descobre no CI — que foi o que
 * aconteceu quando a trilha do OTel cresceu de treze para dezoito nós.
 */
const TOTAL_CPU = MAPA_CPU.labs.length;
const TOTAL_OTEL = MAPA_OTEL.labs.length;


/**
 * O herói é uma ilha `client:visible`: o HTML vem pronto do servidor, mas os
 * controles só respondem depois de hidratar. Sem esperar, um `fill` no scrub
 * cai no vazio de vez em quando e o teste falha sem que nada esteja quebrado.
 * O sinal é do próprio Astro: a ilha larga o atributo `ssr` ao hidratar.
 */
async function aguardarHidratacao(page: Page): Promise<void> {
  // `client:visible` só hidrata quando a ilha entra na tela: em telefone o
  // herói começa abaixo da dobra, então rolar até ele faz parte da espera.
  const ilha = page.locator("astro-island:has(.hero-sim)");
  await ilha.scrollIntoViewIfNeeded();
  await expect(ilha).not.toHaveAttribute("ssr", /.*/);
}

test("the landing loads and the hero hydrates", async ({ page }) => {
  await page.goto("");

  await expect(page.locator("h1")).toContainText("actually works");
  await expect(page.locator(".hero-sim")).toBeVisible();
});

test("the hero runs on its own", async ({ page }) => {
  await page.goto("");
  await aguardarHidratacao(page);

  /*
    Dois quadros diferentes, e não "existe um item na tela".

    O HTML do servidor já traz o palco desenhado: afirmar que ele existe não
    prova que alguma coisa está rodando. O que prova é o desenho MUDAR sozinho,
    sem ninguém tocar em nada.
  */
  const palco = page.locator(".hero-sim .dui-stage");
  const primeiro = await palco.innerHTML();
  await expect
    .poll(async () => (await palco.innerHTML()) !== primeiro, { timeout: 15_000 })
    .toBe(true);
});

test("the hero opens already following a span, and the collector enriches it", async ({ page }) => {
  await page.goto("");
  await aguardarHidratacao(page);

  /*
    A afirmação inteira do herói em um teste: o span atravessa o collector e
    ganha um campo que ele não tinha ao sair do serviço.

    Se o collector parar de enriquecer, este teste cai — e é para isso que ele
    existe. Uma trilha que mostra três estações e nenhuma mudança seria uma
    vitrine bonita afirmando que nada acontece.
  */
  const trilha = page.locator(".hero-sim .dui-trilha");
  await expect(trilha).toBeVisible({ timeout: 15_000 });

  await expect
    .poll(async () => await trilha.locator(".dui-trilha__estacao").count(), { timeout: 20_000 })
    .toBeGreaterThanOrEqual(2);

  await expect(
    trilha.locator('.dui-trilha__estacao[data-mudou*="collector.name"]'),
  ).toHaveCount(1, { timeout: 20_000 });

  await expect(
    trilha.locator('.dui-inspector__line[data-changed="true"]').first(),
  ).toContainText("collector.name");
});

test("double-clicking a box goes inside it", async ({ page }) => {
  await page.goto("");
  await aguardarHidratacao(page);

  const palco = page.locator(".hero-sim .dui-stage");
  const antes = await palco.getAttribute("aria-label");

  await page.locator('.hero-sim .dui-stage__objeto[data-id="collector"]').first().dblclick();

  /*
    A vista de dentro não pode ser a de fora. Comparar o rótulo do palco é o
    jeito mais barato de cobrar isso sem depender de qual desenho o motor
    escolheu montar lá dentro.
  */
  await expect
    .poll(async () => await palco.getAttribute("aria-label"), { timeout: 10_000 })
    .not.toBe(antes);
});

test("na trilha, a parada que mudou algo se distingue da que não mudou, nos dois temas", async ({
  page,
}) => {
  await page.goto("");
  await aguardarHidratacao(page);

  const trilha = page.locator(".hero-sim .dui-trilha");
  const mudou = trilha.locator(".dui-trilha__estacao[data-mudou] .dui-trilha__delta").first();
  const igual = trilha
    .locator(".dui-trilha__estacao:not([data-mudou]) .dui-trilha__delta")
    .first();
  await expect(mudou).toBeVisible({ timeout: 20_000 });
  await expect(igual).toBeVisible();

  const fundoPorTema: string[] = [];
  for (const tema of ["light", "dark"] as const) {
    await noTema(page, tema);
    fundoPorTema.push(await page.evaluate(() => getComputedStyle(document.body).backgroundColor));
    const a = await mudou.evaluate((el) => getComputedStyle(el).color);
    const b = await igual.evaluate((el) => getComputedStyle(el).color);
    // Se as duas tintas forem iguais, o acento não está dizendo nada, e a
    // trilha vira uma lista de nomes com um enfeite.
    expect(a, `o delta que mudou se distingue no tema ${tema}`).not.toBe(b);
  }
  // A prova de que o laço acima trocou mesmo de tema.
  expect(fundoPorTema[0], "o tema mudou de verdade").not.toBe(fundoPorTema[1]);
});

test("nothing on the site still sells the four fixed levels", async () => {
  /*
    A escada morta não pode voltar por descuido. É varredura de código porque a
    mentira silenciosa não aparece em nenhuma asserção de tela: uma página que
    promete L2 Wire e nunca mostra um só continua verde.
  */
  const { execSync } = await import("node:child_process");
  const achados = execSync(
    'grep -rnE "DepthShell|FlowDiagram|\\bL0\\b|\\bL1\\b|\\bL2\\b|\\bL3\\b" apps/site/src || true',
    { cwd: process.cwd().replace(/\/apps\/site$/u, ""), encoding: "utf8" },
  );
  expect(achados.trim()).toBe("");
});

/**
 * Os dois mexem no MESMO progresso guardado no navegador, e um limpa o que o
 * outro acabou de escrever quando rodam em paralelo. Em série eles não se
 * atropelam — e o que se testa aqui é justamente a memória entre recargas, que
 * por definição não é isolada por aba.
 */

/**
 * Esperar a ilha do mapa **hidratar**.
 *
 * Esperar o contador dizer "0 de N" não prova nada: esse texto já está no HTML
 * que o servidor mandou, e o botão de marcar só passa a escutar depois da
 * hidratação. Era guarda que não guardava — o clique caía num botão mudo, o
 * contador ficava em zero, e a falha aparecia rara, sob carga, em qualquer um
 * dos testes desta suíte.
 *
 * `ssr` sai do `astro-island` quando a hidratação termina. É o mesmo sinal que
 * o teste do exercício usa, e pela mesma razão.
 */
async function mapaVivo(page: import("@playwright/test").Page): Promise<void> {
  // A ilha é `client:visible`: ela só começa a hidratar quando entra na tela.
  // Esperar sem rolar é esperar por uma coisa que ninguém pediu para acontecer —
  // e foi assim que a primeira versão desta guarda ficou pendurada vinte
  // segundos e reprovou o teste que ela existia para salvar.
  await page.locator(".roadmap").first().scrollIntoViewIfNeeded();
  // Timeout generoso de propósito: o trabalho desta função é **esperar**, e não
  // policiar quanto tempo a hidratação leva. Sob carga ela passa de cinco
  // segundos, e falhar aí seria trocar um defeito de teste por outro.
  await expect(page.locator("astro-island:has(.roadmap)").first()).not.toHaveAttribute(
    "ssr",
    /.*/u,
    { timeout: 20_000 },
  );
}

test.describe.serial("progresso do mapa", () => {
  test("the map tracks progress and it survives a reload", async ({ page }) => {
    // No handbook da CPU, e não mais no OTel: só se marca o que abre, e hoje
    // quem tem lab no ar é este handbook. O OTel voltou a ter todos os nós
    // como caminho declarado, que é a verdade dele.
    await page.goto("handbooks/cpu/");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();

    const roadmap = page.locator(".roadmap");
    await roadmap.scrollIntoViewIfNeeded();
    await mapaVivo(page);

    await expect(roadmap.locator(".roadmap__progress-count")).toHaveText(`0 of ${TOTAL_CPU}`);

    const marcar = page.getByRole("button", { name: /Mark The whole cycle in one tick as done/i });
    await marcar.click();

    await expect(roadmap.locator(".roadmap__progress-count")).toHaveText(`1 of ${TOTAL_CPU}`);

    await page.reload();
    await roadmap.scrollIntoViewIfNeeded();
    await mapaVivo(page);

    await expect(roadmap.locator(".roadmap__progress-count")).toHaveText(`1 of ${TOTAL_CPU}`);
    await expect(
      page.getByRole("button", { name: /Mark The whole cycle in one tick as done/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("os dois handbooks contam o progresso separado", async ({ page }) => {
    // Eles compartilhavam a chave do localStorage enquanto só um tinha mapa.
    // Marcar um lab de CPU não pode adiantar o roadmap de OpenTelemetry.
    await page.goto("handbooks/cpu/");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    // Esperar o contador zerar antes de clicar não é folga: ele só existe
    // depois de a ilha hidratar e ler o armazenamento. Clicar antes disso
    // marca no estado inicial e o clique se perde na hidratação — falha
    // intermitente, e só sob carga.
    await mapaVivo(page);
    await expect(page.locator(".roadmap__progress-count")).toHaveText(`0 of ${TOTAL_CPU}`);
    const marcar = page.getByRole("button", { name: /Mark The whole cycle in one tick as done/i });
    await marcar.scrollIntoViewIfNeeded();
    await marcar.click();
    await expect(page.locator(".roadmap__progress-count")).toHaveText(`1 of ${TOTAL_CPU}`);

    await page.goto("handbooks/otel/");
    await expect(page.locator(".roadmap__progress-count")).toHaveText(`0 of ${TOTAL_OTEL}`);
  });
});

test("the page does not scroll horizontally", async ({ page }) => {
  await page.goto("");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
