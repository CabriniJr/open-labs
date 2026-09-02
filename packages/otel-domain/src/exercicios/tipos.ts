/**
 * A definição de um exercício.
 *
 * Note o que **não** está aqui: o código da resposta certa. Ele é extraído do
 * arquivo que roda, no build (`apps/site/src/lib/exercicios.ts`), e por isso não
 * existe como escrevê-lo errado nem como ele envelhecer em silêncio. O que é
 * autoral são os distratores e as explicações — explicação, não veredito.
 */
export interface Distrator {
  readonly id: string;
  /**
   * O código que vai na lacuna. Tem de ter a mesma forma do bloco certo — mesma
   * quantidade de linhas na mesma vizinhança —, senão a escolha se decide pelo
   * formato antes de se decidir pelo sentido.
   */
  readonly codigo: string;
  /** Por que isto PARECE certo, e o que a spec diz. Escrito para quem já acredita nele. */
  readonly porque: string;
  /** A âncora na spec. Obrigatória, como em `MAL_ENTENDIDOS`. */
  readonly fonte: string;
}

export interface DefinicaoDeExercicio {
  readonly id: string;
  /** O id do lab a que ele pertence, como no mapa. */
  readonly lab: string;
  /** A frase da aplicação: o que ela faz, o que já existe. Em inglês. */
  readonly cenario: string;
  /** O caminho, a partir da raiz do repo, do arquivo que roda. */
  readonly arquivo: string;
  /** O id do marcador `<handbook:trecho id="…">` dentro dele. */
  readonly trecho: string;
  /** A pergunta, em inglês. */
  readonly pergunta: string;
  /** Por que o bloco certo é o certo. */
  readonly porqueCerto: string;
  readonly fonteCerto: string;
  readonly distratores: readonly Distrator[];
}
