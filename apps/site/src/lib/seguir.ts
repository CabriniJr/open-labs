import type { WorldState } from "@ovh/depth-core";
import { diffStates } from "@ovh/depth-core";
import type { Message } from "@ovh/depth-core";

/**
 * Seguir a carga: o trajeto de **uma coisa**, e o que cada parada acrescentou.
 *
 * É a ideia nº 7 do `DECISIONS.md`, e ela existia só no herói da landing — os
 * labs mostravam a carga andando e não deixavam ninguém abri-la. O que faltava
 * não era desenho: era **identidade**. O motor dá um id novo a cada emissão, e
 * está certo, porque cada salto é uma mensagem nova; quem sabe que duas
 * mensagens são a mesma coisa é o domínio.
 *
 * Aqui a coisa é seguida pela chave, e cada parada guarda o corpo dela naquele
 * ponto. O painel mostra o corpo atual com **o que mudou desde a parada
 * anterior** marcado — que é o enriquecimento acontecendo, e não uma legenda
 * dizendo que ele acontece.
 */

export interface Parada {
  readonly tick: number;
  readonly de: string;
  readonly para: string;
  readonly corpo: unknown;
  /** Os caminhos que mudaram em relação à parada anterior. */
  readonly mudou: readonly string[];
}

export interface LeitorDaCarga {
  readonly chave: (mensagem: Message) => string | undefined;
  readonly corpo: (mensagem: Message) => unknown;
  /**
   * Esta mensagem é uma **parada no trajeto da coisa**, ou um produto dela?
   *
   * A distinção não é preciosismo: na anatomia, a requisição atravessa quatro
   * serviços e cada um exporta um span. Os spans são produtos — eles não
   * continuam o caminho. Misturados no trajeto, cada parada acusava "mudou o
   * traceparent E o span", porque o corpo alternava entre duas formas, e o
   * leitor lia ruído no lugar do mecanismo.
   *
   * Ausente, tudo é parada: um lab em que a coisa só anda não precisa disto.
   */
  readonly noTrajeto?: ((mensagem: Message) => boolean) | undefined;
}

/**
 * Acrescenta ao trajeto o que se vê deste estado, e devolve o trajeto novo.
 *
 * Só acrescenta **parada nova**: a mesma carga aparece no mesmo fio por vários
 * ticks enquanto atravessa, e uma parada por tick encheria o painel de linhas
 * iguais. A parada é o par (de, para) — o salto —, que é o que muda quando ela
 * de fato anda.
 */
export function seguir(
  trajeto: readonly Parada[],
  state: WorldState,
  chaveSeguida: string,
  leitor: LeitorDaCarga,
): readonly Parada[] {
  const emVoo = state.flight.filter(
    (item) =>
      leitor.chave(item.message) === chaveSeguida &&
      (leitor.noTrajeto?.(item.message) ?? true),
  );
  if (emVoo.length === 0) return trajeto;

  let saida = trajeto;
  for (const item of emVoo) {
    const de = item.from;
    const para = String(item.to);
    const ultima = saida.at(-1);
    if (ultima !== undefined && ultima.de === de && ultima.para === para) continue;

    const corpo = leitor.corpo(item.message);
    /*
      Compara com a CHEGADA neste nó, e não com a parada anterior.

      Num caminho reto as duas coisas são a mesma. Num **leque** não são: a
      requisição sai do serviço para os três gravadores ao mesmo tempo, e
      comparar o segundo braço com o primeiro respondia "o que o log tem de
      diferente da métrica" — pergunta que ninguém fez. Contra a chegada, cada
      braço responde a pergunta certa: **o que este guardou da mesma coisa.**
    */
    const chegada = [...saida].reverse().find((parada) => parada.para === de) ?? ultima;
    saida = [
      ...saida,
      {
        tick: state.tick,
        de,
        para,
        corpo,
        mudou: chegada === undefined ? [] : diffStates(chegada.corpo, corpo),
      },
    ];
  }
  return saida;
}

/** O teto do trajeto: mais que isto não se lê, e o lab não é um gravador. */
export const PARADAS_NO_PAINEL = 12;
