import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { assemble } from "./assembler.js";
import { decode, encode, FORMAS } from "./isa.js";
import type { Mnemonic } from "./isa.js";

const montar = (fonte: string) => assemble(fonte);

const erros = (fonte: string) => {
  const r = montar(fonte);
  if (r.ok) throw new Error("esperava erro de montagem, e montou");
  return r.errors;
};

const palavras = (fonte: string) => {
  const r = montar(fonte);
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join(" | "));
  return r.image.words;
};

describe("codificação", () => {
  it("ida e volta: decodificar o que foi codificado devolve a mesma instrução", () => {
    // A tabela é a única fonte dos dois lados; se ela mentisse, este teste é o
    // que acusaria — e ele cobre todo o subconjunto, não um exemplo.
    const mnemonics = Object.keys(FORMAS) as Mnemonic[];
    fc.assert(
      fc.property(
        fc.constantFrom(...mnemonics),
        fc.integer({ min: 0, max: 31 }),
        fc.integer({ min: 0, max: 31 }),
        fc.integer({ min: 0, max: 31 }),
        fc.integer({ min: -1024, max: 1023 }),
        (mnemonic, rd, rs1, rs2, imm) => {
          const forma = FORMAS[mnemonic];
          // Cada formato tem a sua faixa e o seu alinhamento; sortear fora
          // deles testaria o truncamento, que é outro assunto.
          const valor =
            forma.format === "R"
              ? 0 // R não tem imediato: sortear um testaria um campo que não existe
              : forma.format === "B" || forma.format === "J"
              ? imm & ~1
              : forma.format === "U"
                ? Math.abs(imm)
                : forma.funct7 !== undefined && forma.format === "I"
                  ? Math.abs(imm) % 32
                  : imm;
          const instr = { mnemonic, rd, rs1, rs2, imm: valor };
          const voltou = decode(encode(instr));
          expect(voltou?.mnemonic).toBe(mnemonic);
          expect(voltou?.imm).toBe(valor);
          if (forma.format !== "S" && forma.format !== "B") expect(voltou?.rd).toBe(rd);
          if (forma.format !== "U" && forma.format !== "J") expect(voltou?.rs1).toBe(rs1);
        },
      ),
    );
  });

  it("palavra fora do subconjunto decodifica para null, e não para a mais parecida", () => {
    // Executar lixo como se fosse `add` daria um resultado, e resultado errado
    // sem erro é exatamente a falha que este projeto persegue.
    expect(decode(0xffffffff)).toBeNull();
    expect(decode(0x00000000)).toBeNull();
  });
});

describe("montador", () => {
  it("monta as três formas de operando que a gente escreve todo dia", () => {
    expect(
      palavras(`
      add  t0, t1, t2
      addi a0, a1, -4
      lw   s0, 8(sp)
      `),
    ).toHaveLength(3);
  });

  it("rótulo para a frente e para trás viram deslocamento relativo", () => {
    const [primeira, , terceira] = palavras(`
laco:   addi t0, t0, 1
        beq  t0, x0, fim
        jal  x0, laco
fim:    add  x0, x0, x0
    `);
    expect(primeira).toBeDefined();
    // o `jal` volta três palavras: -12 bytes
    expect(decode(terceira as number)?.imm).toBe(-8);
  });

  it("aponta linha e coluna do erro, em vez de dizer só que houve um", () => {
    const [erro] = erros(`
      add t0, t1, t2
      add t0, x99, t2
    `);
    expect(erro?.line).toBe(3);
    expect(erro?.column).toBeGreaterThan(10);
    expect(erro?.message).toMatch(/x0 a x31/);
  });

  it("acusa rótulo inexistente, e não desvia para lugar nenhum em silêncio", () => {
    expect(erros("beq x0, x0, naoexiste")[0]?.message).toMatch(/não existe neste programa/);
  });

  it("acusa rótulo repetido: dois alvos com o mesmo nome escolheriam em silêncio", () => {
    expect(erros("a: add x0,x0,x0\na: add x0,x0,x0")[0]?.message).toMatch(/já foi definido/);
  });

  it("acusa deslocamento maior que a palavra", () => {
    expect(erros("slli t0, t1, 40")[0]?.message).toMatch(/vai de 0 a 31/);
  });

  it("acusa a forma errada de acesso à memória, mostrando a certa", () => {
    expect(erros("lw t0, sp")[0]?.message).toMatch(/deslocamento\(registrador\)/);
  });

  it("acusa instrução fora do subconjunto listando o que existe", () => {
    const erro = erros("mul t0, t1, t2")[0];
    expect(erro?.message).toMatch(/não está no subconjunto/);
    expect(erro?.message).toMatch(/addi/);
  });

  it("comentário e linha em branco não ocupam endereço", () => {
    expect(
      palavras(`
      # isto é comentário

      add x0, x0, x0   ; e isto também
      `),
    ).toHaveLength(1);
  });
});
