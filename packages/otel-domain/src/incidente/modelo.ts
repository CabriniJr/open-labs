import { idHex } from "../anatomia/carga.js";

/**
 * O custo de um sinal sem contexto: quantas requisições um log de erro aponta,
 * quando o único elo é o horário.
 *
 * Um gerador de tráfego determinístico: `rps` requisições por segundo, cada uma
 * com uma duração entre 40 e 900 ms. Uma delas falha, e o log de erro sai com o
 * horário em segundos — como a maioria dos logs que alguém lê às três da manhã.
 * Quem só tem o horário precisa olhar toda requisição ativa naquele segundo;
 * quem tem `trace_id` no log abre uma.
 *
 * O relógio do MTTR é um modelo, e a premissa está escrita: um tempo fixo para
 * detectar e abrir o log, e um tempo fixo para descartar cada candidato. Não é
 * um número da indústria — é a aritmética que mostra que o custo cresce com o
 * tráfego, e não com a gravidade do erro.
 */

export interface RequisicaoDoIncidente {
  readonly n: number;
  readonly traceId: string;
  /** Em ms desde o início da janela. */
  readonly inicio: number;
  readonly fim: number;
  readonly erro: boolean;
}

export interface OpcoesDoIncidente {
  readonly rps: number;
  /** O log de erro carrega `trace_id`. */
  readonly contexto: boolean;
}

export const OPCOES_DO_INCIDENTE: OpcoesDoIncidente = { rps: 20, contexto: false };

/** A janela gerada, em segundos: a falha cai no meio. */
export const JANELA_S = 4;
/** O segundo do log de erro. */
export const SEGUNDO_DO_ERRO = 2;

/** As premissas do relógio, em minutos. */
export const MINUTOS_PARA_DETECTAR = 4;
export const MINUTOS_POR_CANDIDATO = 1.5;

/** Um número pseudoaleatório em [0,1), determinístico pela semente. */
function aleatorio(semente: number): number {
  let x = (semente + 0x6d2b79f5) | 0;
  x = Math.imul(x ^ (x >>> 15), x | 1);
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
}

export function trafego(rps: number): RequisicaoDoIncidente[] {
  const total = Math.max(1, Math.round(rps * JANELA_S));
  const intervalo = 1000 / Math.max(1, rps);
  // A que falha: a primeira que começa no segundo do erro, perto do meio dele.
  const alvo = Math.floor(SEGUNDO_DO_ERRO * rps + rps / 2);
  return Array.from({ length: total }, (_, i) => {
    const inicio = Math.round(i * intervalo + aleatorio(i) * intervalo);
    const duracao = 40 + Math.round(aleatorio(i + 7919) * 860);
    return { n: i + 1, traceId: idHex(32, `incidente:${rps}:${i}`), inicio, fim: inicio + duracao, erro: i === alvo };
  });
}

export interface Busca {
  readonly modo: "horario" | "trace_id";
  readonly candidatos: readonly RequisicaoDoIncidente[];
  readonly minutos: number;
}

export interface Incidente {
  readonly requisicoes: readonly RequisicaoDoIncidente[];
  readonly falha: RequisicaoDoIncidente;
  /** O que o log de erro diz: o segundo, e o `trace_id` quando há contexto. */
  readonly log: { readonly segundo: number; readonly traceId?: string };
  readonly busca: Busca;
}

/** Quem estava ativo em algum momento daquele segundo. */
export function ativasNoSegundo(reqs: readonly RequisicaoDoIncidente[], segundo: number): RequisicaoDoIncidente[] {
  const a = segundo * 1000;
  const b = a + 1000;
  return reqs.filter((r) => r.inicio < b && r.fim > a);
}

export function investigar(opcoes: OpcoesDoIncidente = OPCOES_DO_INCIDENTE): Incidente {
  const requisicoes = trafego(opcoes.rps);
  const falha = requisicoes.find((r) => r.erro)!;
  const segundo = Math.floor(falha.fim / 1000);
  const log = opcoes.contexto ? { segundo, traceId: falha.traceId } : { segundo };
  const candidatos = opcoes.contexto ? [falha] : ativasNoSegundo(requisicoes, segundo);
  return {
    requisicoes,
    falha,
    log,
    busca: { modo: opcoes.contexto ? "trace_id" : "horario", candidatos, minutos: MINUTOS_PARA_DETECTAR + candidatos.length * MINUTOS_POR_CANDIDATO },
  };
}
