import { expect, test } from "@playwright/test";
import { HANDBOOKS } from "../src/data/handbooks.js";

/** Só quem tem mapa é cobrado por mapa. Quem não tem diz isso em voz alta. */
const comMapa = HANDBOOKS.filter((h) => h.map !== undefined);

/**
 * O catálogo é a promessa da capa: se a landing anuncia um handbook e a página
 * dele não abre, o site mente. Estes testes andam o caminho inteiro.
 */
test("the landing lists the handbooks and each one opens", async ({ page }) => {
  await page.goto("");

  // Contado a partir do catálogo, e não de um número escrito à mão: um
  // handbook novo que não chegasse à capa passaria despercebido por um número
  // fixo, e a capa é justamente a promessa que este teste anda.
  const cartoes = page.locator(".handbooks .hb-card");
  await expect(cartoes).toHaveCount(HANDBOOKS.length);

  await cartoes.filter({ hasText: "RISC-V" }).click();
  await expect(page.locator("h1")).toContainText("RISC-V");
});

test("a handbook page shows roadmap, articles and labs", async ({ page }) => {
  await page.goto("handbooks/riscv/");

  await expect(page.getByRole("heading", { name: "Roadmap" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Articles and labs" })).toBeVisible();
  await expect(page.locator(".hb-phase")).toHaveCount(6);
  await expect(page.locator(".hb-group")).toHaveCount(6);
  // Um item pronto é um link; um item por escrever é texto. A página não pode
  // anunciar como pronto o que não abre, nem esconder o que já está escrito.
  const prontos = page.locator(".hb-item").filter({ has: page.locator(".status--available") });
  expect(await prontos.count()).toBeGreaterThan(0);
  for (let i = 0; i < (await prontos.count()); i++) {
    await expect(prontos.nth(i).locator("a")).toHaveCount(1);
  }
  const porEscrever = page.locator(".hb-item").filter({ has: page.locator(".status--coming") });
  await expect(porEscrever.first().locator("a")).toHaveCount(0);
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
  // três labs abrem, e eles levam aos que estão no ar — o genérico ocupou o
  // vazio que "as linhas de controle de um opcode" era, porque a UC
  // multiciclo dele é literalmente isso, em tempo.
  const abertos = page.locator('.roadmap__node:not([data-status="coming"]) a');
  await expect(abertos).toHaveCount(4);
  await expect(page.locator('.roadmap__node a[href*="labs/cpu"]').first()).toBeVisible();
  await expect(page.locator('.roadmap__node a[href*="labs/gates"]').first()).toBeVisible();
  await expect(page.locator('.roadmap__node a[href*="labs/micro"]').first()).toBeVisible();
});

test("nothing on a map promises a link that goes nowhere", async ({ page }) => {
  // O defeito que originou este teste: um nó marcado como pronto com href "#".
  for (const rota of comMapa.map((h) => `handbooks/${h.id}/`)) {
    await page.goto(rota);
    await expect(page.locator('.roadmap__node a[href="#"]')).toHaveCount(0);
  }
});

test("the handbooks index links back into each handbook", async ({ page }) => {
  await page.goto("handbooks/");

  await expect(page.locator(".hb-card")).toHaveCount(HANDBOOKS.length);
  await page.locator(".hb-card").first().click();
  await expect(page.locator("h1")).toContainText("OpenTelemetry");
});

test("handbook pages do not scroll horizontally", async ({ page }) => {
  for (const rota of ["handbooks/", ...HANDBOOKS.map((h) => `handbooks/${h.id}/`)]) {
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
  for (const rota of comMapa.map((h) => `handbooks/${h.id}/`)) {
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

test("os links do mapa levam para onde dizem", async ({ page }) => {
  // O defeito: o mapa escrevia o href cru, e o navegador resolvia relativo à
  // página — de dentro de /handbooks/riscv/ o link "labs/cpu" virava
  // /handbooks/riscv/labs/cpu, que é 404. A página do handbook já passava pelo
  // helper de base; o mapa, não, e ninguém percebeu porque no OTel todo href
  // era "#".
  await page.goto("handbooks/riscv/");

  const link = page.locator('.roadmap__node a').first();
  await link.scrollIntoViewIfNeeded();
  await link.click();

  await expect(page).toHaveURL(/\/labs\/(cpu|gates)\/?$/);
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });
});

test("um handbook sem mapa diz que não tem, em vez de mostrar vazio", async ({ page }) => {
  const semMapa = HANDBOOKS.find((h) => h.map === undefined);
  test.skip(semMapa === undefined, "todo handbook tem mapa");
  await page.goto(`handbooks/${semMapa!.id}/`);

  // Desenhar o caminho antes de andá-lo seria prometer; esconder que ele não
  // foi desenhado seria pior, porque o leitor não saberia o que está faltando.
  await expect(page.locator(".roadmap")).toHaveCount(0);
  await expect(page.locator("#roadmap .hb-section__lede")).toContainText("not drawn yet");
  await expect(page.locator(".hb-phase").first()).toBeVisible();
});
