import { expect, test } from "@playwright/test";

/**
 * O lab dos provedores, na tela.
 *
 * O que se cobra aqui é o que só a página pode responder: a ilha hidrata, o
 * relógio anda, descer e voltar **não** recomeça o tempo, e mexer num controle
 * também não. As afirmações sobre o modelo têm testes de unidade — repeti-las
 * aqui seria pagar caro por uma segunda opinião pior.
 */

async function hidratado(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("labs/providers/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });
  await expect.poll(async () => page.locator(".dui-stage__trilho").count()).toBeGreaterThan(0);
}

/** Os botões de enquadramento. Nomeados, porque a trilha e o palco também têm
 *  botão com o mesmo nome — e escolher "o primeiro que casar" é o tipo de
 *  seletor que passa a apontar para outro elemento sem ninguém perceber. */
const enquadrar = (page: import("@playwright/test").Page, nome: string) =>
  page.getByRole("group", { name: "Framing" }).getByRole("button", { name: nome, exact: true });

const tickAgora = async (page: import("@playwright/test").Page): Promise<number> => {
  const texto = (await page.locator(".providers-lab__tick").first().textContent()) ?? "";
  return Number(texto.replace(/\D/gu, ""));
};

test("a página carrega, a ilha hidrata e o relógio anda", async ({ page }) => {
  await hidratado(page);
  await expect.poll(() => tickAgora(page), { timeout: 15_000 }).toBeGreaterThan(2);
});

test("descer até a fila e voltar não reinicia o tick", async ({ page }) => {
  await hidratado(page);
  await expect.poll(() => tickAgora(page), { timeout: 15_000 }).toBeGreaterThan(3);
  await page.getByRole("button", { name: "Pause" }).click();
  const antes = await tickAgora(page);

  await enquadrar(page, "BatchSpanProcessor").click();
  await expect(page.locator(".dui-stage")).toBeVisible();
  await enquadrar(page, "Instrumented process").click();

  // Descer é câmera, não é recomeço. Um lab que reinicia ao entrar numa peça
  // apaga o que o leitor acabou de construir.
  expect(await tickAgora(page)).toBe(antes);
});

test("mexer num controle é evento no tempo, e não reset", async ({ page }) => {
  await hidratado(page);
  await expect.poll(() => tickAgora(page), { timeout: 15_000 }).toBeGreaterThan(3);
  await page.getByRole("button", { name: "Pause" }).click();
  const antes = await tickAgora(page);

  await page.getByLabel(/LoggerConfig/u).check();
  expect(await tickAgora(page)).toBe(antes);
});

test("o cenário sem SDK troca a árvore, e o silêncio aparece com número", async ({ page }) => {
  await hidratado(page);
  await page.getByLabel("No SDK installed").check();
  await expect(page.locator(".dui-stage")).toBeVisible();

  // O contador do no-op sobe e nada chega ao collector. Sem o número, "nada
  // aconteceu" e "nada apareceu" seriam o mesmo painel.
  const linha = page.locator(".providers-lab__contas li", { hasText: "ended in the no-op" });
  await expect(linha).toBeVisible();
  await expect
    .poll(async () => Number(((await linha.textContent()) ?? "").replace(/\D/gu, "")), {
      timeout: 15_000,
    })
    .toBeGreaterThan(0);

  const recebeu = page.locator(".providers-lab__contas li", { hasText: "collector received" });
  await expect(recebeu).toContainText("0");
});

test("a predição não entrega a resposta antes de o leitor se comprometer", async ({ page }) => {
  await page.goto("labs/providers/");
  const revelacao = page.getByText(/reaction table is explicit/u);
  await expect(revelacao).toHaveCount(0);

  const opcao = page.getByRole("button", { name: /the processor is called, the exporter is not/u });
  await opcao.scrollIntoViewIfNeeded();
  await opcao.click();
  await expect(revelacao).toBeVisible();
});

test("o descarte é desenhado: a saída que não vai a lugar nenhum tem terminal", async ({ page }) => {
  await hidratado(page);
  await enquadrar(page, "TracerProvider").click();
  // O amostrador tem três saídas, e a terceira é a ausência de destino. Sem o
  // terminal, descarte deliberado e fio esquecido seriam o mesmo desenho.
  await expect(page.locator('.dui-stage__fio[data-descarte="true"]').first()).toBeAttached();
  await expect(page.locator(".dui-stage__descarte text").first()).toHaveText("drop");
});

/**
 * A carga na esteira.
 *
 * Estes três são os que faltavam quando o lab ficou verde em tudo e a tela não
 * mostrava nada andando: vinte e um fios desenhados e **zero** bolinhas. O
 * motor entrega na folha de entrada de um contêiner, o desenho conhece as
 * caixas da vista, e ninguém traduzia de um para o outro — então a chave nunca
 * casava e a carga simplesmente não era desenhada.
 */
test("a carga aparece e anda, mesmo quando o fio entra num contêiner", async ({ page }) => {
  await hidratado(page);
  await expect
    .poll(async () => page.locator(".dui-stage__carga-grupo--voo").count(), { timeout: 15_000 })
    .toBeGreaterThan(0);
});

test("a carga muda de forma no caminho: um ponto, um punhado, um documento", async ({ page }) => {
  await hidratado(page);
  await enquadrar(page, "BatchSpanProcessor").click();
  await page.getByRole("button", { name: "Pause" }).click();

  const formas = async () =>
    page.locator(".dui-stage__carga-grupo--voo").evaluateAll((nos) =>
      nos.map((n) => ({
        titulo: n.querySelector("title")?.textContent ?? "",
        pontos: n.querySelectorAll("circle.dui-stage__carga").length,
        pacote: n.querySelector(".dui-stage__carga--pacote") !== null,
      })),
    );

  const visto = { unidade: false, feixe: false, pacote: false };
  // Passo a passo, e não esperando: o lote sai quando um gatilho dispara, e o
  // que se afirma é que as TRÊS formas acontecem — um teste que varre dois
  // casos prova, no fim, que os dois casos aconteceram.
  for (let i = 0; i < 24; i += 1) {
    for (const carga of await formas()) {
      if (carga.pacote) visto.pacote = true;
      else if (carga.pontos > 1) visto.feixe = true;
      else if (carga.pontos === 1 && carga.titulo.startsWith("span")) visto.unidade = true;
    }
    if (visto.unidade && visto.feixe && visto.pacote) break;
    await page.getByRole("button", { name: "Step" }).click();
  }

  expect(visto, "o span solto, o lote e o envelope têm de aparecer os três").toEqual({
    unidade: true,
    feixe: true,
    pacote: true,
  });
});

test("espécies diferentes são pintadas diferente — o atributo estava certo e o CSS não pintava", async ({
  page,
}) => {
  await hidratado(page);
  await enquadrar(page, "Host").click();

  // Cobrar a TINTA, e não o atributo. O `data-especie` sempre esteve no lugar
  // certo; o seletor é que pedia o atributo na carga em vez de no grupo, e as
  // cinco espécies eram pintadas da mesma cor, caladas.
  await expect
    .poll(
      async () =>
        page.locator(".dui-stage__carga-grupo--voo").evaluateAll((nos) => {
          const tintas = new Set<string>();
          for (const no of nos) {
            const alvo = no.querySelector(".dui-stage__carga");
            if (alvo === null) continue;
            tintas.add(getComputedStyle(alvo).fill);
          }
          return tintas.size;
        }),
      { timeout: 20_000 },
    )
    .toBeGreaterThan(1);
});
