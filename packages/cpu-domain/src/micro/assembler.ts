/**
 * Texto → bytes. Uma linha, uma instrução, hexadecimal sem prefixo — que é
 * como o deck escreve.
 *
 * O montador não inventa: ele lê a tabela de `isa.ts`. Erro dele diz ao autor
 * o que fazer, porque quem escreve o programa é o leitor do lab.
 */
import { FORMATO, OPCODES } from "./isa.js";
import type { Mnemonico } from "./isa.js";

const MNEMONICOS = Object.keys(OPCODES) as readonly Mnemonico[];

const nomes = (): string => MNEMONICOS.map((m) => m.toUpperCase()).join(", ");

export interface ErroDeMontagem {
  readonly linha: number;
  readonly message: string;
}

/**
 * Result, e não exceção — a mesma forma do `assemble` do RISC-V, e pelo mesmo
 * motivo: quem escreve o programa é o leitor do lab, e um erro dele é resposta
 * a mostrar na tela, não uma exceção a estourar.
 *
 * Junta os erros em vez de parar no primeiro: quem digitou três linhas erradas
 * quer ver as três.
 */
export type ResultadoDaMontagem =
  | { readonly ok: true; readonly bytes: Uint8Array }
  | { readonly ok: false; readonly errors: readonly ErroDeMontagem[] };

export function montarMicro(fonte: string): ResultadoDaMontagem {
  const bytes: number[] = [];
  const errors: ErroDeMontagem[] = [];

  fonte.split("\n").forEach((bruta, i) => {
    const numero = i + 1;
    const linha = bruta.split(";")[0]?.trim() ?? "";
    if (linha === "") return;

    const [nome, operando] = linha.split(/\s+/);
    const m = nome?.toLowerCase() as Mnemonico | undefined;

    if (m === undefined || !MNEMONICOS.includes(m)) {
      errors.push({
        linha: numero,
        message: `"${nome ?? ""}" não é instrução desta máquina. As que existem: ${nomes()}.`,
      });
      return;
    }
    if (operando === undefined) {
      errors.push({
        linha: numero,
        message: `${nome} precisa de um operando, em hexadecimal e sem prefixo.`,
      });
      return;
    }

    const valor = Number.parseInt(operando, 16);
    if (Number.isNaN(valor)) {
      errors.push({
        linha: numero,
        message: `"${operando}" não é hexadecimal. Escreva 0A, e não 10 nem 0x0A.`,
      });
      return;
    }

    if (FORMATO[m] === 1) {
      if (valor < 0 || valor > 0xff) {
        errors.push({
          linha: numero,
          message:
            `${nome} ${operando}: o operando é um valor e precisa caber em um byte ` +
            `(00 a FF). Para trabalhar com endereço, use STORE, LOADM, JMP ou JZ.`,
        });
        return;
      }
      bytes.push(OPCODES[m], valor);
    } else {
      if (valor < 0 || valor > 0xffff) {
        errors.push({
          linha: numero,
          message:
            `${nome} ${operando}: o operando é um endereço e precisa caber em ` +
            `dois bytes (0000 a FFFF).`,
        });
        return;
      }
      // Parte alta primeiro: é a ordem em que a máquina lê, e é a do slide 17.
      bytes.push(OPCODES[m], (valor >> 8) & 0xff, valor & 0xff);
    }
  });

  return errors.length > 0 ? { ok: false, errors } : { ok: true, bytes: Uint8Array.from(bytes) };
}
