import { expect, test } from "@playwright/test";

/**
 * A invariante do desenho, conferida no que foi desenhado.
 *
 * > **Um fio só toca as duas caixas que ele liga.**
 *
 * Uma linha que atravessa uma caixa parece entrar nela, e o leitor passa a ver
 * uma ligação que não existe. É mentira de desenho, e ela custa o mesmo que
 * mentira de número — com o agravante de não quebrar teste nenhum sozinha: o
 * desenho continua bonito enquanto mente, e só um olho atento reclama, tarde.
 *
 * Por isso a conferência é geométrica e roda em cima do DOM de verdade, e não
 * numa reimplementação do roteador: o que se quer garantir é o que aparece na
 * tela, e uma segunda cópia da conta poderia concordar consigo mesma enquanto
 * as duas erram.
 *
 * As duas exceções são da própria gramática, e não conveniências:
 *
 * - **contêiner é moldura**, e atravessar uma moldura é exatamente o que faz
 *   uma ligação que vem de fora;
 * - **conduíte é linha**, não coisa. Um fio que cruza uma pista de barramento
 *   sem dot não afirma ligação nenhuma — é notação universal de esquemático, e
 *   é como um barramento de verdade é desenhado: a derivação desce cortando as
 *   pistas vizinhas, e ninguém lê aquilo como conexão.
 *
 * O que um fio nunca pode atravessar é uma **coisa**: quem age, quem guarda.
 */

/** Os segmentos retos de um caminho em cotovelos. */
const LEITOR = `(d) => {
  const passos = d.trim().split(/\\s+/u);
  const segs = [];
  let x = 0, y = 0;
  for (let i = 0; i < passos.length; i += 1) {
    if (passos[i] === "M") { x = Number(passos[i + 1]); y = Number(passos[i + 2]); i += 2; }
    else if (passos[i] === "H") { const nx = Number(passos[i + 1]); segs.push({ x1: x, y1: y, x2: nx, y2: y }); x = nx; i += 1; }
    else if (passos[i] === "V") { const ny = Number(passos[i + 1]); segs.push({ x1: x, y1: y, x2: x, y2: ny }); y = ny; i += 1; }
  }
  return segs;
}`;

async function atravessamentos(page: import("@playwright/test").Page): Promise<string[]> {
  return page.evaluate(`(() => {
    const segmentosDe = ${LEITOR};
    const folga = 3;
    // Só a camada de cima: um interior aninhado desenha no espaço dele, e
    // comparar as duas coordenadas seria comparar réguas diferentes.
    const naCamadaDeCima = (el) => el.closest(".dui-stage__interior") === null;
    const caixas = [...document.querySelectorAll(".dui-stage__objeto[data-id]")]
      .filter(naCamadaDeCima)
      .filter((g) => {
        const fam = g.getAttribute("data-familia");
        return fam !== "container" && fam !== "conduit";
      })
      .map((g) => ({ id: g.getAttribute("data-id") || "", r: g.getBBox() }));

    const problemas = [];
    for (const fio of [...document.querySelectorAll(".dui-stage__fio")].filter(naCamadaDeCima)) {
      const de = fio.getAttribute("data-de");
      const para = fio.getAttribute("data-para");
      const leito = fio.querySelector(".dui-stage__leito");
      const segs = segmentosDe(leito ? leito.getAttribute("d") || "" : "");
      for (const caixa of caixas) {
        if (caixa.id === de || caixa.id === para) continue;
        for (const s of segs) {
          const dentro =
            Math.min(s.x1, s.x2) < caixa.r.x + caixa.r.width - folga &&
            Math.max(s.x1, s.x2) > caixa.r.x + folga &&
            Math.min(s.y1, s.y2) < caixa.r.y + caixa.r.height - folga &&
            Math.max(s.y1, s.y2) > caixa.r.y + folga;
          if (dentro) problemas.push((de || "?") + "->" + (para || "?") + " atravessa " + caixa.id);
        }
      }
    }
    return [...new Set(problemas)];
  })()`);
}

const LABS = ["labs/cpu/", "labs/gates/", "labs/rpn/"] as const;

for (const lab of LABS) {
  test(`um fio só toca as duas caixas que ele liga — ${lab}`, async ({ page }) => {
    await page.goto(lab);
    await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".dui-stage__objeto").first()).toBeVisible();
    expect(await atravessamentos(page)).toEqual([]);
  });
}

test("a invariante vale em cada enquadramento, e não só no primeiro", async ({ page }) => {
  await page.goto("labs/cpu/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });

  const quadros = page.getByRole("group", { name: "Framing" }).getByRole("button");
  const quantos = await quadros.count();
  expect(quantos).toBeGreaterThan(1);
  for (let i = 0; i < quantos; i += 1) {
    const nome = (await quadros.nth(i).innerText()).trim();
    await quadros.nth(i).click();
    await expect(page.locator(".dui-stage__objeto").first()).toBeVisible();
    expect(await atravessamentos(page), nome).toEqual([]);
  }
});
