import { expect, test } from "@playwright/test";

test("o payload OTLP: o showcase toca, e a simulação recalcula os bytes", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.goto("labs/reading-an-otlp-payload/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("never says");

  // A simulação abre por padrão: o analisador mostra os bytes do envelope.
  const lab = page.getByTestId("protobuf-lab");
  await expect(lab).toBeVisible();
  const bytes = lab.locator(".pblab__byte");
  const antes = await bytes.count();
  expect(antes).toBeGreaterThan(100);

  // 127 cabe num byte de varint; 128 precisa de dois.
  await lab.getByLabel("http.response.status_code").selectOption("127");
  const com127 = await bytes.count();
  await lab.getByLabel("http.response.status_code").selectOption("128");
  expect(await bytes.count()).toBe(com127 + 1);

  // Escolher um campo acende os bytes dele e explica a chave.
  await lab.getByRole("button", { name: /^5\s*name/ }).first().click();
  await expect(lab.locator(".pblab__leitura")).toContainText("field 5, wire type 2");
  expect(await lab.locator(".pblab__byte[data-on]").count()).toBeGreaterThan(2);

  await page.getByRole("tab", { name: /Showcase/ }).click();
  const vit = page.getByTestId("protobuf-showcase");
  await expect(vit).toBeVisible();
  await vit.getByRole("button", { name: /Messages nest by length/ }).click();
  await vit.getByRole("button", { name: "Pause" }).click();
  await expect(vit.locator(".cpuvit-niveis li[data-on]")).toHaveText("nesting");
  expect(erros).toEqual([]);
});
