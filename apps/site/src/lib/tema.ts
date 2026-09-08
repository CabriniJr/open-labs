/**
 * A identidade visual de um handbook, e o conjunto **fechado** do que ela pinta.
 *
 * A regra do projeto é que cor mora no catálogo e se lê por sentido, nunca por
 * valor — e a guarda `check-catalogo.mjs` a transforma em fato para o CSS. O que
 * faltava era o outro lado: **um handbook precisa parecer o handbook dele**, e
 * até aqui a identidade era só o acento e os quatro sinais, escritos à mão num
 * arquivo CSS por domínio. O palco, que é noventa por cento da tela, saía igual
 * nos três.
 *
 * Agora o handbook declara a identidade junto com nome, fases e mapa, e o CSS
 * sai daí. Uma fonte por fato: um handbook novo nasce com identidade só de ser
 * declarado, sem ninguém lembrar de criar um arquivo.
 *
 * **O conjunto é fechado, e é isso que impede a estilização de virar tema
 * livre.** O que um handbook pode pintar:
 *
 * - o **acento** e os quatro **sinais** da página;
 * - do palco, só o que é identidade: a família que **processa**, a que
 *   **transporta**, e as quatro espécies de carga.
 *
 * O que ele **não** pode pintar, e a razão de cada um:
 *
 * - **fundo e tipografia** são da casa. Identidade que mexe no papel vira
 *   banner, e é o anti-objetivo escrito na spec do handbook;
 * - **a tinta viva** (controle, alimentação, a família controladora) é
 *   convenção, e não identidade: num diagrama de blocos a seta vermelha é
 *   controle em qualquer assunto, e o livro-texto da CPU manda nisso tanto
 *   quanto o do OTel;
 * - **o nível alto** é o valor que saiu da peça, e ele precisa ser a mesma
 *   coisa em todo lugar pelo mesmo motivo.
 */

/** Um sentido que um handbook pinta. A lista é fechada, e o tipo é a lista. */
export interface TemaDoHandbook {
  /** O acento da página: links, marcas, o que puxa o olho. */
  readonly acento: string;
  /** Fluxo, descarte, sucesso e mutação — os quatro sinais da página. */
  readonly fluxo: string;
  readonly descarte: string;
  readonly ok: string;
  readonly mutacao: string;
  /** A família que age sobre o que a atravessa. */
  readonly processador: string;
  /** A família que transporta e nunca altera a carga. */
  readonly conduite: string;
  /**
   * As quatro espécies de carga, da mais proeminente para a mais discreta.
   *
   * O número não nomeia cor, nomeia **proeminência** — a mesma regra do
   * catálogo do palco, e é ela que impede o domínio de escolher tinta por
   * acidente de numeração.
   */
  readonly especies: readonly [string, string, string, string];
}

/**
 * O tema nos dois papéis.
 *
 * O escuro é **parcial** de propósito: quase toda tinta serve nos dois, e
 * repetir a que serve é convite para as duas divergirem. Só entra aqui o que o
 * papel escuro obriga a mudar — tipicamente o acento, que precisa clarear.
 */
export interface TemaCompleto {
  readonly claro: TemaDoHandbook;
  readonly escuro: Partial<TemaDoHandbook>;
}

/**
 * De sentido para token. É a única tradução, e ela é a fronteira: o handbook
 * fala de sentido, o CSS fala de token, e ninguém do lado de lá inventa nome.
 */
const TOKENS: Readonly<Record<keyof Omit<TemaDoHandbook, "especies">, string>> = {
  acento: "--accent",
  fluxo: "--sig-flow",
  descarte: "--sig-drop",
  ok: "--sig-ok",
  mutacao: "--sig-mutation",
  processador: "--dui-processor",
  conduite: "--dui-conduit",
};

/** Os tokens que um tema pode escrever, e nenhum além destes. */
export const TOKENS_PERMITIDOS: readonly string[] = [
  ...Object.values(TOKENS),
  "--dui-especie-1",
  "--dui-especie-2",
  "--dui-especie-3",
  "--dui-especie-4",
];

function declaracoes(tema: Partial<TemaDoHandbook>): readonly string[] {
  const linhas: string[] = [];
  for (const [sentido, token] of Object.entries(TOKENS)) {
    const valor = tema[sentido as keyof typeof TOKENS];
    if (valor !== undefined) linhas.push(`  ${token}: ${valor};`);
  }
  tema.especies?.forEach((cor, i) => linhas.push(`  --dui-especie-${i + 1}: ${cor};`));
  return linhas;
}

/**
 * O CSS de um handbook: claro, escuro do sistema, e escuro escolhido.
 *
 * Os três estados existem porque o tema tem três: uma escolha explícita marca
 * `data-theme`, e o padrão não marca nada — só `prefers-color-scheme` separa.
 * Escrever um e esquecer o outro é como o tema escuro fica pela metade.
 */
export function cssDoTema(id: string, tema: TemaCompleto): string {
  const claras = declaracoes(tema.claro);
  const escuras = declaracoes(tema.escuro);
  const raiz = `:root[data-domain="${id}"]`;
  const blocos = [`${raiz} {\n${claras.join("\n")}\n}`];
  if (escuras.length > 0) {
    blocos.push(
      `@media (prefers-color-scheme: dark) {\n  ${raiz}:not([data-theme="light"]) {\n  ${escuras.join(
        "\n  ",
      )}\n  }\n}`,
      `${raiz}[data-theme="dark"] {\n${escuras.join("\n")}\n}`,
    );
  }
  return blocos.join("\n\n");
}

/** Todos os temas, na ordem do catálogo. */
export function cssDosTemas(
  handbooks: readonly { readonly id: string; readonly tema: TemaCompleto }[],
): string {
  return handbooks.map((h) => cssDoTema(h.id, h.tema)).join("\n\n");
}
