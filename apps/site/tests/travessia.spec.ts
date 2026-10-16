import { expect, test } from "@playwright/test";
import { MAPA_OTEL } from "../src/data/roadmap.js";
import { MAPA_CPU } from "../src/data/roadmap-cpu.js";

/** Os labs publicados, lidos do roadmap: lista derivada não envelhece. */
const LABS_PUBLICADOS: readonly string[] = [
  ...new Set(
    [...MAPA_OTEL.labs, ...MAPA_CPU.labs]
      .filter((lab) => lab.status === "available" && lab.href !== "#")
      .map((lab) => `${lab.href.replace(/\/$/u, "")}/`),
  ),
].sort();

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

/**
 * Nenhum lab publicado rola na horizontal.
 *
 * A regra existia para `cpu`, `gates` e `rpn`, cada uma escrita no spec do seu
 * lab — e por isso as páginas do OTel nunca foram medidas. Quando foram, em
 * 16/10/2026: `providers` com 528px num viewport de 412, `three-pillars` com
 * 464, e a anatomia com 864 depois de ganhar exercícios.
 *
 * A causa da anatomia era a pior e já está consertada: o cartão do exercício é
 * item de grid, item de grid tem `min-width: auto` (min-content), e com
 * `white-space: pre` min-content é a linha mais longa do código — o cartão
 * crescia até caber a linha e arrastava a página. O conserto mora em
 * `Exercicio.css`, porque `astro-island` é `display: contents` e a raiz do
 * componente é que recebe o layout.
 *
 * As duas que sobram são DÍVIDA DECLARADA, e a declaração é medida: o conjunto
 * abaixo não isenta, ele **afirma que ainda rola**. No dia em que alguém
 * consertar `providers`, este teste cai pedindo que o nome saia da lista — que é
 * o contrário de uma isenção, que silenciaria para sempre.
 *
 * E a dívida é **do mobile**, não das páginas: medida no desktop, `providers` e
 * `three-pillars` não rolam. Escrita como fato absoluto, a afirmação reprovava
 * no desktop — a lista precisa dizer onde o número foi medido, senão ela afirma
 * mais do que alguém olhou.
 */
const AINDA_ROLA_NO_MOBILE: ReadonlySet<string> = new Set([
  "labs/providers/",
  "labs/three-pillars/",
]);

for (const lab of [...LABS_PUBLICADOS]) {
  test(`${lab} — a página não rola na horizontal`, async ({ page }, info) => {
    await page.goto(lab);
    await expect(page.locator(".dui-stage")).toBeVisible({ timeout: 20_000 });
    // O palco e as ilhas acabam de assentar; medir antes mede o meio do caminho.
    await page.waitForTimeout(1200);
    const { scrollW, clientW } = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    }));

    if (info.project.name === "mobile" && AINDA_ROLA_NO_MOBILE.has(lab)) {
      expect(
        scrollW,
        `${lab} está em AINDA_ROLA_NO_MOBILE e parou de rolar — tire-o da lista`,
      ).toBeGreaterThan(clientW + 1);
      return;
    }
    expect(scrollW, `${lab} rola ${scrollW - clientW}px na horizontal`).toBeLessThanOrEqual(
      clientW + 1,
    );
  });
}
