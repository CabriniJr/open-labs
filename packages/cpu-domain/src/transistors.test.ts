import { describe, expect, it } from "vitest";
import { World, shortcutDisagreement } from "@ovh/depth-core";
import type { WorldSpec } from "@ovh/depth-core";
import { decide } from "./gates.js";
import { portaCmos, portaCmosWorld, fiosDaPortaCmos, transistor } from "./transistors.js";
import type { PortaLogica } from "./gates.js";

/**
 * A porta lógica feita de transistores, contra a tabela-verdade.
 *
 * É o fundo da fatia vertical, e a prova é a de sempre: a rede de transistores
 * e o atalho da tabela precisam concordar em toda combinação de entrada.
 */

/** O mesmo mundo com um transistor trocado de canal: é assim que se erra. */
function trocaCanal(spec: WorldSpec, alvo: string, canal: "nmos" | "pmos"): WorldSpec {
  return {
    ...spec,
    root: {
      ...spec.root,
      children: (spec.root.children ?? []).map((filho) =>
        filho.id !== "porta"
          ? filho
          : {
              ...filho,
              children: (filho.children ?? []).map((neto) =>
                neto.id === alvo ? transistor(alvo, canal) : neto,
              ),
            },
      ),
    },
  };
}

const TIPOS: readonly PortaLogica[] = ["not", "nand", "nor", "and", "or", "xor"];

/** Roda a porta com as entradas dadas e devolve o bit que saiu. */
function rodar(tipo: PortaLogica, a: number, b: number, comAtalho = false): number {
  const mundo = new World(portaCmosWorld(tipo, comAtalho));
  mundo.setParam("a", a);
  mundo.setParam("b", b);
  // um tick para a fonte emitir, outro para a mensagem atravessar a borda e a
  // rede acomodar, e o terceiro para o sorvedouro guardar
  // fundo suficiente para a cascata mais longa (o XOR tem três NANDs em fila)
  mundo.advance(6);
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
        expect(shortcutDisagreement(spec, "porta", 6, { ...spec.params, a, b })).toBeNull();
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

  it("um dreno solto do nó é recusado, e a porta não fica muda", () => {
    // Soltar o dreno de um transistor do nó é um fio faltando, e o nó sabe
    // quantos ramos a rede dele tem. Sem essa conferência a porta simplesmente
    // não responderia — o modo silencioso de errar, que é o que se persegue.
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
    expect(() => mundo.advance(6)).toThrow(/recebeu 2 ramo\(s\) e a rede tem 3: falta fio/);
  });

  it("uma rede que não puxa de lado nenhum é flutuação, e é recusada", () => {
    // Trocar o PMOS de cima de um NOT por NMOS: com a entrada em zero, o de
    // cima corta e o de baixo também. Todos os ramos estão ligados e nenhum
    // puxa — a saída não tem valor nenhum.
    //
    // Sob a codificação de presença, esta porta quebrada responderia zero em
    // silêncio, porque "não puxado" e "puxado para zero" eram o mesmo estado.
    const mundo = new World(trocaCanal(portaCmosWorld("not", false), "porta-p1", "nmos"));
    mundo.setParam("a", 0);
    expect(() => mundo.advance(6)).toThrow(/flutuando/);
  });

  it("as duas redes puxando ao mesmo tempo é curto, e é recusado", () => {
    // O espelho: trocar o NMOS de baixo por PMOS faz as duas redes fecharem
    // juntas com a entrada em zero — uma puxa para 1, a outra para 0. No
    // silício é o caminho da fumaça.
    const mundo = new World(trocaCanal(portaCmosWorld("not", false), "porta-n1", "pmos"));
    mundo.setParam("a", 0);
    expect(() => mundo.advance(6)).toThrow(/em curto/);
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
