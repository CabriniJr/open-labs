import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * A porta do servidor de dev é fixa, e isso é correção de defeito.
 *
 * O digest de configuração do Astro inclui a porta. Subindo numa porta
 * diferente da corrida anterior, ele conclui que a config mudou, **limpa o
 * armazém de conteúdo** e não o repopula naquela mesma corrida: a coleção
 * `docs` vem vazia e toda página `/docs/*` responde 500. A mensagem de erro
 * fala de índice e de capítulo, e não menciona porta — o que faz procurar no
 * lugar errado por muito tempo.
 *
 * O build nunca sofreu disso, então o defeito só aparecia para quem estava
 * desenvolvendo, que é justamente quem não tem como saber que é do Astro.
 */
const config = readFileSync(new URL("../../astro.config.mjs", import.meta.url), "utf8");
const playwright = readFileSync(new URL("../../playwright.config.ts", import.meta.url), "utf8");

describe("o servidor de dev sobe sempre igual", () => {
  it("a porta do dev está fixa na config", () => {
    expect(config).toMatch(/port:\s*4321/);
  });

  /**
   * Escorregar para a porta seguinte é pior que não subir: o digest de
   * configuração inclui a porta, então a subida seguinte nasce com o armazém de
   * conteúdo limpo e todo `/docs/*` em 500 — longe da causa. Falhar alto é o
   * comportamento certo.
   */
  /**
   * Um `site` que não resolve é endereço morto em toda página no dia em que
   * alguém gerar canônica ou sitemap — e a descoberta vem de fora, tarde.
   */
  it("o endereço público não é o domínio morto de antes", () => {
    expect(config).not.toContain("otel-visual-handbook.vercel.app");
    expect(config).toMatch(/PUBLIC_SITE_URL \?\? "https:\/\//);
  });

  it("a porta ocupada faz o dev falhar, e não escorregar para outra", () => {
    expect(config).toMatch(/strictPort:\s*true/);
  });

  it("o e2e não divide a porta com o dev", () => {
    // Dividindo, uma corrida de teste ou pega o servidor de dev — que serve
    // outra coisa — ou não sobe. Nos dois casos a falha aparece como asserção
    // estranha, longe da causa.
    const doE2e = playwright.match(/127\.0\.0\.1:(\d+)/);
    expect(doE2e, "o e2e precisa declarar a porta dele").not.toBeNull();
    expect(doE2e![1]).not.toBe("4321");
    expect(playwright).toContain(`--port ${doE2e![1]}`);
  });

  it("o e2e fala por IP, e não por nome", () => {
    // `localhost` resolve para IPv6 primeiro no Chrome, e qualquer coisa
    // escutando em [::1] naquela porta sequestra a corrida.
    expect(playwright).not.toMatch(/http:\/\/localhost/);
  });
});
