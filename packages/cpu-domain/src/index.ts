export { assemble } from "./assembler.js";
export type { Assembled, AssembleResult, AssemblyError } from "./assembler.js";
export { decode, encode, FORMAS, signExtend } from "./isa.js";
export type { Format, Instruction, Mnemonic } from "./isa.js";
export { initialCpu, runCpu, stepCpu } from "./reference.js";
export type { CpuState } from "./reference.js";
export { cpuWorld, ENDERECO_ENTRADA, ENDERECO_SAIDA } from "./datapath.js";
export { LARGURA } from "./alu.js";
export type { EstadoBanco, EstadoMemoria, EstadoPc, EstadoSaida } from "./datapath.js";
export {
  CPU_VIEWS,
  VIEW_IMEM,
  VIEW_PROCESSADOR,
  VIEW_SISTEMA,
  VIEW_ULA,
  viewPortaCmos,
  viewSomador,
  viewSomadorDaUla,
  viewsDasPortas,
  viewsDoSomador,
} from "./views.js";
export { decide, porta, portasAltas, somadorCompleto, somadorWorld } from "./gates.js";
export { especieDaCarga, leituraDaCarga } from "./carga.js";
export { conteudoDaCaixa } from "./conteudo.js";
export { ABI, NOMES } from "./assembler.js";
export {
  chavesConduzindo,
  fiosDaPortaCmos,
  noDeSaida,
  portaCmos,
  portaCmosWorld,
  transistor,
  trilho,
} from "./transistors.js";
export type { Canal, PortaCmos } from "./transistors.js";
export type { PortaLogica } from "./gates.js";
export { DESCRICOES, ROTULOS_DA_FASE } from "./labels.js";

// O microprocessador genérico. Os tipos de estado repetem o nome dos do
// RISC-V — `EstadoRegistrador`, `EstadoStatus` — porque cada mundo os cunhou
// para a própria árvore; o alias aqui é só para os dois poderem sair do mesmo
// pacote sem um esconder o outro.
export { estadoDe as estadoDoMicro, microWorld } from "./micro/datapath.js";
export type {
  EstadoMemoria as EstadoMemoriaDoMicro,
  EstadoMicro,
  EstadoRegistrador as EstadoRegistradorDoMicro,
  EstadoStatus as EstadoStatusDoMicro,
  EstadoUc as EstadoUcDoMicro,
} from "./micro/datapath.js";
export { montarMicro } from "./micro/assembler.js";
export type { ErroDeMontagem, ResultadoDaMontagem } from "./micro/assembler.js";
export {
  decodificar,
  FORMATO,
  INICIO_DADOS,
  INICIO_PROGRAMA,
  OPCODES,
  tamanhoEmBytes,
} from "./micro/isa.js";
export type { Formato, Mnemonico as MnemonicoDoMicro } from "./micro/isa.js";
export { ordensDe, PRIMEIRA_FASE, proximaFase } from "./micro/fases.js";
export type { Fase, Ordem } from "./micro/fases.js";
export {
  MICRO_VIEWS,
  VIEW_MICRO_CPU,
  VIEW_MICRO_PROCESSADOR,
  VIEW_MICRO_SISTEMA,
} from "./micro/views.js";
