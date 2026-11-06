import { describe, expect, it } from "vitest";
import { abrirSpan, criarThread, juntar, logar, novoProcesso, rodarLog } from "./modelo.js";

const final = (ponte: boolean, propagar: boolean) => rodarLog({ ponte, propagar }).at(-1)!.estado;

describe("a log that knows its trace", () => {
  it("the bridge stamps the active span of the calling thread as fields", () => {
    const e = logar(abrirSpan(novoProcesso(true), "main", "op"), "main", "hello");
    const log = e.logs[0]!;
    expect(log.spanId).toBe(e.spans[0]!.spanId);
    expect(log.traceId).toBe(e.spans[0]!.traceId);
    expect(log.corpo).toBe("hello");
  });

  it("the innermost open span wins: the log hangs from the child, not the root", () => {
    const e = final(true, true);
    const j = juntar(e);
    expect(j.find((x) => x.log.corpo === "card authorized")).toMatchObject({ motivo: "joined", span: { nome: "charge card" } });
    expect(j.find((x) => x.log.corpo === "cart loaded")).toMatchObject({ motivo: "joined", span: { nome: "POST /checkout" } });
  });

  it("a log after the span ended has no context, and that is correct", () => {
    const j = juntar(final(true, true));
    expect(j.find((x) => x.log.corpo === "request finished")!.motivo).toBe("no-context");
  });

  it("a new thread starts with no context unless someone carries it", () => {
    expect(juntar(final(true, true)).find((x) => x.log.thread === "worker")!.motivo).toBe("joined");
    expect(juntar(final(true, false)).find((x) => x.log.thread === "worker")!.motivo).toBe("no-context");
    const e = criarThread(abrirSpan(novoProcesso(true), "main", "op"), "main", "w", false);
    expect(e.threads["w"]).toEqual([]);
  });

  it("without the bridge, the id in the message text joins nothing", () => {
    const j = juntar(final(false, true));
    expect(j.filter((x) => x.motivo === "joined")).toHaveLength(0);
    expect(j.filter((x) => x.motivo === "text-only").map((x) => x.log.corpo)).toEqual([
      expect.stringContaining("cart loaded trace_id="),
      expect.stringContaining("card authorized trace_id="),
      expect.stringContaining("receipt email queued trace_id="),
    ]);
  });

  it("counts: 3 of 4 logs join with bridge and propagation, 2 without propagation, 0 without the bridge", () => {
    const n = (p: boolean, q: boolean) => juntar(final(p, q)).filter((x) => x.motivo === "joined").length;
    expect([n(true, true), n(true, false), n(false, true)]).toEqual([3, 2, 0]);
  });
});
