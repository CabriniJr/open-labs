const PALAVRAS_POR_MINUTO = 200;
/** Ler código é mais lento que ler prosa, e blocos longos são consultados, não lidos. */
const PALAVRAS_POR_MINUTO_CODIGO = 80;

export interface ReadingTime {
  readonly minutes: number;
  readonly words: number;
}

/**
 * A conta é nossa, e não de uma biblioteca, porque estes documentos têm muito
 * bloco de código: contar código como prosa infla o número, e o leitor perde a
 * confiança na estimativa na primeira vez que percebe.
 */
export function readingTime(markdown: string): ReadingTime {
  const blocos = markdown.match(/```[\s\S]*?```/g) ?? [];
  const prosa = markdown.replace(/```[\s\S]*?```/g, " ");

  // A cerca não é palavra: `` ```ts `` viraria uma "palavra" por bloco, e a
  // linguagem declarada não é texto que alguém lê.
  const conta = (t: string): number =>
    t
      .replace(/```[a-zA-Z0-9+-]*/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 0).length;

  const palavrasProsa = conta(prosa);
  const palavrasCodigo = blocos.reduce((n, b) => n + conta(b), 0);

  const minutos =
    palavrasProsa / PALAVRAS_POR_MINUTO + palavrasCodigo / PALAVRAS_POR_MINUTO_CODIGO;

  return {
    // Nunca zero: "0 min de leitura" diz ao leitor que a página está vazia.
    minutes: Math.max(1, Math.round(minutos)),
    words: palavrasProsa + palavrasCodigo,
  };
}
