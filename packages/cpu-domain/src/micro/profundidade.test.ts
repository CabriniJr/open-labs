import { describe, expect, it } from "vitest";
import { World, indexTree } from "@ovh/depth-core";
import { bytesDe } from "./assembler.test-helper.js";
import { estadoDe, microWorld } from "./datapath.js";

/**
 * A profundidade que o slide não tem.
 *
 * O deck desenha a ULA como duas caixas — "Complementador/Deslocador" e
 * "Somador" — e para ali, porque um slide não abre. O modelo continua: o
 * somador de oito bits são oito somadores completos, cada um são cinco portas,
 * e cada porta é uma rede de transistores.
 *
 * O que este arquivo cobra não é o desenho, é a **reutilização**. As portas e
 * os transistores são os mesmos que o RISC-V usa; se alguém tivesse escrito um
 * segundo somador para a máquina de oito bits, haveria duas verdades sobre o
 * que uma porta XOR faz, e uma delas envelheceria calada.
 */
const arvore = () => indexTree(microWorld(bytesDe("LOAD 03\nADD 05")).root);

const caminhoAte = (id: string): readonly string[] => {
  const tree = arvore();
  const caminho: string[] = [];
  let atual: string | undefined = id;
  while (atual !== undefined) {
    caminho.unshift(atual);
    atual = tree.parent.get(atual);
  }
  return caminho;
};

describe("a profundidade do genérico", () => {
  it("a ULA tem oito bits, e são oito somadores completos de verdade", () => {
    const somador = arvore().byId.get("somador");
    // As duas metades importam: `replicas` sem os filhos seria um número
    // escrito por cima de uma caixa só — a mentira silenciosa em forma de
    // rótulo.
    expect(somador?.replicas).toBe(8);
    expect(somador?.children).toHaveLength(8);
  });

  it("do sistema até um transistor há nove níveis", () => {
    const caminho = caminhoAte("bit0-xor1-g1-p1");
    expect(caminho).toEqual([
      "sistema",
      "cpu",
      "processador",
      "ula",
      "somador",
      "bit0",
      "bit0-xor1",
      "bit0-xor1-g1",
      "bit0-xor1-g1-p1",
    ]);
  });

  it("lá embaixo há silício, e ele é PMOS e NMOS", () => {
    const tree = arvore();
    expect(tree.byId.get("bit0-xor1-g1-p1")?.label).toBe("PMOS");
    expect(tree.byId.get("bit0-xor1-g1-n1")?.label).toBe("NMOS");
    const silicio = [...tree.byId.values()].filter(
      (n) => n.label === "NMOS" || n.label === "PMOS",
    );
    // Oito somadores × cinco portas, e o XOR sozinho custa dezesseis
    // transistores. Que sejam centenas é o ponto: um somador é caro.
    expect(silicio.length).toBeGreaterThan(300);
  });

  it("o nível da porta e o do transistor vêm do que já existe, sem código de domínio novo", async () => {
    // Se este import falhar, alguém escreveu um segundo somador em vez de reusar.
    const gates = await import("../gates.js");
    const transistors = await import("../transistors.js");
    expect(typeof gates.somadorCompleto).toBe("function");
    expect(typeof transistors.portasCmosDe).toBe("function");
  });

  it("abrir a ULA não muda a aritmética: o slide 16 continua dando 21", () => {
    // O refinamento do RISC-V prova isto para trinta e dois bits; aqui é a
    // mesma pergunta para oito, e ela precisa ser feita nesta máquina porque é
    // outra fiação em volta do mesmo somador.
    const mundo = new World(microWorld(bytesDe("LOAD 0A\nADD 05\nADD 12\nSTORE 2000")));
    mundo.advance(30);
    expect(estadoDe(mundo.state).memoria.get(0x2000)).toBe(0x21);
  });
});
