/**
 * A forma de uma métrica: o que o SDK guarda entre duas coletas, e o que cada
 * ponto exportado afirma.
 *
 * Um redutor puro, sem relógio próprio: quem chama diz a hora. Três verbos:
 * `registrar` (uma medição entra no agregador), `coletar` (o MetricReader pede,
 * e sai um ponto) e `reiniciar` (o processo morre e volta, e a memória vai
 * junto). O filme do showcase e a simulação usam os mesmos três.
 *
 * O assunto é a temporalidade, e só ela:
 * - **cumulative** — o ponto diz "desde `inicio`, tantas"; `inicio` é a partida
 *   do processo e só muda quando ele reinicia. Ler a taxa é subtrair o ponto
 *   anterior, e isso só vale se os dois têm o mesmo `inicio`.
 * - **delta** — o ponto diz "desde a última coleta, tantas"; o agregador zera a
 *   cada coleta. Cada ponto se lê sozinho.
 *
 * Nos dois casos, o que foi medido e ainda não coletado quando o processo cai
 * se perde: estava só na memória.
 *
 * Fontes: [Metrics data model · Temporality](https://opentelemetry.io/docs/specs/otel/metrics/data-model/#temporality),
 * [Sums: resets and gaps](https://opentelemetry.io/docs/specs/otel/metrics/data-model/#resets-and-gaps)
 * e [Explicit bucket histogram](https://opentelemetry.io/docs/specs/otel/metrics/sdk/#explicit-bucket-histogram-aggregation).
 */

export type Temporalidade = "cumulative" | "delta";

/**
 * Os limites dos baldes, em ms. Um balde `i` guarda `(limite[i-1], limite[i]]`
 * — o limite de cima é inclusivo, como na spec — e o último vai até o infinito.
 * Os padrões da spec são mais finos; quatro limites bastam para ler.
 */
export const LIMITES_DOS_BALDES = [25, 50, 100, 250] as const;

export const ROTULOS_DOS_BALDES = ["≤25", "≤50", "≤100", "≤250", ">250"] as const;

export function baldeDe(valorMs: number): number {
  const i = LIMITES_DOS_BALDES.findIndex((l) => valorMs <= l);
  return i === -1 ? LIMITES_DOS_BALDES.length : i;
}

export interface Agregador {
  readonly temporalidade: Temporalidade;
  /** Quando o processo começou — a partida, ou o último reinício. */
  readonly partida: number;
  /** De quando conta o que está guardado: a partida (cumulative) ou a última coleta (delta). */
  readonly desde: number;
  readonly contagem: number;
  readonly soma: number;
  readonly baldes: readonly number[];
}

/** O que o exportador manda: um ponto de Sum e o ponto de Histogram que vão juntos. */
export interface PontoExportado {
  readonly temporalidade: Temporalidade;
  /** `StartTimeUnixNano`, em ms. */
  readonly inicio: number;
  /** `TimeUnixNano`, em ms. */
  readonly fim: number;
  readonly contagem: number;
  readonly soma: number;
  readonly baldes: readonly number[];
}

const vazios = (): number[] => Array.from({ length: LIMITES_DOS_BALDES.length + 1 }, () => 0);

export function novoAgregador(temporalidade: Temporalidade, agora = 0): Agregador {
  return { temporalidade, partida: agora, desde: agora, contagem: 0, soma: 0, baldes: vazios() };
}

export function registrar(a: Agregador, valorMs: number): Agregador {
  const baldes = [...a.baldes];
  baldes[baldeDe(valorMs)]! += 1;
  return { ...a, contagem: a.contagem + 1, soma: a.soma + valorMs, baldes };
}

export function coletar(a: Agregador, agora: number): { readonly agregador: Agregador; readonly ponto: PontoExportado } {
  const ponto: PontoExportado = { temporalidade: a.temporalidade, inicio: a.desde, fim: agora, contagem: a.contagem, soma: a.soma, baldes: a.baldes };
  // Delta esquece o que já mandou; cumulative guarda tudo desde a partida.
  const agregador = a.temporalidade === "delta" ? { ...a, desde: agora, contagem: 0, soma: 0, baldes: vazios() } : a;
  return { agregador, ponto };
}

/** O processo morre e volta: a memória do agregador não volta junto. */
export function reiniciar(a: Agregador, agora: number): Agregador {
  return novoAgregador(a.temporalidade, agora);
}

/**
 * Quantas requisições o backend conclui que houve em cada intervalo.
 *
 * Delta: o próprio ponto. Cumulative: o ponto menos o anterior — **se** o
 * anterior tem o mesmo `inicio`. Um backend que ignora o `inicio` (o
 * `respeitaInicio: false`) subtrai através de um reinício e lê um número
 * negativo de requisições: o erro clássico da série cumulativa.
 */
export function lerNoBackend(pontos: readonly PontoExportado[], { respeitaInicio }: { readonly respeitaInicio: boolean }): number[] {
  return pontos.map((p, i) => {
    if (p.temporalidade === "delta") return p.contagem;
    const anterior = pontos[i - 1];
    if (anterior === undefined) return p.contagem;
    if (respeitaInicio && anterior.inicio !== p.inicio) return p.contagem;
    return p.contagem - anterior.contagem;
  });
}

// ── O roteiro que o showcase conta ──

export type Evento =
  | { readonly t: number; readonly tipo: "medir"; readonly valor: number }
  | { readonly t: number; readonly tipo: "coletar" }
  | { readonly t: number; readonly tipo: "reiniciar" };

export const INTERVALO_MS = 10_000;

/** As medições de cada intervalo, em ms de latência. Fixas: a mesma história a cada visita. */
const MEDICOES: readonly (readonly number[])[] = [
  [42, 61, 18, 230, 95, 310],
  [37, 55, 120, 88, 140],
  [20, 48, 260, 33],
  [47, 59, 81, 12],
];

/** No intervalo 3, as duas primeiras medições acontecem antes da queda. */
const ANTES_DA_QUEDA = 2;

export interface OpcoesDaMetrica {
  readonly temporalidade: Temporalidade;
  /** O processo reinicia no meio do terceiro intervalo. */
  readonly reinicio: boolean;
}

export const OPCOES_DA_METRICA: OpcoesDaMetrica = { temporalidade: "cumulative", reinicio: false };

export function roteiro(opcoes: OpcoesDaMetrica): Evento[] {
  const eventos: Evento[] = [];
  MEDICOES.forEach((valores, k) => {
    const base = k * INTERVALO_MS;
    valores.forEach((valor, j) => {
      if (opcoes.reinicio && k === 2 && j === ANTES_DA_QUEDA) eventos.push({ t: base + 5000, tipo: "reiniciar" });
      eventos.push({ t: base + 800 + j * 1400 + (opcoes.reinicio && k === 2 && j >= ANTES_DA_QUEDA ? 3500 : 0), tipo: "medir", valor });
    });
    eventos.push({ t: base + INTERVALO_MS, tipo: "coletar" });
  });
  return eventos;
}

export interface Passo {
  readonly evento: Evento;
  /** O agregador depois do evento. */
  readonly agregador: Agregador;
  /** O ponto, quando o evento foi uma coleta. */
  readonly ponto?: PontoExportado;
  /** Medições que estavam na memória quando o processo caiu. */
  readonly perdidas?: number;
}

export interface Corrida {
  readonly passos: readonly Passo[];
  readonly pontos: readonly PontoExportado[];
  /** O que de fato aconteceu em cada intervalo — a verdade contra a qual o backend é medido. */
  readonly reais: readonly number[];
  readonly perdidas: number;
}

export function rodar(eventos: readonly Evento[], temporalidade: Temporalidade): Corrida {
  let a = novoAgregador(temporalidade, 0);
  const passos: Passo[] = [];
  const pontos: PontoExportado[] = [];
  const reais: number[] = [];
  let noIntervalo = 0;
  let perdidas = 0;
  for (const evento of eventos) {
    if (evento.tipo === "medir") {
      a = registrar(a, evento.valor);
      noIntervalo += 1;
      passos.push({ evento, agregador: a });
    } else if (evento.tipo === "coletar") {
      const r = coletar(a, evento.t);
      a = r.agregador;
      pontos.push(r.ponto);
      reais.push(noIntervalo);
      noIntervalo = 0;
      passos.push({ evento, agregador: a, ponto: r.ponto });
    } else {
      // O que não foi coletado desde a última coleta estava só na memória.
      const naMemoria = noIntervalo;
      perdidas += naMemoria;
      a = reiniciar(a, evento.t);
      passos.push({ evento, agregador: a, perdidas: naMemoria });
    }
  }
  return { passos, pontos, reais, perdidas };
}
