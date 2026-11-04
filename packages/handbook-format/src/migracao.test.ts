import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lerManifesto } from "./ler.js";

/**
 * Migrar de uma versão do contrato para a outra **não muda o handbook** — e a
 * prova é uma igualdade entre um par congelado.
 *
 * O `algorithms` era um objeto TypeScript escrito à mão em
 * `apps/site/src/data/handbooks.ts` e passou a ser
 * `handbooks/algorithms/handbook.yaml`. Isso é uma migração entre duas versões
 * reais do contrato (`typescript` → `openlabs/handbook/v1`), e o que este teste
 * cobra é fidelidade: o leitor da `v1` tem de entender cada cor, cada fase,
 * cada href exatamente como o site entendia.
 *
 * **O par é congelado, e descobri por que isso importa errando.** A primeira
 * versão deste teste comparava o manifesto VIVO com a expectativa congelada — e
 * reprovou no dia seguinte, quando o primeiro artigo do handbook ficou pronto e
 * o `status` de um item mudou de `coming` para `available`. O teste estava
 * certo sobre a desigualdade e errado sobre o que media: ele misturava
 * "o leitor traduz fielmente" com "o conteúdo nunca muda".
 *
 * Então o par vive aqui, os dois lados imóveis: a entrada é o manifesto como
 * ele estava **no dia da migração**, e a saída é o objeto que o catálogo em
 * TypeScript tinha. Conteúdo novo entra no manifesto vivo e não encosta neste
 * teste — que é o que se quer, porque o que está sob medição é o contrato.
 */

const aqui = new URL("./conformance/", import.meta.url);

const MANIFESTO_NA_MIGRACAO = readFileSync(
  new URL("migracao-typescript-v1.handbook.yaml", aqui),
  "utf8",
);

const ESPERADO: Record<string, unknown> = JSON.parse(
  readFileSync(new URL("migracao-typescript-v1.esperado.json", aqui), "utf8"),
) as Record<string, unknown>;

describe("typescript → openlabs/handbook/v1", () => {
  const lido = lerManifesto(MANIFESTO_NA_MIGRACAO, "par de migração");

  it("o manifesto do dia da migração carrega sem problema nenhum", () => {
    expect(lido.problemas).toEqual([]);
    expect(lido.handbook).toBeDefined();
  });

  it.each(Object.keys(ESPERADO).map((campo) => [campo] as const))(
    "%s é idêntico ao que a versão anterior dizia",
    (campo) => {
      const carregado = (lido.handbook as unknown as Record<string, unknown>)[campo];
      expect(carregado).toEqual(ESPERADO[campo]);
    },
  );

  it("e traz o que só o contrato novo tem: dono e versão", () => {
    /*
      A migração não muda o handbook, mas o contrato novo pede duas coisas que o
      antigo não tinha — e elas são a razão de ele existir: quem mantém, e
      contra qual versão foi escrito. Por isso elas NÃO estão na expectativa
      congelada: elas não existiam do outro lado.
    */
    expect(lido.handbook?.apiVersion).toBe("openlabs/handbook/v1");
    expect(lido.handbook?.mantenedores.length ?? 0).toBeGreaterThan(0);
  });

  it("a expectativa congelada cobre o handbook inteiro, e não três campos", () => {
    // Sem isto, alguém poderia "consertar" uma divergência apagando o campo da
    // expectativa — e o teste ficaria verde medindo menos.
    for (const campo of ["id", "name", "tema", "phases", "articles", "labs", "stage", "model"]) {
      expect(Object.keys(ESPERADO), `a expectativa perdeu "${campo}"`).toContain(campo);
    }
  });
});
