import { describe, expect, it } from "vitest";
import { etapasDaCodificacao } from "./codificar.js";
import { envelopeDoProtobuf } from "./exemplo.js";
import { narrarEtapa } from "./narracao.js";

describe("a narração de cada etapa", () => {
  const etapas = etapasDaCodificacao(envelopeDoProtobuf().req);
  const de = (fim: string) => narrarEtapa(etapas.find((e) => e.campo.caminho.endsWith(fim))!);

  it("faz a conta da chave em bits", () => {
    expect(de("spans[0].name").chave.at(-1)![1]).toBe("00101010 = 0x2a");
  });

  it("mostra o varint de 200 em dois grupos de sete bits", () => {
    expect(de("int_value").valor).toContain("c8 = 1·1001000, 01 = 0·0000001");
  });

  it("conta quando um comprimento passa de 127 e ganha um byte", () => {
    const n = de("spans[0].attributes[0].key");
    expect(n.reacoes.find((r) => r.cresceu)!.texto).toContain("resource_spans: 105 → 128 B");
  });
});
