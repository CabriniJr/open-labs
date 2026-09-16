import { expect, test } from "@playwright/test";

/**
 * **A vista de fora não pode discordar do próprio interior.**
 *
 * É a promessa central do projeto — a vista agregada é uma projeção de fronteira
 * do mesmo run — e ela tinha um buraco que nenhum teste via: com o interior de
 * uma caixa aberto, o desenho de fora agregava travessias distintas numa linha
 * só. No lab dos provedores, três sinais da API para três provedores viravam
 * **uma** linha chegando na moldura do SDK, e lá dentro nasciam **três** entradas
 * — duas delas a oitenta e oito unidades de qualquer linha que existisse.
 *
 * O que se cobra aqui é geometria, e por isso não dá para passar por acidente:
 * cada linha que chega numa moldura aberta tem de **terminar exatamente onde uma
 * entrada do interior começa**, e as duas contagens têm de bater.
 */

const LABS = [
  "labs/providers/",
  "labs/cpu/",
  "labs/gates/",
  "labs/micro/",
  "labs/rpn/",
] as const;

/**
 * Os labs em que uma moldura aberta é obrigatória neste enquadramento.
 *
 * Os outros passam por aqui como varredura: se um dia abrirem uma, a regra os
 * pega; enquanto não abrem, não há o que medir e o teste diz isso em voz alta em
 * vez de passar fingindo que mediu.
 */
const EXIGE_MOLDURA_ABERTA: ReadonlySet<string> = new Set(["labs/providers/"]);

interface Travessia {
  readonly caixa: string;
  readonly deFora: readonly { readonly x: number; readonly y: number }[];
  readonly deDentro: readonly { readonly x: number; readonly y: number }[];
}

async function travessias(page: import("@playwright/test").Page): Promise<Travessia[]> {
  return page.evaluate(() => {
    const svg = document.querySelector(".dui-stage");
    if (svg === null) return [];
    const ponto = (p: SVGPathElement, onde: "ini" | "fim") => {
      const m = p.getScreenCTM();
      if (m === null) return null;
      const alvo = p.getPointAtLength(onde === "ini" ? 0 : p.getTotalLength());
      return { x: Math.round(m.a * alvo.x + m.c * alvo.y + m.e), y: Math.round(m.b * alvo.x + m.d * alvo.y + m.f) };
    };
    const trilho = (fio: Element) => fio.querySelector<SVGPathElement>(".dui-stage__trilho");

    const saida: Travessia[] = [];
    for (const interior of svg.querySelectorAll(".dui-stage__interior")) {
      const caixa = interior.getAttribute("data-dentro");
      if (caixa === null) continue;
      // As entradas que o INTERIOR desenha: onde a linha de fora deveria pousar.
      const deDentro = [...interior.querySelectorAll(".dui-stage__fio")]
        .filter((f) => f.getAttribute("data-de") === "__entra")
        .map((f) => { const p = trilho(f); return p === null ? null : ponto(p, "ini"); })
        .filter((p): p is { x: number; y: number } => p !== null);
      // As linhas que chegam nesta moldura por FORA dela.
      const deFora = [...svg.querySelectorAll(".dui-stage__fio")]
        .filter((f) => f.getAttribute("data-para") === caixa && !interior.contains(f))
        .map((f) => { const p = trilho(f); return p === null ? null : ponto(p, "fim"); })
        .filter((p): p is { x: number; y: number } => p !== null);
      if (deDentro.length === 0 && deFora.length === 0) continue;
      saida.push({ caixa, deFora, deDentro });
    }
    return saida;
  });
}

for (const lab of LABS) {
  test(`${lab} — o que chega na moldura pousa onde o interior começa`, async ({ page }) => {
    await page.goto(lab);
    await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 15_000 });
    await expect.poll(async () => page.locator(".dui-stage__trilho").count()).toBeGreaterThan(0);

    const medidas = await travessias(page);
    if (EXIGE_MOLDURA_ABERTA.has(lab)) {
      // Sem isto, o dia em que o enquadramento mudar e nenhuma moldura abrir, os
      // dez casos pulam e o invariante fica sem guarda nenhuma — calado, que é
      // exatamente o modo de falha que este arquivo existe para impedir.
      expect(medidas.length, `${lab} não abriu moldura nenhuma: o invariante ficou sem guarda`).toBeGreaterThan(0);
    }
    test.skip(medidas.length === 0, "nenhuma moldura aberta neste enquadramento");

    for (const { caixa, deFora, deDentro } of medidas) {
      // As duas contagens são a mesma afirmação vista dos dois lados. Uma linha
      // de fora para três entradas de dentro é o desenho contradizendo o modelo.
      expect(deFora.length, `${lab} · ${caixa}: linhas chegando por fora`).toBe(deDentro.length);

      for (const fim of deFora) {
        // Tolerância de três pixels: o traço tem espessura, e a borda da caixa
        // não é uma linha matemática. Oitenta e oito, que era a distância do
        // defeito, não passa por aqui de jeito nenhum.
        const encostou = deDentro.some((ini) => Math.abs(ini.x - fim.x) <= 3 && Math.abs(ini.y - fim.y) <= 3);
        expect(encostou, `${lab} · ${caixa}: linha termina em ${fim.x},${fim.y} e nenhuma entrada do interior começa ali`).toBe(true);
      }
    }
  });
}
