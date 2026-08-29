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
  no: "node",
  vdd: "Vdd",
  gnd: "GND",
} as const;
