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
import { anatomiaWorld } from "./anatomia/world.js";
import { heroiWorld } from "./heroi/world.js";
import { pilaresWorld } from "./pilares/world.js";
import { otelWorld } from "./providers/world.js";

const LABS: Readonly<Record<string, () => WorldSpec>> = {
  anatomia: () => anatomiaWorld(),
  heroi: heroiWorld,
  pilares: () => pilaresWorld(),
  providers: () => otelWorld(),
};

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
