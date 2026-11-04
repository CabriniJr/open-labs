import { frameAt } from "@ovh/motion";
import { describe, expect, it } from "vitest";
import { amostrar, filmeDaVitrineDaAmostragem, traceQueFalha, type ModoDaAmostragem } from "./vitrine.js";

const doErro = (modo: ModoDaAmostragem) => amostrar({ modo }).decisoes.find((d) => d.erro)!;

describe("the sampling showcase — the model", () => {
  it("head drops the failing trace: it decided before the error existed", () => {
    expect(doErro("head").guardados).toEqual([]);
  });

  it("tail routed by trace id keeps the error whole", () => {
    expect(doErro("tail-roteado").guardados).toEqual(["checkout", "payments"]);
  });

  it("tail with spans spread keeps only the half that saw the error", () => {
    expect(doErro("tail-espalhado").guardados).toEqual(["payments"]);
  });

  it("the probabilistic part is the same decision in every mode", () => {
    const sem = (modo: "head" | "tail-roteado" | "tail-espalhado") => amostrar({ modo }).decisoes.filter((d) => !d.erro).map((d) => d.guardados.length > 0);
    expect(sem("tail-roteado")).toEqual(sem("head"));
    expect(sem("tail-espalhado")).toEqual(sem("head"));
  });

  it("routing by trace id puts both spans of a trace on the same gateway", () => {
    const a = amostrar({ modo: "tail-roteado" });
    for (let t = 1; t <= 8; t += 1) expect(new Set(a.spans.filter((s) => s.trace === t).map((s) => s.gateway)).size).toBe(1);
    expect(traceQueFalha()).toBe(a.traceComErro);
  });
});

describe("the sampling showcase — the film", () => {
  const fim = (f: ReturnType<typeof filmeDaVitrineDaAmostragem>, cap: string) => frameAt(f, f.chapters.find((c) => c.id === cap)!.end);
  it("only tail has a decision window, and its height is the spans held", () => {
    expect(filmeDaVitrineDaAmostragem({ modo: "head" }).chapters.some((c) => c.id === "window")).toBe(false);
    const f = filmeDaVitrineDaAmostragem({ modo: "tail-roteado" });
    const a = amostrar({ modo: "tail-roteado" });
    expect(f.entities.find((e) => e.id === "janela:0")!.height).toBe(4 + a.retidos[0] * 4);
  });

  it("the error card says what arrived", () => {
    const t = traceQueFalha();
    const sub = (modo: "head" | "tail-roteado" | "tail-espalhado") => fim(filmeDaVitrineDaAmostragem({ modo }), "verdict").entities.find((e) => e.spec.id === `kept:${t}`)!.state.sublabel;
    expect([sub("head"), sub("tail-roteado"), sub("tail-espalhado")]).toEqual(["dropped", "whole trace", "only payments · orphan"]);
  });
});
