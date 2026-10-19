export {
  ArtigoSchema,
  CorSchema,
  FaseSchema,
  FonteSchema,
  IdSchema,
  ItemSchema,
  MantenedorSchema,
  ReferenciaSchema,
  STATUS,
  TemaSchema,
  CORPO_COMUM,
} from "./schema.js";
export type { Artigo, Fase, Fonte, Item, Mantenedor, Referencia, Tema } from "./schema.js";

export {
  ManifestoV1Schema,
  VERSAO_ATUAL,
  VERSOES_EM_ARQUIVO,
  VERSOES_SUPORTADAS,
  lerDocumento,
  recusaDeVersao,
} from "./versoes.js";
export type {
  EstadoDaVersao,
  HandbookNormalizado,
  ItemNormalizado,
  LeituraDoManifesto,
  ManifestoV1,
  TemaNormalizado,
  VersaoDoContrato,
} from "./versoes.js";

export { conferirArquivosDeArtigo, conferirHandbook, relatoDeProblemas } from "./conferir.js";

export {
  NOME_DO_MANIFESTO,
  PASTA_DE_SUBMISSOES,
  carregarSubmissoes,
  lerManifesto,
  lerSubmissao,
  lerSubmissoes,
} from "./ler.js";
export type { LeituraDeSubmissao } from "./ler.js";
export {
  conferirExercicios,
  DistratorSchema,
  exerciciosPorLab,
  ExercicioSchema,
} from "./exercicio.js";
export type { DefinicaoDeExercicio, Distrator } from "./exercicio.js";
