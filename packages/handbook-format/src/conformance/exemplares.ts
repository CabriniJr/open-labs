import { readFileSync } from "node:fs";

/**
 * Um exemplar por versão suportada do contrato — e eles são o que torna o
 * suporte verificável.
 *
 * A regra de manutenção está escrita em `versoes.ts` e cobrada em
 * `versoes.test.ts`: **versão na lista tem exemplar, e o exemplar carrega.**
 * Quando a `v2` chegar, o exemplar da `v1` fica aqui sem mudar uma linha, e é
 * ele que acusa no dia em que alguém "limpar" o leitor dela.
 *
 * O exemplar da `v1` é o menor handbook que ainda é válido: uma fase, um
 * artigo, um tema inteiro. Mínimo de propósito — um exemplar grande mistura
 * "o contrato mudou" com "o conteúdo mudou", e é o contrato que está sob teste.
 */
export interface Exemplar {
  readonly apiVersion: string;
  /**
   * O arquivo, quando a versão se escreve em arquivo.
   *
   * `undefined` é o legado em TypeScript: ele não tem manifesto, e o exemplar
   * dele é o próprio objeto no catálogo do site — conferido lá, em
   * `handbooks.test.ts`, contra o manifesto que o substituiu.
   */
  readonly yaml?: string;
}

const aqui = new URL(".", import.meta.url);

const ler = (nome: string): string => readFileSync(new URL(nome, aqui), "utf8");

export const EXEMPLARES: readonly Exemplar[] = [
  { apiVersion: "openlabs/handbook/v1", yaml: ler("v1.handbook.yaml") },
  // O par de migração é exemplar da MESMA versão lido de outro ângulo: ele
  // prova que a tradução é fiel, e não só que o arquivo carrega. Ver
  // `migracao.test.ts`.
  { apiVersion: "typescript" },
];
