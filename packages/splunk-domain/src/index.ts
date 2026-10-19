export {
  aQuebraVale,
  BYTES_DA_LINHA,
  BYTES_DO_BLOCO,
  bytesDoRegistro,
  bytesNaFila,
  ingestaoWorld,
  LUGARES_DO_PROPS,
  ondeEstaOProps,
  PARAMS_DA_INGESTAO,
  quemParseia,
  SOURCETYPE,
} from "./ingestao/world.js";
export type {
  EstadoDaApp,
  EstadoDoIndexador,
  EstadoDoIndice,
  EstadoDoMeio,
  EstadoDoUf,
  EventoIndexado,
  LugarDoProps,
  Registro,
} from "./ingestao/world.js";
export { estadoDaIngestao, LEITOR_DA_CARGA, NOME_DA_MAQUINA } from "./ingestao/estado.js";
export type { EstadoDaIngestao } from "./ingestao/estado.js";
export { VIEWS_DA_INGESTAO, VIEW_INGESTAO } from "./ingestao/views.js";
export { MAL_ENTENDIDOS_DA_INGESTAO, ROTULOS_DA_INGESTAO } from "./ingestao/labels.js";
export type { MalEntendido } from "./ingestao/labels.js";
export { EXERCICIOS_DA_INGESTAO } from "./exercicios/ingestao.js";
export { CONJUNTOS_DE_EXERCICIOS, exerciciosPorLab } from "./exercicios/todos.js";
