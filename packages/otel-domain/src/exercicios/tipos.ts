/**
 * O formato de um exercício agora mora em `@ovh/handbook-format`.
 *
 * Ele nasceu aqui, e saiu no dia em que um segundo domínio quis exercícios: o
 * tipo é domínio-neutro — caminho de arquivo, marcador, pergunta, explicações —
 * e deixá-lo aqui obrigaria o segundo domínio a importar o primeiro ou a manter
 * uma cópia. O que ele descreve, inclusive a razão de o código certo NÃO estar
 * no formato, está documentado lá.
 *
 * Este arquivo continua existindo para os onze exercícios deste pacote não
 * precisarem todos aprender o caminho novo de uma vez.
 */
export type { DefinicaoDeExercicio, Distrator } from "@ovh/handbook-format";
