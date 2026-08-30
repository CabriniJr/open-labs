/**
 * O slide 43 do deck de Prof. Filippo Valiante Filho, transcrito.
 *
 * Este arquivo **não é derivado de nada nosso**. É a leitura de um documento
 * que não controlamos, e é essa a virtude dele: qualquer coisa que a nossa
 * máquina faça diferente daqui é ou defeito nosso, ou divergência deliberada —
 * e deliberada tem que estar escrita ao lado da célula, com o motivo.
 *
 * Convenção da tabela original, mantida: **coluna que não foi escrita fica
 * vazia.** Escrita, e não mudada: na linha do segundo `ADD` o IR aparece com
 * `8B`, que é o byte que já estava lá — o ciclo carregou o IR de novo, e a
 * tabela mostra isso. O PC aparece já incrementado, no fim da transação que o
 * incrementou. Na escrita final ele não muda, porque escrever não avança o
 * programa.
 *
 * Programa (slide 16):
 *   LOAD  0A
 *   ADD   05
 *   ADD   12
 *   STORE 2000
 */
import type { LinhaDeTempo } from "./tempo.js";

export const PROGRAMA_DO_SLIDE_16 = `
  LOAD  0A
  ADD   05
  ADD   12
  STORE 2000
`;

/**
 * Os micro-passos que este programa gasta, e por isso o número de ticks com que
 * o oráculo se compara.
 *
 * Não é número redondo de propósito: `LOAD` e os dois `ADD` custam seis
 * micro-passos cada, `STORE` custa onze. Deixar a máquina andar além disso não
 * é inofensivo — ela busca o byte em `0009`, não acha instrução ali e para, e
 * essa busca é uma transação de barramento de verdade, que a nossa tabela
 * mostra (bem) como uma décima primeira linha. O deck não a tem porque o deck
 * acaba com o programa. Comparar 12 linhas com 11 seria comparar dois trechos
 * de tempo diferentes, e não duas máquinas.
 */
export const MICRO_PASSOS_DO_SLIDE_16 = 6 + 6 + 6 + 11;

export const ORACULO_SLIDE_43: readonly LinhaDeTempo[] = [
  { acesso: "init", pc: 0x0000 },
  { acesso: "read", endereco: 0x0000, dado: 0x86, ir: 0x86, pc: 0x0001, instrucao: "LOAD 0A" },
  { acesso: "read", endereco: 0x0001, dado: 0x0a, ac: 0x0a, pc: 0x0002 },
  { acesso: "read", endereco: 0x0002, dado: 0x8b, ir: 0x8b, pc: 0x0003, instrucao: "ADD 05" },
  { acesso: "read", endereco: 0x0003, dado: 0x05, t: 0x05, ac: 0x0f, pc: 0x0004 },
  { acesso: "read", endereco: 0x0004, dado: 0x8b, ir: 0x8b, pc: 0x0005, instrucao: "ADD 12" },
  { acesso: "read", endereco: 0x0005, dado: 0x12, t: 0x12, ac: 0x21, pc: 0x0006 },
  { acesso: "read", endereco: 0x0006, dado: 0xb7, ir: 0xb7, pc: 0x0007, instrucao: "STORE 2000" },
  { acesso: "read", endereco: 0x0007, dado: 0x20, h: 0x20, pc: 0x0008 },
  { acesso: "read", endereco: 0x0008, dado: 0x00, l: 0x00, pc: 0x0009 },
  { acesso: "write", endereco: 0x2000, dado: 0x21 },
];
