/**
 * Backpressure no Collector: onde os spans esperam quando o backend cai, e onde
 * eles morrem.
 *
 * Um redutor por tick, sem relógio próprio. Cada tick chega um lote do SDK. O
 * `memory_limiter` olha a memória antes de aceitar; o exporter põe o lote na
 * `sending_queue` e tenta mandar. Com o backend fora, cada tentativa falha e o
 * lote volta para a fila com espera crescente (1, 2, 4… ticks), até estourar
 * `max_elapsed_time`. Quatro lugares onde um span morre, e cada um tem um
 * contador:
 *
 * - **recusado na borda** — o `memory_limiter` disse não; o SDK recebe o erro;
 * - **fila cheia** — a `sending_queue` não tinha lugar para o lote novo;
 * - **retry esgotado** — o lote esperou mais que `max_elapsed_time`;
 * - **perdido no crash** — sem limiter, a memória passou do teto, o processo
 *   morreu e levou a fila inteira com ele.
 *
 * A unidade é o lote (10 spans). A memória do processo é o que está na fila.
 *
 * Fontes: [memory_limiter](https://github.com/open-telemetry/opentelemetry-collector/tree/main/processor/memorylimiterprocessor)
 * e [exporterhelper · sending_queue e retry_on_failure](https://github.com/open-telemetry/opentelemetry-collector/blob/main/exporter/exporterhelper/README.md).
 */

export const SPANS_POR_LOTE = 10;
/** A memória que o processo aguenta, em lotes. Passou disso, sem limiter, ele morre. */
export const MEMORIA_MAXIMA = 8;
/** Onde o `memory_limiter` começa a recusar: 75% do teto. */
export const LIMITE_DO_LIMITER = 6;
/** Quantos lotes o exporter manda por tick com o backend no ar. */
export const VAZAO = 2;
/** `max_elapsed_time`, em ticks: depois disso desde a primeira falha, o lote é descartado. */
export const TEMPO_MAXIMO_DE_RETRY = 7;

export interface OpcoesDaPressao {
  /** `sending_queue.queue_size`, em lotes. */
  readonly fila: number;
  /** O `memory_limiter` está no pipeline. */
  readonly limiter: boolean;
}

export const OPCOES_DA_PRESSAO: OpcoesDaPressao = { fila: 4, limiter: true };

/** Quando o backend está fora: de `QUEDA[0]` (inclusive) a `QUEDA[1]` (exclusive). */
export const QUEDA: readonly [number, number] = [4, 16];
export const TICKS_DA_VITRINE = 24;

export interface LoteNaFila {
  readonly id: number;
  readonly tentativas: number;
  /** Tick da primeira falha; `null` se nunca falhou. */
  readonly primeiraFalha: number | null;
  /** Antes deste tick o lote não é tentado de novo (o backoff). */
  readonly proximaTentativa: number;
}

export interface Contadores {
  readonly entregues: number;
  readonly recusados: number;
  readonly filaCheia: number;
  readonly retryEsgotado: number;
  readonly perdidosNoCrash: number;
}

export interface EstadoDaPressao {
  readonly t: number;
  readonly fila: readonly LoteNaFila[];
  readonly contadores: Contadores;
  readonly proximoId: number;
  /** O processo caiu neste tick (e volta vazio no próximo). */
  readonly caiu: boolean;
  /** O que aconteceu com o lote que chegou neste tick. */
  readonly chegada: "aceito" | "recusado" | "fila-cheia" | "crash";
  /** Lotes entregues e descartados por retry neste tick. */
  readonly entreguesAgora: number;
  readonly esgotadosAgora: number;
}

const ZERO: Contadores = { entregues: 0, recusados: 0, filaCheia: 0, retryEsgotado: 0, perdidosNoCrash: 0 };

export function novaPressao(): EstadoDaPressao {
  return { t: 0, fila: [], contadores: ZERO, proximoId: 1, caiu: false, chegada: "aceito", entreguesAgora: 0, esgotadosAgora: 0 };
}

export function backendNoAr(t: number, queda: readonly [number, number] = QUEDA): boolean {
  return t < queda[0] || t >= queda[1];
}

/** Um tick: chega um lote, o exporter tenta mandar o que está na hora. */
export function tick(e: EstadoDaPressao, opcoes: OpcoesDaPressao, noAr: boolean): EstadoDaPressao {
  const t = e.t;
  let fila = [...e.fila];
  let c = { ...e.contadores };
  let chegada: EstadoDaPressao["chegada"] = "aceito";
  let caiu = false;

  // 1. A chegada: o limiter decide antes da fila.
  if (opcoes.limiter && fila.length + 1 > LIMITE_DO_LIMITER) {
    chegada = "recusado";
    c = { ...c, recusados: c.recusados + 1 };
  } else if (fila.length >= opcoes.fila) {
    chegada = "fila-cheia";
    c = { ...c, filaCheia: c.filaCheia + 1 };
  } else if (fila.length + 1 > MEMORIA_MAXIMA) {
    // Sem limiter, nada impede a memória de passar do teto: o processo morre.
    chegada = "crash";
    caiu = true;
    c = { ...c, perdidosNoCrash: c.perdidosNoCrash + fila.length + 1 };
    fila = [];
  } else {
    fila.push({ id: e.proximoId, tentativas: 0, primeiraFalha: null, proximaTentativa: t });
  }

  // 2. O exporter: os que estão na hora, até a vazão.
  let entreguesAgora = 0;
  let esgotadosAgora = 0;
  if (!caiu) {
    const restante: LoteNaFila[] = [];
    let tentados = 0;
    for (const lote of fila) {
      if (lote.proximaTentativa > t || tentados >= VAZAO) {
        restante.push(lote);
        continue;
      }
      tentados += 1;
      if (noAr) {
        entreguesAgora += 1;
        continue;
      }
      const primeira = lote.primeiraFalha ?? t;
      if (t - primeira >= TEMPO_MAXIMO_DE_RETRY) {
        esgotadosAgora += 1;
        continue;
      }
      const tentativas = lote.tentativas + 1;
      restante.push({ ...lote, tentativas, primeiraFalha: primeira, proximaTentativa: t + 2 ** (tentativas - 1) });
    }
    fila = restante;
    c = { ...c, entregues: c.entregues + entreguesAgora, retryEsgotado: c.retryEsgotado + esgotadosAgora };
  }

  return { t: t + 1, fila, contadores: c, proximoId: e.proximoId + 1, caiu, chegada, entreguesAgora, esgotadosAgora };
}

/** A corrida do showcase: `TICKS_DA_VITRINE` ticks, com o backend fora durante `QUEDA`. */
export function rodarPressao(opcoes: OpcoesDaPressao = OPCOES_DA_PRESSAO): EstadoDaPressao[] {
  const estados: EstadoDaPressao[] = [];
  let e = novaPressao();
  for (let i = 0; i < TICKS_DA_VITRINE; i += 1) {
    e = tick(e, opcoes, backendNoAr(e.t));
    estados.push(e);
  }
  return estados;
}

export const totalDeLotes = (c: Contadores) => c.entregues + c.recusados + c.filaCheia + c.retryEsgotado + c.perdidosNoCrash;
