import type { View } from "@ovh/depth-ui";
import { ROTULOS_HEROI } from "./labels.js";

/**
 * As duas vistas do herói, e elas são a mesma moldura.
 *
 * A de cima: três caixas numa fileira, e nada mais. Larga e baixa porque ela
 * divide a primeira dobra da página com a trilha, e uma vitrine que pede rolagem
 * para ser vista inteira não é vitrine.
 *
 * A de dentro do collector reusa **as mesmas coordenadas**, e isso é conteúdo e
 * não economia: descer não troca o assunto de lugar, troca o que está dentro das
 * caixas. Onde havia serviço, collector e backend, passa a haver receiver,
 * processor e exporter — mesma fileira, mesmo tamanho, mesma altura. Alternar
 * entre as duas é um diff visual, que é o mesmo recurso que as vistas de provider
 * usam para comparar três providers sem um parágrafo de texto.
 */

/** A fileira: uma medida só, escrita uma vez. Duas cópias divergiriam. */
const FILEIRA = { y: 55, w: 170, h: 90 } as const;
const COLUNA = { esquerda: 30, meio: 275, direita: 520 } as const;
const MOLDURA = { width: 720, height: 200 } as const;

export const VIEW_HEROI: View = {
  id: "otel-hero",
  focus: "pipeline",
  title: ROTULOS_HEROI.sistema,
  ...MOLDURA,
  registro: "blocos",
  places: [
    { id: "service", x: COLUNA.esquerda, ...FILEIRA },
    // `collapsed` diz em voz alta que há mais aqui dentro — e é a única coisa que
    // a vista de fora ganhou com o collector tendo interior. Sem a marca, a
    // caixa que abre e as que não abrem seriam desenhadas igual, e o duplo
    // clique seria um gesto que só descobre quem já sabia dele.
    { id: "collector", x: COLUNA.meio, ...FILEIRA, collapsed: true },
    { id: "backend", x: COLUNA.direita, ...FILEIRA },
  ],
};

/**
 * O dentro do collector: recebe, acrescenta, manda embora.
 *
 * As pontas são conduítes e o meio é processador — e a diferença de forma entre
 * elas **é** a afirmação da vista: o campo `collector.name` nasce na caixa do
 * meio, e em nenhuma outra. Há teste em `world.test.ts` para exatamente isso, no
 * fio de cada lado do processor: se um dia o receiver ou o exporter começar a
 * mexer na carga, o teste cai antes de o desenho passar a mentir.
 */
export const VIEW_DO_COLLECTOR: View = {
  id: "otel-hero-collector",
  focus: "collector",
  title: ROTULOS_HEROI.dentroDoCollector,
  ...MOLDURA,
  registro: "blocos",
  places: [
    { id: "receiver", x: COLUNA.esquerda, ...FILEIRA },
    { id: "processor", x: COLUNA.meio, ...FILEIRA },
    { id: "exporter", x: COLUNA.direita, ...FILEIRA },
  ],
};

export const VIEWS_DO_HEROI: readonly View[] = [VIEW_HEROI, VIEW_DO_COLLECTOR];
