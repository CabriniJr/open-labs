/**
 * O relógio de uma camada — e por que ele não é o mesmo em todas.
 *
 * Uma dimensão **fraciona o tempo**. O que num nível é um instante, no nível de
 * baixo é uma sequência inteira: um passo do mundo de fora contém dezenas de
 * passos do de dentro, do mesmo jeito que um segundo humano contém a vida
 * inteira de um gesto de formiga. Não é metáfora — é o que o modelo diz, e é
 * por isso que o número de subpassos cresce ao abrir uma peça.
 *
 * Duas regras saem disso, e as duas estão implementadas aqui.
 *
 * **Cada camada divide o mesmo tick entre os eventos dela.** Quem tem mais
 * eventos os tem mais curtos. Isso mantém a promessa do tick: a sequência de
 * uma camada **sempre termina dentro dele**, e o leitor nunca vê metade de uma
 * acomodação. É o que faz o tick ser um tick.
 *
 * **A travessia dilata com a profundidade.** Um item desenhado dentro de uma
 * caixa está numa escala menor, e na mesma velocidade angular ele some antes de
 * o olho pegar. A dilatação é a lente: quanto mais fundo, mais devagar aquele
 * item atravessa a tela — que é exatamente o que se faz para observar um
 * processo rápido. O fator não é escolhido, vem da geometria: é o inverso da
 * escala com que aquele interior foi encaixado na caixa do pai.
 */

/**
 * Teto da dilatação.
 *
 * Sem ele, um interior encaixado a 2% da escala pediria cinquenta vezes mais
 * tempo, e a carga ficaria praticamente parada — que é tão ilegível quanto
 * rápida demais, e ainda por cima parece defeito.
 */
export const DILATACAO_MAXIMA = 8;

/** Piso da travessia, como fração do tick. É o que dá peso ao controle de compasso. */
export const PISO_DA_TRAVESSIA = 0.22;

/** Teto da travessia, como fração do tick, para a carga não pisar no tick seguinte. */
export const TETO_DA_TRAVESSIA = 0.92;

export interface Relogio {
  /** Quanto dura, na tela, um passo desta camada. */
  readonly etapaMs: number;
  /** Quanto tempo uma carga leva para atravessar o fio dela. */
  readonly travessiaMs: number;
}

/**
 * A dilatação de um interior, a partir da do pai e da escala do encaixe.
 *
 * Escala menor significa mais fundo, e mais fundo significa mais devagar.
 */
export function dilatarPara(dilatacaoDoPai: number, escalaDoEncaixe: number): number {
  if (!Number.isFinite(escalaDoEncaixe) || escalaDoEncaixe <= 0) return dilatacaoDoPai;
  return Math.min(DILATACAO_MAXIMA, dilatacaoDoPai / Math.min(1, escalaDoEncaixe));
}

export function relogioDaCamada(tickMs: number, etapas: number, dilatacao: number): Relogio {
  const passos = Math.max(1, etapas);
  const etapaMs = tickMs / passos;
  // A dilatação multiplica o relógio inteiro desta camada, e não só um pedaço
  // dele: é o mesmo processo visto mais de perto, não outro processo.
  const lente = Math.max(1, dilatacao);
  const base = Math.min(tickMs * TETO_DA_TRAVESSIA, Math.max(tickMs * PISO_DA_TRAVESSIA, etapaMs));
  return { etapaMs, travessiaMs: base * lente };
}
