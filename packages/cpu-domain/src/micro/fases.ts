/**
 * O ciclo de instrução, como tempo.
 *
 * É o que o caminho de dados de ciclo único do RISC-V **não** tem: lá uma
 * instrução inteira cabe num tick, e busca, decodificação e execução existem só
 * como profundidade da acomodação. Aqui cada micro-passo é um instante, e é por
 * isso que a figura anda.
 *
 * Puro e sem motor de propósito. Dá para conferir a sequência inteira sem
 * construir mundo nenhum — o que é o que um professor faz ao ler.
 *
 * As fases seguem o slide 19: cálculo de endereço de instrução, busca de
 * instrução, decodificação, cálculo de endereço do operando, busca do operando,
 * execução, cálculo de endereço do resultado, armazenamento. Nem toda instrução
 * passa por todas — e não passar é justamente o que distingue os formatos.
 */
import type { Mnemonico } from "./isa.js";
import { FORMATO } from "./isa.js";

export type Fase =
  // comum a toda instrução: o ciclo de busca
  | "end-instrucao" // MAR <- PC
  | "busca-instrucao" // READ
  | "decodifica" // IR <- MBR, PC++
  // formato 1: o operando é o valor
  | "end-operando"
  | "busca-operando"
  | "executa-valor"
  // formato 2: dois bytes de endereço
  | "end-alto"
  | "busca-alto"
  | "guarda-alto"
  | "end-baixo"
  | "busca-baixo"
  | "guarda-baixo"
  // formato 2, execução: ou acessa a memória de dados, ou desvia
  | "end-dado"
  | "acesso-dado"
  | "desvia";

/**
 * Uma ordem é uma linha de controle acionada.
 *
 * Estão escritas como transferência (`origem -> destino`) porque é isso que uma
 * linha de controle faz numa máquina multiciclo: ela abre um caminho por um
 * instante. Metade do diagrama do slide 9 é vermelha, e esta lista é ela.
 */
export type Ordem =
  | "mar<-pc"
  | "ler"
  | "escrever"
  | "mbr->ir"
  | "pc++"
  | "mbr->ac"
  | "mbr->t"
  | "somar"
  | "mbr->h"
  | "mbr->l"
  | "mar<-hl"
  | "mbr<-ac"
  | "pc<-hl";

export const PRIMEIRA_FASE: Fase = "end-instrucao";

/**
 * A próxima fase.
 *
 * `m` é a instrução que está **no IR** — indefinida até `decodifica` acontecer,
 * e é por isso que só as fases depois dela a consultam. Uma máquina que
 * escolhesse o caminho antes de decodificar estaria adivinhando.
 */
export function proximaFase(fase: Fase, m: Mnemonico | undefined, _zero: boolean): Fase {
  switch (fase) {
    case "end-instrucao":
      return "busca-instrucao";
    case "busca-instrucao":
      return "decodifica";
    case "decodifica":
      if (m === undefined) return "end-instrucao";
      return FORMATO[m] === 1 ? "end-operando" : "end-alto";

    case "end-operando":
      return "busca-operando";
    case "busca-operando":
      return "executa-valor";
    case "executa-valor":
      return "end-instrucao";

    case "end-alto":
      return "busca-alto";
    case "busca-alto":
      return "guarda-alto";
    case "guarda-alto":
      return "end-baixo";
    case "end-baixo":
      return "busca-baixo";
    case "busca-baixo":
      return "guarda-baixo";
    case "guarda-baixo":
      // O desvio não toca a memória de dados: ele já tem o endereço, e o
      // endereço **é** o resultado. Store e loadm ainda precisam de uma
      // transação de barramento.
      return m === "jmp" || m === "jz" ? "desvia" : "end-dado";

    case "end-dado":
      return "acesso-dado";
    case "acesso-dado":
    case "desvia":
      return "end-instrucao";
  }
}

/**
 * O que está aceso nesta fase.
 *
 * `zero` é o bit Z do registrador de status, e ele entra em um lugar só: o
 * desvio condicional. Um desvio que não se toma **gasta o mesmo tempo** — as
 * fases são as mesmas —, e é o que a máquina de verdade faz.
 */
export function ordensDe(
  fase: Fase,
  m: Mnemonico | undefined,
  zero: boolean,
): readonly Ordem[] {
  switch (fase) {
    case "end-instrucao":
    case "end-operando":
    case "end-alto":
    case "end-baixo":
      return ["mar<-pc"];

    case "busca-instrucao":
    case "busca-operando":
    case "busca-alto":
    case "busca-baixo":
      return ["ler"];

    case "decodifica":
      return ["mbr->ir", "pc++"];

    case "executa-valor":
      // A diferença entre carregar e somar cabe em duas linhas de controle, e
      // é exatamente o que o slide 43 mostra: LOAD leva o byte ao acumulador,
      // ADD o deposita no temporário e manda a ULA agir.
      return m === "add" ? ["mbr->t", "somar", "pc++"] : ["mbr->ac", "pc++"];

    case "guarda-alto":
      return ["mbr->h", "pc++"];
    case "guarda-baixo":
      return ["mbr->l", "pc++"];

    case "end-dado":
      return ["mar<-hl"];

    case "acesso-dado":
      return m === "store" ? ["mbr<-ac", "escrever"] : ["ler", "mbr->ac"];

    case "desvia":
      // Tomar ou não tomar é a única coisa que o bit Z decide nesta máquina.
      if (m === "jmp") return ["pc<-hl"];
      return zero ? ["pc<-hl"] : [];
  }
}
