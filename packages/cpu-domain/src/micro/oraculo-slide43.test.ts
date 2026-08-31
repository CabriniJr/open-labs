import { describe, expect, it } from "vitest";
import { World } from "@ovh/depth-core";
import type { WorldSpec, WorldState } from "@ovh/depth-core";
import { bytesDe } from "./assembler.test-helper.js";
import { microWorld } from "./datapath.js";
import { tabelaDeTempo } from "./tempo.js";
import {
  MICRO_PASSOS_DO_SLIDE_16,
  ORACULO_SLIDE_43,
  PROGRAMA_DO_SLIDE_16,
} from "./oraculo-slide43.js";

const rodar = (spec: WorldSpec, ticks: number): readonly WorldState[] => {
  const mundo = new World(spec);
  const estados: WorldState[] = [mundo.state];
  for (let i = 0; i < ticks; i += 1) {
    mundo.advance(1);
    estados.push(mundo.state);
  }
  return estados;
};

describe("o oráculo do slide 43", () => {
  // Exatamente os micro-passos do programa, e nem um a mais: o porquê está em
  // `MICRO_PASSOS_DO_SLIDE_16`.
  const nossa = tabelaDeTempo(
    rodar(microWorld(bytesDe(PROGRAMA_DO_SLIDE_16)), MICRO_PASSOS_DO_SLIDE_16),
  );

  it("tem o mesmo número de linhas", () => {
    expect(nossa).toHaveLength(ORACULO_SLIDE_43.length);
  });

  ORACULO_SLIDE_43.forEach((esperada, i) => {
    it(`linha ${i}: ${esperada.acesso} ${esperada.endereco?.toString(16) ?? ""}`, () => {
      expect(nossa[i]).toEqual(esperada);
    });
  });
});
