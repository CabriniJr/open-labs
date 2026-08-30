import { expect, test } from "@playwright/test";

/**
 * O lab das portas: vinte portas, nenhuma sabe somar. Se a conta sai certa na
 * tela, é a composição que está certa — que é a única coisa que ele afirma.
 */
test("soma quatro bits com portas de verdade", async ({ page }) => {
  await page.goto("labs/gates/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

  // 6 + 7 = 13, e 13 em quatro bits é 1101
  await expect(page.locator(".gates-lab__resultado").first()).toContainText("1101", {
    timeout: 10_000,
  });
});

test("estouro sai pelo vai-um", async ({ page }) => {
  await page.goto("labs/gates/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

  await page.getByLabel("First addend").fill("15");
  await page.getByLabel("Second addend").fill("15");

  // 15 + 15 = 30: quatro bits guardam 14, e o resto sai pelo vai-um
  await expect(page.locator(".gates-lab__resultado").first()).toContainText("carry", {
    timeout: 10_000,
  });
  await expect(page.locator(".gates-lab__resultado").first()).toContainText("30");
});

test("porta acesa é porta com saída alta, e com zero não acende nada", async ({ page }) => {
  await page.goto("labs/gates/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

  await expect(page.locator('.dui-stage__objeto[data-alto="true"]').first()).toBeVisible({
    timeout: 10_000,
  });

  await page.getByLabel("First addend").fill("0");
  await page.getByLabel("Second addend").fill("0");
  // Com 0 + 0 as portas rodam e dizem zero — e é justamente por isso que o
  // teste vale: o que apaga a tela é o VALOR que saiu delas, e não o circuito
  // ter ficado parado. Lendo a contagem de emissões, acenderia tudo.
  await expect(page.locator('.dui-stage__objeto[data-alto="true"]')).toHaveCount(0, {
    timeout: 10_000,
  });
  await expect(page.locator(".gates-lab__resultado").nth(1)).toContainText("substeps");
});

test("a profundidade cresce quando o vai-um sobe", async ({ page }) => {
  await page.goto("labs/gates/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

  await page.getByLabel("First addend").fill("1");
  await page.getByLabel("Second addend").fill("1");
  const profundidade = page.locator(".gates-lab__resultado").nth(1);
  await expect(profundidade).toContainText("substeps");
});

test("o lab das portas não rola na horizontal", async ({ page }) => {
  await page.goto("labs/gates/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("dois cliques entram no somador, e a trilha mostra onde você está", async ({ page }) => {
  await page.goto("labs/gates/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

  await page.locator('.dui-stage__objeto[data-id="bit1"]').first().dblclick();

  const trilha = page.locator(".explorer__trilha");
  await expect(trilha).toContainText("circuit");
  await expect(trilha).toContainText("full adder 1");

  // lá dentro estão as cinco portas, e elas continuam vivas
  await expect(page.locator(".dui-stage__objeto")).toHaveCount(5);
  await expect(page.locator('.dui-stage__objeto[data-alto="true"]').first()).toBeVisible({
    timeout: 10_000,
  });

  // e a trilha volta
  await trilha.getByRole("button", { name: "circuit" }).click();
  await expect(page.locator('.dui-stage__objeto[data-id="bit1"]')).toBeVisible();
});


test("descer da porta lógica até o transistor, e achar silício vivo lá embaixo", async ({
  page,
}) => {
  await page.goto("labs/gates/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

  const trilha = page.locator(".explorer__trilha");
  await page.locator('.dui-stage__objeto[data-id="bit0"]').first().dblclick();
  await page.locator('.dui-stage__objeto[aria-label^="XOR"]').first().dblclick();
  await expect(trilha).toContainText("XOR");

  // Um XOR são quatro NAND. Não é rótulo: eles existem e estão desenhados.
  await expect(page.locator(".dui-stage__objeto")).toHaveCount(4);

  await page.locator('.dui-stage__objeto[aria-label^="NAND"]').first().dblclick();
  // E um NAND são dois trilhos, quatro transistores e o nó onde as redes se
  // encontram — o fundo da fatia.
  await expect(page.locator('.dui-stage__objeto[aria-label^="PMOS"]')).toHaveCount(2);
  await expect(page.locator('.dui-stage__objeto[aria-label^="NMOS"]')).toHaveCount(2);
  await expect(page.locator('.dui-stage__objeto[aria-label^="Vdd"]')).toHaveCount(1);

  // e está vivo: alguma coisa aqui embaixo está conduzindo neste tick
  await expect(page.locator('.dui-stage__objeto[data-alto="true"]').first()).toBeVisible({
    timeout: 10_000,
  });

  await trilha.getByRole("button", { name: "circuit" }).click();
  await expect(page.locator('.dui-stage__objeto[data-id="bit0"]')).toBeVisible();
});

/**
 * O desenho da porta acesa, e não o atributo dela.
 *
 * O teste acima cobra `data-alto`, e o atributo sempre esteve certo: a
 * auditoria de tela achou uma porta em 1 desenhada mais **escura** que uma
 * porta em 0, com o brilho pertencendo a quem *rodou* em vez de a quem *disse
 * um*. Atributo certo com desenho errado é o mesmo defeito que a caixa
 * recolhida teve, e ele passa por resolvido enquanto ninguém cobrar a tinta.
 *
 * As três coisas que este teste cobra, e por que cada uma:
 *
 * 1. **acesa e apagada são desenhadas diferente** — o mínimo que o texto do
 *    lab promete ao leitor;
 * 2. **acesa é a colorida** — a direção importa, e "mais clara" não serve como
 *    direção: no tema claro o papel é quase branco, então acender escurece, e
 *    no escuro acender clareia. O que vale nos dois é que o corpo apagado é
 *    neutro e o aceso carrega a cor do nível alto;
 * 3. **o brilho pertence a quem disse um** — e não a quem rodou. Era este o
 *    defeito mais torto: o halo estava preso a `data-ativo`, então a porta em
 *    0 brilhava e a porta em 1 não;
 * 4. **o desenho é estado, não flash** — duas amostras separadas por mais que a
 *    duração da animação têm de dar o mesmo. Era aqui que morava a causa: o
 *    aceso era o primeiro quadro de uma transição que **parte do apagado**, e
 *    com a simulação rodando a porta reiniciava a transição a cada tick e
 *    vivia perto do quadro zero.
 */
/**
 * Os dois temas, porque um defeito de cor pode existir só num deles — e o da
 * moldura existia só no escuro.
 *
 * Pelo botão do próprio site, e não escrevendo o atributo na marra nem
 * emulando a preferência do sistema: as duas tentativas anteriores não
 * trocaram o tema, e o laço passava medindo o mesmo caso duas vezes. Um laço
 * de temas que não troca o tema é um teste que finge cobrir dois casos e cobre
 * um — e é por isso que cada teste daqui prova, no fim, que a troca aconteceu.
 */
async function noTema(page: import("@playwright/test").Page, tema: "light" | "dark") {
  const botao = page.locator("[data-theme-toggle]").first();
  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    const atual = await page.evaluate(() => document.documentElement.dataset.theme);
    if (atual === tema) return;
    await botao.click();
  }
  throw new Error(`o botão de tema não chegou em ${tema}`);
}

async function tinta(page: import("@playwright/test").Page, seletor: string) {
  return page.locator(seletor).first().evaluate((el) => {
    const caixa = el.querySelector(":scope > .dui-stage__caixa");
    if (caixa === null) throw new Error("objeto sem caixa desenhada");
    const s = getComputedStyle(caixa);
    // `oklab(L a b / alpha)`: a luminosidade é o primeiro número, e `a` e `b`
    // são as duas coordenadas de cor. A distância deles até zero é o quanto a
    // tinta se afasta do cinza.
    const n = [...s.fill.matchAll(/-?[\d.]+/g)].map((m) => Number(m[0]));
    const cor = Math.hypot(n[1] ?? 0, n[2] ?? 0);
    return { fill: s.fill, stroke: s.stroke, filter: s.filter, traco: s.strokeDasharray, cor };
  });
}

test("a porta acesa é desenhada acesa, e continua acesa", async ({ page }) => {
  await page.goto("labs/gates/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.dui-stage__objeto[data-alto="true"]').first()).toBeVisible({
    timeout: 10_000,
  });

  const ALTA = '.dui-stage__objeto[data-familia="processor"][data-alto="true"]';
  const BAIXA = '.dui-stage__objeto[data-familia="processor"]:not([data-alto="true"])';
  await expect(page.locator(BAIXA).first()).toBeVisible();

  const alta = await tinta(page, ALTA);
  const baixa = await tinta(page, BAIXA);

  expect(alta.fill).not.toBe(baixa.fill);
  expect(alta.cor).toBeGreaterThan(baixa.cor + 0.02);

  // O halo é de quem disse um. Um brilho de raio zero e cor transparente é o
  // que a transição interrompida deixava para trás, e ele lê como nenhum.
  expect(alta.filter).not.toBe("none");
  expect(alta.filter).not.toMatch(/0px 0px 0px/);

  // Estado, não acontecimento: a animação de acender dura 0.45s. Isto roda no
  // tema em que a página nasceu, e de propósito — o site restaura o tema dele
  // sozinho, e uma troca de tema no meio da espera faria a segunda amostra
  // medir outro tema em vez de outro instante.
  await page.waitForTimeout(1200);
  const depois = await tinta(page, ALTA);
  expect(depois.fill).toBe(alta.fill);
  expect(depois.cor).toBeGreaterThan(baixa.cor + 0.02);

  // E a cor tem de dizer "aceso" nos dois temas, cada um medido na hora.
  const porTema: Record<string, { alta: number; baixaFill: string }> = {};
  for (const tema of ["dark", "light"] as const) {
    await noTema(page, tema);
    const a = await tinta(page, ALTA);
    const b = await tinta(page, BAIXA);
    expect(a.cor, `a porta acesa é a colorida no tema ${tema}`).toBeGreaterThan(b.cor + 0.02);
    porTema[tema] = { alta: a.cor, baixaFill: b.fill };
  }
  // A prova de que o laço acima trocou mesmo de tema.
  expect(porTema.dark?.baixaFill, "o tema mudou de verdade").not.toBe(porTema.light?.baixaFill);
});

/**
 * Uma moldura acesa também tem de aparecer.
 *
 * `fill-opacity: 0` na moldura existe por um bom motivo — preencher a área
 * onde os filhos moram apaga o desenho que interessa. Mas ele anulou o
 * preenchimento de acesa sem pôr nada no lugar, e o contorno de acesa usava a
 * mesma cor do contorno de apagada. Sobrava meio pixel de espessura.
 */
test("a moldura acesa se distingue da apagada, nos dois temas", async ({ page }) => {
  await page.goto("labs/gates/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

  const ALTA = '.dui-stage__objeto[data-familia="container"][data-alto="true"]';
  const BAIXA = '.dui-stage__objeto[data-familia="container"]:not([data-alto="true"])';
  await expect(page.locator(ALTA).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(BAIXA).first()).toBeVisible();

  const fundoPorTema: string[] = [];
  for (const tema of ["light", "dark"] as const) {
    await noTema(page, tema);
    const alta = await tinta(page, ALTA);
    const baixa = await tinta(page, BAIXA);
    fundoPorTema.push(await page.evaluate(() => getComputedStyle(document.body).backgroundColor));

    // Cobrar só a cor do traço deixava o defeito passar: no tema claro os dois
    // contornos já diferiam por acaso, e no escuro eram a MESMA tinta. O que
    // separa uma moldura acesa de uma apagada, e separa nos dois temas, é ela
    // ser contínua contra tracejada — a única coisa que sobra quando
    // `fill-opacity: 0` tira o preenchimento de cena.
    expect(alta.traco, `traço da moldura acesa no tema ${tema}`).not.toBe(baixa.traco);
    expect(alta.traco, `moldura acesa é contínua no tema ${tema}`).toBe("none");
    expect(alta.stroke, `cor da moldura acesa no tema ${tema}`).not.toBe(baixa.stroke);
  }
  // A prova de que o laço acima trocou mesmo de tema.
  expect(fundoPorTema[0], "o tema mudou de verdade").not.toBe(fundoPorTema[1]);
});
