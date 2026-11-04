import type { View } from "@ovh/depth-ui";

/**
 * A vista da ingestão, e ela é uma linha reta de propósito.
 *
 * Os outros labs deste repositório abrem em leque porque a tese deles é sobre
 * escolha de caminho. Aqui não há escolha de caminho nenhuma: há uma esteira, e
 * a pergunta é **em que estação** o trabalho acontece. Desenhar isso como leque
 * sugeriria que o parsing pode acontecer em mais de um lugar, que é exatamente
 * a crença que o lab desmonta.
 *
 * As duas linhas entre o nível do meio e o indexador ficam separadas na
 * vertical, e isso é o resto do argumento: elas não são alternativas de rota,
 * são **naturezas diferentes de carga**. A de cima carrega bloco, a de baixo
 * carrega evento, e qual delas acende depende de uma única decisão de
 * topologia.
 */
const LINHA = 120;
const ALTURA = 92;
const LARGURA = 150;

export const VIEW_INGESTAO: View = {
  id: "splunk-ingest",
  focus: "ingestao",
  title: "Parsing happens once, on the first component that can",
  width: 1000,
  height: 300,
  registro: "blocos",
  places: [
    { id: "app", x: 16, y: LINHA, w: LARGURA, h: ALTURA },
    { id: "uf", x: 206, y: LINHA, w: LARGURA, h: ALTURA },
    { id: "meio", x: 396, y: LINHA, w: LARGURA, h: ALTURA },
    { id: "idx", x: 606, y: LINHA, w: LARGURA, h: ALTURA },
    { id: "indice", x: 816, y: LINHA - 8, w: LARGURA + 16, h: ALTURA + 16 },
  ],
};

export const VIEWS_DA_INGESTAO: readonly View[] = [VIEW_INGESTAO];
