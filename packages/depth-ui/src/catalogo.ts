/**
 * Os sentidos do catálogo, com nome — para a legenda ser **lida** dele.
 *
 * O valor de cada tinta mora no CSS (`stage.css`), e este arquivo guarda só o
 * nome e o token. É a divisão que impede a legenda de mentir: ela não recebe
 * uma cor para pintar a amostra, ela pinta com `var(--dui-alto)` — o mesmo
 * token que o desenho usa. Escrita à mão, a legenda seria uma segunda fonte, e
 * uma legenda que discorda do desenho é pior que legenda nenhuma, porque o
 * leitor confia nela justamente quando não entendeu a figura.
 *
 * O que muda de um registro para o outro não é a tinta: é o **sentido** dela.
 * Vermelha é controle no diagrama de blocos e alimentação no esquemático, e as
 * duas coisas são verdade — cada uma na sua linguagem de desenho. O que era
 * ambíguo era isso ficar implícito.
 */

export interface Sentido {
  /** O token do CSS. A amostra pinta com ele, e por isso não pode divergir. */
  readonly token: string;
  /** Como se chama, para o leitor. */
  readonly nome: string;
}

export const REGISTROS: Readonly<Record<"blocos" | "esquematico", readonly Sentido[]>> = {
  blocos: [
    { token: "--dui-dado", nome: "data" },
    { token: "--dui-sinal", nome: "control" },
    { token: "--dui-alto", nome: "logic 1" },
  ],
  esquematico: [
    { token: "--dui-alimentacao", nome: "supply" },
    { token: "--dui-terra", nome: "ground" },
    { token: "--dui-alto", nome: "conducting" },
  ],
};

export type Registro = keyof typeof REGISTROS;
