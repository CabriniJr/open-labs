import { expect, test } from "@playwright/test";

/**
 * O lab é uma ilha `client:only`: nada dele existe no HTML do servidor, então
 * todo teste começa esperando o palco aparecer.
 */
test("o caminho de dados desenha e executa", async ({ page }) => {
  await page.goto("labs/cpu/");

  const palco = page.locator(".dui-stage");
  await expect(palco).toBeVisible({ timeout: 15_000 });

  // A view não esconde nada: as peças do modelo estão todas desenhadas.
  for (const peca of ["ALU", "register file", "control unit", "PC"]) {
    await expect(palco.getByText(peca, { exact: true })).toBeVisible();
  }

  // O relógio anda sozinho, e o registrador que o programa usa sai do zero.
  await expect(page.locator(".cpu-lab__tick").first()).not.toHaveText("tick 0");
  await expect(page.locator(".cpu-lab__regs li").filter({ hasText: "t1" }).first()).not.toHaveText(
    /t1\s*0$/,
  );
});

test("um ciclo por clique, e o pc anda", async ({ page }) => {
  await page.goto("labs/cpu/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Pause" }).click();
  const tick = page.locator(".cpu-lab__tick").first();
  const antesDoTick = await tick.innerText();
  const agora = page.locator(".cpu-lab__agora");
  const antes = await agora.innerText();

  await page.getByRole("button", { name: "One cycle" }).click();
  await expect(tick).not.toHaveText(antesDoTick);

  // O PC anda um ciclo depois da busca: o valor atravessa a borda de relógio,
  // e só é latchado no flanco seguinte. Três cliques cobrem a travessia.
  for (let i = 0; i < 3; i += 1) {
    await page.getByRole("button", { name: "One cycle" }).click();
  }
  await expect(agora).not.toHaveText(antes);
});

test("erro de montagem aparece com linha e coluna", async ({ page }) => {
  await page.goto("labs/cpu/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

  await page.getByLabel("Assembly program").fill("add t0, x99, t2\n");
  await page.getByRole("button", { name: "Assemble and restart" }).click();

  const erro = page.locator(".cpu-lab__erros li").first();
  await expect(erro).toContainText("1:");
  await expect(erro).toContainText("x0 a x31");
});

test("a segunda view mostra o mesmo run mais de perto", async ({ page }) => {
  await page.goto("labs/cpu/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

  await page
    .getByRole("group", { name: "Framing" })
    .getByRole("button", { name: "processor", exact: true })
    .click();
  const palco = page.locator(".dui-stage");
  await expect(palco).toHaveAttribute("aria-label", /Inside the processor/);
  // enquadrar mais perto não faz o relógio sumir do modelo, só do desenho
  await expect(palco.getByText("clock", { exact: true })).toHaveCount(0);
  await expect(palco.getByText("ALU", { exact: true })).toBeVisible();
});

test("o lab não rola na horizontal", async ({ page }) => {
  await page.goto("labs/cpu/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("descer da CPU até a porta lógica, e achar o somador vivo lá embaixo", async ({ page }) => {
  await page.goto("labs/cpu/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

  const trilha = page.locator(".explorer__trilha");
  await page.locator('.dui-stage__objeto[aria-label^="ALU"]').first().dblclick();
  await expect(trilha).toContainText("ALU");

  await page.locator('.dui-stage__objeto[aria-label^="32-bit adder"]').first().dblclick();
  // o somador de 32 bits tem 32 somadores completos, e eles existem de verdade
  await expect(page.locator(".dui-stage__objeto")).toHaveCount(32);

  await page.locator('.dui-stage__objeto[aria-label^="bit7"]').first().dblclick();
  await expect(page.locator(".dui-stage__objeto")).toHaveCount(5);
  await expect(trilha).toContainText("bit7");

  // e volta pela trilha, sem recarregar nada
  await trilha.getByRole("button", { name: "system" }).click();
  await expect(page.locator('.dui-stage__objeto[aria-label^="ALU"]')).toBeVisible();
});

test("a profundidade do tick conta a cascata do vai-um de 32 bits", async ({ page }) => {
  await page.goto("labs/cpu/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });
  // com o somador aberto, um ciclo custa dezenas de substeps de propagação
  await expect(page.locator(".cpu-lab__tick").nth(1)).toContainText("substeps");
});


test("o programa ouve o botão e fala o resultado", async ({ page }) => {
  await page.goto("labs/cpu/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

  // No compasso mais rápido, para o laço de cinco voltas não custar meio minuto
  const relogio = page.getByLabel("Clock speed");
  await relogio.fill("1600");

  // O programa de partida soma 1..n, com n vindo do endereço de entrada.
  // 1+2+3+4+5 = 15, e é isso que ele fala pelo endereço de saída.
  await expect(page.locator(".cpu-lab__falou")).toHaveText("15", { timeout: 20_000 });

  // Girar o botão é evento no tempo, não recomeço: o programa já falou, então
  // é preciso montar de novo para ele ouvir o número novo desde o começo.
  await page.getByLabel("Input device value").fill("3");
  await page.getByRole("button", { name: "Assemble and restart" }).click();
  await relogio.fill("1600");
  await expect(page.locator(".cpu-lab__falou")).toHaveText("6", { timeout: 20_000 });
});

test("caixa recolhida com circuito dentro não é desenhada parada", async ({ page }) => {
  await page.goto("labs/cpu/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

  // A ULA está recolhida e tem um somador de 32 bits rodando lá dentro. Uma
  // caixa parada, neste desenho, quer dizer "não fez nada" — então desenhá-la
  // parada seria afirmar o contrário do que o modelo diz.
  const ula = page.locator('.dui-stage__objeto[aria-label^="ALU"]').first();
  await expect(ula).toHaveAttribute("data-ativo", "true", { timeout: 15_000 });

  // E ela precisa ser DESENHADA como o que ela guarda: contêiner é moldura, e
  // moldura não tem engrenagem nem gesto. Sem isto, o atributo acima estaria
  // certo e a caixa continuaria parecendo morta na tela — que é o que importa.
  await expect(ula).toHaveAttribute("data-familia", "processor");
  await expect(ula.locator(".dui-stage__engrenagem")).toHaveCount(1);
});

test("o que acontece dentro do ciclo aparece na tela", async ({ page }) => {
  await page.goto("labs/cpu/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".cpu-lab__tick").nth(1)).toContainText("substeps", {
    timeout: 30_000,
  });

  // Só o tráfego que atravessa a borda do relógio andava. Numa CPU quase tudo é
  // combinacional, então o cálculo inteiro — buscar, decodificar, somar,
  // escolher — acontecia dentro do tick e sem nada se mexer: o desenho ficava
  // parado justamente onde está a coisa que se quer entender.
  const acomodadas = page.locator(".dui-stage__carga-grupo--acomodada");
  await expect(acomodadas.first()).toBeAttached({ timeout: 10_000 });
  expect(await acomodadas.count()).toBeGreaterThan(
    await page.locator(".dui-stage__cargas .dui-stage__carga-grupo").count(),
  );
});

test("bateu a dúvida do que é a peça, a resposta está ali", async ({ page }) => {
  await page.goto("labs/cpu/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

  // O hover responde sem tirar ninguém da tela...
  const mux = page.locator('.dui-stage__objeto[aria-label^="operand mux"]').first();
  await expect(mux.locator("title")).toContainText("router");

  // ...e a ficha responde por extenso, com o que a peça é e o que ela está
  // fazendo agora. Sem isso, quem não sabe o que é um mux precisa sair da
  // página para descobrir — e sair da página é onde se perde o fio.
  await mux.click();
  const ficha = page.locator(".ficha");
  await expect(ficha).toContainText("operand mux");
  await expect(ficha).toContainText("router");
  await expect(ficha).toContainText("A mux is a router");
  await expect(ficha).toContainText("processor");

  // e a topologia crua, para conferir o desenho contra o modelo
  await page.locator(".ficha__dot-botao").click();
  await expect(page.locator(".ficha__dot")).toContainText("digraph");
});

test("a ficha de um contêiner mostra o interior dele em grafo", async ({ page }) => {
  await page.goto("labs/cpu/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

  await page.locator('.dui-stage__objeto[aria-label^="ALU"]').first().click();
  await expect(page.locator(".ficha")).toContainText("composite");
  await page.locator(".ficha__dot-botao").click();
  const dot = page.locator(".ficha__dot");
  // o interior da ULA: o dispersor, o somador, e a aresta entre eles
  await expect(dot).toContainText("splitter");
  await expect(dot).toContainText("->");
});
