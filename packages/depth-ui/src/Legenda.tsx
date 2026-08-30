import { REGISTROS } from "./catalogo.js";
import type { Registro } from "./catalogo.js";

/**
 * A legenda do registro em que o leitor está.
 *
 * Ela existe porque a mesma tinta quer dizer coisas diferentes em níveis
 * diferentes — vermelha é controle no diagrama de blocos e alimentação no
 * esquemático —, e sem dizer qual linguagem está em uso o leitor tem de
 * adivinhar. A trilha já diz onde ele está; isto diz em que língua o desenho
 * está falando ali.
 *
 * **A amostra pinta com o mesmo token do desenho.** Não é uma cor copiada para
 * cá: é `var(--dui-alto)`, o mesmo que acende a porta. Uma legenda que discorda
 * do desenho é pior que legenda nenhuma, porque o leitor recorre a ela
 * justamente quando não entendeu a figura — e a única forma de ela não poder
 * discordar é não ter cor própria para discordar com.
 */
export interface LegendaProps {
  readonly registro?: Registro | undefined;
}

export function Legenda({ registro = "blocos" }: LegendaProps) {
  return (
    <ul className="dui-legenda" data-registro={registro} aria-label="What the colours mean here">
      {REGISTROS[registro].map((sentido) => (
        <li key={sentido.token} className="dui-legenda__item">
          <span
            className="dui-legenda__amostra"
            data-token={sentido.token}
            style={{ background: `var(${sentido.token})` }}
          />
          {sentido.nome}
        </li>
      ))}
    </ul>
  );
}
