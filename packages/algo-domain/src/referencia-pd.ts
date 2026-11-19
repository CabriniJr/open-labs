/**
 * O que os labs do handbook de algoritmos mostram, em números, para a entrega
 * de Programação Dinâmica da GS (`programacao-dinamica/`). O código Python da
 * entrega refaz as mesmas contas, e os testes de lá conferem contra este
 * arquivo: o que o aluno estuda em Python é o que ele vê no lab.
 *
 * Gerado para `programacao-dinamica/dados/referencia_openlabs.json` por
 * `programacao-dinamica/exportar_referencia.mjs`; `referencia-pd.test.ts`
 * falha se o arquivo ficar fora de dia.
 */
import { FICHAS_DAS_CLASSES, medir } from "./crescimento/crescimento.js";
import { saoPaulo } from "./mapa-real/dados.js";
import { CENARIOS, melhorOrdem } from "./mapa-real/paradas.js";
import { CENARIOS_DA_MOCHILA, chamadasComMemoria, chamadasSemMemoria, forcaBruta, gulosa, itensDoCenario, mochila, porQue } from "./mochila/mochila.js";
import { gerador } from "./semente.js";
import { VALOR_DO_SISTEMA } from "./troco/filme.js";
import { guloso, menorContraexemplo, otimo, SISTEMAS } from "./troco/troco.js";

export function referenciaDaEntregaDePD() {
  const ate = FICHAS_DAS_CLASSES.exponential.ate;
  const r = gerador(1);
  const vetor = Array.from({ length: ate }, () => 2 * (1 + Math.floor(r() * 50)));

  const troco = SISTEMAS.map((s) => {
    const valor = VALOR_DO_SISTEMA[s.id] ?? 6;
    const g = guloso(s.moedas, valor);
    const o = otimo(s.moedas, valor);
    return {
      id: s.id,
      moedas: s.moedas,
      valor,
      guloso: { moedas: g.moedas, passos: g.passos, sobra: g.sobra },
      otimo: { moedas: o.moedas, passos: o.passos },
      menor_contraexemplo: menorContraexemplo(s.moedas),
    };
  });

  const mochilaRef = CENARIOS_DA_MOCHILA.map((c) => {
    const itens = itensDoCenario(c);
    const m = mochila(itens, c.sessao);
    const g = gulosa(itens, c.sessao);
    const colunas = c.sessao / 5;
    const ultima = porQue(itens, m.T, itens.length, colunas);
    return {
      id: c.id,
      sessao: c.sessao,
      itens: itens.map((i) => i.id),
      tabela: m.T,
      pontos: m.pontos,
      minutos: m.minutos,
      escolhidos: m.escolhidos.map((k) => itens[k]!.id),
      celulas: m.celulas,
      gulosa: { pontos: g.pontos, minutos: g.minutos, escolhidos: g.escolhidos.map((k) => itens[k]!.id) },
      chamadas_sem_memoria: chamadasSemMemoria(itens, c.sessao),
      chamadas_com_memoria: chamadasComMemoria(itens, c.sessao),
      forca_bruta: forcaBruta(itens, c.sessao),
      por_que_ultima_celula: ultima,
    };
  });

  const cidade = saoPaulo();
  const caminho = CENARIOS.map((c) => {
    const pois = c.paradas.map((id) => cidade.pois.find((p) => p.id === id)!);
    const nos = pois.map((p) => p.no);
    const o = melhorOrdem(cidade, nos);
    return { id: c.id, paradas: c.paradas, nos, tempos_ds: o.tempos, melhor_ordem: o.ordem, tempo_total_ds: o.tempo };
  });

  return {
    fonte: "Gerado de packages/algo-domain (o código dos labs do handbook de algoritmos do OpenLabs) por exportar_referencia.mjs. Não edite à mão.",
    crescimento: { semente: 1, vetor, operacoes: Array.from({ length: ate }, (_, k) => medir("exponential", k + 1, 1)) },
    troco,
    mochila: mochilaRef,
    caminho,
  };
}
