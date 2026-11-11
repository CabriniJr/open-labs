// locale: skip-file — desenhos SVG (caminhos), sem texto para traduzir.
import type { Glyph } from "@ovh/motion";
import type { NomeDaTabela } from "./telecentro/esquema.js";

/**
 * Os ícones do handbook de bancos de dados, traço de 24×24. Cada tabela leva
 * o desenho do que uma linha dela É — uma pessoa, um prédio, um livro —, e a
 * mesma tabela tem o mesmo ícone em todo lab deste handbook.
 */
const pessoa = ["M12 4a3 3 0 1 0 0 6a3 3 0 1 0 0-6", "M5 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5"];

export const ICONES_BANCO = {
  /** Um telecentro: o prédio com a porta aberta. */
  T_TELECENTRO: { paths: ["M4 21V9.5l8-5.5 8 5.5V21", "M3 21h18", "M10 21v-5h4v5"] },
  /** Um monitor: a pessoa com o crachá. */
  T_MONITOR: { paths: [...pessoa, "M14.5 17h3.5"] },
  /** Um aluno: a pessoa. */
  T_ALUNO: { paths: pessoa },
  /** Um computador da rede: a tela. */
  T_COMPUTADOR: { paths: ["M3.5 4h17v11h-17z", "M9 20h6", "M12 15v5"] },
  /** Um handbook: o livro. */
  T_HANDBOOK: { paths: ["M5 5a2 2 0 0 1 2-2h11v15H7a2 2 0 0 0-2 2z", "M5 20a2 2 0 0 0 2 1h11v-3"] },
  /** Uma fase do roteiro: o degrau. */
  T_FASE: { paths: ["M3 20h5v-5h5v-5h5V5h3"] },
  /** Um lab: o frasco de laboratório. */
  T_LAB: { paths: ["M9.5 3h5", "M10.5 3v6l-5 9a2 2 0 0 0 1.8 3h9.4a2 2 0 0 0 1.8-3l-5-9V3", "M8 15h8"] },
  /** Uma avaliação: a lista com as marcas de certo. */
  T_AVALIACAO: { paths: ["M6 3h12v18H6z", "M9 8.5l1.5 1.5 3-3", "M9 14.5l1.5 1.5 3-3"] },
  /** Um progresso: a barra que vai enchendo. */
  T_PROGRESSO: { paths: ["M3 9.5h18v5H3z"], fill: ["M4.5 11h9v2h-9z"] },
  /** Uma tentativa: o lápis que responde. */
  T_TENTATIVA: { paths: ["M4 20l4.5-1 11-11-3.5-3.5-11 11z", "M14 6l3.5 3.5"] },
} as const satisfies Record<NomeDaTabela, Glyph>;

/** O balcão do telecentro: a janela do app do OpenLabs, de onde saem as escritas. */
export const ICONE_APP: Glyph = { paths: ["M3 5h18v14H3z", "M3 9h18"], fill: ["M5 6.2h1.6v1.6H5z", "M7.6 6.2h1.6v1.6H7.6z"] };
