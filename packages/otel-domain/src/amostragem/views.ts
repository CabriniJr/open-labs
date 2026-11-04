import type { View } from "@ovh/depth-ui";

/**
 * A vista da amostragem, e o desenho carrega os dois instantes.
 *
 * **O head está antes do leque, e isso é a ordem do argumento.** Tudo que ele
 * corta nunca alcança os gateways — então um leitor que ligue o head e depois
 * procure uma política de tail para recuperar o erro está procurando no lugar
 * onde o dado não está. A posição no desenho diz isso sem texto.
 *
 * **Os dois gateways ficam na mesma coluna, um em cima do outro, e as duas
 * linhas do balanceador se separam ali.** Com roteamento por trace, cada trace
 * fica inteiro numa fileira; sem ele, as fileiras se misturam e o leitor vê a
 * mistura — é a única forma de o defeito ser visível antes de ser contado.
 *
 * **O backend é um só.** Os dois gateways entregam no mesmo lugar, que é o que
 * torna o trace quebrado difícil: ele chega pela porta certa, só não chega
 * inteiro.
 */
const FILEIRA_A = 44;
const FILEIRA_B = 196;
const LINHA_DO_DESCARTE = 340;
const MEIO = (FILEIRA_A + FILEIRA_B) / 2;
const ALTURA = 86;
const LARGURA = 136;

export const VIEW_AMOSTRAGEM: View = {
  id: "otel-sampling",
  focus: "amostragem",
  title: "Head decides early, tail decides late",
  width: 1000,
  height: 460,
  registro: "blocos",
  places: [
    { id: "app", x: 20, y: MEIO, w: LARGURA, h: ALTURA },
    { id: "head", x: 180, y: MEIO, w: LARGURA, h: ALTURA },
    { id: "balanceador", x: 340, y: MEIO, w: LARGURA, h: ALTURA },

    { id: "gatewayA", x: 520, y: FILEIRA_A, w: LARGURA + 8, h: ALTURA },
    { id: "gatewayB", x: 520, y: FILEIRA_B, w: LARGURA + 8, h: ALTURA },

    { id: "backend", x: 712, y: MEIO, w: LARGURA + 40, h: ALTURA + 24 },

    { id: "descartes", x: 340, y: LINHA_DO_DESCARTE, w: LARGURA + 160, h: ALTURA - 8 },
  ],
};

export const VIEWS_DA_AMOSTRAGEM: readonly View[] = [VIEW_AMOSTRAGEM];
