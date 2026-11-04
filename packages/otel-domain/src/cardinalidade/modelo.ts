/**
 * Cardinalidade e a conta — e este lab **não usa o motor**, de propósito.
 *
 * A régua da §9 do `DECISIONS.md` tem duas perguntas, nesta ordem. A primeira:
 * é um fluxo com camadas de abstração e lógica? **Não.** Cardinalidade não é
 * fluxo nenhum: é o tamanho de um produto cartesiano, e não há nada atravessando
 * nada. Então a resposta da régua é lab separado, enxuto, mais perto do PhET do
 * que do Factorio — e isso significa sem árvore de composição, sem palco, sem
 * `kinds`.
 *
 * O que ela **não** dispensa é o resto: pergunta concreta, resposta derivada do
 * estado e não de texto, o mal-entendido que ela desfaz, e teste que cai quando
 * o lab para de ensinar o que promete. A ADR é explícita que o critério de
 * qualidade não cai no segundo caso.
 *
 * ---
 *
 * **O que este módulo afirma, e de onde vem.**
 *
 * 1. **Uma série é identificada pelo conjunto de atributos.** Então o número de
 *    séries de uma métrica é o **produto** das contagens de valores distintos
 *    dos atributos dela — não a soma, e não o número de atributos. É daqui que
 *    sai a frase do lab: um atributo não é uma coluna a mais, é uma
 *    multiplicação.
 * 2. **Um histograma custa mais pontos por série que um contador.** Ele publica
 *    um ponto por balde, mais a soma e a contagem.
 * 3. **O limite de cardinalidade tampa o número e destrói a quebra.** Nada se
 *    perde e nada é contado duas vezes: o excedente vai para uma série de
 *    overflow. O que se perde é a pergunta "por qual valor?".
 *
 * **O que ele NÃO afirma: preço.** Cada fornecedor cobra por unidade diferente,
 * e inventar um número aqui seria exatamente o defeito que a ADR chama de mais
 * caro do projeto — um lab desenhado à mão afirmando o que nenhum modelo
 * sustenta. Então o módulo calcula **volume** (pontos por minuto), que é
 * mecânico, e o preço é um campo que o leitor preenche com a fatura dele.
 */

export interface Atributo {
  readonly id: string;
  /** O nome como ele aparece na convenção semântica, quando há uma. */
  readonly nome: string;
  /**
   * Quantos valores distintos ele assume **em produção**, e não em teoria.
   *
   * É o número que decide tudo, e é o número que todo mundo subestima: um
   * `http.route` tem as rotas que o serviço atende; um `customer.id` tem os
   * clientes que existem.
   */
  readonly valores: number;
  /** Por que alguém quer este atributo. Escrito para quem quer. */
  readonly porque: string;
  readonly fonte: string;
  /** Faz parte da métrica da convenção semântica: tirar é sair do padrão. */
  readonly daConvencao?: true;
}

export type TipoDeMetrica = "counter" | "gauge" | "histogram";

export interface Conta {
  /** O produto das contagens: quantas séries os atributos escolhidos geram. */
  readonly series: number;
  /** As que de fato existem depois do limite. */
  readonly seriesEfetivas: number;
  /**
   * Conjuntos de atributos que perderam a série própria e caíram no overflow.
   * Zero quando o limite não foi alcançado.
   */
  readonly semQuebra: number;
  readonly estourouOLimite: boolean;
  /** Pontos de dado por série, por exportação. */
  readonly pontosPorSerie: number;
  /** O volume: pontos de dado por minuto. É o que fornecedor costuma cobrar. */
  readonly pontosPorMinuto: number;
}

/**
 * Pontos de dado que uma série publica por exportação.
 *
 * Contador e medidor publicam **um**: um número. Histograma publica um por
 * balde, mais a soma e a contagem — e é por isso que ele é o instrumento caro,
 * antes de qualquer atributo entrar na conversa.
 *
 * O `+2` é soma e contagem, as duas que a spec exige de um histograma. Um
 * histograma sem elas não responde "qual a média", que é a primeira pergunta
 * que alguém faz dele.
 */
export function pontosPorSerie(tipo: TipoDeMetrica, baldes: number): number {
  if (tipo === "histogram") return Math.max(1, Math.trunc(baldes)) + 2;
  return 1;
}

/**
 * A conta inteira, e ela é uma multiplicação.
 *
 * `limite` é o `cardinality_limit` do SDK. A leitura do excedente é a MESMA do
 * lab dos três pilares (`pilares/world.ts`): até `limite` conjuntos distintos
 * ganham série própria, e o que passa disso cai no overflow. Dois labs
 * discordando sobre a mesma spec seria pior que um lab faltando.
 */
export function calcular(
  escolhidos: readonly Atributo[],
  tipo: TipoDeMetrica,
  baldes: number,
  exportacoesPorMinuto: number,
  limite: number,
): Conta {
  // Produto vazio é 1, e isso não é um caso de borda: uma métrica sem atributo
  // nenhum tem UMA série. É a conta certa, e é o piso de tudo.
  const series = escolhidos.reduce((total, a) => total * Math.max(1, a.valores), 1);
  const teto = Math.max(1, Math.trunc(limite));
  const seriesEfetivas = Math.min(series, teto);
  const pontos = pontosPorSerie(tipo, baldes);

  return {
    series,
    seriesEfetivas,
    semQuebra: series - seriesEfetivas,
    estourouOLimite: series > teto,
    pontosPorSerie: pontos,
    pontosPorMinuto: seriesEfetivas * pontos * Math.max(0, exportacoesPorMinuto),
  };
}

/**
 * O que um atributo custa **a mais** se entrar — e a resposta é a conta inteira
 * vezes os valores dele, não mais um.
 *
 * Existe como função própria porque é a pergunta que o leitor faz de verdade:
 * não "quantas séries eu tenho", e sim "se eu adicionar este, quanto piora".
 */
export function fatorDeEntrada(atributo: Atributo): number {
  return Math.max(1, atributo.valores);
}
