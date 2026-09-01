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

/**
 * O escopo de um fio: a pilha de interiores em que ele foi desenhado.
 *
 * Um interior é um **espaço de coordenadas próprio** — ele é escalado e
 * transladado para dentro da caixa dona. Dois fios de caixas diferentes podem
 * ter o mesmo `d` e não se tocarem na tela, e medi-los juntos não mede o
 * desenho: mede um encontro que só existe na string.
 *
 * Isso não era hipotético. A vista do processo do lab dos provedores desenha os
 * três provedores, e as três views de provider compartilham moldura, faixas e
 * colunas de propósito — é a regra R3, e é ela que entrega a assimetria por
 * superposição. O preço é que os interiores saem com paths idênticos, e a
 * medida sem escopo acusava dezoito sobreposições cegas onde não há uma.
 */
async function fios(page: import("@playwright/test").Page) {
  const lidos = await page.locator(".dui-stage__fio").evaluateAll((nos) =>
    nos.map((n) => {
      const escopo: string[] = [];
      let cursor: Element | null = n.parentElement;
      while (cursor !== null) {
        if (cursor.classList.contains("dui-stage__interior")) {
          escopo.push(cursor.getAttribute("data-dentro") ?? "?");
        }
        cursor = cursor.parentElement;
      }
      return {
        de: n.getAttribute("data-de") ?? "",
        para: n.getAttribute("data-para") ?? "",
        d: n.querySelector(".dui-stage__trilho")?.getAttribute("d") ?? "",
        escopo: escopo.join("/"),
      };
    }),
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
interface FioMedido {
  readonly de: string;
  readonly para: string;
  readonly d: string;
  readonly escopo: string;
}

/** Os fios agrupados pelo espaço de coordenadas em que foram desenhados. */
function porEscopo(medidos: readonly FioMedido[]): readonly (readonly FioMedido[])[] {
  const grupos = new Map<string, FioMedido[]>();
  for (const fio of medidos) {
    const lista = grupos.get(fio.escopo) ?? [];
    lista.push(fio);
    grupos.set(fio.escopo, lista);
  }
  return [...grupos.values()];
}

function cegas(medidos: readonly FioMedido[]): number {
  let cegas = 0;
  for (const grupo of porEscopo(medidos)) {
    for (let i = 0; i < grupo.length; i += 1) {
      for (let j = i + 1; j < grupo.length; j += 1) {
        const a = grupo[i]!;
        const b = grupo[j]!;
        if (a.de === b.de || a.para === b.para || a.de === b.para || a.para === b.de) continue;
        cegas += meada([a.d, b.d]).sobreposicoes;
      }
    }
  }
  return cegas;
}

/*
 * Os números são o que existe hoje, medido — não são metas, e não têm folga.
 * Folga é onde a próxima piora se esconde: com ela, o desenho degrada até o
 * teto sem ninguém ver, e o teto vira a descrição do estrago.
 *
 * Eles já foram 16, 28 e 4. O somador de quatro bits cruzava quase o dobro do
 * caminho de dados inteiro, que é uma figura muito maior — e a dívida inteira
 * era uma regra faltando, não um layout ruim: as pontas dos fios não miravam
 * nada, e um leque sem ordem tranca sozinho.
 */
const TETOS = [
  { lab: "labs/cpu/", nome: "o caminho de dados inteiro", cruzamentos: 15 },
  { lab: "labs/gates/", nome: "o somador de quatro bits", cruzamentos: 4 },
  { lab: "labs/rpn/", nome: "a máquina de pilha", cruzamentos: 4 },
  { lab: "labs/micro/", nome: "o sistema do genérico", cruzamentos: 7 },
  { lab: "labs/providers/", nome: "o processo instrumentado", cruzamentos: 1 },
] as const;

for (const teto of TETOS) {
  test(`${teto.nome} não vira meada`, async ({ page }) => {
    await page.goto(teto.lab);
    await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });
    // Contagem, e não visibilidade: um fio perfeitamente reto é uma linha
    // horizontal, e a caixa dela tem altura zero — o que a checagem de
    // visibilidade chama de escondido. Depois que a saída passou a mirar o
    // destino, fio reto virou o caso comum, que é justamente o que se queria.
    await expect
      .poll(async () => page.locator(".dui-stage__trilho").count(), { timeout: 10_000 })
      .toBeGreaterThan(0);

    const medidos = await fios(page);
    // Cruzamento também é por escopo, e pelo mesmo motivo: duas linhas de
    // espaços de coordenadas diferentes não se cruzam na tela.
    const cruzamentos = porEscopo(medidos).reduce(
      (total, grupo) => total + meada(grupo.map((f) => f.d)).cruzamentos,
      0,
    );

    expect(cegas(medidos), "fios sem ponta em comum andando pela mesma reta").toBe(0);
    expect(cruzamentos, `cruzamentos em ${teto.nome}`).toBeLessThanOrEqual(teto.cruzamentos);

    // Onde há tronco compartilhado, tem de haver ponto: é o que separa
    // "ligados" de "só passando por cima".
    const compartilham = porEscopo(medidos).some((grupo) =>
      grupo.some((a, i) =>
        grupo.slice(i + 1).some((b) => a.de === b.de && meada([a.d, b.d]).sobreposicoes > 0),
      ),
    );
    if (compartilham) {
      // Existência, e não visibilidade: um `<circle>` de raio 2.6 dentro de um
      // SVG escalado confunde a checagem de visibilidade, e o que se afirma
      // aqui é que a marca FOI desenhada onde há tronco compartilhado.
      expect(
        await page.locator(".dui-stage__juncao").count(),
        "tronco compartilhado sem ponto de junção",
      ).toBeGreaterThan(0);
    }
  });
}
