import { describe, expect, it } from "vitest";
import { indexTree } from "@ovh/depth-core";
import { FAMILIAS, KINDS } from "@ovh/depth-ui";
import { assemble } from "./assembler.js";
import { controlar, cpuWorld } from "./datapath.js";
import { decode, FORMAS } from "./isa.js";
import type { Instruction, Mnemonic } from "./isa.js";
import { rotuloDoSinal } from "./labels.js";
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

/**
 * As descrições dos `kind` também são texto que o leitor vê.
 *
 * Elas moram em `depth-ui` porque são vocabulário do motor, e passaram
 * despercebidas na primeira tradução justamente por não estarem onde os rótulos
 * do modelo estão. A guarda vale para tudo que chega na tela, não para um
 * arquivo.
 */
describe("as descrições dos kind também estão em inglês", () => {
  it("nenhum resumo ou detalhe acentuado", () => {
    const textos = [
      ...Object.entries(KINDS).flatMap(([k, d]) => [
        [`kind ${k} resumo`, d.resumo] as const,
        [`kind ${k} detalhe`, d.detalhe] as const,
      ]),
      ...Object.entries(FAMILIAS).flatMap(([f, d]) => [
        [`família ${f} resumo`, d.resumo] as const,
        [`família ${f} detalhe`, d.detalhe] as const,
      ]),
    ];
    expect(textos.filter(([, t]) => ACENTO.test(t)).map(([onde]) => onde)).toEqual([]);
  });

  it("todo kind e toda família têm descrição, e nenhuma vazia", () => {
    // Um kind novo no motor sem descrição apareceria na ficha como um espaço em
    // branco — o leitor perguntaria "o que é isso?" e a tela não responderia.
    for (const [nome, d] of [...Object.entries(KINDS), ...Object.entries(FAMILIAS)]) {
      expect(d.resumo.length, `${nome}: resumo`).toBeGreaterThan(10);
      expect(d.detalhe.length, `${nome}: detalhe`).toBeGreaterThan(40);
    }
  });
});

/**
 * O sinal de controle também é texto que o leitor lê.
 *
 * A guarda acima varre o `label` dos nós, e os sinais escapavam por dois
 * motivos ao mesmo tempo: eles não são `label` de nó nenhum — nascem no
 * payload da mensagem e vão direto para a linha tracejada —, e nenhum dos
 * identificadores internos (`ler`, `escrever`, `nada`, `ula`, `mem`, `pc4`)
 * tem acento, então nem se fossem varridos seriam pegos.
 *
 * Por isso a checagem aqui não é por acento: é por **cobertura**. Todo par
 * campo/valor que a unidade de controle emite tem de ter tradução, para toda
 * instrução do ISA. Um mnemônico novo, ou um valor de controle novo, reprova
 * aqui em vez de aparecer em português na tela de alguém.
 */
const EXEMPLO: Readonly<Record<Mnemonic, string>> = {
  add: "add t0, t1, t2", sub: "sub t0, t1, t2", and: "and t0, t1, t2",
  or: "or t0, t1, t2", xor: "xor t0, t1, t2", sll: "sll t0, t1, t2",
  srl: "srl t0, t1, t2", sra: "sra t0, t1, t2", slt: "slt t0, t1, t2",
  addi: "addi t0, t1, 4", andi: "andi t0, t1, 4", ori: "ori t0, t1, 4",
  xori: "xori t0, t1, 4", slli: "slli t0, t1, 2", srli: "srli t0, t1, 2",
  srai: "srai t0, t1, 2", slti: "slti t0, t1, 4",
  lw: "lw t0, 0(t1)", sw: "sw t0, 0(t1)",
  beq: "beq t0, t1, 0", bne: "bne t0, t1, 0", blt: "blt t0, t1, 0",
  bge: "bge t0, t1, 0",
  jal: "jal t0, 0", jalr: "jalr t0, t1, 0",
  lui: "lui t0, 1", auipc: "auipc t0, 1",
};

describe("os sinais de controle têm o nome do livro", () => {
  const programa = (Object.keys(FORMAS) as Mnemonic[]).map((m) => EXEMPLO[m]);

  it("o ISA inteiro tem exemplo, senão a varredura tem buraco", () => {
    expect(programa.length).toBe(Object.keys(FORMAS).length);
  });

  it.each(programa)("todo sinal de `%s` tem tradução", (linha) => {
    const montado = assemble(linha);
    if (!montado.ok) throw new Error(`o exemplo não monta: ${linha}`);
    const instr = decode(montado.image.words[0] ?? 0);
    expect(instr).not.toBeNull();

    for (const [campo, valor] of Object.entries(controlar(instr as Instruction))) {
      const rotulo = rotuloDoSinal(campo, String(valor));
      expect(rotulo, `sinal ${campo}=${String(valor)} em "${linha}"`).toBeDefined();
      expect(ACENTO.test(rotulo ?? ""), `acento em ${rotulo ?? ""}`).toBe(false);
    }
  });
});
