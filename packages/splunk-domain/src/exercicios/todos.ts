import type { DefinicaoDeExercicio } from "@ovh/handbook-format";
import { EXERCICIOS_DA_INGESTAO } from "./ingestao.js";

/**
 * Todos os conjuntos de exercícios, num módulo que **não** puxa o motor.
 *
 * Existe pela mesma razão mecânica do barril do `otel-domain`, e vale repetir
 * porque ela não é óbvia: o índice deste pacote importa `ingestao.mmd?raw`, que
 * é recurso do Vite. Quem compila com Vite — o site, o Vitest — resolve isso
 * sozinho; o transpilador do Playwright não, e um `import * as dominio` num
 * `.spec.ts` morre apontando para o front-matter do mmd.
 *
 * Então o e2e importa **isto**, que é só definição de exercício.
 */
export const CONJUNTOS_DE_EXERCICIOS: Readonly<
  Record<string, readonly DefinicaoDeExercicio[]>
> = {
  EXERCICIOS_DA_INGESTAO,
};

/**
 * Quantos exercícios cada lab tem, derivado dos conjuntos.
 *
 * A conta existe também em `@ovh/handbook-format`, e **não** é importada de lá
 * de propósito: o índice daquele pacote exporta o leitor de manifesto, que
 * importa `node:fs`. Este módulo entra no pacote do navegador pelo índice do
 * domínio, e um `import` de valor para lá leva `node:fs` junto — o `astro
 * build` quebra, e a mensagem fala de `existsSync` dentro do Rollup, bem longe
 * daqui. O tipo pode vir de lá porque tipo não sobrevive à compilação.
 */
export function exerciciosPorLab(): ReadonlyMap<string, number> {
  const porLab = new Map<string, number>();
  for (const lista of Object.values(CONJUNTOS_DE_EXERCICIOS)) {
    for (const e of lista) porLab.set(e.lab, (porLab.get(e.lab) ?? 0) + 1);
  }
  return porLab;
}
