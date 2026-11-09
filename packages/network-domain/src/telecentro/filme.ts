import { center, connect, film, pt, through, type Box, type Director, type Film, type Shape, type Tone } from "@ovh/motion";
import { ICONES_REDE as I } from "../icones/icones.js";
import { texto } from "./enderecamento.js";
import { ajustesGraficos, configR1, configSw1, ipconfig, saidaDoCliente, showAccessLists, showNat, showVlanBrief } from "./ios.js";
import { comandoIos, concessao, dora, linhaIos, NOME_DA_ACL, OPCOES_DA_REDE, percorrer, regrasDoCidadao, type OpcoesDaRede, type Quadro, type Resultado, type Salto } from "./protocolos.js";
import { EQUIPE_PADRAO, NOME_DA_FICHA, NOME_DA_INTERNET, planoDeEnderecamento, telecentro, type DispId, type Telecentro } from "./topologia.js";

/**
 * O filme da rede do telecentro, derivado de `percorrer()` e `dora()`.
 *
 * Um cidadão chega com o notebook, entra no Wi-Fi público e abre o OpenLabs.
 * Cada capítulo é um protocolo fazendo a sua parte — DHCP dá o endereço, DNS
 * traduz o nome, HTTP traz a página, NAT leva à internet, a ACL guarda a sala
 * da equipe e o SSH deixa só a equipe mexer no roteador. Nenhum caminho é
 * escrito aqui: este arquivo só sabe onde cada aparelho mora no desenho.
 *
 * No 3D a altura é o andar da rede em que o aparelho decide: os hosts no
 * chão, o switch (camada 2) acima, o roteador (camada 3) mais acima e o
 * provedor no topo — o pacote sobe até onde precisa para chegar.
 *
 * Cada capítulo traz junto o passo no Cisco Packet Tracer: os comandos que
 * montam aquele pedaço e a saída que a verificação deve mostrar.
 */
export type Camada = "application" | "transport" | "network" | "link";

export interface PassoNoPacketTracer {
  /** Em que aparelho e em que aba/modo. */
  readonly onde: string;
  readonly comandos: readonly string[];
  /** A saída esperada da verificação — o print da equipe deve mostrar isto. */
  readonly saida: readonly string[];
}

export interface DetalheDaRede {
  readonly camada: Camada;
  readonly linhas: readonly (readonly [string, string])[];
  readonly packetTracer: PassoNoPacketTracer;
}

export const LARGURA_DA_REDE = 1280;
export const ALTURA_DA_REDE = 720;
export const CAMADAS: readonly Camada[] = ["application", "transport", "network", "link"];

const B = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });

export const CAIXAS: Readonly<Record<DispId, Box>> = {
  web: B(1060, 120, 180, 84),
  isp: B(1060, 275, 180, 84),
  r1: B(690, 200, 200, 84),
  sw1: B(690, 340, 200, 72),
  pc: B(110, 535, 190, 84),
  ap: B(445, 535, 165, 84),
  laptop: B(650, 535, 165, 84),
  srv: B(960, 535, 210, 84),
};

const REGIOES = {
  equipe: B(40, 465, 330, 190),
  cidadao: B(420, 465, 420, 190),
  servidores: B(890, 465, 350, 190),
} as const;

/** A altura no 3D: o andar da rede em que o aparelho decide. */
const ANDAR: Readonly<Record<DispId, number>> = { pc: 0, laptop: 0, srv: 0, ap: 0, sw1: 16, r1: 32, isp: 48, web: 48 };

const ICONE: Readonly<Record<DispId, (typeof I)[keyof typeof I]>> = { web: I.web, isp: I.isp, r1: I.router, sw1: I.switch, pc: I.pc, ap: I.ap, laptop: I.laptop, srv: I.server };

/** A cor de um pacote diz o protocolo; vermelho é o que foi barrado ou se perdeu. */
export const TOM_DO_PROTOCOLO = { dhcp: "kind-4", dns: "kind-3", http: "kind-1", icmp: "kind-2", ssh: "kind-5", perdido: "live" } as const satisfies Record<string, Tone>;

function linhasDoQuadro(q: Quadro, enlace: string): (readonly [string, string])[] {
  const portas = q.portaOrigem === undefined ? "echo request / reply" : `${q.portaOrigem} → ${q.portaDestino}`;
  return [
    ["link", enlace],
    ["Ethernet", `${q.macOrigem} → ${q.macDestino}`],
    ["802.1Q tag", q.vlan === undefined ? "none (access port or routed link)" : `VLAN ${q.vlan}`],
    ["IPv4", `${texto(q.ipOrigem)} → ${texto(q.ipDestino)}`],
    ["TTL", String(q.ttl)],
    [q.proto.toUpperCase(), portas],
  ];
}

const camadaDoSalto = (s: Salto): Camada => (s.quadro.vlan !== undefined ? "link" : s.de === "r1" ? "network" : "transport");

export function filmeDaRede(opcoes: OpcoesDaRede = OPCOES_DA_REDE, x: number = EQUIPE_PADRAO): Film<DetalheDaRede> {
  const t = telecentro(x);
  const f = film<DetalheDaRede>({ width: LARGURA_DA_REDE, height: ALTURA_DA_REDE, gap: 400, maxZoom: 1.6 });
  const nome = (id: DispId) => t.dispositivos[id].nome;
  const { cidadao, equipe, servidores } = t.subredes;

  // ------------------------------------------------------------ o cenário
  const regiao = (id: keyof typeof REGIOES, s: typeof cidadao) => f.add({ type: "region", id: `vlan:${id}`, box: REGIOES[id], label: `VLAN ${s.vlan} ${s.nome} · ${texto(s.rede)}/${s.prefixo}`, tone: "container" });
  regiao("equipe", equipe);
  regiao("cidadao", cidadao);
  regiao("servidores", servidores);
  f.add({ type: "region", id: "internet", box: B(1030, 70, 240, 340), label: "the internet (simulated)", tone: "muted" });

  const sub: Record<DispId, string> = {
    // O endereço primeiro e curto: é o que se procura num diagrama de rede.
    web: texto(t.internet.web),
    isp: texto(t.wan.isp),
    // Um gateway por sala: o mesmo prefixo, só o último octeto muda.
    r1: `gw .${cidadao.gateway & 255} · .${equipe.gateway & 255} · .${servidores.gateway & 255}`,
    sw1: `VLANs ${equipe.vlan} · ${cidadao.vlan} · ${servidores.vlan}`,
    pc: texto(concessao(t, "pc")),
    ap: `SSID ${t.ssid}`,
    laptop: "no address yet",
    srv: texto(t.dispositivos.srv.ip!),
  };
  const forma = (id: DispId): Shape => (id === "isp" ? "pill" : id === "srv" || id === "web" || id === "r1" || id === "sw1" ? "stack" : "box");
  const tom = (id: DispId): Tone => (id === "r1" || id === "isp" ? "controller" : id === "sw1" || id === "ap" ? "conduit" : id === "srv" || id === "web" ? "container" : "processor");
  for (const id of Object.keys(CAIXAS) as DispId[]) {
    f.add({ type: "node", id, box: CAIXAS[id], label: nome(id), sublabel: sub[id], tone: tom(id), shape: forma(id), icon: ICONE[id], elevation: ANDAR[id], height: 12 });
  }
  const fio = (de: DispId, para: DispId, rotulo: string, extra: { dashed?: boolean; tone?: Tone } = {}) =>
    f.add({ type: "link", id: `fio:${de}-${para}`, path: connect(CAIXAS[de], CAIXAS[para], 6), label: rotulo, tone: extra.tone ?? "muted", ...(extra.dashed === true ? { dashed: true } : {}) });
  fio("laptop", "ap", "Wi-Fi WPA2", { dashed: true });
  fio("ap", "sw1", `Fa0/2 · VLAN ${cidadao.vlan}`);
  fio("pc", "sw1", `Fa0/1 · VLAN ${equipe.vlan}`);
  fio("srv", "sw1", `Fa0/3 · VLAN ${servidores.vlan}`);
  fio("sw1", "r1", "trunk 802.1Q", { tone: "conduit" });
  fio("r1", "isp", `${texto(t.wan.rede)}/30`);
  fio("isp", "web", "203.0.113.0/24");
  f.add({ type: "note", id: "nota:r1", at: pt(790, 182), label: "", tone: "controller", align: "middle", width: 360, hidden: true });
  f.add({ type: "note", id: "nota:isp", at: pt(1150, 395), label: "", tone: "live", align: "middle", width: 220, hidden: true });

  // ------------------------------------------------------------ as viagens
  let n = 0;
  const elevacao = (a: DispId, b: DispId) => Math.max(ANDAR[a], ANDAR[b]) + 6;

  /** Um pedaço do caminho por salto, com o quadro decodificado no painel a cada salto. */
  const detalhado = (d: Director<DetalheDaRede>, saltos: readonly Salto[], rotulo: string, tone: Tone, pt0: PassoNoPacketTracer) => {
    for (const s of saltos) {
      const id = `pkt:${(n += 1)}`;
      f.add({ type: "token", id, path: connect(CAIXAS[s.de], CAIXAS[s.para], 8), label: rotulo, sublabel: s.quadro.vlan === undefined ? texto(s.quadro.ipDestino) : `VLAN ${s.quadro.vlan}`, tone, hidden: true, size: 4.5, elevation: elevacao(s.de, s.para) });
      d.beat({ title: `${nome(s.de)} → ${nome(s.para)}`, body: s.nota, detail: { camada: camadaDoSalto(s), linhas: linhasDoQuadro(s.quadro, s.enlace), packetTracer: pt0 } });
      d.send(id, { dur: 650 }).ping(s.para);
    }
  };
  /** O caminho inteiro numa ficha só, para as mensagens que repetem uma rota já vista. */
  const corrido = (d: Director<DetalheDaRede>, saltos: readonly Salto[], rotulo: string, tone: Tone, dur = 1100) => {
    if (saltos.length === 0) return;
    const pontos = [center(CAIXAS[saltos[0]!.de]), ...saltos.map((s) => center(CAIXAS[s.para]))];
    const id = `pkt:${(n += 1)}`;
    f.add({ type: "token", id, path: through(pontos), label: rotulo, sublabel: texto(saltos[0]!.quadro.ipDestino), tone, hidden: true, size: 4.5, trail: 3, elevation: Math.max(...saltos.map((s) => elevacao(s.de, s.para))) });
    d.send(id, { dur }).ping(saltos.at(-1)!.para);
  };
  const registrar = (d: Director<DetalheDaRede>, tag: string, tone: Tone, de: DispId, para: DispId, protocolo: string, payload: string) =>
    d.packet({ tag, tone, from: nome(de), to: nome(para), protocol: protocolo, payload });

  // ------------------------------------------------------------ 1. a rede
  const ptRede: PassoNoPacketTracer = { onde: "SW1 · CLI", comandos: configSw1(t).slice(3), saida: ["SW1#show vlan brief", ...showVlanBrief(t)] };
  f.chapter(
    {
      id: "network",
      title: "Three rooms, one cable",
      body: `The /24 is split by need: ${cidadao.hosts} learners get a /${cidadao.prefixo}, ${equipe.hosts} staff a /${equipe.prefixo}, ${servidores.hosts} servers a /${servidores.prefixo}. Each room is a VLAN; one trunk carries all three up to R1.`,
      detail: { camada: "link", linhas: planoDeEnderecamento(t).map((l) => [l.rede, `${l.cidr} · gw ${l.gateway}`] as const), packetTracer: ptRede },
    },
    (d) => {
      d.camera({ at: { cx: LARGURA_DA_REDE / 2, cy: ALTURA_DA_REDE / 2, zoom: 1 } }, { dur: 600 });
      d.ping(["vlan:equipe", "vlan:cidadao", "vlan:servidores"]).wait(700);
      d.glow("fio:sw1-r1").ping(["sw1", "r1"]).wait(900);
      d.glow("fio:sw1-r1", 0, { wait: false });
    },
  );

  // ------------------------------------------------------------ 2. DHCP
  const mensagens = dora(t, "laptop");
  const ptDhcp: PassoNoPacketTracer = { onde: "R1 · CLI, then LAPTOP-CIDADAO · Desktop → Command Prompt", comandos: configR1(t).filter((l) => /dhcp|network |default-router|dns-server/.test(l)), saida: ipconfig(t, "laptop") };
  const caminhoAteR1: DispId[] = ["laptop", "ap", "sw1", "r1"];
  const saltosDhcp = (de: DispId): Salto[] => {
    const ordem = de === "laptop" ? caminhoAteR1 : [...caminhoAteR1].reverse();
    return ordem.slice(0, -1).map((a, i): Salto => {
      const b = ordem[i + 1]!;
      const m = de === "laptop" ? mensagens[0]! : mensagens[1]!;
      const trunk = (a === "sw1" && b === "r1") || (a === "r1" && b === "sw1");
      return { de: a, para: b, enlace: `${nome(a)} → ${nome(b)}${trunk ? " · trunk 802.1Q" : ""}`, nota: "", quadro: { macOrigem: m.macOrigem, macDestino: m.macDestino, vlan: trunk ? cidadao.vlan : undefined, ipOrigem: 0, ipDestino: 0xffffffff, ttl: 128, proto: "udp", portaOrigem: de === "laptop" ? 68 : 67, portaDestino: de === "laptop" ? 67 : 68 } };
    });
  };
  f.chapter(
    {
      id: "dhcp",
      title: "DHCP: the laptop asks for an address",
      body: `It joins "${t.ssid}" with no IP. Four messages — Discover, Offer, Request, Ack — and R1's pool for VLAN ${cidadao.vlan} lends it ${texto(concessao(t, "laptop"))}.`,
      detail: { camada: "application", linhas: mensagens[0]!.campos, packetTracer: ptDhcp },
    },
    (d) => {
      d.camera({ pad: 90, focus: ["laptop", "ap", "sw1", "r1"] });
      mensagens.forEach((msg, i) => {
        const ida = msg.de === "laptop";
        d.beat({ title: `DHCP${msg.tipo}`, body: msg.resumo, detail: { camada: "application", linhas: [["from", `${msg.ipOrigem} (${msg.macOrigem})`], ["to", `${msg.ipDestino} (${msg.macDestino})`], ...msg.campos], packetTracer: ptDhcp } });
        if (i === 0) {
          // A primeira mensagem anda salto a salto: o broadcast sobe pelo trunk etiquetado.
          for (const s of saltosDhcp("laptop")) {
            const id = `pkt:${(n += 1)}`;
            f.add({ type: "token", id, path: connect(CAIXAS[s.de], CAIXAS[s.para], 8), label: msg.tipo, sublabel: s.quadro.vlan === undefined ? "broadcast" : `VLAN ${s.quadro.vlan}`, tone: TOM_DO_PROTOCOLO.dhcp, hidden: true, size: 4.5, elevation: elevacao(s.de, s.para) });
            d.beat({ title: `${nome(s.de)} → ${nome(s.para)}`, body: s.quadro.vlan === undefined ? "a broadcast floods the VLAN" : `SW1 tags the broadcast VLAN ${s.quadro.vlan} on the trunk`, detail: { camada: s.quadro.vlan === undefined ? "application" : "link", linhas: linhasDoQuadro(s.quadro, s.enlace), packetTracer: ptDhcp } });
            d.send(id, { dur: 600 }).ping(s.para);
          }
        } else {
          corrido(d, saltosDhcp(ida ? "laptop" : "r1"), msg.tipo, TOM_DO_PROTOCOLO.dhcp, 1000);
        }
        registrar(d, msg.tipo, TOM_DO_PROTOCOLO.dhcp, msg.de, msg.para, "DHCP", msg.resumo);
      });
      d.set("laptop", { sublabel: `${texto(concessao(t, "laptop"))}/${cidadao.prefixo}` }).ping("laptop").glow("laptop", 1, { wait: false }).wait(900);
      d.glow("laptop", 0, { wait: false });
    },
  );

  // ------------------------------------------------------------ 3. DNS
  const dns = percorrer(t, "laptop", "srv", "dns", opcoes);
  const ptDns: PassoNoPacketTracer = { onde: "SRV-OPENLABS · Services → DNS, then LAPTOP · Command Prompt", comandos: ajustesGraficos(t).filter((a) => a.onde.includes("DNS")).flatMap((a) => a.campos.map(([k, v]) => `${k}  ${v}`)), saida: saidaDoCliente(t, dns) };
  f.chapter(
    {
      id: "dns",
      title: "DNS: the name becomes a number",
      body: `The learner types ${NOME_DA_FICHA}. The laptop asks the server at ${texto(dns.pacote.destino)} — another VLAN, so the question climbs the trunk as VLAN ${cidadao.vlan} and comes down as VLAN ${servidores.vlan}.`,
      detail: { camada: "application", linhas: [["question", `A ${NOME_DA_FICHA}?`], ["asked to", texto(dns.pacote.destino)]], packetTracer: ptDns },
    },
    (d) => {
      d.camera({ pad: 90, focus: ["laptop", "sw1", "r1", "srv"] });
      viagem(d, dns, "DNS QUERY", "DNS A", TOM_DO_PROTOCOLO.dns, ptDns, true);
      registrar(d, "DNS", TOM_DO_PROTOCOLO.dns, "laptop", "srv", "DNS", `A ${NOME_DA_FICHA}? → ${texto(dns.pacote.destino)}`);
    },
  );

  // ------------------------------------------------------------ 4. HTTP
  const http = percorrer(t, "laptop", "srv", "http", opcoes);
  const ptHttp: PassoNoPacketTracer = { onde: "LAPTOP-CIDADAO · Desktop → Web Browser", comandos: [`http://${NOME_DA_FICHA}`], saida: saidaDoCliente(t, http) };
  f.chapter(
    {
      id: "http",
      title: "HTTP: the OpenLabs page",
      body: `Three TCP segments open the connection, then GET / and the page. ${http.porque}`,
      detail: { camada: "application", linhas: [["request", `GET / HTTP/1.1 · Host: ${NOME_DA_FICHA}`], ["ACL", http.decisao?.regra === undefined ? "not consulted" : linhaIos(http.decisao.regra)]], packetTracer: ptHttp },
    },
    (d) => {
      d.camera({ pad: 90, focus: ["laptop", "sw1", "r1", "srv"] });
      if (http.veredito !== "entregue") {
        viagem(d, http, "SYN", "", TOM_DO_PROTOCOLO.http, ptHttp, false);
        return;
      }
      for (const [rotulo, volta] of [["SYN", false], ["SYN-ACK", true], ["ACK", false]] as const) corrido(d, volta ? http.volta : http.ida, rotulo, TOM_DO_PROTOCOLO.http, 800);
      registrar(d, "TCP", TOM_DO_PROTOCOLO.http, "laptop", "srv", "TCP", "SYN · SYN-ACK · ACK (port 1025 → 80)");
      viagem(d, http, "GET /", "200 OK", TOM_DO_PROTOCOLO.http, ptHttp, false);
      registrar(d, "HTTP", TOM_DO_PROTOCOLO.http, "laptop", "srv", "HTTP", "GET / → 200 OK, the CitizenTech card");
    },
  );

  // ------------------------------------------------------------ 5. NAT
  const internet = percorrer(t, "laptop", "web", "http", opcoes);
  const ptNat: PassoNoPacketTracer = {
    onde: "R1 · CLI",
    comandos: configR1(t).filter((l) => /nat|access-list 1|ip route/.test(l)),
    saida: internet.traducao === undefined ? ["R1#show ip nat translations", "(empty: NAT is off)"] : showNat([internet.traducao]),
  };
  f.chapter(
    {
      id: "nat",
      title: opcoes.nat ? "NAT: one public address for everyone" : "No NAT: the reply has nowhere to go",
      body: `The learner opens ${NOME_DA_INTERNET}. ${internet.porque}`,
      detail: { camada: "network", linhas: internet.traducao === undefined ? [["NAT", "off"]] : [["inside local", internet.traducao.insideLocal], ["inside global", internet.traducao.insideGlobal], ["outside", internet.traducao.outsideGlobal]], packetTracer: ptNat },
    },
    (d) => {
      d.camera({ pad: 90, focus: ["laptop", "r1", "isp", "web"] });
      if (internet.traducao !== undefined) d.set("nota:r1", { label: `NAT ${internet.traducao.insideLocal} ↔ ${internet.traducao.insideGlobal}` });
      viagem(d, internet, "GET /", "200 OK", TOM_DO_PROTOCOLO.http, ptNat, true, (s) => (s.de === "r1" && internet.traducao !== undefined ? () => d.show("nota:r1", { dur: 300 }).ping("r1") : undefined));
      registrar(d, "HTTP", internet.veredito === "entregue" ? TOM_DO_PROTOCOLO.http : TOM_DO_PROTOCOLO.perdido, "laptop", "web", internet.traducao === undefined ? "HTTP" : "HTTP + NAT", internet.porque);
      d.hide("nota:r1", { dur: 250, wait: false });
    },
  );

  // ------------------------------------------------------------ 6. ACL
  const acl = percorrer(t, "laptop", "pc", "ping", opcoes);
  const listas = showAccessLists(t, [dns, http, internet, acl]);
  const ptAcl: PassoNoPacketTracer = {
    onde: "R1 · CLI, then LAPTOP · Command Prompt",
    comandos: [`ip access-list extended ${NOME_DA_ACL}`, ...regrasDoCidadao(t).map((r) => ` ${comandoIos(r)}`), " exit", `interface GigabitEthernet0/0.${cidadao.vlan}`, ` ip access-group ${NOME_DA_ACL} in`],
    saida: [...saidaDoCliente(t, acl), "", ...listas],
  };
  f.chapter(
    {
      id: "acl",
      title: opcoes.acl ? "ACL: the staff room is closed to the Wi-Fi" : "No ACL: the Wi-Fi walks into the staff room",
      body: `The laptop pings PC-MONITOR at ${texto(acl.pacote.destino)}. ${acl.porque}`,
      detail: { camada: "network", linhas: acl.decisao === undefined ? [["ACL", "not applied"]] : [["matched", acl.decisao.regra === undefined ? "implicit deny" : linhaIos(acl.decisao.regra)], ["why", acl.decisao.regra?.motivo ?? "nothing permitted it"]], packetTracer: ptAcl },
    },
    (d) => {
      d.camera({ pad: 90, focus: ["laptop", "sw1", "r1", "pc"] });
      viagem(d, acl, "ECHO", "REPLY", TOM_DO_PROTOCOLO.icmp, ptAcl, true);
      registrar(d, "ICMP", acl.veredito === "entregue" ? TOM_DO_PROTOCOLO.icmp : TOM_DO_PROTOCOLO.perdido, "laptop", "pc", "ICMP", acl.porque);
    },
  );

  // ------------------------------------------------------------ 7. SSH
  const sshEquipe = percorrer(t, "pc", "r1", "ssh", opcoes);
  const sshWifi = percorrer(t, "laptop", "r1", "ssh", opcoes);
  const ptSsh: PassoNoPacketTracer = { onde: "R1 · CLI, then PC-MONITOR and LAPTOP · Command Prompt", comandos: configR1(t).filter((l) => /ssh|username|domain-name|crypto|vty|login local|transport|access-class|VTY-EQUIPE|enable secret/.test(l)), saida: [...saidaDoCliente(t, sshEquipe), "", ...saidaDoCliente(t, sshWifi)] };
  f.chapter(
    {
      id: "ssh",
      title: "SSH: only the staff configures the router",
      // Rótulos fixos entre as duas frases: o tradutor do site separa o molde
      // por eles; duas frases coladas só por espaço ele não sabe onde cortar.
      body: `Staff PC: ${sshEquipe.porque} Wi-Fi laptop: ${sshWifi.porque}`,
      detail: { camada: "application", linhas: [["from PC-MONITOR", sshEquipe.veredito === "entregue" ? "login prompt" : sshEquipe.veredito], ["from the Wi-Fi", sshWifi.veredito === "entregue" ? "login prompt" : "connection refused"]], packetTracer: ptSsh },
    },
    (d) => {
      d.camera({ pad: 90, focus: ["pc", "laptop", "sw1", "r1"] });
      viagem(d, sshEquipe, "SSH", "LOGIN", TOM_DO_PROTOCOLO.ssh, ptSsh, false);
      registrar(d, "SSH", TOM_DO_PROTOCOLO.ssh, "pc", "r1", "SSH", sshEquipe.porque);
      viagem(d, sshWifi, "SSH", "REFUSED", TOM_DO_PROTOCOLO.ssh, ptSsh, false);
      registrar(d, "SSH", TOM_DO_PROTOCOLO.perdido, "laptop", "r1", "SSH", sshWifi.porque);
      d.camera({ at: { cx: LARGURA_DA_REDE / 2, cy: ALTURA_DA_REDE / 2, zoom: 1 } }, { dur: 900 });
    },
  );

  return f.build();

  /**
   * Um pedido e a resposta dele, como `percorrer` decidiu. O que foi barrado
   * fica vermelho onde parou, com o motivo escrito ao lado.
   */
  function viagem(d: Director<DetalheDaRede>, r: Resultado, rotuloIda: string, rotuloVolta: string, tone: Tone, pt0: PassoNoPacketTracer, saltoASalto: boolean, aoChegar?: (s: Salto) => (() => void) | undefined) {
    const ptAtual = pt0;
    if (saltoASalto) {
      for (const s of r.ida) {
        detalhado(d, [s], rotuloIda, tone, ptAtual);
        aoChegar?.(s)?.();
      }
    } else corrido(d, r.ida, rotuloIda, tone);
    const ultimo = r.ida.at(-1)?.para;
    if (r.veredito === "acl-ida" || r.veredito === "vty-recusado") {
      if (ultimo !== undefined) {
        const motivo = r.veredito === "vty-recusado" ? "vty: staff only" : `${NOME_DA_ACL} ${r.decisao?.regra === undefined ? "implicit deny" : `line ${r.decisao.regra.seq} deny`}`;
        d.set("nota:r1", { label: `✕ ${motivo}`, tone: "live" }).show("nota:r1", { dur: 250 }).ping(ultimo).wait(900);
        // O roteador avisa quem mandou: o "Destination host unreachable" do ping.
        if (r.servico === "ping" || r.veredito === "vty-recusado") corrido(d, [...r.ida].reverse().map((s) => ({ ...s, de: s.para, para: s.de })), r.veredito === "vty-recusado" ? "REFUSED" : "UNREACHABLE", TOM_DO_PROTOCOLO.perdido, 900);
        d.hide("nota:r1", { dur: 250 }).set("nota:r1", { tone: "controller" });
      }
      return;
    }
    if (r.veredito === "sem-servico") return;
    if (saltoASalto && r.volta.length > 0) detalhado(d, r.volta, rotuloVolta, r.veredito === "entregue" ? tone : TOM_DO_PROTOCOLO.perdido, ptAtual);
    else corrido(d, r.volta, rotuloVolta, r.veredito === "entregue" ? tone : TOM_DO_PROTOCOLO.perdido);
    if (r.veredito === "sem-rota-volta") {
      d.set("nota:isp", { label: `✕ no route to ${texto(r.pacote.origem)}` }).show("nota:isp", { dur: 250 }).ping("isp").wait(1200);
      d.hide("nota:isp", { dur: 250 });
    }
    if (r.veredito === "acl-volta") {
      d.set("nota:r1", { label: `✕ reply dropped · ${NOME_DA_ACL} line ${r.decisao?.regra?.seq ?? "implicit"}`, tone: "live" }).show("nota:r1", { dur: 250 }).ping("r1").wait(1000);
      d.hide("nota:r1", { dur: 250 }).set("nota:r1", { tone: "controller" });
    }
    if (r.veredito === "entregue") d.ping(r.origem).wait(300);
  }
}

/** Os capítulos do filme, na ordem, para o painel do Packet Tracer saber qual print mostrar. */
export const CAPITULOS_DA_REDE = ["network", "dhcp", "dns", "http", "nat", "acl", "ssh"] as const;
export type CapituloDaRede = (typeof CAPITULOS_DA_REDE)[number];
