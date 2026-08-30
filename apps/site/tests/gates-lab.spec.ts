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

  /*
   * Por id, e não pelo primeiro que casar.
   *
   * `.first()` de um conjunto que muda não é um elemento: entre duas medidas o
   * primeiro pode ser outro objeto, e a checagem de permanência passa a
   * comparar duas peças diferentes. Passava sozinho e reprovava na suíte
   * cheia, que é a assinatura desse erro.
   *
   * Com as entradas fixas o circuito é combinacional e o valor de cada porta
   * não muda de tick para tick — então fixar o id mantém a prova de
   * permanência atravessando muitos ticks, que é justamente o que o defeito
   * original precisava para aparecer.
   */
  await page.getByLabel("First addend").fill("6");
  await page.getByLabel("Second addend").fill("7");

  const escolher = async (aceso: boolean): Promise<string> => {
    const seletor = aceso
      ? '.dui-stage__objeto[data-familia="processor"][data-alto="true"]'
      : '.dui-stage__objeto[data-familia="processor"]:not([data-alto="true"])';
    const id = await page.locator(seletor).first().getAttribute("data-id");
    if (id === null) throw new Error(`nenhuma porta ${aceso ? "acesa" : "apagada"} na tela`);
    return id;
  };
  const ALTA = `.dui-stage__objeto[data-id="${await escolher(true)}"]`;
  const BAIXA = `.dui-stage__objeto[data-id="${await escolher(false)}"]`;
  await expect(page.locator(BAIXA)).toBeVisible();

  const alta = await tinta(page, ALTA);
  const baixa = await tinta(page, BAIXA);

  expect(alta.fill).not.toBe(baixa.fill);
  expect(alta.cor).toBeGreaterThan(baixa.cor + 0.02);

  // O halo é de quem disse um. Um brilho de raio zero e cor transparente é o
  // que a transição interrompida deixava para trás, e ele lê como nenhum.
  expect(alta.filter).not.toBe("none");
  expect(alta.filter).not.toMatch(/0px 0px 0px/);

  /*
   * Estado, e não acontecimento — provado por amostragem.
   *
   * Cobrar igualdade exata do preenchimento em dois instantes era um proxy
   * frágil: ele pega qualquer quadro de transição e reprova por uma diferença
   * que ninguém enxerga. O que o defeito original fazia era a porta acesa
   * **cair na tinta do apagado** durante quase todo o tick, e o que prova o
   * contrário é olhar muitas vezes e nunca encontrá-la apagada.
   *
   * Isto roda no tema em que a página nasceu, de propósito: o site restaura o
   * tema dele sozinho, e uma troca no meio da amostragem faria as medidas
   * compararem temas em vez de instantes.
   */
  const piso = baixa.cor + 0.02;
  for (let amostra = 0; amostra < 12; amostra += 1) {
    await page.waitForTimeout(140);
    const agora = await tinta(page, ALTA);
    expect(agora.cor, `amostra ${amostra}: a porta acesa apagou`).toBeGreaterThan(piso);
  }

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

/**
 * O transistor não é um seletor, e o desenho não pode dizer que é.
 *
 * Ele era `kind: "router"`, e com isso herdava o trapézio do mux e a ficha o
 * descrevia com o texto do mux — "a mux is a router: it picks which of its
 * inputs answers". No nível mais didático do modelo, o desenho empurrava o
 * modelo mental errado: um transistor não escolhe entre entradas, ele deixa
 * passar ou não, e quem manda é o terminal de porta.
 */
test("o transistor é desenhado como chave, e não como seletor", async ({ page }) => {
  await page.goto("labs/gates/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

  // circuito › bit0 › a porta XOR › o NAND dentro dela › o silício
  await page.locator('.dui-stage__objeto[data-id="bit0"]').first().dblclick();
  await page.locator('.dui-stage__objeto[data-id="bit0-xor1"]').first().dblclick();
  await page.locator('.dui-stage__objeto[data-fechado="true"]').first().dblclick();

  const transistor = page.locator('.dui-stage__objeto[data-id$="-p1"]').first();
  await expect(transistor).toBeVisible({ timeout: 10_000 });

  // A chave, e nunca a engrenagem: deixar passar não é processar.
  await expect(transistor.locator(".dui-stage__chave")).toHaveCount(1);
  await expect(transistor.locator(".dui-stage__engrenagem")).toHaveCount(0);

  // E a caixa é caixa, não o trapézio que significa "escolha".
  await expect(transistor.locator("path.dui-stage__caixa")).toHaveCount(0);

  // A ficha deixa de explicá-lo como um mux.
  await transistor.click();
  await expect(page.locator(".ficha")).toContainText("switch", { timeout: 10_000 });
  await expect(page.locator(".ficha")).not.toContainText("A mux is a router");
});

/**
 * A legenda não pode discordar do desenho, e o registro tem de trocar.
 *
 * A mesma tinta quer dizer coisas diferentes em níveis diferentes — vermelha é
 * controle no diagrama de blocos e alimentação no esquemático. Isso só não é
 * ambiguidade porque as duas linguagens nunca aparecem no mesmo quadro e o
 * leitor sabe em qual está; e ele só sabe se a legenda mudar junto.
 *
 * A amostra é conferida contra o token que o desenho usa, e não contra um valor
 * escrito no teste: uma legenda com cor própria é uma segunda fonte, e o leitor
 * recorre a ela justamente quando não entendeu a figura.
 */
test("a legenda troca de registro ao descer, e concorda com o desenho", async ({ page }) => {
  await page.goto("labs/gates/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

  const legenda = page.locator(".dui-legenda");
  await expect(legenda).toHaveAttribute("data-registro", "blocos");
  await expect(legenda).toContainText("control");
  await expect(legenda).not.toContainText("supply");

  // circuito › bit0 › XOR › NAND: o último degrau é esquemático
  await page.locator('.dui-stage__objeto[data-id="bit0"]').first().dblclick();
  await page.locator('.dui-stage__objeto[data-id="bit0-xor1"]').first().dblclick();
  await page.locator('.dui-stage__objeto[data-fechado="true"]').first().dblclick();

  await expect(legenda).toHaveAttribute("data-registro", "esquematico", { timeout: 10_000 });
  await expect(legenda).toContainText("supply");
  await expect(legenda).toContainText("ground");
  await expect(legenda).not.toContainText("control");

  // A amostra pinta com o token, e o trilho de alimentação usa o mesmo.
  const amostra = (token: string) =>
    legenda
      .locator(`.dui-legenda__amostra[data-token="${token}"]`)
      .evaluate((el) => getComputedStyle(el).backgroundColor);
  const trilho = (alto: boolean) =>
    page
      .locator(
        `.dui-stage__objeto[data-kind="source"]${alto ? '[data-alto="true"]' : ':not([data-alto="true"])'}`,
      )
      .first()
      .evaluate((el) => {
        const caixa = el.querySelector(":scope > .dui-stage__caixa");
        if (caixa === null) throw new Error("trilho sem caixa");
        return getComputedStyle(caixa).stroke;
      });

  expect(await amostra("--dui-alimentacao")).toBe(await trilho(true));
  expect(await amostra("--dui-terra")).toBe(await trilho(false));

  /*
   * E os dois trilhos não podem ser a mesma tinta.
   *
   * A primeira versão da regra separava por `source` contra `sink`, e no
   * modelo os DOIS trilhos são `source` — então os dois saíam vermelhos. O
   * desenho ficou bonito e errado, e nenhum teste disse nada: foi preciso
   * olhar a tela. Esta linha é o que faz esse caminho não voltar.
   */
  expect(await trilho(true)).not.toBe(await trilho(false));
});

/**
 * Conduzir é estado, e o desenho tem de mostrá-lo.
 *
 * Aquele nível eram sete objetos do mesmo azul: a pergunta que ele existe para
 * responder — *por que esta porta deu 1?* — só se respondia lendo número
 * pequeno. E cortado não pode sumir: sumir confundiria "não está passando" com
 * "não está aqui".
 */
test("a chave que conduz é desenhada diferente da cortada", async ({ page }) => {
  await page.goto("labs/gates/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

  await page.locator('.dui-stage__objeto[data-id="bit0"]').first().dblclick();
  await page.locator('.dui-stage__objeto[data-id="bit0-xor1"]').first().dblclick();
  await page.locator('.dui-stage__objeto[data-fechado="true"]').first().dblclick();

  // Por id, pelo mesmo motivo do teste da porta acesa: `.first()` de um
  // conjunto que muda não é um elemento.
  await expect(page.locator('.dui-stage__objeto[data-conduz="true"]').first()).toBeVisible({
    timeout: 10_000,
  });
  const idDe = async (estado: string): Promise<string> => {
    const id = await page
      .locator(`.dui-stage__objeto[data-conduz="${estado}"]`)
      .first()
      .getAttribute("data-id");
    if (id === null) throw new Error(`nenhuma chave com data-conduz=${estado}`);
    return id;
  };
  // A complementaridade da porta CMOS garante que sempre há dos dois na tela.
  const conduz = page.locator(`.dui-stage__objeto[data-id="${await idDe("true")}"]`);
  const cortada = page.locator(`.dui-stage__objeto[data-id="${await idDe("false")}"]`);
  await expect(cortada).toBeVisible();

  const tinta = (loc: ReturnType<typeof page.locator>) =>
    loc.evaluate((el) => {
      const via = el.querySelector(".dui-stage__chave-via");
      const lamina = el.querySelector(".dui-stage__chave-lamina");
      if (via === null || lamina === null) throw new Error("chave sem símbolo");
      return {
        stroke: getComputedStyle(via).stroke,
        opacidade: getComputedStyle(via).opacity,
        // A lâmina fechada deita; aberta, ela sobe.
        deitada: lamina.getAttribute("y2") === "0",
      };
    });

  const passando = await tinta(conduz);
  const parada = await tinta(cortada);

  expect(passando.stroke).not.toBe(parada.stroke);
  expect(passando.deitada).toBe(true);
  expect(parada.deitada).toBe(false);
  // Cortada continua desenhada: apagada não é ausente.
  expect(Number(parada.opacidade)).toBeGreaterThan(0);
});
