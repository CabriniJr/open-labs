import { describe, expect, it } from "vitest";
import { World, indexTree } from "@ovh/depth-core";
import { assemble } from "./assembler.js";
import { cpuWorld } from "./datapath.js";


/**
 * O teste de refinamento, aplicado à ULA aberta até o transistor.
 *
 * `docs/depth.md` §3 pede exatamente isto: quando uma folha aproximada é
 * substituída por uma subárvore, as duas versões passam a existir e têm que
 * concordar **na fronteira**. Aqui a "folha" é a porta lógica, e a subárvore
 * são as redes CMOS que a produzem.
 *
 * Sem este teste, descer um nível é uma aposta: o desenho ficaria mais fundo e
 * ninguém saberia se a aritmética continua a mesma. Com ele, profundidade é
 * incremento verificado — e a discordância, se aparecer, é a informação mais
 * útil que se pode ter, porque significa que a aproximação de cima mentia.
 */

const PROGRAMA = `addi t0, x0, 13
addi t1, x0, 29
add  t2, t0, t1
sub  t3, t1, t0
addi t4, x0, -1
add  t5, t4, t1
`;

function palavras(fonte: string): readonly number[] {
  const r = assemble(fonte);
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join("\n"));
  return r.image.words;
}

function rodar(comTransistores: boolean, ticks: number) {
  const mundo = new World(cpuWorld(palavras(PROGRAMA), { transistoresNaUla: comTransistores }));
  mundo.advance(ticks);
  const banco = mundo.state.nodes.banco as { readonly regs: readonly number[] };
  const contador = mundo.state.nodes.pc as { readonly pc: number };
  return { regs: [...banco.regs], pc: contador.pc };
}

describe("abrir a ULA até o transistor não muda a aritmética", () => {
  it("os registradores e o pc batem, tick a tick", () => {
    for (const ticks of [4, 8, 14, 20]) {
      expect(rodar(true, ticks), `depois de ${ticks} ticks`).toEqual(rodar(false, ticks));
    }
  });

  /**
   * A escada existe de verdade, e é isto que a cobra. Sem esta metade, a versão
   * com transistores poderia estar simplesmente ignorando a opção e passando no
   * teste acima por ser a mesma coisa.
   */
  it("com transistores há silício na árvore, e sem eles a porta é folha", () => {
    const fundo = indexTree(cpuWorld(palavras(PROGRAMA), { transistoresNaUla: true }).root);
    const raso = indexTree(cpuWorld(palavras(PROGRAMA)).root);

    expect(raso.byId.get("bit0-xor1")?.children ?? []).toHaveLength(0);
    expect((fundo.byId.get("bit0-xor1")?.children ?? []).length).toBeGreaterThan(0);

    // O transistor é um `router` com rótulo NMOS ou PMOS: o motor não tem um
    // arquétipo de silício, e é o domínio que sabe o que aquilo é.
    const silicio = (arvore: typeof fundo) =>
      [...arvore.byId.values()].filter((n) => n.label === "NMOS" || n.label === "PMOS");
    expect(silicio(fundo).length).toBeGreaterThan(1000);
    expect(silicio(raso)).toHaveLength(0);

    // O custo é a razão de a opção existir, e ele é grande o bastante para ser
    // uma escolha e não um padrão.
    expect(fundo.byId.size).toBeGreaterThan(raso.byId.size * 10);
  });
});
