import { describe, expect, it } from "vitest";
import {
  VERSAO_ATUAL,
  VERSOES_EM_ARQUIVO,
  VERSOES_SUPORTADAS,
  lerDocumento,
  recusaDeVersao,
} from "./versoes.js";
import { lerManifesto } from "./ler.js";
import { EXEMPLARES } from "./conformance/exemplares.js";

/**
 * A promessa de compatibilidade, cobrada em vez de prometida.
 *
 * O contrato diz que um handbook escrito contra uma versão continua sendo lido
 * quando a casa muda de versão. Promessa desse tipo não se mantém por boa
 * vontade: ela se mantém porque existe um **exemplar** de cada versão
 * suportada, ele carrega em cada suíte, e tirar o leitor de uma versão que
 * ainda está na lista derruba a suíte nomeando a versão.
 *
 * É a mesma forma dos tetos de cruzamento e da dívida de rolagem: a lista não
 * isenta, ela afirma — e o dia em que a afirmação deixar de ser verdade, o
 * teste cai pedindo a decisão em vez de deixá-la acontecer sozinha.
 */
describe("a lista de versões do contrato", () => {
  it("tem exatamente uma versão atual", () => {
    const atuais = VERSOES_SUPORTADAS.filter((v) => v.estado === "atual");
    expect(atuais.map((v) => v.apiVersion)).toHaveLength(1);
    expect(VERSAO_ATUAL).toBe(atuais[0]?.apiVersion);
  });

  it("suporta a anterior, e não só a atual", () => {
    /*
      A regra escrita: a release que introduz a versão N continua lendo N-1.
      Enquanto houver mais de uma versão na história do projeto, a lista tem de
      ter pelo menos uma `anterior` — e é isto que impede a limpeza silenciosa
      de "ninguém usa mais aquilo".
    */
    const anteriores = VERSOES_SUPORTADAS.filter((v) => v.estado === "anterior");
    expect(anteriores.length).toBeGreaterThanOrEqual(1);
  });

  it("toda versão suportada tem exemplar de conformidade", () => {
    const comExemplar = new Set(EXEMPLARES.map((e) => e.apiVersion));
    for (const versao of VERSOES_SUPORTADAS) {
      expect(
        [...comExemplar],
        `a versão "${versao.apiVersion}" está suportada e não tem exemplar: ` +
          "sem exemplar, o suporte a ela é uma frase e não um fato",
      ).toContain(versao.apiVersion);
    }
  });

  it("todo exemplar de versão em arquivo carrega de verdade", () => {
    for (const exemplar of EXEMPLARES) {
      if (exemplar.yaml === undefined) continue;
      const lido = lerManifesto(exemplar.yaml, `exemplar ${exemplar.apiVersion}`);
      expect(lido.problemas, `exemplar de ${exemplar.apiVersion}`).toEqual([]);
      expect(lido.handbook?.apiVersion).toBe(exemplar.apiVersion);
    }
  });

  it("toda data `desde` é uma data de verdade", () => {
    for (const v of VERSOES_SUPORTADAS) {
      expect(v.desde, v.apiVersion).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
      expect(Number.isNaN(Date.parse(v.desde))).toBe(false);
    }
  });
});

describe("a recusa ensina o próximo passo", () => {
  it("sem apiVersion, ela diz qual escrever", () => {
    const r = recusaDeVersao(undefined);
    expect(r).toContain("apiVersion");
    expect(r).toContain(VERSAO_ATUAL);
  });

  it("versão mais NOVA do que a casa manda atualizar a casa, não o arquivo", () => {
    /*
      A direção importa, e é a que todo formato versionado erra: quem escreveu
      contra uma versão nova está com um site velho, e dizer "arquivo inválido"
      manda a pessoa mexer no arquivo que está certo.
    */
    const r = recusaDeVersao("openlabs/handbook/v99");
    expect(r).toContain("Atualize o OpenLabs");
    expect(r).not.toContain("migrate");
  });

  it("versão mais VELHA do que a casa manda migrar o arquivo", () => {
    const r = recusaDeVersao("openlabs/handbook/v0");
    expect(r).toContain("migrate");
  });

  it("a recusa lista as versões que esta release lê", () => {
    const r = recusaDeVersao("qualquer-coisa");
    for (const v of VERSOES_EM_ARQUIVO) expect(r).toContain(v.apiVersion);
  });

  it("documento sem forma de objeto não explode, recusa", () => {
    for (const lixo of [null, 42, "texto", []]) {
      const lido = lerDocumento(lixo);
      expect(lido.ok).toBe(false);
    }
  });
});
