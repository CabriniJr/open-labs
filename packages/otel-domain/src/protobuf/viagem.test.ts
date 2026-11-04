import { frameAt } from "@ovh/motion";
import { describe, expect, it } from "vitest";
import { filmeDaViagem } from "./viagem.js";

describe("a viagem do span", () => {
  const filme = filmeDaViagem();
  const cap = (id: string) => filme.chapters.find((c) => c.id === id)!;

  it("o papel vai de app em app, e a tela soma um verbo por parada", () => {
    expect(filme.chapters.map((c) => c.id)).toEqual(["create", "stamp", "write", "spell", "send", "read", "store"]);
    const fim = frameAt(filme, filme.duration).detail!;
    expect(fim.diario.map((l) => l.verbo)).toEqual(["creates", "stamps", "writes", "spells", "sends", "reads + batches", "stores"]);
    // A tela soma: cada capítulo mostra o que veio antes mais a linha dele.
    expect(frameAt(filme, cap("send").end).detail!.diario).toHaveLength(5);
  });

  it("os tamanhos saem do codificador, e o JSON pesa mais", () => {
    const pb = filme.packets.find((p) => p.from === "checkout SDK")!.bytes!;
    const json = filmeDaViagem({ codificacao: "json" }).packets.find((p) => p.from === "checkout SDK")!.bytes!;
    expect(json).toBeGreaterThan(pb * 2);
    expect(pb).toBeGreaterThan(100);
  });

  it("um atributo a mais engorda o papel", () => {
    const sem = filme.packets[0]!.bytes!;
    const com = filmeDaViagem({ atributoExtra: true }).packets[0]!.bytes!;
    expect(com).toBeGreaterThan(sem);
  });

  it("no SDK a câmera desce para dentro do papel, e de um campo", () => {
    expect(frameAt(filme, cap("write").end).camera.zoom).toBeGreaterThan(2);
    expect(frameAt(filme, cap("spell").end).camera.zoom).toBeGreaterThan(frameAt(filme, cap("write").end).camera.zoom * 2);
    expect(frameAt(filme, cap("store").end).camera.zoom).toBeCloseTo(1, 1);
  });
});
