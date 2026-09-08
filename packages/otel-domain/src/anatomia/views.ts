import type { View } from "@ovh/depth-ui";

/**
 * A vista do lab da anatomia.
 *
 * O desenho é a tese: os quatro serviços numa **fileira**, a chamada indo para
 * frente de um para o outro, e o span de cada um saindo **para baixo**, sozinho,
 * até o backend. Ninguém manda árvore para lugar nenhum — e a fileira com quatro
 * fios descendo em paralelo diz isso sem uma palavra.
 *
 * O backend é largo e fica embaixo de todos porque ele é o único que vê os
 * quatro. A árvore que ele monta não está no palco: ela está no painel, montada
 * na leitura, que é onde ela é montada na vida real.
 */
const LINHA_DOS_SERVICOS = 60;
const ALTURA_DO_SERVICO = 90;
const LARGURA_DO_SERVICO = 140;
const ESPACO = 30;
const X0 = 30;

const servicos = ["gateway", "checkout", "payments", "ledger"] as const;

export const VIEW_ANATOMIA: View = {
  id: "otel-anatomy",
  focus: "sistema",
  title: "One request, four processes, four exports",
  width: 960,
  height: 430,
  registro: "blocos",
  places: [
    { id: "edge", x: X0, y: LINHA_DOS_SERVICOS + 230, w: 130, h: 80 },
    ...servicos.map((id, i) => ({
      id,
      x: X0 + 170 + i * (LARGURA_DO_SERVICO + ESPACO),
      y: LINHA_DOS_SERVICOS,
      w: LARGURA_DO_SERVICO,
      h: ALTURA_DO_SERVICO,
    })),
    { id: "backend", x: X0 + 170, y: LINHA_DOS_SERVICOS + 200, w: 4 * LARGURA_DO_SERVICO + 3 * ESPACO, h: 155 },
  ],
};

export const VIEWS_DA_ANATOMIA: readonly View[] = [VIEW_ANATOMIA];
