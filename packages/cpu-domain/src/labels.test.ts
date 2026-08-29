import { describe, expect, it } from "vitest";
import { indexTree } from "@ovh/depth-core";
import { assemble } from "./assembler.js";
import { cpuWorld } from "./datapath.js";
import { somadorWorld } from "./gates.js";
import { CPU_VIEWS, viewsDoSomador } from "./views.js";

/**
 * O que o leitor vê está em inglês, como o resto do site.
 *
 * O handbook é em inglês por decisão declarada, e os labs ficaram em português
 * até 29/08/2026 — o leitor lia um parágrafo numa língua e mexia num painel
 * noutra. Este teste existe para isso não voltar sozinho: um rótulo novo escrito
 * em português passa despercebido numa revisão e não passa aqui.
 *
 * A checagem é por caractere acentuado, e não por dicionário, de propósito: ela
 * não tem como acusar inglês por engano, e o que ela pega é exatamente o
 * descuido que se quer pegar.
 */

const ACENTO = /[áàâãéêíóôõúüç]/i;

const r = assemble("addi t0, x0, 1");
if (!r.ok) throw new Error("o programa de teste tem que montar");

const arvores = {
  cpu: indexTree(cpuWorld(r.image.words).root),
  somador: indexTree(somadorWorld(4, false, 1, true).root),
};

describe("o que o leitor vê está em inglês", () => {
  it.each(Object.entries(arvores))("nenhum rótulo acentuado na árvore de %s", (_qual, arvore) => {
    const acentuados = [...arvore.byId.values()]
      .map((node) => node.label)
      .filter((label) => ACENTO.test(label));
    expect(acentuados).toEqual([]);
  });

  it("nenhum título de vista acentuado", () => {
    const vistas = [...CPU_VIEWS, ...viewsDoSomador(4, true)];
    expect(vistas.filter((v) => ACENTO.test(v.title)).map((v) => v.id)).toEqual([]);
    // e os rótulos que a vista escreve por cima do modelo contam junto
    const sobrescritos = vistas
      .flatMap((v) => v.places)
      .map((p) => p.label)
      .filter((label): label is string => label !== undefined && ACENTO.test(label));
    expect(sobrescritos).toEqual([]);
  });

  it("o teste tem dente: um rótulo em português reprova", () => {
    expect(ACENTO.test("memória principal")).toBe(true);
    expect(ACENTO.test("main memory")).toBe(false);
  });
});
