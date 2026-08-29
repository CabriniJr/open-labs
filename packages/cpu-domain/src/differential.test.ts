import { describe, expect, it } from "vitest";
import { initialWorld, stepWorld, indexTree } from "@ovh/depth-core";
import { assemble } from "./assembler.js";
import { cpuWorld } from "./datapath.js";
import type { EstadoBanco, EstadoMemoria, EstadoPc, EstadoSaida } from "./datapath.js";
import { ENDERECO_ENTRADA, ENDERECO_SAIDA } from "./datapath.js";
import { initialCpu, stepCpu } from "./reference.js";
import type { CpuState } from "./reference.js";

/**
 * O diferencial: o mesmo programa no modelo e no intérprete de referência, e
 * **depois de cada instrução** comparam-se x0–x31, o pc e a memória tocada.
 *
 * O intérprete não usa motor nenhum, então um erro de composição no caminho de
 * dados aparece aqui. O limite está escrito em `reference.ts`: os dois
 * compartilham a tabela de codificação, então isto prova execução, não
 * codificação — e o confronto com um emulador de terceiro continua pendente.
 *
 * O deslocamento de três ticks não é folga: no tick 1 o relógio ainda não
 * pulsou, e o que uma instrução escreve atravessa a borda de relógio, chegando
 * ao elemento de memória no tick seguinte. É o mesmo atraso para PC, banco e
 * memória — se um deles andasse na frente, o modelo teria dois flancos.
 */
const ATRASO = 3;

function montar(fonte: string): readonly number[] {
  const r = assemble(fonte);
  if (!r.ok) throw new Error(r.errors.map((e) => `${e.line}:${e.column} ${e.message}`).join("\n"));
  return r.image.words;
}

function diferenca(modelo: Record<string, unknown>, referencia: CpuState): string | null {
  const banco = modelo.banco as EstadoBanco;
  const contador = modelo.pc as EstadoPc;
  const memoria = modelo.memoria as EstadoMemoria;
  const saida = (modelo.saida as EstadoSaida).palavras;

  if (saida.length !== referencia.saida.length) {
    return `saída: modelo falou ${saida.length} palavra(s), referência ${referencia.saida.length}`;
  }
  for (let i = 0; i < saida.length; i += 1) {
    if (saida[i] !== referencia.saida[i]) {
      return `saída[${i}]: modelo ${String(saida[i])}, referência ${String(referencia.saida[i])}`;
    }
  }

  for (let i = 0; i < 32; i += 1) {
    const meu = banco.regs[i] ?? 0;
    const dele = referencia.regs[i] ?? 0;
    if (meu !== dele) return `x${i}: modelo ${meu}, referência ${dele}`;
  }
  if (contador.pc !== referencia.pc) {
    return `pc: modelo ${contador.pc}, referência ${referencia.pc}`;
  }
  for (const [addr, valor] of referencia.mem) {
    const meu = memoria.mem.get(addr);
    if (meu !== valor) return `memória[${addr}]: modelo ${String(meu)}, referência ${valor}`;
  }
  for (const [addr, valor] of memoria.mem) {
    const dele = referencia.mem.get(addr);
    if (dele !== valor) return `memória[${addr}]: modelo ${valor}, referência ${String(dele)}`;
  }
  return null;
}

/** Roda os dois lado a lado e devolve a primeira divergência, ou `null`. */
function conferir(fonte: string, instrucoes: number, entrada = 0): string | null {
  const image = montar(fonte);
  const spec = cpuWorld(image);
  const tree = indexTree(spec.root);
  const params = { ...spec.params, entrada };

  let mundo = initialWorld(tree);
  let cpu = initialCpu(image, 0, entrada);

  for (let k = 0; k < instrucoes; k += 1) {
    cpu = stepCpu(cpu);
    for (let t = 0; t < (k === 0 ? ATRASO : 1); t += 1) {
      mundo = stepWorld(spec, tree, mundo, params);
    }
    const achado = diferenca(mundo.nodes, cpu);
    if (achado !== null) return `instrução ${k + 1}: ${achado}`;
  }
  return null;
}

describe("diferencial instrução a instrução", () => {
  it("aritmética, incluindo estouro de 32 bits", () => {
    expect(
      conferir(
        `
        lui  t0, 0x7ffff
        addi t0, t0, 2047
        addi t1, x0, 1
        add  t2, t0, t1     # estoura para negativo, e tem que estourar igual
        sub  t3, x0, t2
        slt  t4, t2, x0
        `,
        6,
      ),
    ).toBeNull();
  });

  it("lógica e deslocamentos, com sinal e sem", () => {
    expect(
      conferir(
        `
        addi a0, x0, -8
        addi a1, x0, 3
        and  a2, a0, a1
        or   a3, a0, a1
        xor  a4, a0, a1
        sll  a5, a1, a1
        srl  a6, a0, a1     # sem sinal: entra zero em cima
        sra  a7, a0, a1     # com sinal: entra o bit de sinal
        slli t0, a1, 4
        srai t1, a0, 2
        `,
        10,
      ),
    ).toBeNull();
  });

  it("desvio tomado e desvio não tomado", () => {
    expect(
      conferir(
        `
        addi t0, x0, 5
        addi t1, x0, 5
        beq  t0, t1, igual
        addi t2, x0, 111    # não deve executar
igual:  addi t3, x0, 222
        bne  t0, t1, longe  # não é tomado
        addi t4, x0, 333
longe:  addi t5, x0, 444
        `,
        7,
      ),
    ).toBeNull();
  });

  it("lw e sw com deslocamento", () => {
    expect(
      conferir(
        `
        addi sp, x0, 256
        addi t0, x0, 42
        sw   t0, 8(sp)
        lw   t1, 8(sp)
        addi t2, t1, 1
        sw   t2, 12(sp)
        lw   t3, 12(sp)
        `,
        7,
      ),
    ).toBeNull();
  });

  it("jal e jalr, com o endereço de retorno certo", () => {
    expect(
      conferir(
        `
        addi a0, x0, 7
        jal  ra, dobrar
        addi a2, x0, 99
        jal  x0, fim
dobrar: add  a1, a0, a0
        jalr x0, ra, 0
fim:    addi a3, x0, 1
        `,
        7,
      ),
    ).toBeNull();
  });

  it("jalr zera o bit 0 do alvo, que é regra da instrução e não arredondamento", () => {
    // Sem um alvo ímpar, a regra passa despercebida: todo endereço de
    // instrução já é par, e o modelo erraria sem ninguém notar.
    expect(
      conferir(
        `
        jal  ra, salto
        addi t0, x0, 1
salto:  jalr x0, ra, 1      # ra + 1 é ímpar, e o bit 0 cai
        addi t1, x0, 2
        `,
        4,
      ),
    ).toBeNull();
  });

  it("x0 como destino: escrever nele é legal e não faz nada", () => {
    // É a única instrução do subconjunto cujo comportamento correto é não
    // fazer nada, e por isso o primeiro lugar onde um modelo apressado erra.
    expect(
      conferir(
        `
        addi x0, x0, 123
        add  x0, x0, x0
        lui  x0, 0x12345
        addi t0, x0, 1      # x0 continua zero, então t0 vale 1
        `,
        4,
      ),
    ).toBeNull();
  });

  it("um laço que termina", () => {
    expect(
      conferir(
        `
        addi t0, x0, 0      # soma
        addi t1, x0, 1      # i
        addi t2, x0, 6      # limite
laco:   add  t0, t0, t1
        addi t1, t1, 1
        blt  t1, t2, laco
        addi t3, t0, 0
        `,
        20,
      ),
    ).toBeNull();
  });

  it("entrada e saída mapeadas em memória: um endereço que não é memória", () => {
    // Guardar em 0x1000 é falar; ler de 0x1004 é ouvir. Não há instrução nova —
    // é a mesma `sw` e a mesma `lw`, e é assim que máquina pequena conversa com
    // o mundo de verdade.
    expect(
      conferir(
        `
        lui  t0, 1          # 0x1000
        addi t1, x0, 42
        sw   t1, 0(t0)      # fala 42
        lw   t2, 4(t0)      # ouve a entrada
        add  t3, t2, t2
        sw   t3, 0(t0)      # fala o dobro
        `,
        6,
        7,
      ),
    ).toBeNull();
  });

  it("guardar no endereço de saída não deixa o valor parado na memória", () => {
    // Se ficasse, a memória cresceria com números que ninguém escreveu ali — e
    // o `lw` do mesmo endereço devolveria o eco em vez de zero.
    expect(
      conferir(
        `
        lui  t0, 1
        addi t1, x0, 9
        sw   t1, 0(t0)
        lw   t2, 0(t0)      # tem que ler zero, e não o 9 que acabou de falar
        `,
        4,
      ),
    ).toBeNull();
  });
});
