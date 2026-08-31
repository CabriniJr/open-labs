import { describe, expect, it } from "vitest";
import { PRIMEIRA_FASE, ordensDe, proximaFase } from "./fases.js";
import type { Fase } from "./fases.js";
import type { Mnemonico } from "./isa.js";

/** Roda a máquina de fases até ela voltar ao começo. Devolve a sequência. */
const cicloDe = (m: Mnemonico, zero = false): readonly Fase[] => {
  const seq: Fase[] = [PRIMEIRA_FASE];
  let f = PRIMEIRA_FASE;
  for (let i = 0; i < 50; i++) {
    f = proximaFase(f, m, zero);
    if (f === PRIMEIRA_FASE) return seq;
    seq.push(f);
  }
  throw new Error("a máquina de fases não fechou o ciclo em 50 passos");
};

describe("a máquina de fases", () => {
  it("busca é igual para toda instrução — é o que faz dela um ciclo", () => {
    for (const m of ["load", "add", "store", "loadm", "jmp", "jz"] as Mnemonico[]) {
      expect(cicloDe(m).slice(0, 3)).toEqual([
        "end-instrucao", "busca-instrucao", "decodifica",
      ]);
    }
  });

  it("formato 1 fecha em seis micro-passos", () => {
    expect(cicloDe("load")).toHaveLength(6);
    expect(cicloDe("add")).toHaveLength(6);
  });

  it("STORE fecha em onze — dois bytes de endereço custam tempo, e é isso que o formato quer dizer", () => {
    expect(cicloDe("store")).toHaveLength(11);
  });

  it("JMP não acessa a memória de dados: ele para no desvio", () => {
    expect(cicloDe("jmp")).toEqual([
      "end-instrucao", "busca-instrucao", "decodifica",
      "end-alto", "busca-alto", "guarda-alto",
      "end-baixo", "busca-baixo", "guarda-baixo",
      "desvia",
    ]);
  });

  it("JZ percorre as mesmas fases com Z ligado ou desligado — o que muda é a ordem emitida, não o tempo", () => {
    expect(cicloDe("jz", true)).toEqual(cicloDe("jz", false));
    expect(ordensDe("desvia", "jz", true)).toContain("pc<-hl");
    expect(ordensDe("desvia", "jz", false)).not.toContain("pc<-hl");
  });

  it("o operando do ADD passa pelo temporário antes de a ULA agir — é o que o slide 43 mostra", () => {
    const ordens = ordensDe("executa-valor", "add", false);
    expect(ordens).toContain("mbr->t");
    expect(ordens).toContain("somar");
    expect(ordens).not.toContain("mbr->ac");
  });

  it("o LOAD imediato vai direto ao acumulador, sem passar pelo temporário", () => {
    const ordens = ordensDe("executa-valor", "load", false);
    expect(ordens).toContain("mbr->ac");
    expect(ordens).not.toContain("mbr->t");
  });

  it("toda fase de busca liga a leitura, e nenhuma liga leitura e escrita juntas", () => {
    const fases: Fase[] = [
      "end-instrucao", "busca-instrucao", "decodifica",
      "end-operando", "busca-operando", "executa-valor",
      "end-alto", "busca-alto", "guarda-alto",
      "end-baixo", "busca-baixo", "guarda-baixo",
      "end-dado", "acesso-dado", "desvia",
    ];
    for (const f of fases) {
      for (const m of ["load", "add", "store", "loadm", "jmp", "jz"] as Mnemonico[]) {
        const o = ordensDe(f, m, false);
        expect(o.includes("ler") && o.includes("escrever")).toBe(false);
      }
    }
  });

  it("o PC anda uma vez por byte lido do programa, e nenhuma vez a mais", () => {
    const passos = (m: Mnemonico): number =>
      cicloDe(m).filter((f) => ordensDe(f, m, false).includes("pc++")).length;
    expect(passos("load")).toBe(2);   // opcode + valor
    expect(passos("store")).toBe(3);  // opcode + alto + baixo
  });
});
