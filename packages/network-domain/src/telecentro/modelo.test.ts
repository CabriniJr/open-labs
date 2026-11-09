import { describe, expect, it } from "vitest";
import { ip, prefixoPara, texto, vlsm } from "./enderecamento.js";
import { configR1, configSw1, saidaDoCliente, showNat } from "./ios.js";
import { avaliarAcl, concessao, dora, percorrer, regrasDoCidadao } from "./protocolos.js";
import { PEDIDOS, planoDeEnderecamento, telecentro } from "./topologia.js";

describe("addressing is calculated, not typed", () => {
  it("the prefix is the smallest block that fits hosts + network + broadcast", () => {
    expect(prefixoPara(100)).toBe(25);
    expect(prefixoPara(20)).toBe(27);
    expect(prefixoPara(10)).toBe(28);
    expect(prefixoPara(62)).toBe(26);
    expect(prefixoPara(63)).toBe(25);
  });

  it("VLSM gives the biggest subnet first, each aligned, none overlapping", () => {
    const t = telecentro(10);
    expect(texto(t.subredes.cidadao.rede)).toBe("192.168.10.0");
    expect(t.subredes.cidadao.prefixo).toBe(25);
    expect(texto(t.subredes.equipe.rede)).toBe("192.168.10.128");
    expect(t.subredes.equipe.prefixo).toBe(27);
    expect(texto(t.subredes.servidores.rede)).toBe("192.168.10.160");
    expect(t.subredes.servidores.prefixo).toBe(28);
    const lista = Object.values(t.subredes).sort((a, b) => a.rede - b.rede);
    for (let i = 1; i < lista.length; i += 1) expect(lista[i]!.rede).toBeGreaterThan(lista[i - 1]!.broadcast);
  });

  it("the team number moves everything with it", () => {
    const t = telecentro(42);
    expect(texto(t.subredes.equipe.gateway)).toBe("192.168.42.129");
    expect(texto(t.dispositivos.srv.ip!)).toBe("192.168.42.162");
    expect(configR1(t).join("\n")).toContain("ip address 192.168.42.129 255.255.255.224");
  });

  it("refuses what does not fit in the /24", () => {
    expect(() => vlsm(ip("192.168.1.0"), 24, [...PEDIDOS, { setor: "equipe", vlan: 40, nome: "BIG", papel: "", hosts: 200 }])).toThrow(/does not fit/);
  });

  it("the plan has one row per VLAN plus the WAN and the internet", () => {
    expect(planoDeEnderecamento(telecentro()).map((l) => l.vlan)).toEqual(["20", "10", "30", "—", "—"]);
  });
});

describe("DHCP", () => {
  it("the laptop gets the first address after the gateway; the server range is excluded", () => {
    const t = telecentro(10);
    expect(texto(concessao(t, "laptop"))).toBe("192.168.10.2");
    expect(texto(concessao(t, "pc"))).toBe("192.168.10.130");
  });

  it("DORA: two broadcasts from 0.0.0.0, and the ACK carries gateway and DNS", () => {
    const t = telecentro(10);
    const m = dora(t, "laptop");
    expect(m.map((x) => x.tipo)).toEqual(["DISCOVER", "OFFER", "REQUEST", "ACK"]);
    expect(m[0]!.ipOrigem).toBe("0.0.0.0");
    expect(m[2]!.ipDestino).toBe("255.255.255.255");
    expect(Object.fromEntries(m[3]!.campos)).toMatchObject({ router: "192.168.10.1", "DNS server": "192.168.10.162" });
  });
});

describe("the ACL is read top to bottom", () => {
  const t = telecentro(10);
  const regras = regrasDoCidadao(t);
  const laptop = ip("192.168.10.2");

  it("first match wins", () => {
    expect(avaliarAcl(regras, { proto: "tcp", origem: laptop, destino: ip("192.168.10.162"), portaOrigem: 1025, portaDestino: 80 }).regra?.seq).toBe(30);
    expect(avaliarAcl(regras, { proto: "tcp", origem: laptop, destino: ip("192.168.10.162"), portaOrigem: 1025, portaDestino: 22 }).regra?.seq).toBe(40);
    expect(avaliarAcl(regras, { proto: "icmp", origem: laptop, destino: ip("192.168.10.130") }).regra?.seq).toBe(10);
    expect(avaliarAcl(regras, { proto: "tcp", origem: laptop, destino: ip("203.0.113.10"), portaOrigem: 1025, portaDestino: 80 }).regra?.seq).toBe(50);
  });

  it("what matches no line falls into the implicit deny", () => {
    const d = avaliarAcl(regras, { proto: "icmp", origem: ip("10.0.0.1"), destino: ip("192.168.10.130") });
    expect(d).toEqual({ permitido: false, regra: undefined });
  });

  it("DHCP from 0.0.0.0 passes, because line 5 exists", () => {
    expect(avaliarAcl(regras, { proto: "udp", origem: 0, destino: 0xffffffff, portaOrigem: 68, portaDestino: 67 }).permitido).toBe(true);
  });
});

describe("a packet's path", () => {
  const t = telecentro(10);

  it("between VLANs: up the trunk as VLAN 20, down as VLAN 30, TTL − 1 at R1", () => {
    const r = percorrer(t, "laptop", "srv", "http");
    expect(r.veredito).toBe("entregue");
    const trunk = r.ida.filter((s) => s.quadro.vlan !== undefined);
    expect(trunk.map((s) => [s.de, s.para, s.quadro.vlan])).toEqual([
      ["sw1", "r1", 20],
      ["r1", "sw1", 30],
    ]);
    expect(r.ida.at(-1)!.quadro.ttl).toBe(127);
    expect(r.ida.at(-1)!.quadro.macOrigem).toBe(r.ida.find((s) => s.de === "r1")!.quadro.macOrigem);
  });

  it("the ACL stops the Wi-Fi at R1, and only when it is on", () => {
    expect(percorrer(t, "laptop", "pc", "ping").veredito).toBe("acl-ida");
    expect(percorrer(t, "laptop", "pc", "ping").ida.at(-1)!.para).toBe("r1");
    expect(percorrer(t, "laptop", "pc", "ping", { acl: false, nat: true }).veredito).toBe("entregue");
  });

  it("staff to Wi-Fi fails on the reply, not on the request", () => {
    const r = percorrer(t, "pc", "laptop", "ping");
    expect(r.veredito).toBe("acl-volta");
    expect(r.ida.at(-1)!.para).toBe("laptop");
  });

  it("NAT rewrites the source on the WAN link and keeps the port", () => {
    const r = percorrer(t, "laptop", "web", "http");
    const wan = r.ida.find((s) => s.de === "r1" && s.para === "isp")!;
    expect(texto(wan.quadro.ipOrigem)).toBe("100.64.10.1");
    expect(wan.quadro.portaOrigem).toBe(1025);
    expect(r.traducao).toEqual({ proto: "tcp", insideGlobal: "100.64.10.1:1025", insideLocal: "192.168.10.2:1025", outsideLocal: "203.0.113.10:80", outsideGlobal: "203.0.113.10:80" });
    expect(r.volta.at(-1)!.para).toBe("laptop");
  });

  it("without NAT the request arrives and the reply dies at the ISP", () => {
    const r = percorrer(t, "laptop", "web", "http", { acl: true, nat: false });
    expect(r.veredito).toBe("sem-rota-volta");
    expect(r.ida.at(-1)!.para).toBe("web");
    expect(r.volta.at(-1)!.para).toBe("isp");
    expect(texto(r.ida.find((s) => s.de === "r1")!.quadro.ipOrigem)).toBe("192.168.10.2");
  });

  it("SSH: staff yes, Wi-Fi no", () => {
    expect(percorrer(t, "pc", "r1", "ssh").veredito).toBe("entregue");
    expect(percorrer(t, "laptop", "r1", "ssh").veredito).toBe("vty-recusado");
  });
});

describe("Packet Tracer commands and outputs come from the same model", () => {
  const t = telecentro(10);

  it("the subinterface of the Wi-Fi carries the ACL, and the trunk allows the three VLANs", () => {
    const r1 = configR1(t).join("\n");
    expect(r1).toContain("interface GigabitEthernet0/0.20\n description VLAN 20 CIDADAO\n encapsulation dot1Q 20\n ip address 192.168.10.1 255.255.255.128\n ip nat inside\n ip access-group CIDADAO-IN in");
    expect(r1).toContain(" 10 deny ip 192.168.10.0 0.0.0.127 192.168.10.128 0.0.0.31");
    expect(r1).toContain(" 30 permit tcp 192.168.10.0 0.0.0.127 host 192.168.10.162 eq www");
    expect(r1).toContain("ip dhcp excluded-address 192.168.10.161 192.168.10.162");
    expect(configSw1(t)).toContain(" switchport trunk allowed vlan 10,20,30");
  });

  it("the ping output matches the verdict", () => {
    expect(saidaDoCliente(t, percorrer(t, "laptop", "pc", "ping"))).toContain("Reply from 192.168.10.1: Destination host unreachable.");
    expect(saidaDoCliente(t, percorrer(t, "pc", "srv", "ping"))).toContain("Reply from 192.168.10.162: bytes=32 time<1ms TTL=127");
    expect(saidaDoCliente(t, percorrer(t, "laptop", "web", "ping"))).toContain("Reply from 203.0.113.10: bytes=32 time<1ms TTL=126");
  });

  it("show ip nat translations lists what the model translated", () => {
    const r = percorrer(t, "laptop", "web", "http");
    expect(showNat([r.traducao!]).at(-1)).toMatch(/^tcp\s+100\.64\.10\.1:1025\s+192\.168\.10\.2:1025/);
  });
});
