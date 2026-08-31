/**
 * Nível de detalhe: quanto do interior de uma caixa está visível.
 *
 * A pergunta que decide não é "em que nível o leitor está", é **"esta caixa
 * ocupa quanto do quadro?"**. Duas consequências, e as duas são o ponto:
 *
 * - dois blocos do mesmo desenho podem estar em estados de detalhe diferentes
 *   ao mesmo tempo, porque um está perto e o outro está longe;
 * - a conta não depende do tamanho do monitor, e por isso é testável.
 *
 * A rampa entre os dois limiares é o que faz a descida ser contínua em vez de
 * um corte: é no meio dela que os dois níveis coexistem, e é aí que o leitor
 * vê que um é o dentro do outro.
 */

/** Onde o interior começa a aparecer, como fração da largura do quadro. */
export const LIMIAR_ENTRA = 0.24;

/** Onde ele já está inteiro. */
export const LIMIAR_CHEIO = 0.5;

/** Até onde a câmera aproxima. Além disto o desenho é um pixel esticado. */
export const ZOOM_MAXIMO = 40;

/** Fundo do aninhamento: mais que isto por quadro é sopa, não é leitura. */
export const PROFUNDIDADE_MAXIMA = 3;

/**
 * Quanto do quadro uma caixa ocupa — pelo lado que **aperta**.
 *
 * Só a largura não serve, e o barramento é a prova: uma esteira de 610 por 26
 * ocupa metade da largura do quadro e três por cento da altura dele. Pela
 * largura, o interior dela apareceria quase inteiro; na tela, três vias
 * espremidas em vinte e seis unidades são um borrão. O mesmo vale ao contrário
 * para uma caixa alta e estreita.
 *
 * Pelo lado que aperta, a conta responde à pergunta que importa — "cabe ler o
 * que tem aí dentro?" — e continua não dependendo do tamanho do monitor.
 */
export function fracaoDoQuadro(
  caixa: { readonly w: number; readonly h: number },
  quadro: { readonly largura: number; readonly altura: number },
): number {
  return Math.min(caixa.w / quadro.largura, caixa.h / quadro.altura);
}

export function quantoAparece(fracaoDoQuadro: number): number {
  // NaN é "não deu para medir" — a caixa ainda não foi desenhada, e o honesto
  // é não mostrar interior. Infinito é o caso oposto e cai na regra normal.
  if (Number.isNaN(fracaoDoQuadro) || fracaoDoQuadro <= LIMIAR_ENTRA) return 0;
  if (fracaoDoQuadro >= LIMIAR_CHEIO) return 1;
  return (fracaoDoQuadro - LIMIAR_ENTRA) / (LIMIAR_CHEIO - LIMIAR_ENTRA);
}

/**
 * A escala que encaixa uma view dentro de uma caixa, e a folga que sobra.
 *
 * Uniforme, pelo lado que aperta. Esticar o interior para preencher a caixa
 * distorceria o esquemático — e num esquemático a proporção **é** informação:
 * uma rede em paralelo desenhada esticada deixa de parecer paralela.
 */
export function encaixar(
  caixa: { readonly w: number; readonly h: number },
  moldura: { readonly width: number; readonly height: number },
): { readonly escala: number; readonly dx: number; readonly dy: number } {
  const escala = Math.min(caixa.w / moldura.width, caixa.h / moldura.height);
  return {
    escala,
    dx: (caixa.w - moldura.width * escala) / 2,
    dy: (caixa.h - moldura.height * escala) / 2,
  };
}

/** Altura de uma linha de tabela, nas unidades do desenho. */
export const ALTURA_DA_LINHA = 13;

/**
 * Fração do quadro que uma linha precisa ocupar para ser lida.
 *
 * Uma tabela não segue o mesmo limiar do interior de um contêiner, e a razão é
 * o que ela é: o interior é um desenho inteiro — de longe vira borrão, e por
 * isso só aparece quando a caixa já domina o quadro. Uma linha é **uma linha de
 * texto**, e texto é legível muito antes disso. Cobrar o limiar do interior
 * aqui mantinha a caixa lisa exatamente na vista em que se quer ver o que ela
 * guarda: a de cima, onde a memória é uma caixa entre outras.
 */
export const FRACAO_LEGIVEL = 0.009;

export function tabelaLegivel(unidadesPorQuadro: number): boolean {
  return ALTURA_DA_LINHA / unidadesPorQuadro >= FRACAO_LEGIVEL;
}
