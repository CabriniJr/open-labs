/**
 * Todo texto que o leitor vê, num lugar só.
 *
 * O handbook é em inglês por decisão declarada, e os labs estavam em português:
 * o leitor lia um parágrafo numa língua e mexia num painel noutra. Aqui tudo é
 * inglês, como o resto do site e como o `depth-ui` sempre foi.
 *
 * **Estar num arquivo só é o ponto.** A CPU é material para aulas em pt-BR, e
 * uma camada de idioma vai ser pedida. Espalhado pelos modelos, traduzir seria
 * caçar string em vinte arquivos e esquecer três; reunido, é trocar este mapa.
 * O código, os comentários e os identificadores seguem em português — eles não
 * são lidos por quem visita o site.
 */

export const ROTULOS = {
  // o sistema
  sistema: "system",
  cpu: "CPU",
  processador: "processor",
  logica: "combinational logic",
  relogio: "clock",
  imem: "instruction memory",
  decodificadorDeEndereco: "address decoder",
  celulas: "cells",
  memoria: "main memory",
  entrada: "input",
  saida: "output",

  // dentro do processador
  pc: "PC",
  banco: "register file",
  controle: "control unit",
  decodificador: "decoder",
  desvio: "branch unit",
  muxOperando: "operand mux",
  muxEscrita: "write-back mux",

  // dentro da ULA
  ula: "ALU",
  dispersor: "splitter",
  coletor: "collector",
  pesos: "weights",
  unidadeLogica: "logic unit",
  muxOperacao: "operation mux",
  somadorDe: (bits: number): string => `${bits}-bit adder`,
  peso: (i: number): string => `2^${i}`,

  // o circuito
  circuito: "circuit",
  entradas: "inputs",
  soma: (i: number): string => `sum ${i}`,
  vaium: "carry-out",
  cin: "carry-in",
  barramento: "data bus",
  barramentoInstrucao: "instruction bus",
  viaPc: "address",
  viaInstrucao: "instruction",
  viaEndereco: "address",
  viaDado: "data",
  viaControle: "control",
  no: "node",
  vdd: "Vdd",
  gnd: "GND",
} as const;

/**
 * Os sinais de controle, com o nome que eles têm no livro.
 *
 * A unidade de controle emitia os identificadores internos crus no payload —
 * `ler`, `escrever`, `nada`, `ula`, `mem`, `pc4` —, e a linha tracejada os
 * imprimia como estavam. O leitor de um site em inglês lia palavras em
 * português na única legenda que diz o **nome do sinal**; e nem no idioma
 * certo elas seriam os nomes certos, porque o que ele vai encontrar no livro e
 * na prova é `MemRead`, `RegWrite`, `ALUSrc`, `MemToReg`.
 *
 * A guarda de idioma não pegou isso, e não foi por descuido dela: ela varre
 * caractere acentuado, e nenhuma daquelas palavras tem acento. Quem pega é o
 * teste que exige que todo par campo/valor emitido esteja aqui.
 *
 * **Por campo, e não por valor.** `nada` quer dizer "não acessa memória" em
 * `modo` e "não escreve no banco" em `fonte`: são decisões diferentes de peças
 * diferentes, e um mapa por valor faria uma responder pela outra.
 */
export const SINAIS: Readonly<
  Record<string, { readonly nome: string; readonly valores: Readonly<Record<string, string>> }>
> = {
  // A operação vai para a ULA; os valores são os mnemônicos do ISA, que já são
  // o nome canônico e não passam por tradução nenhuma.
  op: { nome: "ALUOp", valores: {} },
  fonteB: { nome: "ALUSrc", valores: { reg: "reg", imm: "imm" } },
  // O acesso é o par clássico, e cada um é um sinal com nome próprio — por
  // isso o nome do campo fica vazio: `MemRead` já se diz inteiro.
  acesso: { nome: "", valores: { ler: "MemRead", escrever: "MemWrite", nada: "no access" } },
  escrita: {
    nome: "MemToReg",
    valores: { ula: "ALU", mem: "mem", pc4: "PC+4", nada: "no write" },
  },
  desvio: { nome: "Branch", valores: { seq: "none" } },
} as const;

/**
 * A legenda de um sinal, ou `undefined` quando o par não é conhecido.
 *
 * Devolver o valor cru no desconhecido seria o desenho continuar afirmando
 * algo que ninguém revisou. Quem impede o desconhecido de existir é o teste,
 * na construção — aqui só resta não inventar.
 */
export function rotuloDoSinal(campo: string, valor: string): string | undefined {
  const sinal = SINAIS[campo];
  if (sinal === undefined) return undefined;
  // `op` e `desvio` carregam mnemônico do ISA, que já é o nome canônico.
  const traduzido =
    sinal.valores[valor] ?? (campo === "op" || campo === "desvio" ? valor : undefined);
  if (traduzido === undefined) return undefined;
  return sinal.nome === "" ? traduzido : `${sinal.nome}=${traduzido}`;
}
