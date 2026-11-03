import { frameAt } from "@ovh/motion";
import { describe, expect, it } from "vitest";
import { envelopeDoProtobuf, filmeDoProtobuf } from "./filme.js";

describe("o filme do protobuf", () => {
  const filme = filmeDoProtobuf();
  const { cod, json } = envelopeDoProtobuf();
  const cap = (id: string) => filme.chapters.find((c) => c.id === id)!;
  const ent = (t: number, id: string) => frameAt(filme, t).entities.find((e) => e.spec.id === id)!;

  it("os capítulos vão do objeto ao fio", () => {
    expect(filme.chapters.map((c) => c.id)).toEqual(["object", "keys", "varint", "lengths", "fixed", "nesting", "wire"]);
  });

  it("cada campo do envelope vira um bloco, do tamanho que o codificador mediu", () => {
    for (const c of cod.campos) expect(filme.entities.some((e) => e.id === `b:${c.inicio}:${c.profundidade}`)).toBe(true);
    const nome = cod.campos.find((c) => c.caminho.endsWith("spans[0].name"))!;
    const bloco = filme.entities.find((e) => e.id === `b:${nome.inicio}:${nome.profundidade}`)!;
    expect(bloco.type === "node" && bloco.sublabel).toBe(`${nome.fim - nome.inicio} B`);
  });

  it("no aninhamento, cada bloco sobe pelo número de mensagens em volta", () => {
    const fundo = cod.campos.find((c) => c.nome === "int_value")!;
    const id = `b:${fundo.inicio}:${fundo.profundidade}`;
    expect(ent(cap("fixed").end, id).state.lift).toBe(0);
    expect(ent(cap("nesting").end, id).state.lift).toBe(fundo.profundidade * 9);
  });

  it("o fim compara os dois tamanhos que o codificador mediu", () => {
    const p = filme.packets.filter((x) => x.tag === "OTLP");
    expect(p.map((x) => x.bytes)).toEqual([cod.bytes.length, json]);
    expect(json).toBeGreaterThan(cod.bytes.length * 2);
  });
});
