import { describe, expect, it } from "vitest";
import { attribute, toOtlpJson, type OtelSpan } from "../otlp.js";
import { bytesEmJson, chave, codificarRequisicao, hex, varint } from "./codificar.js";

const SPAN: OtelSpan = {
  traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
  spanId: "00f067aa0ba902b7",
  name: "a",
  kind: 2,
  startTimeUnixNano: "1",
  endTimeUnixNano: "2",
  attributes: [attribute("http.response.status_code", 200)],
};
const REQ = toOtlpJson({ attributes: [attribute("service.name", "checkout")] }, [SPAN], "s");

describe("o protobuf do OTLP", () => {
  it("varint: sete bits por byte, o alto diz que tem mais", () => {
    expect(varint(1)).toEqual([1]);
    expect(varint(127)).toEqual([0x7f]);
    expect(varint(200)).toEqual([0xc8, 0x01]);
    expect(varint(300)).toEqual([0xac, 0x02]);
    expect(varint(-1)).toHaveLength(10);
  });

  it("a chave é (número << 3) | wire type", () => {
    expect(chave(5, 2)).toEqual([0x2a]); // span.name
    expect(chave(6, 0)).toEqual([0x30]); // span.kind
    expect(chave(7, 1)).toEqual([0x39]); // start_time_unix_nano
    expect(chave(1, 2)).toEqual([0x0a]);
  });

  it("escreve os campos do span nos bytes que o Collector lê", () => {
    const { bytes, campos } = codificarRequisicao(REQ);
    const de = (nome: string) => {
      const c = campos.find((x) => x.caminho.endsWith(`spans[0].${nome}`))!;
      return [...bytes.slice(c.inicio, c.fim)].map(hex).join(" ");
    };
    expect(de("name")).toBe("2a 01 61");
    expect(de("kind")).toBe("30 02");
    expect(de("start_time_unix_nano")).toBe("39 01 00 00 00 00 00 00 00");
    expect(de("trace_id")).toBe(`0a 10 ${"4bf92f3577b34da6a3ce929d0e0e4736".match(/../g)!.join(" ")}`);
    const status = campos.find((c) => c.nome === "int_value")!;
    expect([...bytes.slice(status.inicio, status.fim)].map(hex).join(" ")).toBe("18 c8 01");
  });

  it("cada mensagem cobre exatamente os filhos, e o topo cobre o envelope", () => {
    const { bytes, campos } = codificarRequisicao(REQ);
    const topo = campos.filter((c) => c.profundidade === 0);
    expect(topo.at(-1)!.fim).toBe(bytes.length);
    for (const m of campos.filter((c) => c.tipo === "message")) {
      const filhos = campos.filter((c) => c.profundidade === m.profundidade + 1 && c.inicio >= m.inicio && c.fim <= m.fim);
      const soma = filhos.reduce((s, c) => s + (c.fim - c.inicio), 0);
      expect(soma).toBe(m.fim - m.inicio - m.cabeca);
    }
  });

  it("o mesmo envelope é bem menor em protobuf que em JSON", () => {
    const { bytes } = codificarRequisicao(REQ);
    expect(bytes.length).toBeLessThan(bytesEmJson(REQ) / 2);
  });
});
