import { curinga, naRede, texto, type Ipv4 } from "./enderecamento.js";
import { setorDe, type DispId, type Telecentro } from "./topologia.js";

/**
 * O que acontece com um pacote na rede do telecentro, salto a salto.
 *
 * Três regras decidem tudo, e elas são as do IOS:
 * - dentro da mesma VLAN, o switch entrega sem passar pelo roteador;
 * - entre VLANs, o quadro sobe pelo trunk com a etiqueta 802.1Q da VLAN de
 *   origem e desce com a da VLAN de destino; o roteador troca os MACs e tira 1
 *   do TTL;
 * - a ACL `CIDADAO-IN` é lida de cima para baixo na entrada da subinterface do
 *   Wi-Fi público, a primeira linha que casa decide, e o que nenhuma casa é
 *   negado (o `deny` implícito no fim).
 *
 * O NAT (PAT, "overload") troca o endereço de origem na saída para o provedor e
 * desfaz a troca na volta. Sem ele o pedido chega à internet, mas a resposta
 * vai para um 192.168 que o provedor não sabe rotear — e se perde.
 */

export type Protocolo = "icmp" | "tcp" | "udp";
export type Servico = "ping" | "http" | "dns" | "ssh";

export const PORTA: Readonly<Record<Exclude<Servico, "ping">, number>> = { http: 80, dns: 53, ssh: 22 };
const PROTO: Readonly<Record<Servico, Protocolo>> = { ping: "icmp", http: "tcp", dns: "udp", ssh: "tcp" };
/** A porta efêmera que o cliente usa. O Packet Tracer começa em 1025. */
export const PORTA_EFEMERA = 1025;
/** O TTL com que um PC ou servidor do Packet Tracer manda um pacote. */
export const TTL_INICIAL = 128;

export interface Pacote {
  readonly proto: Protocolo;
  readonly origem: Ipv4;
  readonly destino: Ipv4;
  readonly portaOrigem?: number;
  readonly portaDestino?: number;
}

// ---------------------------------------------------------------- endereços

/** O endereço que o DHCP entrega: o primeiro livre do pool, fora dos excluídos. */
export function excluidos(t: Telecentro): Readonly<Record<keyof Telecentro["subredes"], readonly Ipv4[]>> {
  const s = t.subredes;
  const srv = t.dispositivos.srv.ip!;
  const faixa = (de: Ipv4, ate: Ipv4) => Array.from({ length: ate - de + 1 }, (_, i) => de + i);
  return {
    cidadao: [s.cidadao.gateway],
    equipe: [s.equipe.gateway],
    servidores: faixa(s.servidores.gateway, srv),
  };
}

export function concessao(t: Telecentro, cliente: "laptop" | "pc"): Ipv4 {
  const setor = t.dispositivos[cliente].setor!;
  const s = t.subredes[setor];
  const fora = new Set(excluidos(t)[setor]);
  for (let a = s.gateway; a <= s.ultimoUtil; a += 1) if (!fora.has(a)) return a;
  throw new Error(`the ${s.nome} pool is exhausted`);
}

/** O endereço de um aparelho como ele é visto de dentro do setor `de`. */
export function enderecoDe(t: Telecentro, id: DispId, de?: DispId): Ipv4 {
  if (id === "laptop" || id === "pc") return concessao(t, id);
  if (id === "r1") {
    const setor = de === undefined ? undefined : t.dispositivos[de].setor;
    return setor === undefined ? t.wan.r1 : t.subredes[setor].gateway;
  }
  const ipFixo = t.dispositivos[id].ip;
  if (ipFixo === undefined) throw new Error(`${id} has no IP address`);
  return ipFixo;
}

/** O MAC de uma interface. Roteador tem um por porta física; o resto, um só. */
export function macDe(t: Telecentro, id: DispId, porta?: "G0/0" | "G0/1"): string {
  const base = t.dispositivos[id].mac;
  if (porta !== "G0/1") return base;
  const [a, b, c] = base.split(".");
  return `${a}.${b}.${(parseInt(c!, 16) ^ 0x00ff).toString(16).toUpperCase().padStart(4, "0")}`;
}

// ---------------------------------------------------------------- ACL

export type Alvo = { readonly tipo: "any" } | { readonly tipo: "host"; readonly ip: Ipv4 } | { readonly tipo: "rede"; readonly rede: Ipv4; readonly prefixo: number };

export interface RegraAcl {
  readonly seq: number;
  readonly acao: "permit" | "deny";
  readonly proto: "ip" | Protocolo;
  readonly origem: Alvo;
  readonly destino: Alvo;
  readonly portaDestino?: number;
  /** Por que a linha existe, em uma frase. */
  readonly motivo: string;
}

export const NOME_DA_ACL = "CIDADAO-IN";
export const NOME_DA_ACL_VTY = "VTY-EQUIPE";

export function regrasDoCidadao(t: Telecentro): RegraAcl[] {
  const { cidadao, equipe, servidores } = t.subredes;
  const wifi: Alvo = { tipo: "rede", rede: cidadao.rede, prefixo: cidadao.prefixo };
  const srv: Alvo = { tipo: "host", ip: t.dispositivos.srv.ip! };
  return [
    { seq: 5, acao: "permit", proto: "udp", origem: { tipo: "any" }, destino: { tipo: "any" }, portaDestino: 67, motivo: "a laptop with no address yet (0.0.0.0) must still reach the DHCP server" },
    { seq: 10, acao: "deny", proto: "ip", origem: wifi, destino: { tipo: "rede", rede: equipe.rede, prefixo: equipe.prefixo }, motivo: "the public Wi-Fi never reaches the staff network" },
    { seq: 20, acao: "permit", proto: "udp", origem: wifi, destino: srv, portaDestino: PORTA.dns, motivo: "learners may ask the server for names (DNS)" },
    { seq: 30, acao: "permit", proto: "tcp", origem: wifi, destino: srv, portaDestino: PORTA.http, motivo: "learners may open the OpenLabs page (HTTP)" },
    { seq: 40, acao: "deny", proto: "ip", origem: wifi, destino: { tipo: "rede", rede: servidores.rede, prefixo: servidores.prefixo }, motivo: "nothing else on the server network is open to the public" },
    { seq: 50, acao: "permit", proto: "ip", origem: wifi, destino: { tipo: "any" }, motivo: "everything else is the internet, and it is allowed" },
  ];
}

const casaAlvo = (a: Alvo, endereco: Ipv4) => a.tipo === "any" || (a.tipo === "host" ? a.ip === endereco : naRede(endereco, a.rede, a.prefixo));

export interface Decisao {
  readonly permitido: boolean;
  /** A linha que decidiu; `undefined` é o deny implícito do fim da lista. */
  readonly regra: RegraAcl | undefined;
}

export function avaliarAcl(regras: readonly RegraAcl[], p: Pacote): Decisao {
  for (const r of regras) {
    if (r.proto !== "ip" && r.proto !== p.proto) continue;
    if (!casaAlvo(r.origem, p.origem) || !casaAlvo(r.destino, p.destino)) continue;
    if (r.portaDestino !== undefined && r.portaDestino !== p.portaDestino) continue;
    return { permitido: r.acao === "permit", regra: r };
  }
  return { permitido: false, regra: undefined };
}

const NOME_DA_PORTA: Readonly<Record<number, string>> = { 53: "domain", 67: "bootps", 80: "www", 22: "22" };

export function alvoIos(a: Alvo): string {
  if (a.tipo === "any") return "any";
  if (a.tipo === "host") return `host ${texto(a.ip)}`;
  return `${texto(a.rede)} ${texto(curinga(a.prefixo))}`;
}

export function linhaIos(r: RegraAcl): string {
  const porta = r.portaDestino === undefined ? "" : ` eq ${NOME_DA_PORTA[r.portaDestino] ?? r.portaDestino}`;
  return `${r.seq} ${r.acao} ${r.proto} ${alvoIos(r.origem)} ${alvoIos(r.destino)}${porta}`;
}

// ---------------------------------------------------------------- o caminho

export interface Quadro {
  readonly macOrigem: string;
  readonly macDestino: string;
  /** A etiqueta 802.1Q, só no trunk. */
  readonly vlan: number | undefined;
  readonly ipOrigem: Ipv4;
  readonly ipDestino: Ipv4;
  readonly ttl: number;
  readonly proto: Protocolo;
  readonly portaOrigem: number | undefined;
  readonly portaDestino: number | undefined;
}

export interface Salto {
  readonly de: DispId;
  readonly para: DispId;
  /** O fio por onde o quadro passa, como o Packet Tracer o nomeia. */
  readonly enlace: string;
  readonly quadro: Quadro;
  /** O que aconteceu neste salto, em verbos curtos. */
  readonly nota: string;
}

export interface TraducaoNat {
  readonly proto: Protocolo;
  readonly insideGlobal: string;
  readonly insideLocal: string;
  readonly outsideLocal: string;
  readonly outsideGlobal: string;
}

export type Veredito =
  | "entregue"
  | "acl-ida"
  | "acl-volta"
  | "vty-recusado"
  | "sem-rota-volta"
  | "sem-servico";

export interface OpcoesDaRede {
  /** A ACL CIDADAO-IN aplicada na subinterface do Wi-Fi. */
  readonly acl: boolean;
  /** O NAT/PAT na saída para o provedor. */
  readonly nat: boolean;
}

export const OPCOES_DA_REDE: OpcoesDaRede = { acl: true, nat: true };

export interface Resultado {
  readonly servico: Servico;
  readonly origem: DispId;
  readonly alvo: DispId;
  readonly pacote: Pacote;
  readonly ida: readonly Salto[];
  readonly volta: readonly Salto[];
  readonly veredito: Veredito;
  /** A linha da ACL que decidiu, quando uma ACL foi consultada. */
  readonly decisao: Decisao | undefined;
  readonly traducao: TraducaoNat | undefined;
  /** Quantos roteadores a resposta atravessou: é o que baixa o TTL que o ping mostra. */
  readonly roteadoresNaVolta: number;
  /** A explicação, em uma frase. */
  readonly porque: string;
}

const SERVICOS_DE: Readonly<Partial<Record<DispId, readonly Servico[]>>> = {
  srv: ["dns", "http"],
  web: ["http"],
  r1: ["ssh"],
};

export function oferece(id: DispId, servico: Servico): boolean {
  return servico === "ping" || (SERVICOS_DE[id] ?? []).includes(servico);
}

/** O primeiro salto de um host até o switch (pelo AP, no Wi-Fi). */
function subida(de: DispId): readonly DispId[] {
  return de === "laptop" ? ["laptop", "ap", "sw1"] : [de, "sw1"];
}

function enlaceDe(t: Telecentro, a: DispId, b: DispId): string {
  const c = t.cabos.find((k) => (k.de === a && k.para === b) || (k.de === b && k.para === a));
  if (c === undefined) return `${a}–${b}`;
  const porta = (id: DispId) => (c.de === id ? c.portaDe : c.portaPara);
  const modo = c.modo === "trunk" ? " · trunk 802.1Q" : c.tipo === "wireless" ? ` · Wi-Fi WPA2 "${t.ssid}"` : c.modo === "access" ? ` · access VLAN ${c.vlan}` : "";
  return `${t.dispositivos[a].nome} ${porta(a)} → ${t.dispositivos[b].nome} ${porta(b)}${modo}`;
}

interface Trecho {
  readonly caminho: readonly DispId[];
  readonly macOrigem: string;
  readonly macDestino: string;
  readonly ttl: number;
  readonly ipOrigem: Ipv4;
  readonly ipDestino: Ipv4;
  /** A VLAN cujo quadro sobe/desce pelo trunk neste trecho. */
  readonly vlan: number | undefined;
  readonly nota: (de: DispId, para: DispId) => string;
}

function saltosDe(t: Telecentro, p: Pacote, trechos: readonly Trecho[]): Salto[] {
  const saltos: Salto[] = [];
  for (const tr of trechos) {
    for (let i = 0; i + 1 < tr.caminho.length; i += 1) {
      const de = tr.caminho[i]!;
      const para = tr.caminho[i + 1]!;
      const noTrunk = (de === "sw1" && para === "r1") || (de === "r1" && para === "sw1");
      saltos.push({
        de,
        para,
        enlace: enlaceDe(t, de, para),
        quadro: {
          macOrigem: tr.macOrigem,
          macDestino: tr.macDestino,
          vlan: noTrunk ? tr.vlan : undefined,
          ipOrigem: tr.ipOrigem,
          ipDestino: tr.ipDestino,
          ttl: tr.ttl,
          proto: p.proto,
          // O PAT do Packet Tracer mantém a porta do cliente: só o endereço muda.
          portaOrigem: p.portaOrigem,
          portaDestino: p.portaDestino,
        },
        nota: tr.nota(de, para),
      });
    }
  }
  return saltos;
}

/**
 * Leva um pedido de `origem` até `alvo` e, se ele chegar, traz a resposta.
 * `origem` é um host (o laptop, o PC da equipe ou o servidor).
 */
export function percorrer(t: Telecentro, origem: DispId, alvo: DispId, servico: Servico, opcoes: OpcoesDaRede = OPCOES_DA_REDE): Resultado {
  if (origem !== "laptop" && origem !== "pc" && origem !== "srv") throw new Error(`${origem} is not a host that can start a conversation`);
  if (origem === alvo) throw new Error("a host talking to itself never touches the network");
  const proto = PROTO[servico];
  const a = enderecoDe(t, origem);
  const b = enderecoDe(t, alvo, origem);
  const pacote: Pacote = servico === "ping" ? { proto, origem: a, destino: b } : { proto, origem: a, destino: b, portaOrigem: PORTA_EFEMERA, portaDestino: PORTA[servico] };
  const sa = setorDe(t, a)!;
  const sb = setorDe(t, b);
  const macA = macDe(t, origem);
  const r1In = macDe(t, "r1", "G0/0");
  const base = { servico, origem, alvo, pacote };
  const regras = regrasDoCidadao(t);
  // A ACL só existe na entrada da subinterface do Wi-Fi público.
  const aclNaEntrada = (setor: string, p: Pacote) => (opcoes.acl && setor === "cidadao" ? avaliarAcl(regras, p) : undefined);
  const resposta: Pacote = { proto, origem: pacote.destino, destino: pacote.origem, ...(pacote.portaDestino === undefined ? {} : { portaOrigem: pacote.portaDestino, portaDestino: pacote.portaOrigem! }) };
  const nome = (id: DispId) => t.dispositivos[id].nome;

  // 1. Mesma VLAN: o switch resolve sozinho, sem roteador e sem etiqueta.
  if (sb !== undefined && sb.setor === sa.setor && alvo !== "r1") {
    const caminho = [...subida(origem), ...[...subida(alvo)].reverse().slice(1)];
    const ida = saltosDe(t, pacote, [{ caminho, macOrigem: macA, macDestino: macDe(t, alvo), ttl: TTL_INICIAL, ipOrigem: a, ipDestino: b, vlan: undefined, nota: (de) => (de === "sw1" ? "SW1 looks up the MAC table: same VLAN, straight out the port" : "the frame leaves untagged") }]);
    const volta = saltosDe(t, resposta, [{ caminho: [...caminho].reverse(), macOrigem: macDe(t, alvo), macDestino: macA, ttl: TTL_INICIAL, ipOrigem: b, ipDestino: a, vlan: undefined, nota: () => "the reply comes back the same way" }]);
    if (!oferece(alvo, servico)) return { ...base, ida, volta: [], veredito: "sem-servico", decisao: undefined, traducao: undefined, roteadoresNaVolta: 0, porque: `${nome(alvo)} is reachable but does not run ${servico.toUpperCase()}.` };
    return { ...base, ida, volta, veredito: "entregue", decisao: undefined, traducao: undefined, roteadoresNaVolta: 0, porque: `Same VLAN (${sa.nome}): the switch delivers it without the router.` };
  }

  // 2. Para o roteador: sobe pelo trunk, etiquetado com a VLAN de origem.
  const subidaAteR1: Trecho = { caminho: [...subida(origem), "r1"], macOrigem: macA, macDestino: r1In, ttl: TTL_INICIAL, ipOrigem: a, ipDestino: b, vlan: sa.vlan, nota: (de, para) => (para === "r1" ? `SW1 tags the frame with VLAN ${sa.vlan} on the trunk; R1 receives it on G0/0.${sa.vlan}` : de === "laptop" ? "the laptop sends it over the encrypted Wi-Fi" : `the frame enters SW1 on an access port of VLAN ${sa.vlan}`) };
  const decisaoIda = aclNaEntrada(sa.setor, pacote);
  if (decisaoIda !== undefined && !decisaoIda.permitido) {
    const ida = saltosDe(t, pacote, [subidaAteR1]);
    const linha = decisaoIda.regra === undefined ? "the implicit deny at the end" : `line ${decisaoIda.regra.seq} (${decisaoIda.regra.acao})`;
    return { ...base, ida, volta: [], veredito: "acl-ida", decisao: decisaoIda, traducao: undefined, roteadoresNaVolta: 0, porque: `R1 checks ${NOME_DA_ACL} on G0/0.${sa.vlan} and drops it at ${linha}: ${decisaoIda.regra?.motivo ?? "nothing permitted it"}.` };
  }

  if (alvo === "r1") {
    const ida = saltosDe(t, pacote, [subidaAteR1]);
    const descida = saltosDe(t, resposta, [{ caminho: [...subidaAteR1.caminho].reverse(), macOrigem: r1In, macDestino: macA, ttl: 255, ipOrigem: b, ipDestino: a, vlan: sa.vlan, nota: () => "R1 answers from its own subinterface" }]);
    if (servico === "ssh" && sa.setor !== "equipe") {
      return { ...base, ida, volta: [], veredito: "vty-recusado", decisao: decisaoIda, traducao: undefined, roteadoresNaVolta: 0, porque: `The vty lines only accept ${t.subredes.equipe.nome} (access-class ${NOME_DA_ACL_VTY}): R1 refuses the SSH connection.` };
    }
    if (!oferece("r1", servico)) return { ...base, ida, volta: [], veredito: "sem-servico", decisao: decisaoIda, traducao: undefined, roteadoresNaVolta: 0, porque: `R1 does not run ${servico.toUpperCase()}.` };
    return { ...base, ida, volta: descida, veredito: "entregue", decisao: decisaoIda, traducao: undefined, roteadoresNaVolta: 0, porque: servico === "ssh" ? "SSH from the staff network: R1 asks for the local username and password." : "R1 answers from the gateway address of your own VLAN." };
  }

  // 3. Outra VLAN do telecentro: sobe etiquetado com uma VLAN, desce com outra.
  if (sb !== undefined) {
    const ida = saltosDe(t, pacote, [
      subidaAteR1,
      { caminho: ["r1", ...[...subida(alvo)].reverse()], macOrigem: r1In, macDestino: macDe(t, alvo), ttl: TTL_INICIAL - 1, ipOrigem: a, ipDestino: b, vlan: sb.vlan, nota: (de) => (de === "r1" ? `R1 routes it: new MACs, TTL − 1, back down the trunk tagged VLAN ${sb.vlan}` : `SW1 strips the tag and delivers on VLAN ${sb.vlan}`) },
    ]);
    if (!oferece(alvo, servico)) return { ...base, ida, volta: [], veredito: "sem-servico", decisao: decisaoIda, traducao: undefined, roteadoresNaVolta: 0, porque: `${nome(alvo)} is reachable but does not run ${servico.toUpperCase()}.` };
    const decisaoVolta = aclNaEntrada(sb.setor, resposta);
    const volta = saltosDe(t, resposta, [
      { caminho: [...subida(alvo), "r1"], macOrigem: macDe(t, alvo), macDestino: r1In, ttl: TTL_INICIAL, ipOrigem: b, ipDestino: a, vlan: sb.vlan, nota: (_, para) => (para === "r1" ? `the reply climbs the trunk tagged VLAN ${sb.vlan}` : "the reply leaves") },
      ...(decisaoVolta !== undefined && !decisaoVolta.permitido ? [] : [{ caminho: ["r1", ...[...subida(origem)].reverse()] as DispId[], macOrigem: r1In, macDestino: macA, ttl: TTL_INICIAL - 1, ipOrigem: b, ipDestino: a, vlan: sa.vlan, nota: (de: DispId) => (de === "r1" ? `R1 routes the reply down tagged VLAN ${sa.vlan}` : "the reply arrives") }]),
    ]);
    if (decisaoVolta !== undefined && !decisaoVolta.permitido) {
      return { ...base, ida, volta, veredito: "acl-volta", decisao: decisaoVolta, traducao: undefined, roteadoresNaVolta: 1, porque: `The request arrives, but the reply enters R1 on the Wi-Fi subinterface and ${NOME_DA_ACL} line ${decisaoVolta.regra?.seq ?? "(implicit)"} drops it: the isolation works in both directions.` };
    }
    return { ...base, ida, volta, veredito: "entregue", decisao: decisaoIda, traducao: undefined, roteadoresNaVolta: 1, porque: `Inter-VLAN routing: up the trunk as VLAN ${sa.vlan}, down as VLAN ${sb.vlan}${decisaoIda?.regra === undefined ? "" : `, permitted by ${NOME_DA_ACL} line ${decisaoIda.regra.seq}`}.` };
  }

  // 4. A internet: pelo provedor, com ou sem NAT.
  const r1Out = macDe(t, "r1", "G0/1");
  const ispIn = macDe(t, "isp");
  const ispOut = macDe(t, "isp", "G0/1");
  const webMac = macDe(t, "web");
  const global = opcoes.nat ? t.wan.r1 : a;
  const traducao: TraducaoNat | undefined = opcoes.nat
    ? {
        proto,
        insideGlobal: `${texto(t.wan.r1)}:${pacote.portaOrigem ?? 1}`,
        insideLocal: `${texto(a)}:${pacote.portaOrigem ?? 1}`,
        outsideLocal: `${texto(b)}:${pacote.portaDestino ?? 1}`,
        outsideGlobal: `${texto(b)}:${pacote.portaDestino ?? 1}`,
      }
    : undefined;
  const lafora: Pacote = { ...pacote, origem: global };
  const ida = saltosDe(t, lafora, [
    { ...subidaAteR1, ipOrigem: a },
    { caminho: ["r1", "isp"], macOrigem: r1Out, macDestino: ispIn, ttl: TTL_INICIAL - 1, ipOrigem: global, ipDestino: b, vlan: undefined, nota: () => (opcoes.nat ? `NAT overload: R1 swaps ${texto(a)} for its public address ${texto(t.wan.r1)} and writes it down` : `no NAT: the private address ${texto(a)} leaves for the internet as it is`) },
    { caminho: ["isp", "web"], macOrigem: ispOut, macDestino: webMac, ttl: TTL_INICIAL - 2, ipOrigem: global, ipDestino: b, vlan: undefined, nota: () => "the ISP routes it to the web server" },
  ]);
  if (!oferece(alvo, servico)) return { ...base, ida, volta: [], veredito: "sem-servico", decisao: decisaoIda, traducao, roteadoresNaVolta: 0, porque: `${nome(alvo)} does not run ${servico.toUpperCase()}.` };
  const respostaLaFora: Pacote = { ...resposta, destino: global };
  if (!opcoes.nat) {
    const volta = saltosDe(t, respostaLaFora, [{ caminho: ["web", "isp"], macOrigem: webMac, macDestino: ispOut, ttl: TTL_INICIAL, ipOrigem: b, ipDestino: a, vlan: undefined, nota: () => `the ISP has no route to ${texto(a)}: private addresses are not routed on the internet, so the reply dies here` }]);
    return { ...base, ida, volta, veredito: "sem-rota-volta", decisao: decisaoIda, traducao: undefined, roteadoresNaVolta: 1, porque: `Without NAT the request reaches ${nome(alvo)}, but the reply is addressed to the private ${texto(a)} and the ISP drops it.` };
  }
  const volta = saltosDe(t, respostaLaFora, [
    { caminho: ["web", "isp", "r1"], macOrigem: webMac, macDestino: ispOut, ttl: TTL_INICIAL, ipOrigem: b, ipDestino: global, vlan: undefined, nota: (de) => (de === "web" ? "the reply goes to R1's public address" : "the ISP knows that address: it is on the link to R1") },
    { caminho: ["r1", ...[...subida(origem)].reverse()], macOrigem: r1In, macDestino: macA, ttl: TTL_INICIAL - 2, ipOrigem: b, ipDestino: a, vlan: sa.vlan, nota: (de) => (de === "r1" ? `R1 finds the entry in its NAT table and puts ${texto(a)} back` : "the reply arrives") },
  ]);
  return { ...base, ida, volta, veredito: "entregue", decisao: decisaoIda, traducao, roteadoresNaVolta: 2, porque: `R1 translated ${texto(a)} to ${texto(t.wan.r1)} on the way out and back on the way in${decisaoIda?.regra === undefined ? "" : `; ${NOME_DA_ACL} line ${decisaoIda.regra.seq} let it through`}.` };
}

// ---------------------------------------------------------------- DHCP e DNS

export interface MensagemDhcp {
  readonly tipo: "DISCOVER" | "OFFER" | "REQUEST" | "ACK";
  readonly de: DispId;
  readonly para: DispId;
  readonly ipOrigem: string;
  readonly ipDestino: string;
  readonly macOrigem: string;
  readonly macDestino: string;
  /** Campos do DHCP que importam nesta mensagem. */
  readonly campos: readonly (readonly [string, string])[];
  readonly resumo: string;
}

/** DORA: o cliente sem endereço grita, o roteador oferece, o cliente pede, o roteador confirma. */
export function dora(t: Telecentro, cliente: "laptop" | "pc"): MensagemDhcp[] {
  const s = t.subredes[t.dispositivos[cliente].setor!];
  const oferta = texto(concessao(t, cliente));
  const gw = texto(s.gateway);
  const mac = macDe(t, cliente);
  const r1 = macDe(t, "r1", "G0/0");
  const mascaraTexto = texto(((0xffffffff << (32 - s.prefixo)) >>> 0));
  const opcoes: (readonly [string, string])[] = [
    ["subnet mask", mascaraTexto],
    ["router", gw],
    ["DNS server", texto(t.dispositivos.srv.ip!)],
    ["lease", "1 day (IOS default)"],
  ];
  return [
    { tipo: "DISCOVER", de: cliente, para: "r1", ipOrigem: "0.0.0.0", ipDestino: "255.255.255.255", macOrigem: mac, macDestino: "FFFF.FFFF.FFFF", campos: [["client MAC", mac], ["UDP", "68 → 67"]], resumo: "no address yet: it broadcasts to everyone on the VLAN" },
    { tipo: "OFFER", de: "r1", para: cliente, ipOrigem: gw, ipDestino: "255.255.255.255", macOrigem: r1, macDestino: "FFFF.FFFF.FFFF", campos: [["your IP (yiaddr)", oferta], ...opcoes], resumo: `R1's pool for VLAN ${s.vlan} offers ${oferta}` },
    { tipo: "REQUEST", de: cliente, para: "r1", ipOrigem: "0.0.0.0", ipDestino: "255.255.255.255", macOrigem: mac, macDestino: "FFFF.FFFF.FFFF", campos: [["requested IP", oferta], ["server ID", gw]], resumo: `the client asks for ${oferta} out loud, so any other server knows` },
    { tipo: "ACK", de: "r1", para: cliente, ipOrigem: gw, ipDestino: "255.255.255.255", macOrigem: r1, macDestino: "FFFF.FFFF.FFFF", campos: [["your IP (yiaddr)", oferta], ...opcoes], resumo: `confirmed: ${oferta}/${s.prefixo}, gateway ${gw}` },
  ];
}

export function resolver(t: Telecentro, nome: string): Ipv4 | undefined {
  return t.dns.find((r) => r.nome === nome.toLowerCase())?.ip;
}
