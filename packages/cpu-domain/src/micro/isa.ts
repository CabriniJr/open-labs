/**
 * O conjunto de instruções do microprocessador genérico.
 *
 * Genérico é literal: os códigos `86`, `8B` e `B7` são os do deck de Prof.
 * Filippo Valiante Filho, e foram escolhidos por ele **sem** corresponder a
 * nenhum chip. O 8085 real aparece só no último artigo, como ponte. Manter a
 * separação é o que faz a máquina poder ser mínima.
 *
 * Este arquivo é o único lugar que sabe qual byte é qual instrução. O montador
 * escreve por aqui e o caminho de dados lê por aqui — com duas tabelas, um erro
 * de codificação apareceria como erro de execução, no lugar errado.
 */

/** Os três do deck, mais os três que o deck não tem e sem os quais não há laço. */
export type Mnemonico =
  | "load" // AC <- valor            (deck)
  | "add" // AC <- AC + valor       (deck)
  | "store" // (end) <- AC            (deck)
  | "loadm" // AC <- (end)            extensão
  | "jmp" // PC <- end              extensão
  | "jz"; // PC <- end, se Z        extensão

/**
 * Os dois formatos do slide 15, e nenhum terceiro.
 *
 * - **1**, valores: opcode + valor. Dois bytes.
 * - **2**, endereços: opcode + parte alta + parte baixa. Três bytes.
 */
export type Formato = 1 | 2;

export const OPCODES: Readonly<Record<Mnemonico, number>> = {
  load: 0x86,
  add: 0x8b,
  store: 0xb7,
  // Livres, e arbitrários como os do deck. A única regra é não colidir, e há
  // teste cobrando a tabela inteira por injetividade.
  loadm: 0xa6,
  jmp: 0xc3,
  jz: 0xcb,
};

export const FORMATO: Readonly<Record<Mnemonico, Formato>> = {
  load: 1,
  add: 1,
  store: 2,
  loadm: 2,
  jmp: 2,
  jz: 2,
};

export const tamanhoEmBytes = (m: Mnemonico): number => (FORMATO[m] === 1 ? 2 : 3);

const PORBYTE: ReadonlyMap<number, Mnemonico> = new Map(
  (Object.entries(OPCODES) as readonly [Mnemonico, number][]).map(([m, b]) => [b, m]),
);

/** O byte de volta. Indefinido quando o byte não é instrução — e é assim que a
 *  máquina para em vez de executar lixo como se fosse programa. */
export const decodificar = (byte: number): Mnemonico | undefined => PORBYTE.get(byte);

/** O endereço onde o programa começa e onde os dados começam, como no deck. */
export const INICIO_PROGRAMA = 0x0000;
export const INICIO_DADOS = 0x2000;
