import type { WorldState } from "@ovh/depth-core";
import {
  bytesNaFila,
  BYTES_DO_BLOCO,
  type EstadoDaApp,
  type EstadoDoIndexador,
  type EstadoDoIndice,
  type EstadoDoMeio,
  type EstadoDoUf,
  type EventoIndexado,
  type LugarDoProps,
} from "./world.js";

/**
 * O que a tela mostra, derivado do estado.
 *
 * A pergunta da página é a que se faz na segunda semana de um ambiente novo:
 *
 * > O stack trace que a aplicação escreveu está pesquisável como um evento?
 *
 * E ela tem duas formas de ser "não" que se consertam em máquinas diferentes,
 * que é a razão de o placar separá-las:
 *
 * - **o arquivo está na máquina errada**: o `props.conf` existe, está correto,
 *   e está instalado em quem não executa a fase;
 * - **a topologia mudou debaixo dele**: o arquivo estava na máquina certa até
 *   alguém pôr um heavy forwarder no caminho, e a fase se mudou.
 *
 * Nenhuma das duas produz erro, log de aviso ou contador vermelho.
 */

export interface EstadoDaIngestao {
  readonly registrosEscritos: number;
  readonly linhasEscritas: number;
  readonly multilinhasEscritos: number;

  readonly blocosEnviados: number;
  readonly bytesNaFila: number;
  readonly registrosNaFila: number;
  /** O quanto do bloco de 64K já está cheio, de 0 a 1. */
  readonly enchimentoDoBloco: number;

  /** Quem executou a fase de parsing neste run. Sai do run, não do parâmetro. */
  readonly parseouNoMeio: boolean;
  readonly parseouNoIndexador: boolean;
  readonly eventosDoMeio: number;
  readonly blocosRepassados: number;

  readonly eventosGravados: number;
  readonly eventosJaProntos: number;

  readonly eventosNoIndice: number;
  /** Registros multilinha que entraram como um evento só. */
  readonly inteiros: number;
  /** Registros multilinha que entraram em pedaços. */
  readonly partidos: number;
  readonly fragmentos: number;
  /**
   * Quantos eventos o índice tem por registro multilinha. É o número que a
   * licença paga e que a busca devolve — 1 quando a quebra está no lugar certo,
   * `linhas-do-registro` quando não está.
   */
  readonly eventosPorRegistroPartido: number;
  readonly ultimos: readonly EventoIndexado[];
}

const no = <T>(state: WorldState, id: string): T | undefined => state.nodes[id] as T | undefined;

export function estadoDaIngestao(state: WorldState): EstadoDaIngestao {
  const app = no<EstadoDaApp>(state, "app");
  const uf = no<EstadoDoUf>(state, "uf");
  const meio = no<EstadoDoMeio>(state, "meio");
  const idx = no<EstadoDoIndexador>(state, "idx");
  const indice = no<EstadoDoIndice>(state, "indice");

  const fila = uf?.fila ?? [];
  const bytes = bytesNaFila(fila);
  const fragmentos = indice?.fragmentos ?? 0;
  const partidos = indice?.registrosPartidos ?? 0;

  return {
    registrosEscritos: app?.registros ?? 0,
    linhasEscritas: app?.linhas ?? 0,
    multilinhasEscritos: app?.multilinhas ?? 0,

    blocosEnviados: uf?.blocosEnviados ?? 0,
    bytesNaFila: bytes,
    registrosNaFila: fila.length,
    enchimentoDoBloco: Math.min(1, bytes / BYTES_DO_BLOCO),

    parseouNoMeio: meio?.parseou ?? false,
    parseouNoIndexador: idx?.parseou ?? false,
    eventosDoMeio: meio?.eventosProduzidos ?? 0,
    blocosRepassados: meio?.blocosRepassados ?? 0,

    eventosGravados: idx?.eventosGravados ?? 0,
    eventosJaProntos: idx?.eventosRecebidos ?? 0,

    eventosNoIndice: indice?.eventos ?? 0,
    inteiros: indice?.registrosInteiros ?? 0,
    partidos,
    fragmentos,
    // Média real do run, e não o parâmetro: é o que o índice de fato tem.
    eventosPorRegistroPartido: partidos === 0 ? 0 : fragmentos / partidos,
    ultimos: indice?.ultimos ?? [],
  };
}

/** O nome que a tela dá a cada máquina, pela ordem do parâmetro `props-em`. */
export const NOME_DA_MAQUINA: Readonly<Record<LugarDoProps, string>> = {
  uf: "universal forwarder",
  meio: "intermediate tier",
  idx: "indexer",
};

/**
 * Seguir um bloco (ou um evento) pela ingestão.
 *
 * A chave é o primeiro registro que a mensagem carrega, porque é a identidade
 * que **sobrevive** à fase de parsing: um bloco entra com o registro 240 lá
 * dentro e saem doze eventos do registro 240. Seguir "o bloco" acabaria no
 * parsing; seguir o registro mostra justamente onde ele se multiplicou.
 */
export const LEITOR_DA_CARGA = {
  chave: (mensagem: { readonly data: Readonly<Record<string, unknown>> }): string | undefined => {
    const registros = mensagem.data["registros"];
    if (Array.isArray(registros) && registros.length > 0) {
      const primeiro = registros[0] as { readonly id?: number };
      if (primeiro.id !== undefined) return `record ${primeiro.id}`;
    }
    const eventos = mensagem.data["eventos"];
    if (Array.isArray(eventos) && eventos.length > 0) {
      const primeiro = eventos[0] as EventoIndexado;
      if (primeiro.registro !== undefined) return `record ${primeiro.registro}`;
    }
    return undefined;
  },

  corpo: (mensagem: {
    readonly kind: string;
    readonly data: Readonly<Record<string, unknown>>;
  }): unknown => {
    const registros = mensagem.data["registros"];
    if (Array.isArray(registros) && registros.length > 0) {
      const primeiro = registros[0] as { readonly id: number; readonly linhas: number };
      return {
        travelling_as: "an unparsed 64K block",
        records_in_block: registros.length,
        bytes: mensagem.data["bytes"] ?? 0,
        host: mensagem.data["host"] ?? "—",
        source: mensagem.data["source"] ?? "—",
        sourcetype: mensagem.data["sourcetype"] ?? "—",
        first_record: `#${primeiro.id}, ${primeiro.linhas} line(s) in the file`,
        is_an_event_yet: false,
      };
    }

    const eventos = mensagem.data["eventos"];
    if (Array.isArray(eventos) && eventos.length > 0) {
      const primeiro = eventos[0] as EventoIndexado;
      return {
        travelling_as: "a parsed event",
        events_in_message: eventos.length,
        from_record: primeiro.registro,
        this_event_is: `part ${primeiro.parte} of ${primeiro.de}`,
        parsed_by: NOME_DA_MAQUINA[primeiro.parseadoPor],
        sourcetype: primeiro.sourcetype,
        is_an_event_yet: true,
      };
    }

    return {};
  },
};
