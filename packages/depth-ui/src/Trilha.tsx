import type { Parada } from "@ovh/depth-core";
import { PARADAS_NO_PAINEL } from "@ovh/depth-core";
import { Inspector } from "./Inspector.js";

/**
 * A vista do item: o trajeto vira o desenho.
 *
 * O palco é centrado na **fábrica** — o grafo, as máquinas, o que tem dentro de
 * cada caixa — e o item é carga que atravessa. Há assunto em que o protagonista
 * é o item, e desenhá-lo como um ponto de sete unidades numa esteira é tratar de
 * raspão justamente o que o lab é sobre. Ver `DECISIONS.md` §9.
 *
 * Aqui o trajeto é a espinha. Nada disto é desenhado à mão: cada traço sai de um
 * campo de `Parada`, que sai de `seguir()`, que sai do `state.flight` do motor.
 * Se o mundo parar de enriquecer, a trilha para de dizer que enriqueceu.
 */
export interface TrilhaProps {
  readonly trajeto: readonly Parada[];
  /** Quem está sendo seguido, no vocabulário do domínio. */
  readonly titulo: string;
  /** O que dizer quando o item ainda não apareceu, ou já saiu do sistema. */
  readonly vazio?: string;
}

/** Uma ponta do trajeto: onde o item esteve, e o que o salto até aqui mudou. */
export interface Estacao {
  readonly id: string;
  readonly nome: string;
  /** O que o salto que CHEGOU aqui acrescentou. Vazio na origem. */
  readonly mudou: readonly string[];
  /** A origem: ninguém a alcançou por um salto, então ela não tem delta. */
  readonly origem: boolean;
  /** É a primeira aparição do item — ninguém o viu antes daqui. */
  readonly primeiraVez: boolean;
  /** Pendura no mesmo lugar que a estação de cima, em vez de continuar a linha. */
  readonly ramo: boolean;
}

/**
 * As estações saem do trajeto, e são **uma a mais** que as paradas.
 *
 * Uma parada é um salto — o par (de, para) —, então N saltos tocam N+1 lugares.
 * Uma estação por parada perderia a origem, e o item passaria a nascer no meio
 * do caminho.
 *
 * E o delta mora na **chegada**, não na partida. A razão é o leque: três saltos
 * saindo do mesmo lugar com deltas diferentes disputariam uma linha só do lado
 * da partida. Na chegada, cada braço carrega o seu — e num caminho reto o texto
 * continua caindo entre os dois pontos, que é onde ele aconteceu.
 */
export function estacoesDe(trajeto: readonly Parada[]): readonly Estacao[] {
  if (trajeto.length === 0) return [];
  const paradas = trajeto.slice(-PARADAS_NO_PAINEL);
  const primeira = paradas[0]!;

  const estacoes: Estacao[] = [
    {
      id: `${primeira.tick}:${primeira.de}:origem`,
      nome: primeira.de,
      mudou: [],
      origem: true,
      primeiraVez: false,
      ramo: false,
    },
  ];

  paradas.forEach((parada, i) => {
    const anterior = paradas[i - 1];
    estacoes.push({
      id: `${parada.tick}:${parada.de}:${parada.para}`,
      nome: parada.para,
      mudou: parada.mudou,
      origem: false,
      primeiraVez: i === 0,
      // Sai do mesmo lugar que o salto de cima: é irmão, e não continuação.
      ramo: anterior !== undefined && anterior.de === parada.de,
    });
  });

  return estacoes;
}

export function Trilha({ trajeto, titulo, vazio }: TrilhaProps) {
  const estacoes = estacoesDe(trajeto);
  const ultima = trajeto.at(-1);

  if (ultima === undefined) {
    return (
      <div className="dui-trilha" aria-label="Following one item">
        <p className="dui-trilha__titulo mono">{titulo}</p>
        <p className="dui-trilha__vazio">{vazio ?? ""}</p>
      </div>
    );
  }

  return (
    <div className="dui-trilha" aria-label="Following one item">
      <p className="dui-trilha__titulo mono">{titulo}</p>

      <ol className="dui-trilha__estacoes mono">
        {estacoes.map((estacao, i) => (
          <li
            key={estacao.id}
            className="dui-trilha__estacao"
            data-atual={i === estacoes.length - 1 ? "true" : undefined}
            data-ramo={estacao.ramo ? "true" : undefined}
            data-mudou={estacao.mudou.length > 0 ? estacao.mudou.join(", ") : undefined}
          >
            {/*
              O delta vem ANTES do nome, e é por isso que ele cai visualmente
              entre os dois pontos: ele descreve o salto que terminou aqui.
              A ausência é dita — em branco, "não vi antes", "vi e nada mudou" e
              "mudou" se pareceriam.
            */}
            {estacao.origem ? null : (
              <span className="dui-trilha__delta">
                {estacao.mudou.length > 0
                  ? estacao.mudou.join(", ")
                  : estacao.primeiraVez
                    ? "first sighting"
                    : "unchanged"}
              </span>
            )}
            <span className="dui-trilha__ponto" aria-hidden="true" />
            <span className="dui-trilha__nome">{estacao.nome}</span>
          </li>
        ))}
      </ol>

      <Inspector
        value={ultima.corpo}
        changedPaths={ultima.mudou}
        label={`body, as it left ${ultima.de}`}
      />
    </div>
  );
}
