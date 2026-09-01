import type { View } from "@ovh/depth-ui";

/**
 * As views do lab dos provedores.
 *
 * Uma view decide **onde** e **como**, nunca **o que existe**. O que existe vem
 * da árvore; `viewDisagreement` recusa qualquer view que tente inventar ou
 * esconder — esconder só vale declarando `collapsed`.
 *
 * Três regras fazem o trabalho pesado aqui, e o desenho **carrega parte do
 * argumento** em vez de ilustrá-lo:
 *
 * **R1 — Quem a placa toca é quem a possui.** A placa encosta na borda de quem
 * a declara. `resource-traces` na borda do `tracer-provider`; `propagators` na
 * borda do `process`, fora das três molduras. Não há legenda explicando posse:
 * a posse é a posição. É o que faz o mal-entendido do `service.name` cair sem
 * prosa.
 *
 * **R2 — Controle mora acima do dado, e nunca o cruza.** A faixa de dado é uma
 * horizontal; sequenciadores ficam numa faixa acima. A pergunta "por onde o
 * span passa?" se responde olhando uma faixa só.
 *
 * **R3 — Provider se compara por superposição, não por texto.** As três views
 * de provider compartilham `width`, `height`, o `y` das duas faixas e o `x` das
 * bordas. **O que muda é só o que está dentro.** Alternar entre elas é um diff
 * visual: no lugar onde traces e logs têm uma fila, métricas têm um banco; e a
 * flecha do gatilho aponta para o lado oposto, porque um empurra e o outro pede.
 * F4 é entregue pela geometria.
 */

/** A moldura compartilhada pelas três views de provider. R3 depende disto. */
const MOLDURA = { width: 1100, height: 360 } as const;

/**
 * As duas faixas, e o `x` das colunas. Números e não literais espalhados: R3 é
 * uma afirmação sobre coordenadas, e uma afirmação sobre coordenadas escrita
 * três vezes deixa de valer no dia em que alguém ajusta uma delas.
 */
export const FAIXA = { controle: 40, dado: 200 } as const;
const ALTURA = { controle: 70, dado: 120 } as const;
const COLUNA = { placa: 8, decide: 280, executa: 620 } as const;
const LARGURA = { placa: 200, decide: 220, executa: 440 } as const;

/** A borda onde as placas encostam. Menor que isto é "encostado" para o teste. */
export const MARGEM_DA_BORDA = 16;

export const VIEW_HOST: View = {
  id: "otel-host",
  focus: "host",
  title: "One machine, two programs",
  width: 900,
  height: 400,
  registro: "blocos",
  places: [
    // O processo fechado: o lab inteiro mora aqui dentro, e a vista de cima
    // existe para dizer que o Collector NÃO mora.
    { id: "process", x: 40, y: 60, w: 440, h: 280, collapsed: true },
    { id: "collector", x: 620, y: 140, w: 240, h: 120, badge: "opaque" },
  ],
};

export const VIEW_PROCESS: View = {
  id: "otel-process",
  focus: "process",
  title: "One process, three providers",
  width: 1200,
  height: 740,
  registro: "blocos",
  places: [
    // R1: os propagadores encostam na borda do PROCESSO, e ficam fora das três
    // molduras. A posição é a afirmação — contexto não é configuração de provider.
    { id: "propagators", x: 24, y: 6, w: 190, h: 40 },
    { id: "app", x: 24, y: 300, w: 190, h: 150 },
    // As três molduras têm o mesmo tamanho de propósito: a assimetria que
    // interessa é o que está dentro, e caixas de tamanhos diferentes sugeririam
    // que a diferença é de importância.
    //
    // A altura é escolhida contra o LOD, não por estética: abaixo de 24% do
    // quadro pelo lado que aperta, o interior não aparece, e o leitor não veria
    // a assimetria sem clicar. 220/740 = 0,297 — folga, e não empate.
    //
    // A folga entre as molduras é 16, e não 8, e o número não é gosto: o
    // roteador só desce pela borda quando o destino está mais de 8 abaixo do
    // fim da origem. Com folga de 8 exatos, a linha de controle entre o
    // tracer-provider e o logger-provider caía no caso "sobrepostos na
    // vertical" e contornava o desenho inteiro pela direita — uma barra
    // vermelha de ponta a ponta, que é como a linha mais importante do lab
    // estava sendo desenhada. Defeito que só a tela pega.
    { id: "tracer-provider", x: 250, y: 56, w: 920, h: 216, collapsed: true },
    { id: "logger-provider", x: 250, y: 288, w: 920, h: 216, collapsed: true },
    { id: "meter-provider", x: 250, y: 520, w: 920, h: 216, collapsed: true },
  ],
};

export const VIEW_TRACER_PROVIDER: View = {
  id: "otel-tracer-provider",
  focus: "tracer-provider",
  title: "Who decides whether a span ever leaves the process",
  ...MOLDURA,
  registro: "blocos",
  places: [
    { id: "resource-traces", x: COLUNA.placa, y: 60, w: LARGURA.placa, h: 70 },
    { id: "span-limits", x: COLUNA.placa, y: 150, w: LARGURA.placa, h: 60 },
    // R2: o flush mora na faixa de controle, acima. Ele desce para dois destinos
    // ao mesmo tempo, e essa imagem É o "MUST invocar em todos os processadores
    // registrados" da spec.
    { id: "trace-flush", x: COLUNA.executa, y: FAIXA.controle, w: LARGURA.executa, h: ALTURA.controle },
    { id: "sampler", x: COLUNA.decide, y: FAIXA.dado, w: LARGURA.decide, h: ALTURA.dado },
    { id: "span-processors", x: COLUNA.executa, y: FAIXA.dado, w: LARGURA.executa, h: ALTURA.dado, collapsed: true },
  ],
};

export const VIEW_LOGGER_PROVIDER: View = {
  id: "otel-logger-provider",
  focus: "logger-provider",
  title: "The same frame, and no sampler in it",
  ...MOLDURA,
  registro: "blocos",
  places: [
    { id: "resource-logs", x: COLUNA.placa, y: 60, w: LARGURA.placa, h: 70 },
    { id: "log-flush", x: COLUNA.executa, y: FAIXA.controle, w: LARGURA.executa, h: ALTURA.controle },
    // No lugar onde o outro tem um amostrador, este tem uma chave — e quem a
    // comanda vem de fora do provider. É a única linha do lab que cruza essa
    // fronteira, e é por isso que ela ensina.
    { id: "trace-gate", x: COLUNA.decide, y: FAIXA.dado, w: LARGURA.decide, h: ALTURA.dado },
    { id: "log-processors", x: COLUNA.executa, y: FAIXA.dado, w: LARGURA.executa, h: ALTURA.dado, collapsed: true },
  ],
};

export const VIEW_METER_PROVIDER: View = {
  id: "otel-meter-provider",
  focus: "meter-provider",
  title: "The same frame, and the arrow points the other way",
  ...MOLDURA,
  registro: "blocos",
  places: [
    { id: "resource-metrics", x: COLUNA.placa, y: 60, w: LARGURA.placa, h: 70 },
    { id: "views", x: COLUNA.placa, y: 150, w: LARGURA.placa, h: 60 },
    // O leitor ocupa o lugar do flush — e a seta dele vai para a ESQUERDA, para
    // quem guarda, em vez de descer sobre o caminho. Ele pede; o outro empurra.
    { id: "metric-reader", x: COLUNA.executa, y: FAIXA.controle, w: LARGURA.executa, h: ALTURA.controle },
    // No lugar da fila, um banco de linhas. Mesma posição, forma diferente: é a
    // superposição fazendo o trabalho que um parágrafo faria pior.
    { id: "points", x: COLUNA.decide, y: FAIXA.dado, w: LARGURA.decide, h: ALTURA.dado },
    { id: "metric-exporter", x: COLUNA.executa, y: FAIXA.dado, w: LARGURA.executa, h: ALTURA.dado },
  ],
};

export const VIEW_BATCH_PROCESSOR: View = {
  id: "otel-batch-processor",
  focus: "batch-processor",
  title: "Inside the batch processor: a queue, a clock, and a way out",
  width: 900,
  height: 400,
  registro: "blocos",
  places: [
    { id: "batch-timer", x: 160, y: 50, w: 260, h: 70 },
    { id: "queue", x: 160, y: 200, w: 260, h: 130 },
    { id: "span-exporter", x: 560, y: 200, w: 280, h: 130 },
  ],
};

/** As três de provider, na ordem em que a superposição as compara. */
export const VIEWS_DE_PROVIDER: readonly View[] = [
  VIEW_TRACER_PROVIDER,
  VIEW_LOGGER_PROVIDER,
  VIEW_METER_PROVIDER,
];

export const OTEL_VIEWS: readonly View[] = [
  VIEW_HOST,
  VIEW_PROCESS,
  ...VIEWS_DE_PROVIDER,
  VIEW_BATCH_PROCESSOR,
];

/**
 * O mundo sem SDK tem outra árvore — não há provider nenhum —, então ele tem
 * outras views. Reusar as de cima desenharia caixas que aquela árvore não tem,
 * que é exatamente o que `viewDisagreement` existe para recusar.
 */
export const VIEW_PROCESS_SEM_SDK: View = {
  id: "otel-process-no-sdk",
  focus: "process",
  title: "The API with no SDK installed",
  width: 1200,
  height: 460,
  registro: "blocos",
  places: [
    { id: "propagators", x: 24, y: 6, w: 190, h: 40 },
    { id: "app", x: 24, y: 160, w: 190, h: 150 },
    { id: "tracer-provider", x: 420, y: 120, w: 480, h: 220, badge: "no-op" },
  ],
};

export const VIEWS_SEM_SDK: readonly View[] = [VIEW_HOST, VIEW_PROCESS_SEM_SDK];
