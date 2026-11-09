import { cidr, ip, texto, vlsm, type Ipv4, type PedidoDeSubrede, type SetorId, type Subrede } from "./enderecamento.js";

/**
 * A rede de um telecentro comunitário: um lugar gratuito do bairro onde quem
 * não tem computador nem internet em casa aprende tecnologia. É o cenário de
 * exemplo da disciplina de redes — o lugar é o pretexto; o assunto é como os
 * protocolos funcionam.
 *
 * Três setores isolados em VLANs (equipe, cidadão no Wi-Fi público,
 * servidores), um switch com trunk 802.1Q até um roteador em
 * router-on-a-stick, e a saída para a internet por um provedor, com NAT.
 *
 * `X` é o número da equipe: a faixa é 192.168.X.0/24. Ele vive numa constante
 * só, e tudo — o plano, os comandos e o filme — é recalculado a partir dela.
 */
export const EQUIPE_PADRAO = 10;

export const PEDIDOS: readonly PedidoDeSubrede[] = [
  { setor: "cidadao", vlan: 20, nome: "CIDADAO", papel: "public Wi-Fi for learners", hosts: 100 },
  { setor: "equipe", vlan: 10, nome: "EQUIPE", papel: "staff and instructors", hosts: 20 },
  { setor: "servidores", vlan: 30, nome: "SERVIDORES", papel: "the OpenLabs server and sensors", hosts: 10 },
];

export type DispId = "laptop" | "ap" | "pc" | "srv" | "sw1" | "r1" | "isp" | "web";

export type Papel = "host" | "access-point" | "switch" | "router" | "server";

/**
 * O que é cada aparelho, para quem nunca viu um: o nome do papel, o que ele faz
 * em uma frase e onde ele aparece na história. É o texto do painel "O que é o
 * quê" e da etiqueta de cada desenho na vista Rede.
 */
export interface Explicacao {
  /** O papel, em duas ou três palavras. */
  readonly papel: string;
  /** O que ele faz, em uma frase, sem jargão que não esteja explicado. */
  readonly faz: string;
  /** O que ele faz no telecentro, em particular. */
  readonly aqui: string;
}

export const O_QUE_E: Readonly<Record<DispId, Explicacao>> = {
  laptop: { papel: "Learner's laptop", faz: "The computer of someone who came to learn. It has no network address until DHCP lends one.", aqui: "Joins the public Wi-Fi and opens the OpenLabs page." },
  ap: { papel: "Wi-Fi access point", faz: "Turns radio into cable: it lets wireless devices join the wired network, protected by a WPA2 password.", aqui: "Publishes the TELECENTRO-LIVRE network, which belongs to the learners' VLAN." },
  pc: { papel: "Staff computer", faz: "A desktop on the private staff network. The public Wi-Fi must never reach it.", aqui: "Where the instructors work, and the only place allowed to manage the router." },
  srv: { papel: "OpenLabs server", faz: "A machine that answers requests: it tells names (DNS) and serves web pages (HTTP).", aqui: "Hosts the course and the CitizenTech card, so learning works even without internet." },
  sw1: { papel: "Switch", faz: "Connects the cables of one building and keeps each VLAN apart, like separate rooms on the same corridor.", aqui: "Sends traffic between rooms up the trunk to the router, tagged with the room's number." },
  r1: { papel: "Router", faz: "Decides the path between different networks. It is the gateway of every room, and it checks the ACL.", aqui: "Joins the three VLANs, lends addresses (DHCP), translates to the public address (NAT) and guards the rooms (ACL)." },
  isp: { papel: "Internet provider", faz: "The company that connects the building to the internet. It only routes public addresses.", aqui: "Receives everything with R1's public address — and drops what still has a private one." },
  web: { papel: "Website on the internet", faz: "Any site outside the building, reached through the provider.", aqui: "The page a learner opens to test the way out through NAT." },
};

export interface Dispositivo {
  readonly id: DispId;
  /** O nome no Packet Tracer (hostname do IOS, ou o nome do aparelho). */
  readonly nome: string;
  /** O modelo que se arrasta no Packet Tracer. */
  readonly modelo: string;
  readonly papel: Papel;
  readonly setor?: SetorId;
  /** Endereço fixo, quando há; hosts por DHCP não têm (ver `dhcp.ts`). */
  readonly ip?: Ipv4;
  /** MAC fictício e estável, no formato do Packet Tracer. */
  readonly mac: string;
}

export interface Cabo {
  readonly de: DispId;
  readonly portaDe: string;
  readonly para: DispId;
  readonly portaPara: string;
  readonly tipo: "copper-straight" | "wireless";
  /** "trunk" leva várias VLANs com etiqueta 802.1Q; "access" leva uma só, sem etiqueta. */
  readonly modo: "trunk" | "access" | "routed";
  readonly vlan?: number;
}

export interface RegistroDns {
  readonly nome: string;
  readonly ip: Ipv4;
}

export interface Telecentro {
  readonly x: number;
  readonly base: Ipv4;
  readonly subredes: Readonly<Record<SetorId, Subrede>>;
  /** O enlace entre o roteador e o provedor: um /30, dois endereços úteis. */
  readonly wan: { readonly rede: Ipv4; readonly prefixo: 30; readonly r1: Ipv4; readonly isp: Ipv4 };
  /** A "internet" simulada: a rede do provedor onde mora um servidor web externo. */
  readonly internet: { readonly rede: Ipv4; readonly prefixo: 24; readonly gateway: Ipv4; readonly web: Ipv4 };
  readonly dispositivos: Readonly<Record<DispId, Dispositivo>>;
  readonly cabos: readonly Cabo[];
  readonly dns: readonly RegistroDns[];
  readonly ssid: string;
}

export const NOME_DA_FICHA = "openlabs.telecentro";
export const NOME_DA_INTERNET = "www.internet.example";

/** MAC fictício, estável por aparelho, no formato que o Packet Tracer mostra. */
function macDe(n: number): string {
  const h = (v: number) => v.toString(16).toUpperCase().padStart(4, "0");
  return `0060.${h(0x5c00 + n)}.${h(0x1a00 + n * 17)}`;
}

export function telecentro(x: number = EQUIPE_PADRAO): Telecentro {
  if (!Number.isInteger(x) || x < 0 || x > 255) throw new Error(`team number must be 0–255, got ${x}`);
  const base = ip(`192.168.${x}.0`);
  const lista = vlsm(base, 24, PEDIDOS);
  const subredes = Object.fromEntries(lista.map((s) => [s.setor, s])) as Record<SetorId, Subrede>;
  const srvIp = subredes.servidores.gateway + 1;
  const wanRede = ip(`100.64.${x}.0`);
  const internetRede = ip("203.0.113.0");
  const web = internetRede + 10;

  const d = (id: DispId, n: number, resto: Omit<Dispositivo, "id" | "mac">): Dispositivo => ({ id, mac: macDe(n), ...resto });
  const dispositivos: Record<DispId, Dispositivo> = {
    laptop: d("laptop", 1, { nome: "LAPTOP-CIDADAO", modelo: "Laptop-PT (with WPC300N wireless card)", papel: "host", setor: "cidadao" }),
    ap: d("ap", 2, { nome: "AP-TELECENTRO", modelo: "AccessPoint-PT", papel: "access-point", setor: "cidadao" }),
    pc: d("pc", 3, { nome: "PC-MONITOR", modelo: "PC-PT", papel: "host", setor: "equipe" }),
    srv: d("srv", 4, { nome: "SRV-OPENLABS", modelo: "Server-PT", papel: "server", setor: "servidores", ip: srvIp }),
    sw1: d("sw1", 5, { nome: "SW1", modelo: "2960-24TT", papel: "switch" }),
    r1: d("r1", 6, { nome: "R1", modelo: "2911", papel: "router" }),
    isp: d("isp", 7, { nome: "ISP", modelo: "2911", papel: "router", ip: wanRede + 2 }),
    web: d("web", 8, { nome: "WEB-INTERNET", modelo: "Server-PT", papel: "server", ip: web }),
  };

  const cabos: Cabo[] = [
    { de: "laptop", portaDe: "Wireless0", para: "ap", portaPara: "Port 1", tipo: "wireless", modo: "access", vlan: subredes.cidadao.vlan },
    { de: "ap", portaDe: "Port 0", para: "sw1", portaPara: "Fa0/2", tipo: "copper-straight", modo: "access", vlan: subredes.cidadao.vlan },
    { de: "pc", portaDe: "Fa0", para: "sw1", portaPara: "Fa0/1", tipo: "copper-straight", modo: "access", vlan: subredes.equipe.vlan },
    { de: "srv", portaDe: "Fa0", para: "sw1", portaPara: "Fa0/3", tipo: "copper-straight", modo: "access", vlan: subredes.servidores.vlan },
    { de: "sw1", portaDe: "G0/1", para: "r1", portaPara: "G0/0", tipo: "copper-straight", modo: "trunk" },
    { de: "r1", portaDe: "G0/1", para: "isp", portaPara: "G0/0", tipo: "copper-straight", modo: "routed" },
    { de: "isp", portaDe: "G0/1", para: "web", portaPara: "Fa0", tipo: "copper-straight", modo: "routed" },
  ];

  return {
    x,
    base,
    subredes,
    wan: { rede: wanRede, prefixo: 30, r1: wanRede + 1, isp: wanRede + 2 },
    internet: { rede: internetRede, prefixo: 24, gateway: internetRede + 1, web },
    dispositivos,
    cabos,
    dns: [
      { nome: NOME_DA_FICHA, ip: srvIp },
      { nome: NOME_DA_INTERNET, ip: web },
    ],
    ssid: "TELECENTRO-LIVRE",
  };
}

/** A tabela do plano de endereçamento, uma linha por rede, como vai no PDF. */
export interface LinhaDoPlano {
  readonly rede: string;
  readonly vlan: string;
  readonly cidr: string;
  readonly mascara: string;
  readonly gateway: string;
  readonly faixa: string;
  readonly broadcast: string;
  readonly hosts: string;
}

export function planoDeEnderecamento(t: Telecentro): LinhaDoPlano[] {
  const mascaraTexto = (p: number) => texto(p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0);
  const linhas: LinhaDoPlano[] = Object.values(t.subredes)
    .sort((a, b) => a.rede - b.rede)
    .map((s) => ({
      rede: `${s.nome} — ${s.papel}`,
      vlan: String(s.vlan),
      cidr: cidr(s.rede, s.prefixo),
      mascara: mascaraTexto(s.prefixo),
      gateway: texto(s.gateway),
      faixa: `${texto(s.gateway + 1)} – ${texto(s.ultimoUtil)}`,
      broadcast: texto(s.broadcast),
      hosts: `${s.hosts} needed · ${s.capacidade} fit`,
    }));
  linhas.push({
    rede: "WAN — R1 to the ISP",
    vlan: "—",
    cidr: cidr(t.wan.rede, t.wan.prefixo),
    mascara: mascaraTexto(t.wan.prefixo),
    gateway: `R1 ${texto(t.wan.r1)} · ISP ${texto(t.wan.isp)}`,
    faixa: "point-to-point",
    broadcast: texto(t.wan.rede + 3),
    hosts: "2 fit",
  });
  linhas.push({
    rede: "Internet (simulated) — the ISP's LAN",
    vlan: "—",
    cidr: cidr(t.internet.rede, t.internet.prefixo),
    mascara: mascaraTexto(t.internet.prefixo),
    gateway: texto(t.internet.gateway),
    faixa: `web server ${texto(t.internet.web)}`,
    broadcast: texto(t.internet.rede + 255),
    hosts: "254 fit",
  });
  return linhas;
}

/** O setor de um endereço, ou `undefined` se ele não for de dentro do telecentro. */
export function setorDe(t: Telecentro, endereco: Ipv4): Subrede | undefined {
  return Object.values(t.subredes).find((s) => endereco >= s.rede && endereco <= s.broadcast);
}
