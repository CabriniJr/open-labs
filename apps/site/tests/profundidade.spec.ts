import { expect, test } from "@playwright/test";
import { meada } from "@ovh/depth-ui";

/**
 * O espaguete das vistas **fundas**.
 *
 * A medida de `espaguete.spec.ts` mede a vista de abertura de cada lab, e por
 * isso a bagunça foi morar exatamente onde ninguém olhava. Medido em
 * 08/09/2026, um nível abaixo do caminho de dados: a vista da ULA tinha
 * **342 cruzamentos e 2345 sobreposições** enquanto o lab dela passava com teto
 * quinze. Nada estava quebrado — nada estava sendo medido.
 *
 * Duas causas, e as duas eram o desenho ignorando o próprio nível de detalhe:
 *
 * 1. o interior do somador de 32 bits era desenhado a **sete por cento de
 *    opacidade** e mesmo assim recebia trinta e duas linhas individuais, uma por
 *    bit, pousando em entradas que ninguém enxerga;
 * 2. o mesmo interior desenhava noventa e seis fios lá dentro, invisíveis, e
 *    cruzando-se centenas de vezes.
 *
 * Agora `LIMIAR_LEGIVEL` manda nas duas: abaixo dele a ligação é uma linha
 * marcada com o feixe de N, e o interior mostra as formas sem os fios.
 *
 * **A sobreposição cega é zero, e aqui ela não tem teto nenhum.** Dois fios sem
 * ponta em comum na mesma reta se leem como um: é ambiguidade, não é bagunça, e
 * ambiguidade não se orça.
 */

interface FioMedido {
  readonly d: string;
  readonly escopo: string;
  readonly de: string;
  readonly para: string;
  readonly linha: string;
}

async function fios(page: import("@playwright/test").Page): Promise<FioMedido[]> {
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
        d: n.querySelector(".dui-stage__trilho")?.getAttribute("d") ?? "",
        escopo: escopo.join("/"),
        de: n.getAttribute("data-de") ?? "",
        para: n.getAttribute("data-para") ?? "",
        linha: n.getAttribute("data-linha") ?? "data",
      };
    }),
  );
  return lidos.filter((f) => f.d !== "");
}

/**
 * Por espaço de coordenadas **e por plano**: um interior é escalado e
 * transladado, e o circuito passa por cima das esteiras. Medir junto o que se
 * desenha separado mede um encontro que só existe na string.
 */
function porGrupo(medidos: readonly FioMedido[]): readonly (readonly FioMedido[])[] {
  const grupos = new Map<string, FioMedido[]>();
  for (const fio of medidos) {
    const chave = `${fio.escopo}|${fio.linha}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), fio]);
  }
  return [...grupos.values()];
}

/*
 * Os números são o que existe hoje, medido — e não metas. O do processador do
 * micro é grande e está declarado: quarenta e dois cruzamentos num caminho de
 * dados de quarenta e cinco fios, e é o próximo alvo. Ele **subiu** de vinte e
 * oito nesta rodada, e isso é honesto: as sete sobreposições cegas que existiam
 * ali escondiam fios inteiros, e fio escondido não cruza nada.
 */
const FUNDAS = [
  { nome: "a ULA por dentro", lab: "labs/cpu/", passos: ["logica", "ula"], cruzamentos: 2 },
  { nome: "a lógica combinacional", lab: "labs/cpu/", passos: ["logica"], cruzamentos: 0 },
  { nome: "o processador do micro", lab: "labs/micro/", passos: ["cpu"], cruzamentos: 42 },
  { nome: "um bit do somador", lab: "labs/gates/", passos: ["bit1"], cruzamentos: 5 },
  {
    nome: "o TracerProvider por dentro",
    lab: "labs/providers/",
    passos: ["tracer-provider"],
    cruzamentos: 0,
  },
] as const;

for (const funda of FUNDAS) {
  test(`${funda.nome} não é uma meada`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto(funda.lab);
    await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator(".dui-stage__trilho").count(), { timeout: 10_000 })
      .toBeGreaterThan(0);

    for (const passo of funda.passos) {
      const alvo = page.locator(`.dui-stage__objeto[data-id="${passo}"]`).first();
      // Sem isto, um id renomeado faria o teste medir a vista de cima e passar
      // com folga — calado, que é o modo de falha que esta suíte não aceita.
      await expect(alvo, `${funda.lab}: não achei "${passo}" para descer`).toHaveCount(1);
      await alvo.dblclick();
      await page.waitForTimeout(1_500);
    }

    const medidos = await fios(page);
    expect(medidos.length, "nenhum fio na vista: a medida não mediu nada").toBeGreaterThan(0);

    let cruzamentos = 0;
    let cegas = 0;
    for (const grupo of porGrupo(medidos)) {
      cruzamentos += meada(grupo.map((f) => f.d)).cruzamentos;
      for (let i = 0; i < grupo.length; i += 1) {
        for (let j = i + 1; j < grupo.length; j += 1) {
          const a = grupo[i]!;
          const b = grupo[j]!;
          // Ponta em comum é topologia real — o leque —, e o pontinho de junção
          // já responde por ela.
          if (a.de === b.de || a.para === b.para || a.de === b.para || a.para === b.de) continue;
          cegas += meada([a.d, b.d]).sobreposicoes;
        }
      }
    }

    expect(cegas, `fios sem ponta em comum na mesma reta em ${funda.nome}`).toBe(0);
    expect(cruzamentos, `cruzamentos em ${funda.nome}`).toBeLessThanOrEqual(funda.cruzamentos);
  });
}

test("a vista funda que agrega diz quantas ligações ela agrega", async ({ page }) => {
  // O feixe é o que impede a agregação de esconder a diferença: de longe o
  // desenho informa a conta, de perto ele se abre nos fios que a compõem.
  await page.goto("labs/cpu/");
  await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });
  await page.locator('.dui-stage__objeto[data-id="logica"]').first().dblclick();
  await page.waitForTimeout(1_200);
  await page.locator('.dui-stage__objeto[data-id="ula"]').first().dblclick();
  await page.waitForTimeout(1_500);

  const feixes = await page
    .locator("[data-feixe]")
    .evaluateAll((nos) => nos.map((n) => Number(n.getAttribute("data-feixe") ?? "0")));
  expect(feixes.filter((n) => n === 32).length, "o somador de 32 bits não anuncia os 32").toBeGreaterThanOrEqual(2);
});
