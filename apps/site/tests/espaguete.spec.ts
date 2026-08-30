import { expect, test } from "@playwright/test";
import { meada } from "@ovh/depth-ui";

/**
 * Quanto espaguete cada figura tem, medido no que foi desenhado.
 *
 * "Está bagunçado" é gosto, e gosto não segura nada: a próxima vista nasce um
 * pouco pior, ninguém sabe dizer o quanto, e três meses depois o desenho é uma
 * meada. Aqui o número sai dos `path` que a página realmente pintou — não de
 * uma rota recalculada, que seria um segundo roteador discordando do primeiro
 * exatamente no dia em que o primeiro piorasse.
 *
 * **Os orçamentos não são metas, são tetos do que existe hoje.** Baixá-los é
 * trabalho; estourá-los sem querer é o que este arquivo impede. E
 * `sobreposicoes` é zero em toda vista, e continua zero: dois fios um por cima
 * do outro são desenhados como um só, e o leitor vê uma ligação onde há duas —
 * a mesma espécie da linha que atravessa uma caixa e parece entrar nela.
 */

async function fios(page: import("@playwright/test").Page) {
  const lidos = await page.locator(".dui-stage__fio").evaluateAll((nos) =>
    nos.map((n) => ({
      de: n.getAttribute("data-de") ?? "",
      para: n.getAttribute("data-para") ?? "",
      d: n.querySelector(".dui-stage__trilho")?.getAttribute("d") ?? "",
    })),
  );
  const uteis = lidos.filter((f) => f.d !== "");
  expect(uteis.length, "nenhum fio na tela: a medida não mediu nada").toBeGreaterThan(0);
  return uteis;
}

/**
 * Sobreposição cega: dois fios um por cima do outro **sem ponta em comum**.
 *
 * A distinção não é preciosismo, é a diferença entre duas coisas. Dois fios que
 * saem da mesma porta compartilham o começo do caminho: isso é topologia real,
 * é o leque, e o desenho o marca com o pontinho de junção. Dois fios que nada
 * têm a ver andando pela mesma reta é ambiguidade pura — nenhum ponto explica
 * aquilo, e o leitor lê uma ligação que não existe.
 */
function cegas(medidos: readonly { de: string; para: string; d: string }[]): number {
  let cegas = 0;
  for (let i = 0; i < medidos.length; i += 1) {
    for (let j = i + 1; j < medidos.length; j += 1) {
      const a = medidos[i]!;
      const b = medidos[j]!;
      if (a.de === b.de || a.para === b.para || a.de === b.para || a.para === b.de) continue;
      cegas += meada([a.d, b.d]).sobreposicoes;
    }
  }
  return cegas;
}

/*
 * Os números são o que existe hoje, medido — não são metas, e não têm folga.
 * Folga é onde a próxima piora se esconde: com ela, o desenho degrada até o
 * teto sem ninguém ver, e o teto vira a descrição do estrago.
 *
 * A dívida está à vista: o somador de quatro bits cruza quase o dobro do
 * caminho de dados inteiro, que é uma figura muito maior. São quatro somadores
 * completos empilhados, cada um com cinco portas e o vai-um atravessando — e é
 * o candidato óbvio da próxima rodada de arrumação.
 */
const TETOS = [
  { lab: "labs/cpu/", nome: "o caminho de dados inteiro", cruzamentos: 16 },
  { lab: "labs/gates/", nome: "o somador de quatro bits", cruzamentos: 28 },
  { lab: "labs/rpn/", nome: "a máquina de pilha", cruzamentos: 4 },
] as const;

for (const teto of TETOS) {
  test(`${teto.nome} não vira meada`, async ({ page }) => {
    await page.goto(teto.lab);
    await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".dui-stage__trilho").first()).toBeVisible({ timeout: 10_000 });

    const medidos = await fios(page);
    const { cruzamentos } = meada(medidos.map((f) => f.d));

    expect(cegas(medidos), "fios sem ponta em comum andando pela mesma reta").toBe(0);
    expect(cruzamentos, `cruzamentos em ${teto.nome}`).toBeLessThanOrEqual(teto.cruzamentos);

    // Onde há tronco compartilhado, tem de haver ponto: é o que separa
    // "ligados" de "só passando por cima".
    const compartilham = medidos.some((a, i) =>
      medidos.slice(i + 1).some((b) => a.de === b.de && meada([a.d, b.d]).sobreposicoes > 0),
    );
    if (compartilham) {
      await expect(page.locator(".dui-stage__juncao").first()).toBeVisible();
    }
  });
}
