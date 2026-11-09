/**
 * Um gerador semeado (mulberry32). Tudo o que este handbook sorteia passa por
 * aqui: a mesma semente dá o mesmo vetor, a mesma corrida e o mesmo gráfico —
 * e é isso que deixa um teste dizer "com a semente 7, a bolha faz 1 204 trocas"
 * sem que o número mude amanhã.
 */
export function gerador(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Um inteiro em [min, max], do gerador. */
export const inteiroEntre = (r: () => number, min: number, max: number): number => min + Math.floor(r() * (max - min + 1));

/** Embaralha uma cópia (Fisher–Yates), com o gerador. */
export function embaralhado<T>(itens: readonly T[], r: () => number): T[] {
  const v = [...itens];
  for (let i = v.length - 1; i > 0; i -= 1) {
    const j = Math.floor(r() * (i + 1));
    [v[i], v[j]] = [v[j]!, v[i]!];
  }
  return v;
}
