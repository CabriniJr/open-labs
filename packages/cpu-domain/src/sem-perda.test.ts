// packages/cpu-domain/src/sem-perda.test.ts
//
// Nenhum lab deste domínio joga emissão fora em silêncio.
//
// Aqui a guarda cobra outra coisa que no `otel-domain`: estes mundos são
// escritos à mão, e o que erra não é um rótulo de Mermaid — é fiação gerada em
// laço. O somador liga `bits` vezes cinco portas por programa, e o vai-um de um
// bit é a entrada do próximo; um `i + 1` fora de lugar produz um fio que sai de
// porta que ninguém usa, e o resultado da soma continua certo nos bits de baixo.
//
// Os níveis abertos entram de propósito: abrir a ULA até o transistor troca
// quem emite por quais portas, e é na troca que um fio fica apontando para a
// porta de quem ele deixou de ser.
import { describe, expect, it } from "vitest";
import { World, emissoesPerdidas, relatoDePerdas } from "@ovh/depth-core";
import type { WorldSpec } from "@ovh/depth-core";
import { assemble } from "./assembler.js";
import { cpuWorld } from "./datapath.js";
import { somadorWorld } from "./gates.js";
import { bytesDe } from "./micro/assembler.test-helper.js";
import { microWorld } from "./micro/datapath.js";
import { portaCmosWorld } from "./transistors.js";
import * as pacote from "./index.js";

const PROGRAMA_RISCV = `
  addi t0, x0, 20
  addi t1, x0, 22
  add  t2, t0, t1
  sw   t2, 0(x0)
`;

const PROGRAMA_MICRO = `
  LOAD  0A
  ADD   05
  STORE 2000
`;

const imagem = (fonte: string): readonly number[] => {
  const r = assemble(fonte);
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join(" | "));
  return r.image.words;
};

/** Ticks por lab: o bastante para toda porta do desenho ter tido vez. */
const LABS: Readonly<Record<string, { readonly build: () => WorldSpec; readonly ticks: number }>> = {
  cpu: { build: () => cpuWorld(imagem(PROGRAMA_RISCV)), ticks: 14 },
  "cpu com atalho na ula": {
    build: () => cpuWorld(imagem(PROGRAMA_RISCV), { atalhoNaUla: true }),
    ticks: 14,
  },
  "cpu aberta até o transistor": {
    build: () => cpuWorld(imagem(PROGRAMA_RISCV), { transistoresNaUla: true }),
    ticks: 6,
  },
  "somador de 4 bits": { build: () => somadorWorld(4), ticks: 8 },
  "somador de 4 bits com atalho": { build: () => somadorWorld(4, true), ticks: 8 },
  "somador de 4 bits até o transistor": {
    build: () => somadorWorld(4, false, 1, true),
    ticks: 6,
  },
  "microprocessador genérico": { build: () => microWorld(bytesDe(PROGRAMA_MICRO)), ticks: 40 },
  // As seis portas CMOS, com e sem atalho. Entraram porque a guarda de
  // cobertura abaixo as achou de fora na primeira vez que rodou — a varredura
  // tinha sido escrita à mão e `portaCmosWorld` ficou para trás.
  ...Object.fromEntries(
    (["not", "and", "or", "nand", "nor", "xor"] as const).flatMap((tipo) =>
      [false, true].map((atalho) => [
        `porta CMOS ${tipo}${atalho ? " com atalho" : ""}`,
        { build: () => portaCmosWorld(tipo, atalho), ticks: 8 },
      ]),
    ),
  ),
};

/**
 * Os construtores que a varredura exercita, por nome.
 *
 * Segunda fonte da mesma verdade, e de propósito: ela existe só para a guarda
 * de cobertura poder comparar nome com nome. A primeira fonte é `LABS`, e um
 * construtor listado aqui sem estar lá não é pego por nada — o preço de a
 * guarda ser sobre a superfície do pacote e não sobre as chamadas.
 */
const CONSTRUTORES_VARRIDOS = ["cpuWorld", "microWorld", "portaCmosWorld", "somadorWorld"];

describe("nenhuma emissão cai no vácuo", () => {
  for (const [nome, { build, ticks }] of Object.entries(LABS)) {
    it(`${nome}: toda porta que emite tem fio ou descarte declarado`, () => {
      const world = new World(build());
      world.advance(ticks);
      const perdas = emissoesPerdidas(world.state);
      expect(perdas, `\n${relatoDePerdas(perdas)}`).toEqual([]);
    });
  }
});

describe("a varredura não envelhece em silêncio", () => {
  /*
    O defeito que esta sessão inteira perseguiu é guarda que passa a não medir
    nada sem avisar. Uma varredura com lista escrita à mão é exatamente isso: o
    lab nº 8 entra no repositório, ninguém lembra deste arquivo, e o verde
    continua verde cobrindo sete.

    Não é hipótese. Na primeira vez que esta guarda rodou ela achou
    `portaCmosWorld` de fora — a varredura tinha sido escrita à mão na rodada
    anterior e esse mundo ficou para trás. Os doze variantes dele estavam
    limpos, então o que se perdeu não foi um defeito: foi a garantia.

    A guarda é sobre a SUPERFÍCIE do pacote, e a convenção que ela usa já
    valia antes de ela existir: todo construtor de mundo deste repositório
    termina em `World`. Um construtor que não seja exportado do índice fica
    invisível aqui — é o limite declarado desta checagem.
  */
  it("todo construtor de mundo exportado pelo pacote está na varredura", () => {
    const exportados = Object.keys(pacote)
      .filter((nome) => /World$/u.test(nome))
      .sort();
    expect(
      exportados,
      "um construtor de mundo entrou no índice do pacote e não entrou na " +
        "varredura de emissões perdidas. Acrescente-o a `LABS` e a " +
        "`CONSTRUTORES_VARRIDOS` neste arquivo.",
    ).toEqual(CONSTRUTORES_VARRIDOS);
  });
});
