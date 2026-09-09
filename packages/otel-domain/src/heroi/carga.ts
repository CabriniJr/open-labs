import { idHex } from "../anatomia/carga.js";

/**
 * O que viaja no herói: um span, e só.
 *
 * Ele nasce no serviço com o recurso que o processo declarou, e o collector
 * acrescenta o dele. É o enriquecimento mais simples que o OTLP tem, e é o que
 * a trilha desenha: o mesmo item, com um campo a mais depois de uma parada.
 */
export interface SpanDoHeroi {
  readonly n: number;
  readonly traceId: string;
  readonly spanId: string;
  readonly name: string;
  readonly durationMs: number;
  readonly resource: Readonly<Record<string, string>>;
}

/** As rotas que o serviço atende, em rodízio. Nomes de verdade, e curtos. */
const ROTAS = ["GET /checkout", "POST /cart", "GET /catalog"] as const;

/**
 * Um span novo. Determinístico: o mesmo carregamento conta a mesma história, e
 * uma vitrine que muda de resposta entre dois carregamentos não é evidência de
 * nada.
 */
export function spanDoHeroi(n: number): SpanDoHeroi {
  return {
    n,
    traceId: idHex(32, `heroi:trace:${n}`),
    spanId: idHex(16, `heroi:span:${n}`),
    name: ROTAS[n % ROTAS.length]!,
    durationMs: 40 + ((n * 37) % 160),
    resource: { "service.name": "checkout" },
  };
}
