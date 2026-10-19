import type { WorldState } from "@ovh/depth-core";
import {
  diasPorTick,
  mbPorTick,
  type Balde,
  type EstadoDoCongelado,
  type EstadoDoFrio,
  type EstadoDoMorno,
  type EstadoDoQuente,
  type EstadoDosEventos,
} from "./world.js";

/**
 * O que a tela mostra, derivado do estado.
 *
 * A pergunta da página é a que se faz quando alguém pede o log de três meses
 * atrás:
 *
 * > Até onde dá para pesquisar?
 *
 * E a resposta é um número que não está escrito em nenhum arquivo de
 * configuração. Ele é o mais velho que ainda está no disco, e sai da conta
 * entre o volume diário e os limites — por isso a tela o mostra ao lado da
 * retenção configurada, que é o número que todo mundo cita.
 */

export interface EstadoDosBaldes {
  readonly mbEscritos: number;
  readonly mbPorTick: number;
  readonly diasPorTick: number;

  readonly mbAberto: number;
  readonly enchimentoDoQuente: number;
  readonly baldesFechados: number;

  readonly mornos: number;
  readonly mbMorno: number;
  readonly frios: number;
  readonly mbFrio: number;
  readonly mbNoDisco: number;
  readonly enchimentoDoIndice: number;

  readonly congelados: number;
  readonly mbCongelado: number;
  readonly porTamanho: number;
  readonly porIdade: number;
  readonly apagados: number;
  readonly arquivados: number;

  /**
   * A janela: a idade, em dias, do dado mais velho ainda pesquisável.
   *
   * `undefined` enquanto nada foi congelado, porque aí a janela não é uma
   * propriedade do sistema — é só o tempo que o lab está rodando, e dizer
   * "você tem 3 dias" quando nada foi apagado seria inverter a leitura.
   */
  readonly janelaEmDias: number | undefined;
  /** A retenção configurada, para ficar ao lado da janela real. */
  readonly retencaoEmDias: number;

  /**
   * Quando o nível morno sozinho cabe mais que o índice inteiro — e aí este
   * modelo **deixa de valer**, e diz isso em vez de calar.
   *
   * `maxWarmDBCount × maxDataSize > maxTotalDataSizeMB` é uma configuração
   * incoerente, e o Splunk a resolve de um jeito que este modelo não
   * reproduz: congelar tira o balde mais velho do **índice**, onde quer que
   * ele esteja, então com o frio vazio ele tiraria um balde morno. Aqui o
   * congelamento por tamanho só acontece no frio, porque um nó deste motor
   * conhece apenas o próprio estado.
   *
   * A escolha foi medir isto e nomeá-lo na tela em vez de modelar errado uma
   * região inteira de configuração. Com os defaults de verdade ela não é
   * alcançada: 300 × 750 MB são 225 GB, contra 500 000 MB de índice.
   */
  readonly configuracaoIncoerente: boolean;
}

const no = <T>(state: WorldState, id: string): T | undefined => state.nodes[id] as T | undefined;

const soma = (baldes: readonly Balde[]): number => baldes.reduce((n, b) => n + b.mb, 0);

export function estadoDosBaldes(
  state: WorldState,
  params: Readonly<Record<string, number>>,
): EstadoDosBaldes {
  const eventos = no<EstadoDosEventos>(state, "eventos");
  const quente = no<EstadoDoQuente>(state, "quente");
  const morno = no<EstadoDoMorno>(state, "morno");
  const frio = no<EstadoDoFrio>(state, "frio");
  const congelado = no<EstadoDoCongelado>(state, "congelado");

  const dias = diasPorTick(params);
  const mbMorno = soma(morno?.baldes ?? []);
  const mbFrio = soma(frio?.baldes ?? []);
  const mbAberto = quente?.mbAberto ?? 0;
  const teto = Math.max(1, (params["max-total-gb"] ?? 500) * 1024);
  const tetoDoBalde = Math.max(1, params["max-data-size-mb"] ?? 750);

  // O mais velho ainda no disco. Os mornos são mais novos que os frios por
  // construção, então o frio manda — e, se não há frio, o morno.
  const maisVelho = (frio?.baldes ?? [])[0] ?? (morno?.baldes ?? [])[0];
  const congelouAlgo = (congelado?.baldes ?? 0) > 0;

  return {
    mbEscritos: eventos?.mbEscritos ?? 0,
    mbPorTick: mbPorTick(params),
    diasPorTick: dias,

    mbAberto,
    enchimentoDoQuente: Math.min(1, mbAberto / tetoDoBalde),
    baldesFechados: quente?.baldesFechados ?? 0,

    mornos: morno?.baldes.length ?? 0,
    mbMorno,
    frios: frio?.baldes.length ?? 0,
    mbFrio,
    mbNoDisco: mbAberto + mbMorno + mbFrio,
    enchimentoDoIndice: Math.min(1, (mbMorno + mbFrio) / teto),

    congelados: congelado?.baldes ?? 0,
    mbCongelado: congelado?.mb ?? 0,
    porTamanho: frio?.porTamanho ?? 0,
    porIdade: frio?.porIdade ?? 0,
    apagados: congelado?.apagados ?? 0,
    arquivados: congelado?.arquivados ?? 0,

    configuracaoIncoerente: (params["max-warm"] ?? 300) * tetoDoBalde > teto,

    janelaEmDias:
      congelouAlgo && maisVelho !== undefined
        ? Math.round((state.tick - maisVelho.fechadoEm) * dias)
        : undefined,
    retencaoEmDias: params["retencao-dias"] ?? 2184,
  };
}

/**
 * Seguir um balde pela escada de estados.
 *
 * A chave é o id do balde, que é a identidade que atravessa os quatro estados
 * — e é o que torna possível ver que o mesmo balde que esfriou é o que
 * congelou. Seguir "um evento" não daria: evento não é a unidade de nada nesta
 * fase, e é justamente isso que o lab ensina.
 */
export const LEITOR_DO_BALDE = {
  chave: (mensagem: { readonly data: Readonly<Record<string, unknown>> }): string | undefined => {
    const baldes = mensagem.data["baldes"];
    if (!Array.isArray(baldes) || baldes.length === 0) return undefined;
    const primeiro = baldes[0] as Balde;
    if (primeiro.id === undefined) return undefined;
    return `bucket ${primeiro.id}`;
  },

  corpo: (mensagem: {
    readonly kind: string;
    readonly data: Readonly<Record<string, unknown>>;
  }): unknown => {
    const baldes = mensagem.data["baldes"];
    if (!Array.isArray(baldes) || baldes.length === 0) {
      const mb = mensagem.data["mb"];
      return typeof mb === "number"
        ? { travelling_as: "indexed events", mb_on_disk: Math.round(mb) }
        : {};
    }
    const balde = baldes[0] as Balde;
    return {
      travelling_as: "a closed bucket",
      bucket: balde.id,
      mb: balde.mb,
      closed_at_tick: balde.fechadoEm,
      buckets_in_message: baldes.length,
      ...(mensagem.data["arquivado"] === undefined
        ? {}
        : { fate: mensagem.data["arquivado"] === true ? "archived" : "deleted" }),
    };
  },
};
