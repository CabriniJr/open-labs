// O banco de dados do OpenLabs num telecentro: esquema, dados, um motor que
// recusa o que o Oracle recusaria, as três consultas e o filme.
export { constraintsDe, nivelDe, nomeDaConstraint, semPrefixo, tabela, TABELAS } from "./telecentro/esquema.js";
export type { Coluna, Constraint, Estrangeira, NomeDaTabela, Tabela, TipoDeConstraint } from "./telecentro/esquema.js";
export { DADOS } from "./telecentro/dados.js";
export type { DadosDaTabela, Valor } from "./telecentro/dados.js";
export { avaliar } from "./telecentro/expressao.js";
export type { Logico } from "./telecentro/expressao.js";
export { apagar, bancoInicial, consulta1, consulta2, consulta3, ESQUEMA, inserir, juntar, lerTipo, linhasDe, proximoId } from "./telecentro/motor.js";
export type { Banco, CodigoOracle, Escrita, Juncao, Linha, Par, Recusa, Resultado } from "./telecentro/motor.js";
export { CONSULTA3_COM_INNER, CONSULTAS } from "./telecentro/consultas.js";
export type { Consulta } from "./telecentro/consultas.js";
export {
  ALTURA_DO_BANCO,
  alunaNova,
  CABECALHO,
  CAIXA_DO_APP,
  CAIXAS_DO_BANCO,
  CAPITULOS_DO_BANCO,
  escritaErrada,
  filmeDoBanco,
  GRUPO,
  inverter,
  LARGURA_DO_BANCO,
  LIGACOES_DO_BANCO,
  LINHA,
  OPCOES_DO_BANCO,
  REGIOES_DO_BANCO,
  sqlDoInsert,
  TOM_DA_FICHA,
  TOM_DO_GRUPO,
  yDaColuna,
} from "./telecentro/filme.js";
export type { CapituloDoBanco, DetalheDoBanco, ErroDoFilme, GrupoDeTabela, LigacaoDoBanco, OpcoesDoBanco, ResultadoNoPainel } from "./telecentro/filme.js";
export { CONCEITOS, MAL_ENTENDIDOS_DO_BANCO, SOBRE_A_COLUNA, SOBRE_A_CONSULTA, SOBRE_A_TABELA } from "./telecentro/labels.js";
export type { Conceito, IdDoConceito, MalEntendidoDeBanco } from "./telecentro/labels.js";
export { ICONE_APP, ICONES_BANCO } from "./icones.js";
export { EXPLICACAO_DO_ERRO, linhaValida, TENTATIVAS_ERRADAS } from "./telecentro/simulacao.js";
export type { Tentativa } from "./telecentro/simulacao.js";
export { CONFERIR_TABELAS, conferirConstraints, conferirLinhas, conferirRelacionamentos, provasDasRegras, resultadosDoDql, saidaDoDdl, saidaDoDml } from "./telecentro/oracle.js";
export type { Conferencia, ProvaDaRegra, ResultadoDaConsulta } from "./telecentro/oracle.js";
