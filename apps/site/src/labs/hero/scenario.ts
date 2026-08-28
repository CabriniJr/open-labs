import type { Scenario } from "@ovh/depth-core";
import { attribute, formatTraceparent } from "@ovh/otel-domain";
import type { OtelSpan } from "@ovh/otel-domain";

export interface HeroState {
  /** Posição do pacote na aresta atual, de 0 a 1. */
  readonly progress: number;
  /** Aresta ativa: 0 = client→api, 1 = api→checkout. */
  readonly hop: 0 | 1;
  /** O header carregado neste hop, ou null se a propagação está desligada. */
  readonly header: string | null;
  readonly spans: readonly OtelSpan[];
}

const TRACE_A = "4bf92f3577b34da6a3ce929d0e0e4736";
const TRACE_B = "b7ad6b7169203331b1e5b3f1a2c40d99";
const SPAN_ROOT = "00f067aa0ba902b7";
const SPAN_CHILD = "a3ce929d0e0e4736";
const T0 = 1_700_000_000_000_000_000n;

function span(
  traceId: string,
  spanId: string,
  name: string,
  service: string,
  parentSpanId?: string,
): OtelSpan {
  const base: OtelSpan = {
    traceId,
    spanId,
    name,
    kind: 2,
    startTimeUnixNano: String(T0),
    endTimeUnixNano: String(T0 + 120_000_000n),
    attributes: [attribute("service.name", service), attribute("http.route", name)],
  };
  return parentSpanId === undefined ? base : { ...base, parentSpanId };
}

/**
 * O hero: uma requisição atravessa api → checkout. Com `propagate` ligado o
 * traceparent viaja e os dois spans formam um trace; desligado, o segundo
 * serviço abre um trace novo e o trace original fica pela metade.
 */
export const heroScenario: Scenario<HeroState> = {
  id: "hero",
  seed: 1312,
  levels: ["flow", "payload"],

  initialState: () => ({ progress: 0, hop: 0, header: null, spans: [] }),

  step: (state, ctx) => {
    const propagate = ctx.inputs.propagate !== false;
    const next = state.progress + 0.12;

    if (next < 1) {
      return { ...state, progress: next };
    }

    // Chegou ao fim da aresta: o serviço de destino emite seu span.
    if (state.hop === 0) {
      const root = span(TRACE_A, SPAN_ROOT, "GET /checkout", "api");
      return {
        progress: 0,
        hop: 1,
        header: propagate
          ? formatTraceparent({ traceId: TRACE_A, spanId: SPAN_ROOT, sampled: true })
          : null,
        spans: [root],
      };
    }

    const child = propagate
      ? span(TRACE_A, SPAN_CHILD, "POST /charge", "checkout", SPAN_ROOT)
      : span(TRACE_B, SPAN_CHILD, "POST /charge", "checkout");

    return {
      progress: 0,
      hop: 0,
      header: state.header,
      spans: state.spans.length >= 2 ? state.spans : [...state.spans, child],
    };
  },
};
