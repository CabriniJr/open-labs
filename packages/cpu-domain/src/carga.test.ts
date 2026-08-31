import { describe, expect, it } from "vitest";
import { World } from "@ovh/depth-core";
import type { Message } from "@ovh/depth-core";
import { leituraDaCarga } from "./carga.js";
import { assemble } from "./assembler.js";
import { cpuWorld } from "./datapath.js";
import { somadorWorld } from "./gates.js";

const msg = (kind: string, data: Record<string, unknown>, weight = 1): Message => ({
  id: "m",
  kind,
  weight,
  data,
});

describe("o que a carga mostra na esteira", () => {
  it("um bit é o bit, e zero é um valor como outro qualquer", () => {
    expect(leituraDaCarga(msg("bit", { bit: 1 }))).toBe("1");
    // Zero tem que aparecer. Ele é a resposta da porta, não a ausência dela —
    // e sumir com o zero é a mentira que este modelo passou a vida evitando.
    expect(leituraDaCarga(msg("bit", { bit: 0 }))).toBe("0");
  });

  it("a corrente diz se o caminho está aberto, e qual trilho puxa", () => {
    expect(leituraDaCarga(msg("corrente", { conduz: true, bit: 1 }))).toBe("▲1");
    expect(leituraDaCarga(msg("corrente", { conduz: true, bit: 0 }))).toBe("▼0");
    expect(leituraDaCarga(msg("corrente", { conduz: false, bit: 0 }))).toBe("—");
  });

  it("endereço e instrução saem em hexadecimal, que é como se lê os dois", () => {
    expect(leituraDaCarga(msg("endereco", { pc: 16 }))).toBe("0x10");
    expect(leituraDaCarga(msg("instrucao", { pc: 0, word: 0x00500093 }))).toBe("0x500093");
  });

  it("uma escrita mostra o destino e o valor: é a transformação inteira", () => {
    expect(leituraDaCarga(msg("escrita", { rd: 5, valor: 42 }))).toBe("x5=42");
  });

  it("um sinal carrega a decisão, e se lê pelo nome que ela tem no livro", () => {
    // Era o identificador interno cru. `sub` é mnemônico do ISA e sobrevive
    // como está; o que não sobrevive é o valor que só o código conhecia.
    expect(leituraDaCarga(msg("sinal", { op: "sub" }))).toBe("ALUOp=sub");
    expect(leituraDaCarga(msg("sinal", { acesso: "ler" }))).toBe("MemRead");
    expect(leituraDaCarga(msg("sinal", { acesso: "escrever" }))).toBe("MemWrite");
    expect(leituraDaCarga(msg("sinal", { escrita: "ula" }))).toBe("MemToReg=ALU");
  });

  it("um sinal que ninguém traduziu fica sem legenda, e não sai em português", () => {
    // Devolver o valor cru seria o desenho afirmar o que ninguém revisou — e
    // foi assim que `ler`, `escrever` e `nada` chegaram à tela de um site em
    // inglês. Quem impede o par desconhecido de existir é a varredura do ISA
    // em `labels.test.ts`; aqui só se garante que ninguém invente.
    expect(leituraDaCarga(msg("sinal", { acesso: "hipnotizar" }))).toBeUndefined();
    expect(leituraDaCarga(msg("sinal", { inventado: "coisa" }))).toBeUndefined();
  });

  it("o que não se sabe ler fica sem legenda, em vez de virar [object Object]", () => {
    expect(leituraDaCarga(msg("inventado", { x: 1 }))).toBeUndefined();
    expect(leituraDaCarga(msg("bit", {}))).toBeUndefined();
  });
});

/**
 * A meia-verdade que este teste fecha: uma legenda que existe para meia dúzia
 * de formas e falta justamente nas que andam na tela seria pior que nenhuma —
 * o leitor aprenderia a não confiar nela.
 *
 * As mensagens são as **de verdade**, colhidas do mundo rodando. Fabricar um
 * exemplo por forma criaria uma segunda lista escrita à mão, que envelheceria
 * sozinha e passaria a aprovar formas que ninguém mais emite — foi o que
 * aconteceu na primeira versão deste arquivo.
 */
describe("a esteira não anda com carga anônima", () => {
  function cargasDe(spec: { readonly root: unknown }, ticks: number): readonly Message[] {
    const mundo = new World(spec as never);
    const vistas = new Map<string, Message>();
    for (let i = 0; i < ticks; i += 1) {
      mundo.advance(1);
      for (const mensagens of Object.values(mundo.state.settled)) {
        for (const m of mensagens) if (!vistas.has(m.kind)) vistas.set(m.kind, m);
      }
      for (const item of mundo.state.flight) {
        if (!vistas.has(item.message.kind)) vistas.set(item.message.kind, item.message);
      }
    }
    return [...vistas.values()];
  }

  it("toda forma que a CPU põe na linha tem legenda", () => {
    const r = assemble("addi t0, x0, 5\nadd t1, t0, t0\nsw t1, 0(x0)\n");
    if (!r.ok) throw new Error("o programa de teste tem que montar");
    const cargas = cargasDe(cpuWorld(r.image.words), 12);
    expect(cargas.length).toBeGreaterThan(6);
    for (const carga of cargas) {
      expect(
        leituraDaCarga(carga),
        `a forma "${carga.kind}" anda na tela sem legenda: ${JSON.stringify(carga.data)}`,
      ).toBeDefined();
    }
  });

  it("toda forma do circuito de portas tem legenda", () => {
    const cargas = cargasDe(somadorWorld(4, false, 1, true), 4);
    expect(cargas.length).toBeGreaterThan(0);
    for (const carga of cargas) {
      expect(leituraDaCarga(carga), `a forma "${carga.kind}"`).toBeDefined();
    }
  });
});
