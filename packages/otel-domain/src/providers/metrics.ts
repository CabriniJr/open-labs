import type { AnyObject, Emission, Message, ObjectSpec, Wire } from "@ovh/depth-core";

/**
 * O lado das métricas — e ele existe para provar que os três provedores **não
 * são simétricos**.
 *
 * Fontes: [Metrics SDK · MetricReader](https://opentelemetry.io/docs/specs/otel/metrics/sdk/#metricreader),
 * [Periodic exporting MetricReader](https://opentelemetry.io/docs/specs/otel/metrics/sdk/#periodic-exporting-metricreader),
 * [Cardinality limits](https://opentelemetry.io/docs/specs/otel/metrics/sdk/#cardinality-limits)
 * e [Overflow attribute](https://opentelemetry.io/docs/specs/otel/metrics/sdk/#overflow-attribute).
 *
 * Duas diferenças de forma, e nenhuma precisa de texto para aparecer no desenho:
 *
 * 1. **quem guarda** — a fila do lote é `buffer` e enche; o estado das métricas
 *    é `store`, um banco de linhas que responde por chave
 * 2. **quem dispara** — o gatilho do lote **empurra**; o `MetricReader` **pede**,
 *    e a seta aponta para o outro lado
 *
 * E o limite: a fila cheia **recusa** e o span morre; o banco cheio **colapsa**,
 * e as medições excedentes se somam numa linha só. Mesmo problema — memória
 * finita —, duas mentiras diferentes. A spec garante que nenhuma medição é
 * perdida nem contada duas vezes no overflow, então se o nosso modelo perder,
 * ele está errado, e há teste dizendo isso.
 */

/** Padrões da spec, escritos uma vez. */
export const EXPORT_INTERVAL_MS_PADRAO = 60_000;
export const LIMITE_DE_CARDINALIDADE_PADRAO = 2000;

/**
 * A linha em que o excedente se acumula. É o nome que a spec dá ao atributo, e
 * ele aparece na tela como está aqui: um leitor que veja `otel.metric.overflow`
 * na fatura precisa reconhecer a palavra.
 */
export const ATRIBUTO_DE_OVERFLOW = "otel.metric.overflow";

export interface MedicaoConfig {
  readonly pontos: string;
  readonly leitor: string;
  readonly exportador: string;
  readonly rotulos: {
    readonly pontos: string;
    readonly leitor: string;
    readonly exportador: string;
  };
  readonly paramIntervalo: string;
  readonly paramCardinalidade: string;
}

export interface EstadoPontos {
  /** Uma linha por conjunto de atributos. A chave É o conjunto. */
  readonly linhas: Readonly<Record<string, number>>;
  /** Quantas medições foram para a linha de overflow. Colapsadas, não perdidas. */
  readonly colapsados: number;
}

export interface EstadoLeitor {
  readonly desde: number;
}

export interface EstadoSaidaDeMetrica {
  readonly coletas: number;
  readonly linhas: number;
}

interface Medida {
  readonly chave: string;
  readonly valor: number;
}

const medidasDe = (m: Message): readonly Medida[] => {
  const carga = m.data["medidas"];
  return Array.isArray(carga) ? (carga as readonly Medida[]) : [];
};

const inteiro = (valor: number | undefined, padrao: number, minimo: number): number =>
  valor === undefined || !Number.isFinite(valor) ? padrao : Math.max(minimo, Math.round(valor));

export interface Medicao {
  readonly objetos: readonly AnyObject[];
  readonly wires: readonly Wire[];
}

export function medicao(cfg: MedicaoConfig): Medicao {
  /**
   * O estado em memória. `store` — "guarda muitos valores e responde por chave"
   * —, e ele **não emite sozinho**: só quando pedem. É a metade da assimetria.
   */
  const pontos: ObjectSpec<EstadoPontos> = {
    id: cfg.pontos,
    kind: "store",
    label: cfg.rotulos.pontos,
    leaf: true,
    init: (): EstadoPontos => ({ linhas: {}, colapsados: 0 }),
    behavior: (state, inbox, ctx) => {
      if (ctx.phase !== "commit") return { state, out: [] };

      const limite = inteiro(ctx.params[cfg.paramCardinalidade], LIMITE_DE_CARDINALIDADE_PADRAO, 1);
      const linhas: Record<string, number> = { ...state.linhas };
      let colapsados = state.colapsados;

      for (const message of inbox) {
        for (const medida of medidasDe(message)) {
          const atual = linhas[medida.chave];
          if (atual !== undefined) {
            linhas[medida.chave] = atual + medida.valor;
            continue;
          }
          // O limite conta o total de pontos, e a linha de overflow é um deles:
          // por isso `limite - 1` séries distintas cabem antes de o resto colapsar.
          const distintas = Object.keys(linhas).filter((k) => k !== ATRIBUTO_DE_OVERFLOW).length;
          if (distintas < limite - 1) {
            linhas[medida.chave] = medida.valor;
            continue;
          }
          linhas[ATRIBUTO_DE_OVERFLOW] = (linhas[ATRIBUTO_DE_OVERFLOW] ?? 0) + medida.valor;
          colapsados += 1;
        }
      }

      const out: Emission[] = [];
      // Ele responde a pedido. Nenhum outro caminho emite: se o `MetricReader`
      // não pedir, o dado fica aqui — que é o que "pull" quer dizer, e é a
      // diferença que o desenho tem de mostrar sem uma linha de texto.
      if ((ctx.signals["collect"]?.length ?? 0) > 0) {
        const chaves = Object.keys(linhas);
        out.push({
          port: "out",
          message: ctx.emit("point", Math.max(1, chaves.length), {
            linhas: { ...linhas },
            colapsados,
          }),
        });
      }

      return { state: { linhas, colapsados }, out };
    },
  };

  /**
   * O `MetricReader` periódico. `sequencer`, como o gatilho do lote — e a
   * diferença entre os dois não é o `kind`, é **para onde a seta aponta**: este
   * pede, aquele empurra.
   */
  const leitor: ObjectSpec<EstadoLeitor> = {
    id: cfg.leitor,
    kind: "sequencer",
    label: cfg.rotulos.leitor,
    leaf: true,
    init: (): EstadoLeitor => ({ desde: 0 }),
    behavior: (state, _inbox, ctx) => {
      if (ctx.phase !== "commit") return { state, out: [] };
      const intervalo = inteiro(ctx.params[cfg.paramIntervalo], 1, 1);
      const desde = state.desde + 1;
      if (desde < intervalo) return { state: { desde }, out: [] };
      return {
        state: { desde: 0 },
        out: [{ port: "collect", message: ctx.emit("collect", 1, { motivo: "interval" }) }],
      };
    },
  };

  const exportador: ObjectSpec<EstadoSaidaDeMetrica> = {
    id: cfg.exportador,
    kind: "sink",
    label: cfg.rotulos.exportador,
    leaf: true,
    init: (): EstadoSaidaDeMetrica => ({ coletas: 0, linhas: 0 }),
    behavior: (state, inbox, ctx) => {
      if (ctx.phase !== "commit" || inbox.length === 0) return { state, out: [] };
      const out: Emission[] = [];
      let coletas = state.coletas;
      let linhas = state.linhas;
      for (const message of inbox) {
        coletas += 1;
        linhas = message.weight;
        out.push({ port: "out", message: ctx.emit("otlp-metrics", message.weight, message.data) });
      }
      return { state: { coletas, linhas }, out };
    },
  };

  return {
    objetos: [pontos, leitor, exportador],
    wires: [
      { from: cfg.pontos, port: "out", to: cfg.exportador },
      { from: cfg.leitor, port: "collect", to: cfg.pontos, line: "control", toPort: "collect" },
    ],
  };
}
