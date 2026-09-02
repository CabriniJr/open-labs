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

/**
 * O expoente da curva da tinta.
 *
 * Menor que 1 de propósito: é o que faz a tinta subir depressa no começo da
 * rampa. Com 1 a curva é a reta de hoje, e a reta é o que produz o platô de
 * fantasma — a caixa passa metade da descida desenhando um interior que existe
 * e não se lê. O número foi escolhido para satisfazer a legibilidade cobrada em
 * `TINTA_LEGIVEL`, e é o teste que o segura, não o gosto.
 */
export const EXPOENTE_DA_TINTA = 0.45;

/** Onde o interior deixa de ser fantasma e passa a ser desenho. */
export const TINTA_LEGIVEL = 0.4;

/**
 * De quanto do interior aparece para quanta tinta ele recebe.
 *
 * `quantoAparece` é medida — responde "quanto do quadro esta caixa ocupa" — e
 * não muda. Esta função é **desenho**: ela decide com que força aquela medida
 * chega ao papel. Separar as duas é o que permite melhorar a leitura sem
 * mexer no instrumento, que é o erro de ajustar a régua para o gráfico ficar
 * bonito.
 *
 * Contínua nas duas pontas, e por isso não é um piso: sai de zero em zero.
 */
export function tintaDoInterior(aparece: number): number {
  const a = Math.max(0, Math.min(1, aparece));
  return a ** EXPOENTE_DA_TINTA;
}

/** O traço e o preenchimento de uma caixa que está deixando de estar fechada. */
export interface NotacaoDeFechada {
  /** O `stroke-dasharray`, já pronto para ir ao SVG. */
  readonly tracejado: string;
  /** O `fill-opacity`: 1 é a caixa de hoje, 0 é contorno e nada mais. */
  readonly preenchimento: number;
}

/**
 * A caixa fechada virando moldura, continuamente.
 *
 * O defeito que isto conserta: `aparece` comandava a opacidade do interior e a
 * borda era pintada por um booleano. Metade da ligação andava numa grandeza
 * contínua e a outra metade era um interruptor — então a moldura anunciava
 * "fechada" com o interior aberto e desenhado dentro dela.
 *
 * O fim da rampa não é um estado novo: **contorno e nada mais** é a definição
 * da `moldura`, que o palco já desenha para o objeto enquadrado. A caixa não
 * vira outra coisa; ela chega onde já estava escrito que se chega.
 *
 * O vão do tracejado encolhendo até zero é o que dá continuidade sem degrau:
 * `8 4` (fechada) → `48 0`, e vão zero **é** linha contínua.
 */
export function notacaoDeFechada(aparece: number): NotacaoDeFechada {
  const a = Math.max(0, Math.min(1, aparece));
  // Duas casas bastam para o traço e evitam despejar `21.320000000000004` no
  // atributo: o SVG aceita, e quem inspeciona o desenho lê ruído.
  const duasCasas = (n: number): string => String(Math.round(n * 100) / 100);
  return {
    tracejado: `${duasCasas(8 + 40 * a)} ${duasCasas(4 - 4 * a)}`,
    preenchimento: 1 - a,
  };
}

/**
 * O ponto da rampa em que o interior passa a ser legível.
 *
 * É `TINTA_LEGIVEL` lido de trás para frente pela curva, e não um segundo
 * número escolhido à parte: dois números independentes dizendo a mesma coisa é
 * como duas listas de labs escritas à mão divergem.
 */
export const PONTO_LEGIVEL = TINTA_LEGIVEL ** (1 / EXPOENTE_DA_TINTA);

/**
 * O rosto da caixa — o título e o `more inside` — cedendo lugar ao interior.
 *
 * Ele tem de chegar a zero **antes** de o interior ficar legível, e não depois.
 * A regra de hoje (`1 - aparece * 2`) o mantinha na tela até o interior estar
 * com 73% de tinta: a caixa prometia "tem mais aqui dentro" por cima do dentro
 * já desenhado, que é a tela contradizendo a si mesma.
 */
export function opacidadeDoRosto(aparece: number): number {
  const a = Math.max(0, Math.min(1, aparece));
  return Math.max(0, 1 - a / PONTO_LEGIVEL);
}
