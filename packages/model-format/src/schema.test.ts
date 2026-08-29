import { describe, expect, it } from "vitest";
import { ParamSchema, PortSchema, WireSchema } from "./schema.js";

describe("PortSchema", () => {
  it("aceita uma porta de dado", () => {
    const r = PortSchema.safeParse({ role: "data", direction: "in", accepts: "item" });
    expect(r.success).toBe(true);
  });

  it("aceita descarte como direção — o medidor precisa dele para ser honesto", () => {
    const r = PortSchema.safeParse({ role: "data", direction: "drop", emits: "item" });
    expect(r.success).toBe(true);
  });

  it("recusa direção inventada", () => {
    expect(PortSchema.safeParse({ role: "data", direction: "lateral" }).success).toBe(false);
  });

  it("recusa porta de controle que declara carga: controle carrega sinal, não carga", () => {
    const r = PortSchema.safeParse({ role: "control", direction: "in", accepts: "item" });
    expect(r.success).toBe(false);
  });

  it("recusa campo inventado, para erro de digitação não virar silêncio", () => {
    const r = PortSchema.safeParse({ role: "data", direction: "in", acepts: "item" });
    expect(r.success).toBe(false);
  });
});

describe("ParamSchema", () => {
  it("exige unidade em número, para o controle poder mostrar o valor real", () => {
    expect(ParamSchema.safeParse({ type: "int", default: 512, unit: "items" }).success).toBe(true);
    expect(ParamSchema.safeParse({ type: "int", default: 512 }).success).toBe(false);
  });

  it("enum precisa listar valores, e o default precisa estar na lista", () => {
    const bom = { type: "enum", values: ["drop_new", "block"], default: "drop_new" };
    const ruim = { type: "enum", values: ["drop_new", "block"], default: "drop_old" };
    expect(ParamSchema.safeParse(bom).success).toBe(true);
    expect(ParamSchema.safeParse(ruim).success).toBe(false);
  });

  it("duração é string com unidade declarada", () => {
    expect(ParamSchema.safeParse({ type: "duration", default: "5s" }).success).toBe(true);
    expect(ParamSchema.safeParse({ type: "duration", default: 5 }).success).toBe(false);
  });

  it("recusa número fora da faixa que ele mesmo declara", () => {
    const fora = { type: "int", default: 9, unit: "items", min: 10, max: 20 };
    expect(ParamSchema.safeParse(fora).success).toBe(false);
  });
});

describe("WireSchema", () => {
  it("linha de dado é o padrão", () => {
    const r = WireSchema.parse({ from: "in", to: "queue.in" });
    expect(r.line).toBe("data");
  });

  it("linha de controle é declarada", () => {
    const r = WireSchema.parse({ from: "timer.tick", to: "batcher.trigger", line: "control" });
    expect(r.line).toBe("control");
  });
});
