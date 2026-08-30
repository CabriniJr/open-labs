import type { WorldState } from "@ovh/depth-core";
import { ENDERECO_ENTRADA, ENDERECO_SAIDA } from "./datapath.js";
import { PALAVRA } from "./datapath.js";
import type { EstadoBanco, EstadoMemoria, EstadoSaida } from "./datapath.js";
import { NOMES } from "./assembler.js";
import { decode } from "./isa.js";

export interface Linha {
  readonly chave: string;
  readonly valor: string;
  readonly ativo?: boolean;
}

const hex = (n: number): string => `0x${(n >>> 0).toString(16).padStart(4, "0")}`;

/**
 * O que cada caixa guarda agora — as linhas do estado, não uma ilustração.
 *
 * Uma memória desenhada como caixa lisa é a caixa fechada do armazém: sabe-se
 * que tem coisa lá dentro e não se vê nenhuma. O que se quer ver não é a lista
 * de números — é **o acesso acontecendo**: qual endereço esta instrução tocou,
 * e o valor mudando ali.
 *
 * Quem lê o estado é o domínio, sempre. O motor sabe que um objeto tem estado;
 * o que aquele estado significa — endereço, palavra, registrador — é do modelo.
 */
export function conteudoDaCaixa(
  state: WorldState,
  programa: readonly number[] = [],
): (id: string) => readonly Linha[] | undefined {
  return (id) => {
    if (id === "memoria") return daMemoria(state);
    if (id === "banco") return doBanco(state);
    if (id === "imem") return daImem(state, programa);
    if (id === "saida") return daSaida(state);
    return undefined;
  };
}

/**
 * A memória de instruções mostra **o programa**, e a linha acesa é a instrução
 * que está sendo buscada agora.
 *
 * Ela não guarda estado: as palavras vêm da imagem montada, que é quem sabe o
 * programa. Mostrá-las decodificadas e não em hexadecimal é a diferença entre
 * ver um bloco de números e ver o laço andando de instrução em instrução.
 */
function daImem(state: WorldState, programa: readonly number[]): readonly Linha[] | undefined {
  if (programa.length === 0) return undefined;
  const buscado = (state.settled["imem.out"] ?? [])[0]?.data.pc;
  const tocado = typeof buscado === "number" ? buscado : undefined;
  return programa.map((word, i) => {
    const instr = decode(word);
    const endereco = i * PALAVRA;
    return {
      chave: hex(endereco),
      valor: instr === null ? hex(word) : legenda(instr),
      ...(endereco === tocado ? { ativo: true as const } : {}),
    };
  });
}

function legenda(instr: {
  readonly mnemonic: string;
  readonly rd: number;
  readonly rs1: number;
  readonly rs2: number;
  readonly imm: number;
}): string {
  const r = (i: number): string => NOMES[i] ?? `x${i}`;
  const { mnemonic: m, rd, rs1, rs2, imm } = instr;
  if (m === "beq" || m === "bne") return `${m} ${r(rs1)},${r(rs2)},${imm}`;
  if (m === "lw") return `${m} ${r(rd)},${imm}(${r(rs1)})`;
  if (m === "sw") return `${m} ${r(rs2)},${imm}(${r(rs1)})`;
  if (m === "addi") return `${m} ${r(rd)},${r(rs1)},${imm}`;
  return `${m} ${r(rd)},${r(rs1)},${r(rs2)}`;
}

/**
 * A saída é uma fita: o que o programa falou, na ordem, com o último por
 * último. É o resultado sendo **produzido**, e não um número que aparece pronto.
 */
function daSaida(state: WorldState): readonly Linha[] | undefined {
  const saida = state.nodes.saida as EstadoSaida | undefined;
  if (saida === undefined || saida.palavras.length === 0) return undefined;
  const ultima = saida.palavras.length - 1;
  return saida.palavras.map((valor, i) => ({
    chave: `#${i + 1}`,
    valor: String(valor | 0),
    ...(i === ultima ? { ativo: true as const } : {}),
  }));
}

/**
 * A memória mostra as palavras que existem, e não os bilhões de endereços que
 * ela poderia ter. Um mapa esparso é a verdade dela: endereço que nunca foi
 * escrito não é zero guardado, é zero por não existir.
 */
function daMemoria(state: WorldState): readonly Linha[] | undefined {
  const memoria = state.nodes.memoria as EstadoMemoria | undefined;
  if (memoria === undefined) return undefined;

  // O endereço tocado neste tick, para a linha acender. Sai do que a própria
  // memória emitiu, e não de um palpite do desenho.
  const acessado = (state.settled["memoria.out"] ?? [])[0]?.data.resultado;
  const tocado = typeof acessado === "number" ? acessado : undefined;

  const linhas = [...memoria.mem.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([endereco, palavra]) => ({
      chave: hex(endereco),
      valor: hex(palavra),
      ...(endereco === tocado ? { ativo: true as const } : {}),
    }));

  // Os dois endereços que não são memória aparecem como o que são: portas para
  // fora. Escondê-los faria a tabela contradizer o texto do lab.
  return [
    ...linhas,
    { chave: `${hex(ENDERECO_ENTRADA)} in`, valor: String(memoria.entrada | 0), ...(tocado === ENDERECO_ENTRADA ? { ativo: true as const } : {}) },
    { chave: `${hex(ENDERECO_SAIDA)} out`, valor: "—", ...(tocado === ENDERECO_SAIDA ? { ativo: true as const } : {}) },
  ];
}

/** O banco mostra só quem saiu do zero: trinta e dois zeros não ensinam nada. */
function doBanco(state: WorldState): readonly Linha[] | undefined {
  const banco = state.nodes.banco as EstadoBanco | undefined;
  if (banco === undefined) return undefined;

  const escrito = (state.settled["mux-escrita.escrita"] ?? [])[0]?.data.rd;
  const tocado = typeof escrito === "number" ? escrito : undefined;

  return banco.regs
    .map((valor, i) => ({ i, valor }))
    .filter(({ i, valor }) => valor !== 0 || i === tocado)
    .map(({ i, valor }) => ({
      chave: NOMES[i] ?? `x${i}`,
      valor: String(valor | 0),
      ...(i === tocado ? { ativo: true as const } : {}),
    }));
}
