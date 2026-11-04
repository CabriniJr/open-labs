import { conferirExercicios } from "@ovh/handbook-format";
import { describe, expect, it } from "vitest";
import * as pacote from "../index.js";
import { CONJUNTOS_DE_EXERCICIOS, exerciciosPorLab } from "./todos.js";

/**
 * As regras genéricas de exercício moram em `@ovh/handbook-format`, e este
 * arquivo só diz o que é deste domínio: quais hosts de documentação contam
 * como âncora.
 *
 * Copiar o arquivo de teste do `otel-domain` era a outra saída, e teria o
 * defeito que este repositório mais persegue: as regras passariam a valer para
 * um domínio e a não valer para o outro na primeira vez que uma delas mudasse,
 * sem ninguém ser avisado.
 */

/**
 * Onde a documentação do Splunk vive, e são três hosts porque a Splunk de fato
 * publica em três: o `docs.splunk.com` antigo (que ainda serve o Splexicon),
 * o `help.splunk.com` atual, e a base de conhecimento do suporte.
 */
const DOCUMENTACAO_DO_SPLUNK = ["docs.splunk.com", "help.splunk.com", "splunk.my.site.com"];

describe("os exercícios do Splunk", () => {
  it("passam nas regras que valem para todo exercício do repositório", () => {
    const problemas = conferirExercicios(CONJUNTOS_DE_EXERCICIOS, {
      dominiosDeFonte: DOCUMENTACAO_DO_SPLUNK,
    });
    expect(problemas, `\n${problemas.join("\n")}`).toEqual([]);
  });

  it("o barril e o índice do pacote expõem os MESMOS conjuntos", () => {
    // Os dois existem por motivo mecânico (ver o docblock de `todos.ts`), e o
    // risco de ter dois é um conjunto novo entrar só num deles.
    const noIndice = Object.keys(pacote as unknown as Record<string, unknown>)
      .filter((nome) => nome.startsWith("EXERCICIOS_"))
      .sort();
    expect(Object.keys(CONJUNTOS_DE_EXERCICIOS).sort()).toEqual(noIndice);
  });

  it("a contagem por lab é derivada, e todo lab tem pelo menos um", () => {
    const porLab = exerciciosPorLab();
    expect(porLab.size).toBeGreaterThan(0);
    for (const [lab, quantos] of porLab) expect(quantos, lab).toBeGreaterThan(0);
  });

  it("a guarda compartilhada RECUSA um exercício sem âncora — senão ela não mede", () => {
    /*
      A prova de que a conferência acima não é decorativa. Sem isto, um dia em
      que `conferirExercicios` passasse a devolver sempre `[]` deixaria os dois
      domínios verdes sem medir nada.
    */
    const quebrado = {
      SEM_ANCORA: [
        {
          ...CONJUNTOS_DE_EXERCICIOS["EXERCICIOS_DA_INGESTAO"]![0]!,
          fonteCerto: "https://exemplo.invalido/pagina",
        },
      ],
    };
    const problemas = conferirExercicios(quebrado, {
      dominiosDeFonte: DOCUMENTACAO_DO_SPLUNK,
    });
    expect(problemas.join(" ")).toMatch(/exemplo\.invalido/u);
  });
});
