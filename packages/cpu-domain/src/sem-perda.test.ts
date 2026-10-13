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
};

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
