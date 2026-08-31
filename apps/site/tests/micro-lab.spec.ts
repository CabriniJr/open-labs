import { expect, test } from "@playwright/test";

/**
 * O lab é uma ilha `client:only`: nada dele existe no HTML do servidor, então
 * todo teste começa esperando o palco aparecer.
 */
test("o genérico desenha o sistema: memória, CPU e os barramentos", async ({ page }) => {
  await page.goto("labs/micro/");
  const palco = page.locator(".dui-stage");
  await expect(palco).toBeVisible({ timeout: 15_000 });

  for (const peca of ["main memory", "CPU", "clock", "address bus", "data bus"]) {
    await expect(palco.getByText(peca, { exact: true })).toBeVisible();
  }

  // A CPU chega fechada: é o que diz em voz alta que há mais lá dentro.
  await expect(
    palco.locator('.dui-stage__objeto[data-id="cpu"][data-fechado="true"]'),
  ).toHaveCount(1);
});

test("entrar na CPU mostra a UC; entrar no processador mostra os registradores", async ({
  page,
}) => {
  await page.goto("labs/micro/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

  const framing = page.getByRole("group", { name: "Framing" });
  await framing.getByRole("button", { name: "CPU", exact: true }).click();
  await expect(page.locator(".dui-stage").getByText("control unit", { exact: true })).toBeVisible();

  await framing.getByRole("button", { name: "processor", exact: true }).click();
  const palco = page.locator(".dui-stage");
  for (const peca of ["AC", "MAR", "MBR", "IR", "PC"]) {
    await expect(palco.getByText(peca, { exact: true })).toBeVisible();
  }
});

test("a fase muda de um tick para o outro — é o que o single-cycle não mostra", async ({
  page,
}) => {
  await page.goto("labs/micro/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

  // O primeiro clique só confirma a fase inicial — no tick 0 nada rodou
  // ainda, e o primeiro commit da UC apenas a torna real. É só do segundo
  // tick em diante que a máquina de fases de verdade avança.
  await page.getByRole("button", { name: "Pause" }).click();
  const fase = page.locator("[data-fase]");
  await page.getByRole("button", { name: "Step" }).click();
  const antes = await fase.getAttribute("data-fase");
  await page.getByRole("button", { name: "Step" }).click();
  await expect(fase).not.toHaveAttribute("data-fase", antes ?? "");
});

test("dá para descer da ULA até um transistor", async ({ page }) => {
  await page.goto("labs/micro/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

  await page
    .getByRole("group", { name: "Framing" })
    .getByRole("button", { name: "processor", exact: true })
    .click();

  await page.locator('.dui-stage__objeto[data-id="ula"]').first().dblclick();
  const somador = page.locator('.dui-stage__objeto[data-id="somador"]').first();
  await expect(somador).toBeVisible();
  await somador.dblclick();
  await expect(page.locator('.dui-stage__objeto[data-id="bit0"]')).toBeVisible();
});

test("o lab não rola na horizontal", async ({ page }) => {
  await page.goto("labs/micro/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("bateu a dúvida do que é o MAR, a resposta está ali — em vocabulário do domínio", async ({
  page,
}) => {
  await page.goto("labs/micro/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

  await page
    .getByRole("group", { name: "Framing" })
    .getByRole("button", { name: "processor", exact: true })
    .click();

  await page.locator('.dui-stage__objeto[data-id="mar"]').first().click();
  const ficha = page.locator(".ficha");
  // A ficha do MAR não pode responder só "buffer": tem que dizer o que a peça
  // é nesta máquina, e não só o `kind` do motor.
  await expect(ficha).toContainText("address bus");
  await expect(ficha).toContainText("buffer");
});
