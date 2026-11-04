import type { Tone } from "@ovh/motion";
import { attribute, toOtlpJson, type OtelSpan } from "../otlp.js";
import { bytesEmJson, codificarRequisicao, type CampoCodificado } from "./codificar.js";

/**
 * O exemplo do lab "Reading an OTLP payload": um span do checkout, o mesmo no
 * showcase em etapas e na simulação. O tom de cada jeito de escrever também
 * mora aqui, para os dois falarem a mesma cor.
 */
export const SPAN_DO_PROTOBUF: OtelSpan = {
  traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
  spanId: "00f067aa0ba902b7",
  name: "GET /cart",
  kind: 2,
  startTimeUnixNano: "1730649600000000000",
  endTimeUnixNano: "1730649600042000000",
  attributes: [attribute("http.request.method", "GET"), attribute("http.response.status_code", 200)],
};

export function envelopeDoProtobuf() {
  const req = toOtlpJson({ attributes: [attribute("service.name", "checkout")] }, [SPAN_DO_PROTOBUF], "checkout");
  return { req, cod: codificarRequisicao(req), json: bytesEmJson(req) };
}

/** Que tom cada jeito de escrever tem, em todo o lab. */
export function tomDoCampo(c: CampoCodificado): Tone {
  if (c.tipo === "message") return "conduit";
  if (c.tipo === "varint") return "high";
  if (c.tipo === "fixed64") return "kind-4";
  if (c.tipo === "bytes") return "kind-2";
  return "kind-1";
}

