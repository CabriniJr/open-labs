// Quem volta ao telecentro: as regressões da entrega de Data Science, no navegador.
export {
  ajustarPreprocessador,
  analisar,
  BINARIAS,
  CATEGORICAS,
  dividir,
  ErroDoModelo,
  metricasDeClassificacao,
  metricasDeRegressao,
  NUMERICAS,
  preparar,
  regressaoLinear,
  regressaoLogistica,
  resolver,
  retornoPorCaminhada,
  VARIAVEIS_DA_LINEAR,
  VARIAVEIS_DA_LOGISTICA,
} from "./retorno/modelo.js";
export type { Analise, Base, Divisao, Matriz, MetricasDeClassificacao, MetricasDeRegressao, Modelo, Partes, Referencia, Sessao, Variavel } from "./retorno/modelo.js";

/** A base (120 KB) carrega à parte: o site só baixa quando o lab abre. */
export async function carregarBase(): Promise<import("./retorno/modelo.js").Base> {
  const m = await import("./retorno/dados.json");
  return m.default as unknown as import("./retorno/modelo.js").Base;
}
export { filmeDoRetorno } from "./retorno/filme.js";
export type { DetalheDoRetorno } from "./retorno/filme.js";
