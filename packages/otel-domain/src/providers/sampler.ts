import type { PortId } from "@ovh/depth-core";

/**
 * A decisão de amostragem, pura e sem motor.
 *
 * Fonte: [Tracing SDK · ShouldSample](https://opentelemetry.io/docs/specs/otel/trace/sdk/#shouldsample)
 * e a [tabela de reação](https://opentelemetry.io/docs/specs/otel/trace/sdk/#recording-sampled-reaction-table).
 *
 * O ponto do arquivo inteiro: **amostrar não é sim ou não.** `ShouldSample`
 * devolve três coisas, e a do meio — `RECORD_ONLY` — é a que quase ninguém sabe
 * que existe: o span é criado, é gravado, é legível dentro do processo, e o
 * exportador nunca o vê. Um modelo com duas saídas apagaria justamente o caso
 * que confunde quem instrumenta.
 *
 * `always-record` é o decorador da spec que transforma `DROP` em `RECORD_ONLY`.
 * Ele está aqui porque é o caminho honesto para o leitor **ver** a porta do
 * meio acender: sem ele, o único jeito de produzir `RECORD_ONLY` seria um
 * amostrador escrito para o lab, e um fenômeno que precisa de roteiro não é
 * fenômeno.
 */

export type Decisao = "record-and-sample" | "record-only" | "drop";

export type Amostrador =
  | { readonly tipo: "always-on" }
  | { readonly tipo: "always-off" }
  | { readonly tipo: "ratio"; readonly razao: number }
  /** `ParentBased`: o pai remoto decide; sem pai, decide a raiz. É o padrão da spec. */
  | { readonly tipo: "parent-based"; readonly raiz: Amostrador }
  /** O decorador que rebaixa `drop` a `record-only`, e nunca o contrário. */
  | { readonly tipo: "always-record"; readonly raiz: Amostrador };

export interface Sorteio {
  /** O sorteio do tick, em [0, 1). Vem do motor: `ctx.random()`. */
  readonly aleatorio: number;
  /** O bit `sampled` do `traceparent` que chegou, quando chegou um. */
  readonly paiAmostrado?: boolean;
}

/**
 * A porta por onde cada decisão sai.
 *
 * `Record<Decisao, PortId>` e não um `if`: decisão nova sem porta deixa de
 * compilar. E as três são distintas porque duas decisões na mesma porta seriam,
 * no desenho, uma decisão só — a confusão que a §6 da spec existe para desfazer.
 */
export const PORTA_DA_DECISAO: Record<Decisao, PortId> = {
  "record-and-sample": "sampled",
  "record-only": "recorded",
  drop: "dropped",
};

export function decidir(amostrador: Amostrador, sorteio: Sorteio): Decisao {
  switch (amostrador.tipo) {
    case "always-on":
      return "record-and-sample";
    case "always-off":
      return "drop";
    case "ratio":
      // `<` e não `<=`: com razão 0 nenhum sorteio passa, que é o que razão 0
      // quer dizer. Com `<=`, o sorteio exato 0 vazaria um span.
      return sorteio.aleatorio < amostrador.razao ? "record-and-sample" : "drop";
    case "parent-based":
      if (sorteio.paiAmostrado === undefined) return decidir(amostrador.raiz, sorteio);
      return sorteio.paiAmostrado ? "record-and-sample" : "drop";
    case "always-record": {
      const raiz = decidir(amostrador.raiz, sorteio);
      return raiz === "drop" ? "record-only" : raiz;
    }
  }
}
