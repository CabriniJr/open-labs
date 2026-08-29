import { expect, test } from "@playwright/test";

/**
 * O catálogo é a promessa da capa: se a landing anuncia um handbook e a página
 * dele não abre, o site mente. Estes testes andam o caminho inteiro.
 */
test("the landing lists the handbooks and each one opens", async ({ page }) => {
  await page.goto("");

  const cartoes = page.locator(".handbooks .hb-card");
  await expect(cartoes).toHaveCount(2);

  await cartoes.filter({ hasText: "RISC-V" }).click();
  await expect(page.locator("h1")).toContainText("RISC-V");
});

test("a handbook page shows roadmap, articles and labs", async ({ page }) => {
  await page.goto("handbooks/riscv/");

  await expect(page.getByRole("heading", { name: "Roadmap" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Articles and labs" })).toBeVisible();
  await expect(page.locator(".hb-phase")).toHaveCount(6);
  await expect(page.locator(".hb-group")).toHaveCount(6);
  await expect(page.locator(".hb-item").first()).toContainText("coming");
});

test("both handbooks draw their own interactive map", async ({ page }) => {
  // O RISC-V ficou sem mapa enquanto o modelo dele não existia — desenhar o
  // caminho antes de andá-lo seria prometer. O modelo existe, e o mapa dele
  // mostra os dois labs que abrem e o resto como caminho declarado.
  await page.goto("handbooks/otel/");
  await expect(page.locator(".roadmap")).toBeVisible();
  await expect(page.locator('.roadmap__node[data-status="coming"]').first()).toBeVisible();

  await page.goto("handbooks/riscv/");
  await expect(page.locator(".roadmap")).toBeVisible();
  // dois nós abrem, e eles levam aos labs que estão no ar
  const abertos = page.locator('.roadmap__node:not([data-status="coming"]) a');
  await expect(abertos).toHaveCount(3);
  await expect(page.locator('.roadmap__node a[href$="labs/cpu"]').first()).toBeVisible();
  await expect(page.locator('.roadmap__node a[href$="labs/gates"]').first()).toBeVisible();
});

test("nothing on a map promises a link that goes nowhere", async ({ page }) => {
  // O defeito que originou este teste: um nó marcado como pronto com href "#".
  for (const rota of ["handbooks/otel/", "handbooks/riscv/"]) {
    await page.goto(rota);
    await expect(page.locator('.roadmap__node a[href="#"]')).toHaveCount(0);
  }
});

test("the handbooks index links back into each handbook", async ({ page }) => {
  await page.goto("handbooks/");

  await expect(page.locator(".hb-card")).toHaveCount(2);
  await page.locator(".hb-card").first().click();
  await expect(page.locator("h1")).toContainText("OpenTelemetry");
});

test("handbook pages do not scroll horizontally", async ({ page }) => {
  for (const rota of ["handbooks/", "handbooks/otel/", "handbooks/riscv/"]) {
    await page.goto(rota);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, rota).toBeLessThanOrEqual(1);
  }
});

test("o desenho do mapa e as coordenadas dos nós escalam juntos", async ({ page }) => {
  // O defeito: a proporção do mapa estava escrita no CSS com a medida do OTel,
  // e um mapa de outra altura fazia o SVG e os nós escalarem diferente — as
  // linhas paravam longe das caixas, mostrando fio ligado a lugar nenhum.
  //
  // As linhas vivem no SVG e as caixas são posicionadas em % sobre o contêiner,
  // então os dois só concordam enquanto ocuparem exatamente a mesma caixa.
  for (const rota of ["handbooks/otel/", "handbooks/riscv/"]) {
    await page.goto(rota);
    const fios = page.locator(".roadmap__wires");

    // Em tela estreita o mapa vira lista empilhada e os fios somem de
    // propósito: ali não há o que alinhar, e a lista é que precisa existir.
    if (!(await fios.isVisible())) {
      await expect(page.locator(".roadmap__node").first()).toBeVisible();
      continue;
    }

    // O SVG sempre preenche o contêiner (`inset: 0`), então medir a caixa dele
    // não prova nada. O que desalinha é a proporção do **viewBox** contra a da
    // caixa: divergindo, o desenho é encaixado com sobra dentro do próprio SVG
    // e as coordenadas dele deixam de bater com as porcentagens dos nós.
    const mapa = await page.locator(".roadmap__map").boundingBox();
    expect(mapa, rota).not.toBeNull();

    const viewBox = await fios.getAttribute("viewBox");
    expect(viewBox, rota).not.toBeNull();
    const [, , vbW, vbH] = viewBox!.split(/\s+/).map(Number);

    const daCaixa = mapa!.height / mapa!.width;
    const doDesenho = vbH! / vbW!;
    expect(Math.abs(daCaixa - doDesenho), `${rota} proporção`).toBeLessThan(0.02);
  }
});
