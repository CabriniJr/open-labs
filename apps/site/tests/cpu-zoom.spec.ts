import { expect, test } from "@playwright/test";

/**
 * A escada da CPU, descida por zoom: sistema › processador › ULA › somador ›
 * bit › porta › silício. Ela é a mesma árvore o tempo todo — o que muda é a
 * distância da câmera.
 */
test.skip(({ isMobile }) => isMobile === true, "o gesto de toque é a pinça, e ela não existe ainda");

test("o somador de 32 bits abre dentro da caixa da ULA", async ({ page }) => {
  await page.goto("labs/cpu/");
  await page.waitForSelector("g.dui-stage__objeto");

  await page.getByRole("group", { name: "Framing" }).getByRole("button", { name: "ALU" }).click();
  const somador = page.locator('[data-id="somador"]');
  await expect(somador).toBeVisible();
  // De longe, os estágios não estão no desenho. A caixa da ULA já é grande o
  // bastante para o somador começar a aparecer — o que ainda não aparece é o
  // que mora dentro dele.
  // De longe o interior existe e está quase apagado: é a rampa, e é ela que
  // faz a descida ser contínua. O que não dá para ler ainda é o que há dentro
  // de cada estágio.
  const opacidade = () =>
    page.locator(".dui-stage__interior").first().evaluate((el) => Number(el.getAttribute("opacity")));
  expect(await opacidade()).toBeLessThan(0.6);

  // O palco passou a ter altura própria e ficou mais alto, então a caixa pode
  // nascer abaixo da dobra. A roda precisa cair SOBRE o desenho: fora dele o
  // navegador rola a página e a câmera não se mexe — que é como este teste
  // falhava, com a opacidade parada no valor de longe.
  await somador.scrollIntoViewIfNeeded();
  const caixa = await somador.boundingBox();
  const janela = page.viewportSize();
  if (caixa === null || janela === null) throw new Error("o somador não está na tela");
  const x = Math.min(janela.width - 5, Math.max(5, caixa.x + caixa.width / 2));
  const y = Math.min(janela.height - 5, Math.max(5, caixa.y + caixa.height / 2));
  for (let i = 0; i < 10; i++) {
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(45);
  }
  await page.waitForTimeout(500);

  // Os trinta e dois estágios, em serpentina: o vai-um atravessa a largura
  // inteira do número, e a dobra é só a linha do texto virando.
  expect(await opacidade()).toBeGreaterThan(0.99);
  const dentro = page.locator(".dui-stage__interior").first();
  await expect(dentro).toBeVisible();
  await expect(dentro.locator('[data-id="bit0"]')).toHaveCount(1);
  await expect(dentro.locator('[data-id="bit31"]')).toHaveCount(1);
});

/**
 * O fundo é opção porque custa: 247 objetos viram 3639. Escondido num padrão,
 * isso viraria "o lab travou" — e o preço tem que estar escrito onde se decide.
 */
test("a ULA só desce até o transistor quando o leitor pede", async ({ page }) => {
  await page.goto("labs/cpu/");
  await page.waitForSelector("g.dui-stage__objeto");

  const opcao = page.getByRole("checkbox", { name: /transistor/i });
  await expect(opcao).not.toBeChecked();

  const substeps = async () =>
    page.evaluate(() => {
      const alvo = [...document.querySelectorAll(".cpu-lab__tick")].find((e) =>
        (e.textContent ?? "").includes("substeps"),
      );
      return Number((alvo?.textContent ?? "").replace(/\D+/g, "")) || 0;
    });
  await expect.poll(substeps).toBeGreaterThan(0);
  const raso = await substeps();

  await opcao.check();
  await expect.poll(substeps, { timeout: 30000 }).toBeGreaterThan(raso * 2);

  // A mesma conta, muito mais fundo: o atraso de propagação cresce porque o
  // caminho cresceu, e é isso que o número diz.
});

/**
 * O barramento: a coisa que agrega.
 *
 * Endereço e dado eram dois fios soltos atravessando o desenho. É fiel e é
 * ilegível no nível alto — é o espaguete que qualquer diagrama de sistema vira
 * quando não há nada que agregue. De longe o barramento é uma esteira só; de
 * perto, são as vias, cada uma com a sua carga.
 */
test("o barramento é uma auto-estrada, e as pistas dele estão à vista", async ({ page }) => {
  await page.goto("labs/cpu/");
  await page.waitForSelector("g.dui-stage__objeto");

  const barramento = page.locator('[data-id="barramento"]');
  await expect(barramento).toHaveAttribute("data-familia", "conduit");

  // Fechado, ele era uma barra verde no meio da figura: o leitor via que havia
  // um barramento e não via o que ele é. As três pistas do diagrama de sempre
  // — endereço, dado, controle — estão desenhadas, e cada uma é um conduíte de
  // verdade, que transporta e não altera.
  for (const via of ["via-endereco", "via-dado", "via-acesso"]) {
    const pista = page.locator(`[data-id="${via}"]`);
    await expect(pista).toHaveCount(1);
    await expect(pista).toHaveAttribute("data-familia", "conduit");
  }

  // E elas rodam: o endereço que a CPU pôs na pista chega na memória por ela.
  await expect(page.locator('[data-id="via-endereco"][data-ativo="true"]')).toHaveCount(1, {
    timeout: 15_000,
  });
});

/**
 * A forma vem do kind, e ela é a explicação.
 *
 * Um seletor desenhado como retângulo exige que o leitor já saiba o que é um
 * mux — o rótulo é a única pista, e rótulo se ignora. O trapézio conta antes:
 * largo do lado das entradas, estreito do lado da saída. Muitas entram, uma
 * sai. É a notação universal, e ela não custa nada.
 */
test("um seletor é um trapézio, e o que não é seletor não é", async ({ page }) => {
  await page.goto("labs/cpu/");
  await page.waitForSelector("g.dui-stage__objeto");
  await page.getByRole("group", { name: "Framing" }).getByRole("button", { name: "processor" }).click();
  await page.waitForSelector('[data-id="mux-operando"]');

  const mux = page.locator('[data-id="mux-operando"]');
  await expect(mux.locator("path.dui-stage__caixa")).toHaveCount(1);
  await expect(mux.locator("rect.dui-stage__caixa")).toHaveCount(0);

  // E a saída sai pelo bico, e não espalhada pela borda: é ali que a linha
  // realmente sai.
  await expect(mux.locator('.dui-stage__porta[data-lado="saida"]')).toHaveCount(1);

  // O banco de registradores guarda, não seleciona: continua sendo caixa.
  const banco = page.locator('[data-id="banco"]');
  await expect(banco.locator("rect.dui-stage__caixa")).toHaveCount(1);
  await expect(banco.locator("path.dui-stage__caixa")).toHaveCount(0);
});

test("a memória abre, e lá dentro está o que endereçar quer dizer", async ({ page }) => {
  await page.goto("labs/cpu/");
  await page.waitForSelector("g.dui-stage__objeto");

  // Fechada, a memória recebe um número e devolve outro: o passo que interessa
  // acontece em lugar nenhum. Aberta, ele tem peça, e a peça roda.
  await page.locator('.dui-stage__objeto[data-id="imem"]').first().dblclick();
  await expect(page.locator(".explorer__trilha")).toContainText("instruction memory");

  const decodificador = page.locator('.dui-stage__objeto[data-id="imem-decodificador"]');
  const celulas = page.locator('.dui-stage__objeto[data-id="imem-celulas"]');
  await expect(decodificador).toHaveCount(1);
  await expect(celulas).toHaveCount(1);

  // O decodificador é quem transforma: um endereço entra, uma linha sai.
  await expect(decodificador).toHaveAttribute("data-familia", "processor");
  // E o banco de células guarda de verdade: o programa está ali, linha a linha.
  await expect(celulas.locator(".dui-stage__linha-chave").first()).toBeVisible();
  await expect(celulas.locator(".dui-stage__prateleira")).toHaveCount(1);
});
