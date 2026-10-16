// packages/otel-domain/src/sem-perda.test.ts
//
// Nenhum lab deste domínio joga emissão fora em silêncio.
//
// A guarda vale mais para a `anatomia` do que para os outros três, e a razão é
// o formato: a topologia dela vem de `anatomy.mmd`, e a porta de cada fio é uma
// string escrita à mão num rótulo (`call:request`, `export:span`). Errar uma
// letra ali compila, valida e roda — o fio liga o nó a uma porta que nenhum
// comportamento usa, e o lab passa a ensinar que um trace tem um span.
//
// Medido antes de ser escrito: com `cal:request` no lugar de `call:request`, o
// livro-caixa marcava `out:gateway.call.unwired: 11` e nada nesta suíte caía.
// O que caía era um teste de comportamento três camadas abaixo, cobrando quatro
// spans e recebendo um — e a primeira suspeita de quem lê isso é do
// comportamento, que está certo.
import { describe, expect, it } from "vitest";
import { World, emissoesPerdidas, relatoDePerdas } from "@ovh/depth-core";
import type { WorldSpec } from "@ovh/depth-core";
import { amostragemWorld } from "./amostragem/world.js";
import { anatomiaWorld } from "./anatomia/world.js";
import { collectorWorld } from "./collector/world.js";
import { heroiWorld } from "./heroi/world.js";
import { pilaresWorld } from "./pilares/world.js";
import { otelWorld } from "./providers/world.js";
import * as pacote from "./index.js";

const LABS: Readonly<Record<string, () => WorldSpec>> = {
  amostragem: () => amostragemWorld(),
  // A amostragem com os dois cortes ligados: no padrão (`1 em 1` no head) as
  // três portas de corte nunca emitem, e a varredura passaria sem ter visto um
  // terço das portas do lab.
  "amostragem cortando": () =>
    amostragemWorld({ "head-mantem-1-em": 3, "tail-mantem-1-em": 4, "erro-a-cada": 3 }),
  // E com o roteamento que parte o trace: é o cenário do defeito, e as portas
  // dos dois gateways acordam por caminhos diferentes nele.
  "amostragem com rota por chegada": () => amostragemWorld({ "rotear-por-trace": 0 }),
  anatomia: () => anatomiaWorld(),
  collector: () => collectorWorld(),
  // O collector sob os parâmetros que acordam as portas de recusa: sem eles
  // `limiter.recusado` e `filtro.barrado` nunca emitem, e a varredura passaria
  // sem ter visto metade das portas do lab.
  "collector sob pressão": () =>
    collectorWorld({ "spans-por-tick": 5, "limite-de-memoria": 2, "filtrar-health-checks": 1 }),
  heroi: heroiWorld,
  pilares: () => pilaresWorld(),
  providers: () => otelWorld(),
};

/** Os construtores que a varredura exercita, por nome. Ver a guarda no fim. */
const CONSTRUTORES_VARRIDOS = [
  "amostragemWorld",
  "anatomiaWorld",
  "collectorWorld",
  "heroiWorld",
  "otelWorld",
  "pilaresWorld",
];

describe("nenhuma emissão cai no vácuo", () => {
  for (const [nome, build] of Object.entries(LABS)) {
    it(`${nome}: toda porta que emite tem fio ou descarte declarado`, () => {
      const world = new World(build());
      world.advance(20);
      const perdas = emissoesPerdidas(world.state);
      expect(perdas, `\n${relatoDePerdas(perdas)}`).toEqual([]);
    });
  }
});

describe("a anatomia vinda do mmd, com os parâmetros de defeito ligados", () => {
  /*
    Os defeitos que o lab ensina mudam quais portas emitem: um serviço sem
    instrumentação para de exportar span, e derrubar o cabeçalho corta o que
    segue para frente. Um fio certo no caminho feliz pode estar errado só no
    caminho em que a outra porta acorda, e é por isso que a guarda roda os
    cenários e não só o padrão.
  */
  const CENARIOS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
    "cabeçalho derrubado no meio": { "derrubar-cabecalho-em": 2 },
    "um serviço sem instrumentação": { "sem-instrumentacao": 2 },
    "amostragem ignorada embaixo": { "taxa-de-amostragem": 0.5, "ignorar-amostragem": 1 },
    "nada amostrado": { "taxa-de-amostragem": 0 },
  };

  for (const [nome, params] of Object.entries(CENARIOS)) {
    it(`${nome}: segue sem emissão perdida`, () => {
      const world = new World(anatomiaWorld(params));
      world.advance(20);
      const perdas = emissoesPerdidas(world.state);
      expect(perdas, `\n${relatoDePerdas(perdas)}`).toEqual([]);
    });
  }
});

describe("a varredura não envelhece em silêncio", () => {
  /*
    Guarda com lista escrita à mão passa a não medir nada sem avisar: o lab
    novo entra, ninguém lembra deste arquivo, e o verde continua verde cobrindo
    os antigos. Não é hipótese — na primeira vez que a versão desta guarda
    rodou no `cpu-domain` ela achou `portaCmosWorld` de fora.

    A convenção que ela usa já valia antes de ela existir: todo construtor de
    mundo deste repositório termina em `World`. Construtor não exportado do
    índice fica invisível aqui, e é o limite declarado desta checagem.
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
