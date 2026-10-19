import { expect, test } from "@playwright/test";

/**
 * O lab da cardinalidade — e o que só a página responde.
 *
 * A aritmética tem teste de unidade em `modelo.test.ts`; repeti-la aqui seria
 * pagar caro por uma segunda opinião pior. O que se cobra aqui são as três
 * coisas que são da tela:
 *
 * 1. **o produto aparece como produto**, e não só o total — é a decisão de
 *    desenho que carrega o argumento;
 * 2. **a resposta sai do estado**, e mexer num controle muda o número;
 * 3. **o lab não afirma preço**, que é a trava da ADR §9 contra um lab
 *    desenhado à mão afirmar o que nenhum modelo sustenta.
 */

const LAB = "labs/cardinality-and-the-bill/";

async function abrir(page: import("@playwright/test").Page): Promise<void> {
  await page.goto(LAB);
  await expect(page.locator(".cardinalidade__produto")).toBeVisible({ timeout: 20_000 });

  /*
    Esperar a HIDRATAÇÃO, e não a visibilidade.

    A ilha é `client:visible`, e o HTML do servidor já traz o conteúdo — então
    "visível" não quer dizer "escutando". Escrito só com a espera de
    visibilidade, `corrigir a contagem de valores` reprovou no CI em `[mobile]`
    com `Expected: > 288, Received: 288`: o `fill` aconteceu num input que
    ainda não tinha `onChange` ligado, e o React recriou o valor do estado.

    O repositório já tinha esta resposta escrita em `exercicio.spec.ts`, com a
    mesma razão: `ssr` sai do `astro-island` quando a hidratação acaba. E o
    motivo de eu não ter visto antes vale registrar — rodei este arquivo só com
    `--project=desktop`, onde a dobra é outra.
  */
  await expect(page.locator("astro-island:has(.cardinalidade)").first()).not.toHaveAttribute(
    "ssr",
    /.*/u,
  );
}

const numeros = (texto: string): readonly number[] =>
  [...texto.matchAll(/[\d,]+/gu)].map((m) => Number(m[0].replace(/,/gu, "")));

test("o produto aparece COMO produto, e o total é o produto", async ({ page }) => {
  await abrir(page);
  const produto = page.locator(".cardinalidade__produto");
  // Os três da convenção vêm ligados: 12 × 6 × 4 = 288.
  await expect(produto).toContainText("×");
  const lidos = numeros((await produto.textContent()) ?? "");
  const fatores = lidos.slice(0, -1);
  const total = lidos[lidos.length - 1];
  expect(fatores.length).toBeGreaterThanOrEqual(2);
  expect(total).toBe(fatores.reduce((a, b) => a * b, 1));
  // E não é a soma, que é o mal-entendido que o lab desfaz.
  expect(total).not.toBe(fatores.reduce((a, b) => a + b, 0));
});

test("ligar um atributo de alta cardinalidade MULTIPLICA o total", async ({ page }) => {
  await abrir(page);
  const produto = page.locator(".cardinalidade__produto");
  const antes = numeros((await produto.textContent()) ?? "").at(-1) ?? 0;

  const caixa = page.getByLabel("distinct values of enduser.id");
  const valores = Number(await caixa.inputValue());
  await page.locator('.cardinalidade__atributo[data-ligado="false"]').first().scrollIntoViewIfNeeded();
  await page
    .locator(".cardinalidade__atributo", { has: page.getByLabel("distinct values of enduser.id") })
    .locator('input[type="checkbox"]')
    .check();

  const depois = numeros((await produto.textContent()) ?? "").at(-1) ?? 0;
  expect(depois).toBe(antes * valores);
});

test("o limite tampa as séries e diz quantas quebras se perderam", async ({ page }) => {
  await abrir(page);
  // Liga o atributo caro primeiro, senão o limite não é alcançado.
  await page
    .locator(".cardinalidade__atributo", { has: page.getByLabel("distinct values of enduser.id") })
    .locator('input[type="checkbox"]')
    .check();

  await expect(page.locator(".cardinalidade__aviso")).toHaveCount(0);
  await page.getByText("apply").locator("input[type=checkbox]").check();

  const aviso = page.locator(".cardinalidade__aviso");
  await expect(aviso).toBeVisible();
  // A frase que importa: a quebra que se perdeu, e ela é um número do estado.
  await expect(aviso).toContainText("no longer have one");
  await expect(page.locator(".cardinalidade__tampado")).toBeVisible();
});

test("o lab NÃO afirma preço: sem a fatura do leitor, não há número", async ({ page }) => {
  /*
    A ADR §9 nomeia o defeito mais caro do projeto — um lab PhET-like desenhado
    à mão afirmando o que nenhum modelo sustenta. Preço de fornecedor é
    exatamente isso: cada um cobra por unidade diferente.

    Então a trava é dupla: o campo nasce vazio, e a saída não mostra moeda
    nenhuma até alguém digitar. Um valor padrão aqui seria um preço inventado
    com cara de medição.
  */
  await abrir(page);
  const campo = page.getByLabel("price per million data points");
  await expect(campo).toHaveValue("");

  const saida = page.locator(".cardinalidade__preco output");
  await expect(saida).toContainText("fill it in");
  await expect(saida).not.toContainText("$");

  // Com a fatura do leitor, a conta aparece — e é a dele, não a nossa.
  await campo.fill("0.5");
  await expect(saida).toContainText("/ month");
  await expect(saida).not.toContainText("fill it in");
});

test("corrigir a contagem de valores muda a conta na hora", async ({ page }) => {
  // O lab existe para o leitor usar os números DELE: os padrões são de uma loja
  // de porte médio e não são afirmação sobre o serviço de ninguém.
  await abrir(page);
  const produto = page.locator(".cardinalidade__produto");
  const antes = numeros((await produto.textContent()) ?? "").at(-1) ?? 0;

  const rota = page.getByLabel("distinct values of http.route");
  await rota.fill("24");

  const depois = numeros((await produto.textContent()) ?? "").at(-1) ?? 0;
  expect(depois).toBeGreaterThan(antes);
});
