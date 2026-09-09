import type { SpanDoHeroi } from "./carga.js";

/**
 * Quem diz que duas mensagens são a mesma coisa.
 *
 * O motor dá id novo a cada emissão, e está certo: cada salto é uma mensagem
 * nova. A identidade é conhecimento de domínio, e aqui ela é o `traceId` — o
 * mesmo span atravessando o collector continua sendo aquele span.
 *
 * `noTrajeto` fica de fora: neste mundo tudo que anda é o span, e não há
 * produto que não continue o caminho. Ausente, tudo é parada.
 */
export const LEITOR_DO_SPAN = {
  chave: (mensagem: { readonly data: Readonly<Record<string, unknown>> }): string | undefined => {
    const spans = mensagem.data["spans"];
    if (!Array.isArray(spans) || spans.length === 0) return undefined;
    const primeiro = spans[0] as Partial<SpanDoHeroi>;
    return primeiro.traceId === undefined ? undefined : `span:${primeiro.traceId}`;
  },

  corpo: (mensagem: { readonly data: Readonly<Record<string, unknown>> }): unknown => {
    const spans = mensagem.data["spans"];
    if (!Array.isArray(spans) || spans.length === 0) return {};
    const span = spans[0] as SpanDoHeroi;
    return {
      traceId: span.traceId,
      spanId: span.spanId,
      name: span.name,
      durationMs: span.durationMs,
      resource: span.resource,
    };
  },
};

/** O título que a trilha mostra: o span, curto o bastante para caber. */
export const tituloDoSpan = (chave: string): string => `span ${chave.replace("span:", "").slice(0, 8)}`;
