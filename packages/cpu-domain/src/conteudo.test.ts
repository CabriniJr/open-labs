import { describe, expect, it } from "vitest";
import { World } from "@ovh/depth-core";
import { assemble, NOMES, ABI } from "./assembler.js";
import { cpuWorld, ENDERECO_ENTRADA, ENDERECO_SAIDA } from "./datapath.js";
import { conteudoDaCaixa } from "./conteudo.js";

function montar(fonte: string): readonly number[] {
  const r = assemble(fonte);
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join("\n"));
  return r.image.words;
}

function mundoCom(fonte: string, ticks: number) {
  const mundo = new World(cpuWorld(montar(fonte)));
  mundo.advance(ticks);
  return mundo;
}

describe("os nomes dos registradores", () => {
  it("saem do ABI, e não de uma segunda lista", () => {
    expect(NOMES).toHaveLength(32);
    expect(NOMES[0]).toBe("zero");
    expect(NOMES[6]).toBe("t1");
    for (const [nome, indice] of Object.entries(ABI)) {
      // `fp` é apelido de `s0`: quem escreve escolhe qualquer um, quem lê
      // precisa de um só.
      if (nome === "fp") continue;
      expect(NOMES[indice], `${nome} = x${indice}`).toBe(nome);
    }
  });
});

describe("o que cada caixa guarda", () => {
  it("a memória mostra as palavras que existem, e as duas portas do mundo", () => {
    const mundo = mundoCom("addi t0, x0, 5\n", 4);
    const linhas = conteudoDaCaixa(mundo.state)("memoria");
    expect(linhas).toBeDefined();
    // O programa montado vira palavras na memória: elas estão lá.
    expect(linhas!.length).toBeGreaterThan(2);
    expect(linhas!.some((l) => l.chave.includes("in"))).toBe(true);
    expect(linhas!.some((l) => l.chave.includes("out"))).toBe(true);
  });

  /**
   * O que se quer ver não é a lista de números: é **o acesso acontecendo**. Sem
   * a linha que acende, a tabela é um painel, e um painel não mostra fluxo.
   */
  it("a linha tocada no tick acende, e só ela", () => {
    const mundo = mundoCom("addi t0, x0, 5\nsw t0, 0(x0)\n", 6);
    for (let i = 0; i < 12; i += 1) {
      mundo.advance(1);
      const linhas = conteudoDaCaixa(mundo.state)("memoria") ?? [];
      expect(linhas.filter((l) => l.ativo === true).length).toBeLessThanOrEqual(1);
    }
  });

  it("o banco mostra quem saiu do zero, e não trinta e dois zeros", () => {
    const mundo = mundoCom("addi t0, x0, 5\naddi t1, x0, 7\n", 8);
    const linhas = conteudoDaCaixa(mundo.state)("banco") ?? [];
    expect(linhas.length).toBeLessThan(5);
    expect(linhas.map((l) => l.chave)).toContain("t0");
    expect(linhas.map((l) => l.chave)).not.toContain("zero");
  });

  it("quem não guarda nada não inventa tabela", () => {
    const mundo = mundoCom("addi t0, x0, 5\n", 4);
    expect(conteudoDaCaixa(mundo.state)("ula")).toBeUndefined();
    expect(conteudoDaCaixa(mundo.state)("inexistente")).toBeUndefined();
  });

  it("os dois endereços que não são memória aparecem como o que são", () => {
    const mundo = mundoCom("addi t0, x0, 5\n", 4);
    const linhas = conteudoDaCaixa(mundo.state)("memoria") ?? [];
    const entrada = linhas.find((l) => l.chave.includes("in"));
    const saida = linhas.find((l) => l.chave.includes("out"));
    expect(entrada?.chave).toContain((ENDERECO_ENTRADA >>> 0).toString(16));
    expect(saida?.chave).toContain((ENDERECO_SAIDA >>> 0).toString(16));
  });


  it("a memória de instruções mostra o programa legível, e não um bloco de hex", () => {
    const fonte = "addi t0, x0, 5\naddi t1, x0, 7\nadd t2, t0, t1\n";
    const mundo = mundoCom(fonte, 6);
    const linhas = conteudoDaCaixa(mundo.state, montar(fonte))("imem") ?? [];
    expect(linhas).toHaveLength(3);
    // Ver `addi t0,zero,5` e não `0x00500293` é a diferença entre um bloco de
    // números e o laço andando de instrução em instrução.
    expect(linhas[0]?.valor).toContain("addi t0");
    expect(linhas[2]?.valor).toBe("add t2,t0,t1");
  });

  it("sem programa, a memória de instruções não inventa tabela", () => {
    const mundo = mundoCom("addi t0, x0, 5\n", 4);
    expect(conteudoDaCaixa(mundo.state)("imem")).toBeUndefined();
  });

  it("a saída é a fita do que o programa falou, com o último aceso", () => {
    // `sw` no endereço de saída é como o programa fala.
    const fonte = [
      "lui t3, 1",
      "addi t0, x0, 11",
      "sw t0, 0(t3)",
      "addi t0, x0, 22",
      "sw t0, 0(t3)",
    ].join("\n");
    const mundo = mundoCom(fonte, 40);
    const linhas = conteudoDaCaixa(mundo.state)("saida") ?? [];
    expect(linhas.map((l) => l.valor)).toEqual(["11", "22"]);
    expect(linhas.at(-1)?.ativo).toBe(true);
    expect(linhas[0]?.ativo).toBeUndefined();
  });
});
