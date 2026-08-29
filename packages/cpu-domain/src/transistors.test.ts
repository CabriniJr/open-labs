import { describe, expect, it } from "vitest";
import { World, shortcutDisagreement } from "@ovh/depth-core";
import { decide } from "./gates.js";
import { portaCmos, portaCmosWorld, fiosDaPortaCmos, transistor } from "./transistors.js";
import type { PortaCmos } from "./transistors.js";

/**
 * A porta lógica feita de transistores, contra a tabela-verdade.
 *
 * É o fundo da fatia vertical, e a prova é a de sempre: a rede de transistores
 * e o atalho da tabela precisam concordar em toda combinação de entrada.
 */

const TIPOS: readonly PortaCmos[] = ["not", "nand", "nor"];

/** Roda a porta com as entradas dadas e devolve o bit que saiu. */
function rodar(tipo: PortaCmos, a: number, b: number, comAtalho = false): number {
  const mundo = new World(portaCmosWorld(tipo, comAtalho));
  mundo.setParam("a", a);
  mundo.setParam("b", b);
  // um tick para a fonte emitir, outro para a mensagem atravessar a borda e a
  // rede acomodar, e o terceiro para o sorvedouro guardar
  mundo.advance(4);
  return (mundo.state.nodes.saida as { bit: number }).bit;
}

describe("a porta CMOS, transistor por transistor", () => {
  it.each(TIPOS)("a rede de %s dá a tabela-verdade inteira", (tipo) => {
    const entradas = tipo === "not" ? 1 : 2;
    for (let a = 0; a <= 1; a += 1) {
      for (let b = 0; b <= (entradas === 1 ? 0 : 1); b += 1) {
        const altas = a + (entradas === 1 ? 0 : b);
        expect({ a, b, saiu: rodar(tipo, a, b) }).toEqual({
          a,
          b,
          saiu: decide(tipo, altas, entradas),
        });
      }
    }
  });

  it.each(TIPOS)("o atalho de %s concorda com a rede que ele fecha", (tipo) => {
    const entradas = tipo === "not" ? 1 : 2;
    for (let a = 0; a <= 1; a += 1) {
      for (let b = 0; b <= (entradas === 1 ? 0 : 1); b += 1) {
        const spec = portaCmosWorld(tipo, true);
        expect(shortcutDisagreement(spec, "porta", 4, { ...spec.params, a, b })).toBeNull();
      }
    }
  });

  it("as duas redes são complementares: nunca as duas puxam, nunca nenhuma", () => {
    // Este é o invariante que o nó de saída existe para vigiar. Se ele nunca
    // dispara em nenhuma combinação de nenhuma porta, as redes estão certas —
    // e se disparasse, o teste morreria com o nome do nó.
    for (const tipo of TIPOS) {
      const entradas = tipo === "not" ? 1 : 2;
      for (let a = 0; a <= 1; a += 1) {
        for (let b = 0; b <= (entradas === 1 ? 0 : 1); b += 1) {
          expect(() => rodar(tipo, a, b)).not.toThrow();
        }
      }
    }
  });

  it("a rede de baixo desligada do nó é recusada, e não responde errado", () => {
    // Soltar o dreno do último NMOS do nó deixa a saída flutuando com as duas
    // entradas em alto: os dois PMOS estão cortados e ninguém mais puxa.
    //
    // É o caso que a codificação antiga não sabia acusar. Lá, "não puxado" e
    // "puxado para zero" eram o mesmo estado, e esta porta quebrada responderia
    // zero — que por acaso é a resposta certa do NAND com 1 e 1. Acertar por
    // acaso, calado, é exatamente o defeito que este projeto persegue.
    const spec = portaCmosWorld("nand", false);
    const capenga = {
      ...spec,
      // Desligado do nó, mas ainda declarado: mandar para o descarte diz que a
      // corrente vai para lugar nenhum, e é diferente de esquecer o fio.
      wires: spec.wires.map((w) =>
        w.from === "porta-n2" && w.to === "porta-no" ? { ...w, to: "@drop" as const } : w,
      ),
    };
    const mundo = new World(capenga);
    mundo.setParam("a", 1);
    mundo.setParam("b", 1);
    expect(() => mundo.advance(4)).toThrow(/flutuando/);

    // E com uma entrada em zero a mesma porta quebrada responde certo: o
    // defeito depende do dado, que é o motivo de ele passar despercebido.
    const outro = new World(capenga);
    outro.setParam("a", 1);
    outro.setParam("b", 0);
    expect(() => outro.advance(4)).not.toThrow();
  });

  it("as duas redes puxando ao mesmo tempo é curto, e é recusado", () => {
    // Trocar o canal de um NMOS por PMOS faz as duas redes fecharem juntas com
    // a entrada em zero: uma puxa para 1, a outra para 0.
    const spec = portaCmosWorld("not", false);
    const trocado = {
      ...spec,
      root: {
        ...spec.root,
        children: spec.root.children?.map((filho) =>
          filho.id !== "porta"
            ? filho
            : {
                ...filho,
                children: filho.children?.map((neto) =>
                  neto.id === "porta-n1" ? transistor("porta-n1", "pmos") : neto,
                ),
              },
        ),
      },
    };
    const mundo = new World(trocado);
    mundo.setParam("a", 0);
    expect(() => mundo.advance(4)).toThrow(/em curto/);
  });

  it("um trilho é recusado se não alimentar nada, ou se alguém alimentar ele", () => {
    // As duas maneiras de `drives` ser mentira, recusadas na construção.
    const spec = portaCmosWorld("not", false);

    const semSaida = { ...spec, wires: spec.wires.filter((w) => !w.from.endsWith("-vdd")) };
    expect(() => new World(semSaida)).toThrow(/drives e não tem saída acomodada/);

    const alimentado = {
      ...spec,
      wires: [
        ...spec.wires,
        { from: "porta-gnd", port: "out", to: "porta-vdd", timing: "settle" as const },
      ],
    };
    expect(() => new World(alimentado)).toThrow(/drives e tem entrada acomodada/);
  });

  it("o nó não some da árvore: a porta aberta tem os transistores de verdade", () => {
    const nand = portaCmos("x", "nand");
    expect(nand.children?.map((c) => c.id)).toEqual([
      "x-vdd",
      "x-gnd",
      "x-p1",
      "x-p2",
      "x-n1",
      "x-n2",
      "x-no",
    ]);
    // Série embaixo, paralelo em cima: é isso que faz um NAND ser um NAND.
    const fios = fiosDaPortaCmos("x", "nand");
    expect(fios).toContainEqual({ from: "x-n1", port: "dreno", to: "x-n2", timing: "settle" });
    expect(fios.filter((f) => f.to === "x-no")).toHaveLength(3);
  });
});
