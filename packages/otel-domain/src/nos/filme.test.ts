import { frameAt } from "@ovh/motion";
import { describe, expect, it } from "vitest";
import { filmeDosNos } from "./filme.js";

const fim = (f: ReturnType<typeof filmeDosNos>, cap: string) => frameAt(f, f.chapters.find((c) => c.id === cap)!.end);
const estado = (q: ReturnType<typeof fim>, id: string) => q.entities.find((e) => e.spec.id === id)!.state;

describe("the host and Kubernetes film is read from the model", () => {
  it("in 3D the Pods and the agent stand on their node", () => {
    const f = filmeDosNos();
    expect(f.entities.find((e) => e.id === "pod:checkout-7f9c")!.elevation).toBe(6);
    expect(f.entities.find((e) => e.id === "agent:node-a")!.elevation).toBe(6);
  });

  it("the agent's lookup returns the Pod; the gateway's returns nobody", () => {
    const a = filmeDosNos({ onde: "agent" });
    const g = filmeDosNos({ onde: "gateway" });
    expect(a.entities.find((e) => e.id === "r:0")!.label).toBe("POD");
    expect(g.entities.find((e) => e.id === "r:0")!.label).toBe("NOBODY");
    expect(g.entities.find((e) => e.id === "q:0")!.sublabel).toBe("10.0.1.4");
  });

  it("the backend cards say whether the pod name arrived", () => {
    expect(estado(fim(filmeDosNos({ onde: "agent" }), "backend"), "card:0").sublabel).toBe("checkout-7f9c · node-a");
    expect(estado(fim(filmeDosNos({ onde: "gateway" }), "backend"), "card:0").sublabel).toBe("service.name only");
  });

  it("without k8sattributes nobody asks the API server", () => {
    expect(filmeDosNos({ onde: "nenhum" }).entities.some((e) => e.id.startsWith("q:"))).toBe(false);
  });
});
