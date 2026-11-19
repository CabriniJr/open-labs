import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { referenciaDaEntregaDePD } from "./referencia-pd.js";

/**
 * A entrega de Programação Dinâmica (`programacao-dinamica/`) confere o Python
 * contra `dados/referencia_openlabs.json`. Se um lab mudar e o arquivo não, o
 * Python passaria a ensinar uma coisa e o site a mostrar outra.
 *
 * Com `ATUALIZAR_REFERENCIA_PD=1` (é o que `exportar_referencia.mjs` faz), o
 * teste grava o arquivo em vez de conferir.
 */
const ARQUIVO = new URL("../../../programacao-dinamica/dados/referencia_openlabs.json", import.meta.url);

describe("a referência da entrega de PD está em dia com os labs", () => {
  it("o arquivo é o que os labs calculam hoje", () => {
    const atual = JSON.parse(JSON.stringify(referenciaDaEntregaDePD()));
    if (process.env.ATUALIZAR_REFERENCIA_PD === "1") {
      writeFileSync(ARQUIVO, `${JSON.stringify(atual, null, 1)}\n`);
      return;
    }
    expect(existsSync(ARQUIVO), "rode `node programacao-dinamica/exportar_referencia.mjs`").toBe(true);
    expect(JSON.parse(readFileSync(ARQUIVO, "utf8")), "rode `node programacao-dinamica/exportar_referencia.mjs`").toEqual(atual);
  });
});
