import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Um endereço só, e ele tem de estar vivo.
 *
 * O projeto teve **quatro** endereços ao mesmo tempo: o nome antigo na Vercel
 * (404), o espelho no GitHub Pages (404), um `openlabs.vercel.app` que é de
 * outra conta, e o de produção. O README apontava para os dois primeiros. Quem
 * abria descobria que o projeto estava fora do ar — e ele não estava.
 *
 * É a mesma regra que já vale para o catálogo de labs e para o `href` do mapa:
 * **uma fonte só por fato**. Um link que o leitor clica não pode depender de o
 * redirecionamento de um terceiro continuar existindo.
 *
 * O que estes testes vigiam é a **superfície viva**: o que o site publica e o
 * que o README promete. As specs e os planos em `docs/superpowers/` são
 * registro datado e ficam como foram escritos — reescrever histórico para
 * calar um teste é pior que o defeito.
 */

const aqui = dirname(fileURLToPath(import.meta.url));
const raizDoSite = join(aqui, "..");
const raizDoRepo = join(aqui, "..", "..", "..", "..");

/** Endereços que não respondem, ou que não são nossos. */
const MORTOS = [
  "otel-visual-handbook.vercel.app",
  "cabrinijr.github.io",
  "github.com/CabriniJr/otel-visual-handbook",
  // De outra conta: responde, redireciona para /en, e já custou meia investigação.
  "://openlabs.vercel.app",
];

const NO_AR = "https://openlabs-guaxinims-projects.vercel.app";

function arquivosDe(dir: string): readonly string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(dir, entrada.name);
    if (entrada.isDirectory()) return arquivosDe(caminho);
    return /\.(ts|tsx|astro|css|md)$/u.test(entrada.name) ? [caminho] : [];
  });
}

describe("o site não publica endereço morto", () => {
  it.each(MORTOS)("nenhum arquivo do site cita %s", (morto) => {
    const culpados = arquivosDe(raizDoSite)
      // Os dois testes que PROÍBEM o endereço morto precisam citá-lo para
      // poder proibi-lo. Acusá-los seria a guarda mordendo a própria guarda.
      .filter((caminho) => !/(enderecos|dev-server)\.test\.ts$/u.test(caminho))
      .filter((caminho) => readFileSync(caminho, "utf8").includes(morto));
    expect(culpados.map((c) => c.slice(raizDoRepo.length + 1))).toEqual([]);
  });
});

describe("o README aponta para o que está no ar", () => {
  const readme = readFileSync(join(raizDoRepo, "README.md"), "utf8");

  it("traz o endereço de produção", () => {
    expect(readme).toContain(NO_AR);
  });

  it("se cita um endereço morto, é para dizer que ele é morto", () => {
    // Nomear o endereço que não é nosso poupa a investigação de quem testa —
    // mas ele não pode aparecer como link solto, que é como ele apareceu antes.
    for (const morto of MORTOS) {
      if (!readme.includes(morto)) continue;
      expect(readme, `${morto} aparece sem aviso`).toMatch(
        /(404|não são nossos|não é nosso|outra conta|desligado)/u,
      );
      expect(readme, `${morto} aparece como link clicável`).not.toContain(`https://${morto}`);
    }
  });
});
