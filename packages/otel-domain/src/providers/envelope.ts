import type { WorldState } from "@ovh/depth-core";
import { attribute } from "../otlp.js";
import { formatTraceparent } from "../traceparent.js";
import type { ExportTraceServiceRequest, OtelSpan, ScopeSpans } from "../otlp.js";
import { spansDa, type AtributoDeRecurso, type RegistroDeSpan } from "./carga.js";

/**
 * O L3: o mesmo run, visto como envelope OTLP.
 *
 * **É a tese do lab, e ela é estrutural, não decorativa.**
 *
 * > `ResourceSpans → ScopeSpans → Span` é, campo por campo, provider → tracer → span.
 *
 * O `resource` está uma camada **acima** dos spans porque ele pertence ao
 * provider. O `scope` está no meio porque pertence ao tracer. O span carrega só
 * o que a instrumentação de fato criou. Nenhuma dessas três frases é analogia:
 * são a mesma hierarquia vista de dois lados, e é isso que `envelope.test.ts`
 * cobra — nas duas metades de sempre, (⊆) o envelope não inventa campo e (⊇)
 * nenhuma placa deixa de aparecer nele.
 *
 * A fonte é o que está **atravessando o canal agora**: o tráfego em voo do
 * `WorldState`. Não é um mock e não é um segundo cálculo — é projeção do mesmo
 * run, que é a promessa que o projeto inteiro faz.
 */

export interface EnvelopeEmVoo {
  /** Qual exportador o pôs no canal. Com dois providers, são dois. */
  readonly de: string;
  readonly envelope: ExportTraceServiceRequest;
  /**
   * O header que acompanharia cada span na rede. Fica ao lado do envelope, e não
   * dentro do `OtelSpan`, porque no OTLP o bit `sampled` viaja no contexto e não
   * no corpo do span — juntá-los seria inventar um campo que a spec não tem.
   */
  readonly traceparents: readonly string[];
}

/** Um tick vale um segundo neste mundo; o OTLP fala em nanossegundos. */
const NANOS_POR_TICK = 1_000_000_000;
const nanos = (tick: number): string => String(tick * NANOS_POR_TICK);

const recursoDe = (bruto: unknown): readonly AtributoDeRecurso[] =>
  Array.isArray(bruto) ? (bruto as readonly AtributoDeRecurso[]) : [];

function otelSpan(registro: RegistroDeSpan): OtelSpan {
  return {
    traceId: registro.traceId,
    spanId: registro.spanId,
    name: registro.nome,
    // SERVER: o span nasce de uma requisição que entrou no processo.
    kind: 2,
    startTimeUnixNano: nanos(registro.inicio),
    endTimeUnixNano: nanos(registro.inicio + 1),
    attributes: [],
  };
}

/**
 * Agrupa por escopo — e o agrupamento **é** a camada `ScopeSpans`.
 *
 * Um `Map` guarda a ordem de inserção, então dois runs com a mesma semente
 * produzem o mesmo envelope byte a byte. Um objeto simples também guardaria,
 * mas o `Map` diz que a ordem é intencional.
 */
function porEscopo(registros: readonly RegistroDeSpan[]): readonly ScopeSpans[] {
  const grupos = new Map<string, OtelSpan[]>();
  for (const registro of registros) {
    const lista = grupos.get(registro.escopo) ?? [];
    lista.push(otelSpan(registro));
    grupos.set(registro.escopo, lista);
  }
  return [...grupos].map(([name, spans]) => ({ scope: { name }, spans }));
}

/**
 * Os envelopes que estão no canal neste tick.
 *
 * Vazio na maior parte dos ticks, e isso é resposta do modelo: o lote sai quando
 * um gatilho dispara, e não a cada instante. Um L3 que sempre tivesse algo para
 * mostrar estaria inventando tráfego.
 */
export function envelopesDe(state: WorldState): readonly EnvelopeEmVoo[] {
  const saida: EnvelopeEmVoo[] = [];
  for (const item of state.flight) {
    if (item.message.kind !== "otlp-traces") continue;
    const registros = spansDa(item.message);
    if (registros.length === 0) continue;
    const atributos = recursoDe(item.message.data["resource"]);
    saida.push({
      de: item.from,
      envelope: {
        resourceSpans: [
          {
            resource: { attributes: atributos.map((a) => attribute(a.chave, a.valor)) },
            scopeSpans: porEscopo(registros),
          },
        ],
      },
      traceparents: registros.map((r) =>
        formatTraceparent({ traceId: r.traceId, spanId: r.spanId, sampled: r.amostrado }),
      ),
    });
  }
  return saida;
}

/**
 * O envelope como o leitor o vê no L3. Um só, para desenhar — e quando dois
 * providers exportam no mesmo tick, os `resourceSpans` de todos eles no mesmo
 * documento, que é como um backend os receberia.
 */
export function envelopeUnico(state: WorldState): ExportTraceServiceRequest | undefined {
  const voando = envelopesDe(state);
  if (voando.length === 0) return undefined;
  return { resourceSpans: voando.flatMap((v) => v.envelope.resourceSpans) };
}
