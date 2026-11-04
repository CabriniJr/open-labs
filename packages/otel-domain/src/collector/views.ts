import type { View } from "@ovh/depth-ui";

/**
 * A vista do lab do Collector, e o desenho é o argumento.
 *
 * **Duas fileiras saindo do mesmo nó.** O receiver tem uma porta de saída e
 * dela partem duas linhas, uma para cada pipeline — e as fileiras seguem
 * paralelas, sem se tocar, até dois destinos diferentes. Um leitor que olhe
 * isso por três segundos já sabe que um processor da fileira de cima não
 * alcança a de baixo, antes de qualquer rótulo ser lido.
 *
 * **O descarte fica embaixo, no meio, e recebe das duas.** É o único nó que as
 * duas fileiras compartilham, e isso é verdade do Collector: a perda é contada
 * num lugar só (`otelcol_processor_*`), venha ela de limite de memória ou de
 * filtro declarado. Pôr um contador em cada fileira deixaria o desenho mais
 * simétrico e ensinaria errado.
 *
 * O `app` fica fora, à esquerda, e na altura do meio: ele não é parte do
 * Collector e não sabe quantas pipelines existem — que é o começo da tese.
 */
const FILEIRA_ALTA = 44;
const FILEIRA_BAIXA = 188;
const LINHA_DO_DESCARTE = 330;
const ALTURA = 86;
const LARGURA = 128;
const PASSO = 152;
const X_PIPELINE = 320;

export const VIEW_COLLECTOR: View = {
  id: "otel-collector-pipeline",
  focus: "collector",
  title: "One receiver, two pipelines, one copy each",
  width: 1000,
  height: 450,
  registro: "blocos",
  places: [
    { id: "app", x: 24, y: (FILEIRA_ALTA + FILEIRA_BAIXA) / 2, w: LARGURA, h: ALTURA },
    { id: "receiver", x: 176, y: (FILEIRA_ALTA + FILEIRA_BAIXA) / 2, w: LARGURA, h: ALTURA },

    // pipeline: traces — a de cima, que o backend lê
    { id: "limiter", x: X_PIPELINE, y: FILEIRA_ALTA, w: LARGURA, h: ALTURA },
    { id: "lote", x: X_PIPELINE + PASSO, y: FILEIRA_ALTA, w: LARGURA, h: ALTURA },
    { id: "exportador", x: X_PIPELINE + 2 * PASSO, y: FILEIRA_ALTA, w: LARGURA, h: ALTURA },
    { id: "backend", x: X_PIPELINE + 3 * PASSO, y: FILEIRA_ALTA, w: LARGURA + 20, h: ALTURA },

    // pipeline: traces/audit — a de baixo, que ninguém estava olhando
    { id: "filtro", x: X_PIPELINE, y: FILEIRA_BAIXA, w: LARGURA, h: ALTURA },
    { id: "depuracao", x: X_PIPELINE + PASSO, y: FILEIRA_BAIXA, w: LARGURA, h: ALTURA },
    { id: "console", x: X_PIPELINE + 2 * PASSO, y: FILEIRA_BAIXA, w: LARGURA + 20, h: ALTURA },

    // o que as duas perdem, contado num lugar só
    {
      id: "descartes",
      x: X_PIPELINE,
      y: LINHA_DO_DESCARTE,
      w: LARGURA + PASSO,
      h: ALTURA - 8,
    },
  ],
};

export const VIEWS_DO_COLLECTOR: readonly View[] = [VIEW_COLLECTOR];
