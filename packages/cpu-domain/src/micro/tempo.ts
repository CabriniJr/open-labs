/**
 * A tabela de tempo — o slide 43 como vista.
 *
 * Ela é a segunda projeção do mesmo run, e a razão de existir é essa: o deck
 * tem duas granularidades (os quadros da animação e a tabela do resumo) e nós
 * temos que ter as duas **a partir de um livro-caixa só**. Se a tabela tivesse
 * contabilidade própria, provaríamos o contrário do que o projeto afirma.
 *
 * Uma linha por transação de barramento. O que aparece numa linha é o que
 * aquela transação fez acontecer: o byte que passou pelo barramento de dados, e
 * os registradores que foram escritos por causa dele.
 *
 * Coluna que não foi escrita fica **vazia**, como no deck. Repetir o valor
 * anterior encheria a tabela de transferências que não aconteceram.
 */
import type { WorldState } from "@ovh/depth-core";
import { estadoDe } from "./datapath.js";
import { ordensDe } from "./fases.js";
import type { Ordem } from "./fases.js";
import { FORMATO, decodificar } from "./isa.js";

export type Acesso = "init" | "read" | "write";

export interface LinhaDeTempo {
  readonly acesso: Acesso;
  readonly endereco?: number;
  readonly dado?: number;
  readonly pc?: number;
  readonly ir?: number;
  readonly ac?: number;
  readonly t?: number;
  readonly h?: number;
  readonly l?: number;
  /** Preenchida só na linha em que uma instrução começa. */
  readonly instrucao?: string;
}

type Coluna = "pc" | "ir" | "ac" | "t" | "h" | "l";
type Mutavel = { -readonly [K in keyof LinhaDeTempo]: LinhaDeTempo[K] };

/**
 * Qual ordem escreve em qual coluna.
 *
 * É por aqui, e não por comparar valores antes e depois, que a linha se
 * preenche — e a diferença aparece no slide 43: o segundo `ADD` recarrega o IR
 * com `8B`, que é o byte que já estava lá. Uma tabela feita de diferenças
 * mostraria a célula vazia e afirmaria que o IR não foi escrito naquele ciclo,
 * quando ele foi. Uma transferência que acontece e não aparece é a mentira
 * silenciosa em forma de coluna.
 *
 * `somar` escreve no acumulador porque é para lá que a resposta da ULA vai: a
 * ordem que acende o somador é a mesma que muda o AC.
 */
const ESCRITA_EM: readonly (readonly [Ordem, Coluna])[] = [
  ["pc++", "pc"],
  ["pc<-hl", "pc"],
  ["mbr->ir", "ir"],
  ["mbr->ac", "ac"],
  ["somar", "ac"],
  ["mbr->t", "t"],
  ["mbr->h", "h"],
  ["mbr->l", "l"],
];

/**
 * As ordens que estiveram acesas em cada tick, reconstruídas de `fases.ts`.
 *
 * Reconstruídas, e não guardadas: quem sabe o que uma fase acende é a máquina
 * de fases, e perguntar a ela é o oposto de manter uma segunda contabilidade. A
 * UC decide com o IR e o bit Z do flanco anterior — daí a fase vir do tick `i`
 * e o mnemônico do tick `i - 1`.
 *
 * Tick sem micro-passo devolve lista vazia. A fase nunca sucede a si mesma
 * (veja `proximaFase`), então fase repetida só acontece com a máquina parada —
 * e uma máquina parada não acende linha nenhuma. O tick 0 fica de fora porque
 * nele nada rodou ainda.
 */
function ordensPorTick(estados: readonly WorldState[]): readonly (readonly Ordem[])[] {
  return estados.map((estado, i) => {
    if (i === 0) return [];
    const agora = estadoDe(estado);
    const antes = estadoDe(estados[i - 1]!);
    if (i > 1 && agora.fase === antes.fase) return [];
    return ordensDe(agora.fase, decodificar(antes.ir), antes.zero);
  });
}

export function tabelaDeTempo(estados: readonly WorldState[]): readonly LinhaDeTempo[] {
  if (estados.length === 0) return [];

  const linhas: LinhaDeTempo[] = [{ acesso: "init", pc: estadoDe(estados[0]!).pc }];
  const ordens = ordensPorTick(estados);

  // Uma transação é um tick em que a linha de leitura ou a de escrita está
  // acesa. É a definição física, e não uma lista de fases: se `fases.ts` mudar
  // qual fase acessa a memória, a tabela acompanha sozinha.
  const inicios: number[] = [];
  for (let i = 1; i < estados.length; i += 1) {
    const noTick = ordens[i]!;
    if (noTick.includes("ler") || noTick.includes("escrever")) inicios.push(i);
  }

  inicios.forEach((inicio, k) => {
    // A linha cobre a transação e tudo o que veio dela até a próxima transação:
    // é onde o byte lido acaba de chegar ao registrador que o pediu. Nada de
    // micro-passo caindo entre duas linhas — se caísse, a tabela esconderia
    // trabalho que a máquina fez.
    const proxima = inicios[k + 1] ?? estados.length;
    let fim = inicio;
    for (let i = inicio + 1; i < proxima && ordens[i]!.length > 0; i += 1) fim = i;

    const noBarramento = estadoDe(estados[inicio]!);
    const depois = estadoDe(estados[fim]!);
    const daTransacao = new Set<Ordem>(ordens.slice(inicio, fim + 1).flat());

    const linha: Mutavel = {
      acesso: daTransacao.has("escrever") ? "write" : "read",
      endereco: noBarramento.mar,
      // O que o MBR segura no fim do tick da transação **é** o que passou pelo
      // barramento de dados: o byte que a memória devolveu, na leitura, ou o
      // que saiu do acumulador, na escrita. Ler daqui é o que mantém a coluna
      // certa mesmo com a gravação síncrona, que só se compromete uma borda
      // depois — o valor da linha é o do instante da ordem, não o da borda.
      dado: noBarramento.mbr,
    };
    for (const [ordem, coluna] of ESCRITA_EM) {
      if (daTransacao.has(ordem)) linha[coluna] = depois[coluna];
    }
    linhas.push(linha);
  });

  return comInstrucoes(linhas);
}

const hex = (n: number, casas: number): string =>
  n.toString(16).toUpperCase().padStart(casas, "0");

/**
 * A coluna da direita: onde cada instrução começa.
 *
 * Começa onde o IR foi escrito, e o texto sai de `decodificar(ir)` mais os
 * bytes de operando que as linhas seguintes trouxeram — é por isso que ele
 * **não** é uma segunda lista escrita à mão. Uma lista à mão diverge; esta não
 * tem como.
 *
 * Byte que não decodifica em instrução nenhuma não ganha texto: é assim que o
 * fim do programa aparece na tabela como o que ele é, uma leitura que não virou
 * instrução.
 *
 * `linhas` pode ser um run inteiro (como no oráculo) ou um run ainda em
 * andamento (como no lab, tick a tick): a tabela cresce ao vivo, e a linha do
 * opcode chega antes das linhas do operando existirem. Até elas chegarem, o
 * operando não é conhecido — e "0000" no lugar dele seria exatamente a
 * mentira silenciosa que este arquivo inteiro existe para não contar. Melhor
 * a coluna ficar vazia mais um instante do que confiante e errada.
 */
function comInstrucoes(linhas: readonly LinhaDeTempo[]): readonly LinhaDeTempo[] {
  return linhas.map((linha, i) => {
    if (linha.ir === undefined) return linha;
    const m = decodificar(linha.ir);
    if (m === undefined) return linha;
    const bytes = (FORMATO[m] === 1 ? [linhas[i + 1]] : [linhas[i + 1], linhas[i + 2]]).map(
      (l) => l?.dado,
    );
    if (bytes.some((d) => d === undefined)) return linha;
    const operando =
      FORMATO[m] === 1
        ? hex(bytes[0]!, 2)
        : hex((bytes[0]! << 8) | bytes[1]!, 4);
    return { ...linha, instrucao: `${m.toUpperCase()} ${operando}` };
  });
}
