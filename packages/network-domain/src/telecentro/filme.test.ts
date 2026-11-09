import { frameAt } from "@ovh/motion";
import { describe, expect, it } from "vitest";
import { CAPITULOS_DA_REDE, filmeDaRede, TOM_DO_PROTOCOLO } from "./filme.js";

const fim = (f: ReturnType<typeof filmeDaRede>, cap: string) => frameAt(f, f.chapters.find((c) => c.id === cap)!.end);
const estado = (q: ReturnType<typeof fim>, id: string) => q.entities.find((e) => e.spec.id === id)!.state;

describe("the network film is read from the model", () => {
  it("has one chapter per protocol, in order", () => {
    expect(filmeDaRede().chapters.map((c) => c.id)).toEqual([...CAPITULOS_DA_REDE]);
  });

  it("in 3D, height is the floor where a device decides: hosts, switch, router, ISP", () => {
    const e = filmeDaRede().entities;
    const el = (id: string) => e.find((x) => x.id === id)!.elevation;
    expect([el("laptop"), el("sw1"), el("r1"), el("isp")]).toEqual([0, 16, 32, 48]);
  });

  it("after DHCP the laptop shows the address the model leased", () => {
    expect(estado(fim(filmeDaRede(), "dhcp"), "laptop").sublabel).toContain("192.168.10.2/25");
  });

  it("every chapter carries the Packet Tracer step for its protocol", () => {
    const f = filmeDaRede();
    for (const c of f.chapters) {
      const d = c.steps[0]?.detail;
      expect(d?.packetTracer.comandos.length, c.id).toBeGreaterThan(0);
      expect(d?.packetTracer.saida.length, c.id).toBeGreaterThan(0);
    }
  });

  it("the ACL chapter changes with the switch: a red UNREACHABLE, or a reply", () => {
    const com = filmeDaRede({ acl: true, nat: true });
    const sem = filmeDaRede({ acl: false, nat: true });
    const naAcl = (f: typeof com) => {
      const c = f.chapters.find((x) => x.id === "acl")!;
      return f.packets.filter((p) => p.t >= c.start && p.t <= c.end);
    };
    expect(naAcl(com).map((p) => p.tone)).toEqual([TOM_DO_PROTOCOLO.perdido]);
    expect(naAcl(sem).map((p) => p.tone)).toEqual([TOM_DO_PROTOCOLO.icmp]);
    expect(com.entities.some((e) => e.type === "token" && e.label === "UNREACHABLE")).toBe(true);
    expect(sem.entities.some((e) => e.type === "token" && e.label === "UNREACHABLE")).toBe(false);
  });

  it("without NAT the NAT chapter is named after what happens", () => {
    expect(filmeDaRede({ acl: true, nat: false }).chapters.find((c) => c.id === "nat")!.title).toBe("No NAT: the reply has nowhere to go");
  });

  it("the same team number reaches the film", () => {
    const f = filmeDaRede(undefined, 42);
    expect(estado(fim(f, "dhcp"), "laptop").sublabel).toContain("192.168.42.2");
  });
});
