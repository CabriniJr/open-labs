import { describe, expect, it } from "vitest";
import { enriquecer, metricasDosNos, podComIp } from "./modelo.js";

describe("host and Kubernetes signals", () => {
  it("in the agent, the connection's IP is the Pod's: every span gets its pod name", () => {
    const r = enriquecer({ onde: "agent", associacao: "conexao" });
    expect(r.every((s) => s.casou)).toBe(true);
    expect(r[0]!.recurso["k8s.pod.name"]).toBe("checkout-7f9c");
    expect(r[2]!.recurso["k8s.node.name"]).toBe("node-b");
  });

  it("in a gateway, the connection comes from the agent: nobody has that IP, nothing is added", () => {
    const r = enriquecer({ onde: "gateway", associacao: "conexao" });
    expect(r.every((s) => !s.casou)).toBe(true);
    expect(r[0]!.ipPerguntado).toBe("10.0.1.4");
    expect(r[0]!.recurso["k8s.pod.name"]).toBeUndefined();
    expect(podComIp("10.0.1.4")).toBeNull();
  });

  it("associating by the k8s.pod.ip resource attribute works anywhere", () => {
    for (const onde of ["agent", "gateway"] as const) expect(enriquecer({ onde, associacao: "recurso" }).every((s) => s.casou)).toBe(true);
  });

  it("without k8sattributes the span has only what the SDK set", () => {
    expect(enriquecer({ onde: "nenhum", associacao: "conexao" })[0]!.recurso).toEqual({ "service.name": "checkout" });
  });

  it("host and kubelet metrics carry their identity without any association", () => {
    const m = metricasDosNos();
    expect(m.filter((x) => x.receiver === "hostmetrics").map((x) => x.recurso["host.name"])).toEqual(["node-a", "node-b"]);
    expect(m.filter((x) => x.receiver === "kubeletstats").every((x) => x.recurso["k8s.pod.name"] !== undefined)).toBe(true);
  });
});
