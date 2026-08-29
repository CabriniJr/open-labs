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
  for (const peca of ["ULA", "banco de registradores", "unidade de controle", "PC"]) {
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

  await page.getByRole("button", { name: "Pausar" }).click();
  const tick = page.locator(".cpu-lab__tick").first();
  const antesDoTick = await tick.innerText();
  const agora = page.locator(".cpu-lab__agora");
  const antes = await agora.innerText();

  await page.getByRole("button", { name: "Um ciclo" }).click();
  await expect(tick).not.toHaveText(antesDoTick);

  // O PC anda um ciclo depois da busca: o valor atravessa a borda de relógio,
  // e só é latchado no flanco seguinte. Três cliques cobrem a travessia.
  for (let i = 0; i < 3; i += 1) {
    await page.getByRole("button", { name: "Um ciclo" }).click();
  }
  await expect(agora).not.toHaveText(antes);
});

test("erro de montagem aparece com linha e coluna", async ({ page }) => {
  await page.goto("labs/cpu/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

  await page.getByLabel("Programa em assembly").fill("add t0, x99, t2\n");
  await page.getByRole("button", { name: "Montar e reiniciar" }).click();

  const erro = page.locator(".cpu-lab__erros li").first();
  await expect(erro).toContainText("1:");
  await expect(erro).toContainText("x0 a x31");
});

test("a segunda view mostra o mesmo run mais de perto", async ({ page }) => {
  await page.goto("labs/cpu/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

  await page
    .getByRole("group", { name: "Enquadramento" })
    .getByRole("button", { name: "processador" })
    .click();
  const palco = page.locator(".dui-stage");
  await expect(palco).toHaveAttribute("aria-label", /Dentro do processador/);
  // enquadrar mais perto não faz o relógio sumir do modelo, só do desenho
  await expect(palco.getByText("relógio", { exact: true })).toHaveCount(0);
  await expect(palco.getByText("ULA", { exact: true })).toBeVisible();
});

test("o lab não rola na horizontal", async ({ page }) => {
  await page.goto("labs/cpu/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
