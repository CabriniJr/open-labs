import type { View } from "@ovh/depth-ui";

/**
 * A vista dos baldes: uma escada, e ela desce da esquerda para a direita.
 *
 * Os quatro estados ficam na mesma linha porque a sequência é a lição — um
 * balde não escolhe para onde vai, ele envelhece. E o congelado fica fora do
 * alinhamento das três caixas de disco, um pouco abaixo: ele não é um quarto
 * nível de armazenamento, é a saída. Essa diferença de posição é o que o
 * desenho tem a dizer que a palavra "frozen" esconde.
 */
const LINHA = 96;
const ALTURA = 96;
const LARGURA = 158;

export const VIEW_BALDES: View = {
  id: "splunk-buckets",
  focus: "baldes",
  title: "An index ageing, bucket by bucket",
  width: 1000,
  height: 300,
  registro: "blocos",
  places: [
    { id: "eventos", x: 16, y: LINHA, w: LARGURA, h: ALTURA },
    { id: "quente", x: 206, y: LINHA, w: LARGURA, h: ALTURA },
    { id: "morno", x: 396, y: LINHA, w: LARGURA, h: ALTURA },
    { id: "frio", x: 586, y: LINHA, w: LARGURA, h: ALTURA },
    { id: "congelado", x: 790, y: LINHA + 48, w: LARGURA + 20, h: ALTURA },
  ],
};

export const VIEWS_DOS_BALDES: readonly View[] = [VIEW_BALDES];
