export { aplicar, avaliar, lerExpressao, rpnWorld } from "./rpn.js";
export type {
  ErroDeExpressao,
  EstadoFita,
  EstadoPilha,
  EstadoVisor,
  LeituraDaExpressao,
  Sinal,
  Token,
} from "./rpn.js";
export { leituraDaCarga } from "./carga.js";
export { conteudoDaCaixa } from "./conteudo.js";
export type { Linha } from "./conteudo.js";
export { ALGO_VIEWS, VIEW_MAQUINA } from "./views.js";
export { ROTULOS } from "./labels.js";

// O curso: custo, ordenação, grafos, caminhos e o guloso contra a tabela.
export { embaralhado, gerador, inteiroEntre } from "./semente.js";
export { ICONES_ALGO } from "./icones.js";
export { ALGORITMOS, aplicar as aplicarOperacao, CLASSES_DE_ORDENACAO, curvaDeOrdenacao, custo, entrada, ErroDeVetor, FICHAS, FORMATO_ROTULO, FORMATOS, instante, lerVetor, MAIOR_MEDIDO, MAIOR_NA_TELA, ordenar, podio } from "./ordenacao/ordenacao.js";
export type { Algoritmo, ClasseDeOrdenacao, Colocacao, Fase, FichaDoAlgoritmo, Formato, Instante, Operacao, Traco } from "./ordenacao/ordenacao.js";
export { buscaBinaria, buscaLinear, CLASSES, curva, duracao, FICHAS_DAS_CLASSES, lerPosicao, medir, somaDeSubconjunto, TAMANHOS, tempoEstimado } from "./crescimento/crescimento.js";
export type { Classe, FichaDaClasse, Medida } from "./crescimento/crescimento.js";
export { filmeDoCrescimento, linhasEm, NS_DO_FILME, TOM_DA_CLASSE } from "./crescimento/filme.js";
export type { DetalheDoCrescimento, LinhaDoCrescimento } from "./crescimento/filme.js";
export {
  adicionarAresta,
  adicionarNo,
  ALTURA_DO_GRAFO,
  comDirecao,
  componentes,
  ErroDeGrafo,
  EXEMPLOS,
  graus,
  LARGURA_DO_GRAFO,
  listaDeAdjacencia,
  MAIOR_GRAFO,
  matrizDeAdjacencia,
  oQueE,
  pesar,
  proximoRotulo,
  removerAresta,
  removerNo,
  temCiclo,
  temNo,
  vazio,
} from "./grafo/grafo.js";
export type { Aresta, Grafo, Graus, No, Vizinho } from "./grafo/grafo.js";
export { filmeDoGrafo } from "./grafo/filme.js";
export type { DetalheDoGrafo } from "./grafo/filme.js";
// O mapa de verdade: São Paulo, do OpenStreetMap. Os dados (260 KB) ficam em
// `mapa-real/dados.ts`, importado à parte para o site carregar só quando o lab abre.
export { cidadeDe, linhaReta, maisPerto, tempoEmTexto, tracado } from "./mapa-real/cidade.js";
export type { Cidade, DadosDaCidade, PontoDeInteresse } from "./mapa-real/cidade.js";
export { buscarNaCidade, BUSCAS_REAIS, CLASSES_DE_BUSCA, FICHAS_REAIS, trabalhoPorDistancia } from "./mapa-real/buscas.js";
export type { BuscaReal, ClasseDeBusca, FichaDaBuscaReal, PassoDaBusca, ResultadoReal } from "./mapa-real/buscas.js";
export { ErroDeTroco, guloso, lerMoedas, MAIOR_VALOR, MAIS_MOEDAS, menorContraexemplo, otimo, SISTEMAS, tabela } from "./troco/troco.js";
export type { PassoGuloso, SistemaDeMoedas, Tabela, Troco } from "./troco/troco.js";
export { filmeDoTroco, VALOR_DO_SISTEMA } from "./troco/filme.js";
export type { DetalheDoTroco } from "./troco/filme.js";

/** Carrega o mapa de São Paulo à parte (o site só baixa os 260 KB quando o lab abre). */
export async function carregarSaoPaulo(): Promise<import("./mapa-real/cidade.js").Cidade> {
  const m = await import("./mapa-real/dados.js");
  return m.saoPaulo();
}
