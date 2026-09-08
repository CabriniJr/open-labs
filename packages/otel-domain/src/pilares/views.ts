import type { View } from "@ovh/depth-ui";

/**
 * A vista do lab dos três pilares.
 *
 * O desenho **carrega o argumento**, e ele é geométrico: uma fonte, um serviço,
 * e três caixas do mesmo tamanho na mesma coluna. O mesmo tamanho não é
 * estética — é a afirmação de que ninguém é o principal e de que os três veem a
 * mesma coisa. E como o serviço tem uma entrada e três saídas, o trapézio dele
 * **abre**: a forma diz "daqui saem três" antes de qualquer rótulo ser lido.
 *
 * Nenhuma view esconde nada aqui: as três caixas são folhas, e o que elas
 * guardam aparece **dentro delas**, linha a linha. É a profundidade deste lab —
 * o balde com a contagem ao lado é o descarte, desenhado.
 */
const COLUNA = { fonte: 20, servico: 250, gravador: 470 } as const;
const LARGURA = { fonte: 170, servico: 150, gravador: 400 } as const;
const ALTURA_DO_GRAVADOR = 185;
const ESPACO = 20;

export const VIEW_PILARES: View = {
  id: "otel-three-pillars",
  focus: "process",
  title: "The same requests, three recorders",
  width: 900,
  height: 640,
  registro: "blocos",
  places: [
    { id: "requests", x: COLUNA.fonte, y: 250, w: LARGURA.fonte, h: 110 },
    { id: "service", x: COLUNA.servico, y: 265, w: LARGURA.servico, h: 80 },
    {
      id: "trace-store",
      x: COLUNA.gravador,
      y: 20,
      w: LARGURA.gravador,
      h: ALTURA_DO_GRAVADOR,
    },
    {
      id: "metric-store",
      x: COLUNA.gravador,
      y: 20 + ALTURA_DO_GRAVADOR + ESPACO,
      w: LARGURA.gravador,
      h: ALTURA_DO_GRAVADOR,
    },
    {
      id: "log-store",
      x: COLUNA.gravador,
      y: 20 + (ALTURA_DO_GRAVADOR + ESPACO) * 2,
      w: LARGURA.gravador,
      h: ALTURA_DO_GRAVADOR,
    },
  ],
};

export const VIEWS_DOS_PILARES: readonly View[] = [VIEW_PILARES];
