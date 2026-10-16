import { EXERCICIOS_DA_ANATOMIA } from "./anatomia.js";
import { EXERCICIOS_DO_COLLECTOR } from "./collector.js";
import { EXERCICIOS_DOS_PILARES } from "./pilares.js";
import { EXERCICIOS_DOS_PROVEDORES } from "./providers.js";
import type { DefinicaoDeExercicio } from "./tipos.js";

/**
 * Todos os conjuntos de exercícios, num módulo que **não** puxa o motor.
 *
 * Existe por uma razão mecânica e vale a pena dizê-la, porque ela não é
 * óbvia: o índice do `otel-domain` importa `anatomy.mmd?raw`, que é recurso
 * do Vite. Quem compila com Vite — o site, o Vitest — resolve isso sozinho;
 * o transpilador do Playwright não, e um `import * as dominio from
 * "@ovh/otel-domain"` num `.spec.ts` morre em `Invalid left-hand side`
 * apontando para o front-matter do mmd.
 *
 * Então o e2e importa **isto**, que é só definição de exercício: nenhum
 * `WorldSpec`, nenhum `.mmd`, nenhum comportamento.
 *
 * O preço é um lugar a mais para lembrar, e a guarda está em
 * `exercicios.test.ts`: ela cobra que este barril e o índice do pacote
 * exponham exatamente os mesmos conjuntos. Um conjunto novo que entre só num
 * dos dois faz o teste cair nomeando-o.
 */
export const CONJUNTOS_DE_EXERCICIOS: Readonly<
  Record<string, readonly DefinicaoDeExercicio[]>
> = {
  EXERCICIOS_DA_ANATOMIA,
  EXERCICIOS_DO_COLLECTOR,
  EXERCICIOS_DOS_PILARES,
  EXERCICIOS_DOS_PROVEDORES,
};

/**
 * Quantos exercícios cada lab tem, derivado dos conjuntos.
 *
 * O e2e usa isto para cobrar que a página do lab mostre o que o domínio
 * declara, sem número escrito no teste.
 */
export function exerciciosPorLab(): ReadonlyMap<string, number> {
  const porLab = new Map<string, number>();
  for (const lista of Object.values(CONJUNTOS_DE_EXERCICIOS)) {
    for (const e of lista) porLab.set(e.lab, (porLab.get(e.lab) ?? 0) + 1);
  }
  return porLab;
}
