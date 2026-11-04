// packages/splunk-domain/src/sem-perda.test.ts
//
// Nenhum lab deste domínio joga emissão fora em silêncio.
//
// O caso que a guarda tem a dizer aqui é o do nível do meio: ele escolhe a
// porta de saída pela **topologia**, não pelo conteúdo, e as duas portas
// carregam coisas de natureza diferente. Uma porta a mais no comportamento do
// que no desenho não daria erro nenhum — o índice continuaria enchendo pelo
// outro caminho, e o que faltasse faltaria em silêncio.
import { describe, expect, it } from "vitest";
import { World, emissoesPerdidas, relatoDePerdas } from "@ovh/depth-core";
import { baldesWorld } from "./baldes/world.js";
import { ingestaoWorld } from "./ingestao/world.js";
import * as pacote from "./index.js";

/** Os construtores que a varredura exercita, por nome. Ver a guarda no fim. */
const CONSTRUTORES_VARRIDOS = ["baldesWorld", "ingestaoWorld"];

/**
 * Cenários escolhidos por quais caminhos eles acordam, e não por realismo: as
 * duas topologias, os três lugares do `props.conf`, o registro de uma linha e o
 * stack trace grande.
 */
const CENARIOS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  "parsing no indexador, props certo": { "meio-cozinha": 0, "props-em": 2 },
  "parsing no indexador, props no forwarder": { "meio-cozinha": 0, "props-em": 0 },
  "parsing no heavy forwarder, props certo": { "meio-cozinha": 1, "props-em": 1 },
  "parsing no heavy forwarder, props no indexador": { "meio-cozinha": 1, "props-em": 2 },
  "sem registro multilinha": { "multilinha-a-cada": 0 },
  "tudo multilinha": { "multilinha-a-cada": 1, "linhas-do-registro": 8 },
  "sem tráfego": { "registros-por-tick": 0 },
};

describe("nenhuma emissão cai no vácuo", () => {
  for (const [nome, params] of Object.entries(CENARIOS)) {
    it(`${nome}: toda porta que emite tem fio ou descarte declarado`, () => {
      const world = new World(ingestaoWorld(params));
      world.advance(120);
      const perdas = emissoesPerdidas(world.state);
      expect(perdas, `\n${relatoDePerdas(perdas)}`).toEqual([]);
    });
  }
});

/**
 * Cenários dos baldes: o que congela por tamanho, o que congela por idade, e o
 * índice que nunca enche (em que nada desce para congelado, de propósito).
 */
const CENARIOS_DOS_BALDES: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  "congelando por tamanho": { "max-warm": 4, "max-total-gb": 6 },
  "congelando por idade": { "max-warm": 2, "retencao-dias": 2, "horas-por-tick": 24 },
  "índice que não enche": { "max-total-gb": 500000, "retencao-dias": 999999 },
  "com arquivo configurado": { "max-warm": 4, "max-total-gb": 6, arquivar: 1 },
  "sem volume": { "gb-por-dia": 0 },
};

describe("nenhuma emissão cai no vácuo — os baldes", () => {
  for (const [nome, params] of Object.entries(CENARIOS_DOS_BALDES)) {
    it(`${nome}: toda porta que emite tem fio ou descarte declarado`, () => {
      const world = new World(baldesWorld(params));
      world.advance(200);
      const perdas = emissoesPerdidas(world.state);
      expect(perdas, `\n${relatoDePerdas(perdas)}`).toEqual([]);
    });
  }
});

describe("a varredura não envelhece em silêncio", () => {
  /*
    Guarda com lista escrita à mão passa a não medir nada sem avisar: o lab novo
    entra, ninguém lembra deste arquivo, e o verde continua verde cobrindo os
    antigos. A convenção que ela usa vale em todo o repositório — todo
    construtor de mundo termina em `World`.
  */
  it("todo construtor de mundo exportado pelo pacote está na varredura", () => {
    const exportados = Object.keys(pacote)
      .filter((nome) => /World$/u.test(nome))
      .sort();
    expect(
      exportados,
      "um construtor de mundo entrou no índice do pacote e não entrou na " +
        "varredura de emissões perdidas. Acrescente-o neste arquivo.",
    ).toEqual(CONSTRUTORES_VARRIDOS);
  });
});
