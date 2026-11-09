import { curinga, mascara, texto } from "./enderecamento.js";
import { concessao, dora, excluidos, linhaIos, NOME_DA_ACL, NOME_DA_ACL_VTY, regrasDoCidadao, TTL_INICIAL, type Resultado, type TraducaoNat } from "./protocolos.js";
import type { DispId, Telecentro } from "./topologia.js";

/**
 * Os comandos que montam no Cisco Packet Tracer a mesma rede que o lab
 * desenha, e as saídas que cada verificação deve mostrar.
 *
 * Tudo é gerado do modelo: o endereço que o filme mostra no ACK do DHCP é o
 * mesmo que o `ipconfig` daqui imprime, e a linha da ACL que barra o ping no
 * filme é a mesma que o `show access-lists` conta. Se o modelo mudar, os
 * comandos mudam junto — não há uma segunda cópia para desatualizar.
 *
 * As saídas são a forma esperada, não uma captura: o Packet Tracer varia em
 * detalhes (tempo, primeiro ping perdido no ARP). O print da equipe é a prova.
 */

const m = (p: number) => texto(mascara(p));

/** Senhas de laboratório, para o PDF. Num telecentro de verdade, troque. */
export const CREDENCIAIS = { usuario: "admin", senha: "Telecentro@2026", enable: "Enable@2026", wifi: "AprenderLivre2026" } as const;

export function configR1(t: Telecentro): string[] {
  const { cidadao, equipe, servidores } = t.subredes;
  const ex = excluidos(t);
  const srv = texto(t.dispositivos.srv.ip!);
  const subif = (s: typeof cidadao, extra: readonly string[] = []) => [
    `interface GigabitEthernet0/0.${s.vlan}`,
    ` description VLAN ${s.vlan} ${s.nome}`,
    ` encapsulation dot1Q ${s.vlan}`,
    ` ip address ${texto(s.gateway)} ${m(s.prefixo)}`,
    " ip nat inside",
    ...extra,
    " exit",
  ];
  const faixas = (lista: readonly number[]) => {
    const primeiro = lista[0]!;
    const ultimo = lista[lista.length - 1]!;
    return primeiro === ultimo ? `ip dhcp excluded-address ${texto(primeiro)}` : `ip dhcp excluded-address ${texto(primeiro)} ${texto(ultimo)}`;
  };
  const pool = (s: typeof cidadao) => [
    `ip dhcp pool VLAN${s.vlan}-${s.nome}`,
    ` network ${texto(s.rede)} ${m(s.prefixo)}`,
    ` default-router ${texto(s.gateway)}`,
    ` dns-server ${srv}`,
    " exit",
  ];
  return [
    "enable",
    "configure terminal",
    "hostname R1",
    "no ip domain-lookup",
    `enable secret ${CREDENCIAIS.enable}`,
    "service password-encryption",
    "ip domain-name telecentro.local",
    `username ${CREDENCIAIS.usuario} secret ${CREDENCIAIS.senha}`,
    "crypto key generate rsa general-keys modulus 1024",
    "ip ssh version 2",
    "!",
    "! --- router-on-a-stick: one physical port, one subinterface per VLAN",
    "interface GigabitEthernet0/0",
    " no shutdown",
    " exit",
    ...subif(equipe),
    ...subif(cidadao, [` ip access-group ${NOME_DA_ACL} in`]),
    ...subif(servidores),
    "!",
    "! --- WAN to the ISP",
    "interface GigabitEthernet0/1",
    " description WAN to ISP",
    ` ip address ${texto(t.wan.r1)} ${m(t.wan.prefixo)}`,
    " ip nat outside",
    " no shutdown",
    " exit",
    `ip route 0.0.0.0 0.0.0.0 ${texto(t.wan.isp)}`,
    "!",
    "! --- DHCP: one pool per VLAN, gateway and server excluded",
    faixas(ex.equipe),
    faixas(ex.cidadao),
    faixas(ex.servidores),
    ...pool(equipe),
    ...pool(cidadao),
    ...pool(servidores),
    "!",
    "! --- NAT/PAT: every inside address leaves as R1's WAN address",
    `access-list 1 permit ${texto(t.base)} ${texto(curinga(24))}`,
    "ip nat inside source list 1 interface GigabitEthernet0/1 overload",
    "!",
    `! --- ACL: what the public Wi-Fi may reach (applied on G0/0.${cidadao.vlan} in)`,
    `ip access-list extended ${NOME_DA_ACL}`,
    ...regrasDoCidadao(t).map((r) => ` ${linhaIos(r)}`),
    " exit",
    "!",
    "! --- management only by SSH, and only from the staff VLAN",
    `ip access-list standard ${NOME_DA_ACL_VTY}`,
    ` permit ${texto(equipe.rede)} ${texto(curinga(equipe.prefixo))}`,
    " exit",
    "line console 0",
    ` password ${CREDENCIAIS.senha}`,
    " login",
    " exit",
    "line vty 0 4",
    " login local",
    " transport input ssh",
    ` access-class ${NOME_DA_ACL_VTY} in`,
    " exit",
    "end",
    "write memory",
  ];
}

export function configSw1(t: Telecentro): string[] {
  const { cidadao, equipe, servidores } = t.subredes;
  const acesso = (porta: string, s: typeof cidadao, quem: string) => [`interface ${porta}`, ` description ${quem}`, " switchport mode access", ` switchport access vlan ${s.vlan}`, " exit"];
  return [
    "enable",
    "configure terminal",
    "hostname SW1",
    `enable secret ${CREDENCIAIS.enable}`,
    ...[equipe, cidadao, servidores].flatMap((s) => [`vlan ${s.vlan}`, ` name ${s.nome}`, " exit"]),
    ...acesso("FastEthernet0/1", equipe, "PC-MONITOR"),
    ...acesso("FastEthernet0/2", cidadao, "AP-TELECENTRO"),
    ...acesso("FastEthernet0/3", servidores, "SRV-OPENLABS"),
    "interface GigabitEthernet0/1",
    " description TRUNK to R1",
    " switchport mode trunk",
    ` switchport trunk allowed vlan ${[equipe, cidadao, servidores].map((s) => s.vlan).join(",")}`,
    " exit",
    "end",
    "write memory",
  ];
}

export function configIsp(t: Telecentro): string[] {
  return [
    "enable",
    "configure terminal",
    "hostname ISP",
    "interface GigabitEthernet0/0",
    " description link to the telecentro (R1)",
    ` ip address ${texto(t.wan.isp)} ${m(t.wan.prefixo)}`,
    " no shutdown",
    " exit",
    "interface GigabitEthernet0/1",
    " description the simulated internet",
    ` ip address ${texto(t.internet.gateway)} ${m(t.internet.prefixo)}`,
    " no shutdown",
    " exit",
    "! no route to 192.168.0.0/16: private addresses are not routed on the internet",
    "end",
    "write memory",
  ];
}

/** O que se configura pela interface gráfica (aba Config/Desktop), campo a campo. */
export interface AjusteGrafico {
  readonly aparelho: string;
  readonly onde: string;
  readonly campos: readonly (readonly [string, string])[];
}

export function ajustesGraficos(t: Telecentro): AjusteGrafico[] {
  const s = t.subredes.servidores;
  return [
    { aparelho: "SRV-OPENLABS", onde: "Desktop → IP Configuration (Static)", campos: [["IPv4 Address", texto(t.dispositivos.srv.ip!)], ["Subnet Mask", m(s.prefixo)], ["Default Gateway", texto(s.gateway)], ["DNS Server", texto(t.dispositivos.srv.ip!)]] },
    { aparelho: "SRV-OPENLABS", onde: "Services → DNS (On)", campos: t.dns.map((r) => [r.nome, `A record → ${texto(r.ip)}`] as const) },
    { aparelho: "SRV-OPENLABS", onde: "Services → HTTP (On) → index.html", campos: [["content", "the CitizenTech card (see fichaHtml)"]] },
    { aparelho: "WEB-INTERNET", onde: "Desktop → IP Configuration (Static)", campos: [["IPv4 Address", texto(t.internet.web)], ["Subnet Mask", m(t.internet.prefixo)], ["Default Gateway", texto(t.internet.gateway)]] },
    { aparelho: "AP-TELECENTRO", onde: "Config → Port 1", campos: [["SSID", t.ssid], ["Authentication", "WPA2-PSK"], ["PSK Pass Phrase", CREDENCIAIS.wifi], ["Encryption", "AES"]] },
    { aparelho: "LAPTOP-CIDADAO", onde: "Physical: swap the card for WPC300N · Config → Wireless0", campos: [["SSID", t.ssid], ["Authentication", "WPA2-PSK"], ["PSK Pass Phrase", CREDENCIAIS.wifi], ["IP Configuration", "DHCP"]] },
    { aparelho: "PC-MONITOR", onde: "Desktop → IP Configuration", campos: [["IP Configuration", "DHCP"]] },
  ];
}

// ---------------------------------------------------------------- saídas esperadas

export function showVlanBrief(t: Telecentro): string[] {
  const { cidadao, equipe, servidores } = t.subredes;
  const linha = (id: string, nome: string, status: string, portas: string) => `${id.padEnd(5)}${nome.padEnd(33)}${status.padEnd(10)}${portas}`;
  return [
    linha("VLAN", "Name", "Status", "Ports"),
    "---- -------------------------------- --------- -------------------------------",
    linha("1", "default", "active", "Fa0/4, Fa0/5, Fa0/6, …"),
    linha(String(equipe.vlan), equipe.nome, "active", "Fa0/1"),
    linha(String(cidadao.vlan), cidadao.nome, "active", "Fa0/2"),
    linha(String(servidores.vlan), servidores.nome, "active", "Fa0/3"),
  ];
}

export function ipconfig(t: Telecentro, cliente: "laptop" | "pc"): string[] {
  const s = t.subredes[t.dispositivos[cliente].setor!];
  return [
    "C:\\>ipconfig /all",
    "",
    `   Physical Address................: ${dora(t, cliente)[0]!.macOrigem}`,
    `   IPv4 Address....................: ${texto(concessao(t, cliente))}`,
    `   Subnet Mask.....................: ${m(s.prefixo)}`,
    `   Default Gateway.................: ${texto(s.gateway)}`,
    `   DHCP Servers....................: ${texto(s.gateway)}`,
    `   DNS Servers.....................: ${texto(t.dispositivos.srv.ip!)}`,
  ];
}

export function showNat(traducoes: readonly TraducaoNat[]): string[] {
  const linha = (a: string, b: string, c: string, d: string, e: string) => `${a.padEnd(5)}${b.padEnd(22)}${c.padEnd(22)}${d.padEnd(22)}${e}`;
  return ["R1#show ip nat translations", linha("Pro", "Inside global", "Inside local", "Outside local", "Outside global"), ...traducoes.map((x) => linha(x.proto, x.insideGlobal, x.insideLocal, x.outsideLocal, x.outsideGlobal))];
}

export function showAccessLists(t: Telecentro, resultados: readonly Resultado[]): string[] {
  const contagem = new Map<number, number>();
  for (const r of resultados) {
    const seq = r.decisao?.regra?.seq;
    if (seq !== undefined) contagem.set(seq, (contagem.get(seq) ?? 0) + (r.servico === "ping" ? 4 : 1));
  }
  return [
    "R1#show access-lists",
    `Extended IP access list ${NOME_DA_ACL}`,
    ...regrasDoCidadao(t).map((r) => {
      const n = contagem.get(r.seq);
      return `    ${linhaIos(r)}${n === undefined ? "" : ` (${n} match(es))`}`;
    }),
  ];
}

/** O que o Command Prompt de quem começou mostra para o pedido. */
export function saidaDoCliente(t: Telecentro, r: Resultado): string[] {
  const destino = texto(r.pacote.destino);
  const gateway = texto(t.subredes[t.dispositivos[r.origem].setor!].gateway);
  if (r.servico === "ping") {
    const resposta =
      r.veredito === "entregue"
        ? `Reply from ${destino}: bytes=32 time<1ms TTL=${(r.alvo === "r1" ? 255 : TTL_INICIAL) - r.roteadoresNaVolta}`
        : r.veredito === "acl-ida"
          ? `Reply from ${gateway}: Destination host unreachable.`
          : "Request timed out.";
    const recebidos = r.veredito === "entregue" ? 4 : 0;
    return [`C:\\>ping ${destino}`, "", `Pinging ${destino} with 32 bytes of data:`, "", ...Array.from({ length: 4 }, () => resposta), "", `Ping statistics for ${destino}:`, `    Packets: Sent = 4, Received = ${recebidos}, Lost = ${4 - recebidos} (${(4 - recebidos) * 25}% loss),`];
  }
  if (r.servico === "ssh") {
    const linha = `C:\\>ssh -l ${CREDENCIAIS.usuario} ${destino}`;
    if (r.veredito === "entregue") return [linha, "", "Password:", "", "R1>"];
    if (r.veredito === "vty-recusado") return [linha, "", "% Connection refused by remote host"];
    return [linha, "", "% Connection timed out; remote host not responding"];
  }
  if (r.servico === "dns") {
    if (r.veredito === "entregue") return ["C:\\>nslookup", `Server: [${destino}]`, `Address:  ${destino}`];
    return ["C:\\>nslookup", "DNS request timed out."];
  }
  const nome = t.dns.find((d) => d.ip === r.pacote.destino)?.nome ?? destino;
  return r.veredito === "entregue" ? [`Web Browser → http://${nome}`, "the page loads"] : [`Web Browser → http://${nome}`, "Request Timeout"];
}

/** A página que o servidor do telecentro serve: a Ficha da CitizenTech. */
export function fichaHtml(t: Telecentro): string {
  return [
    "<html><body>",
    "<h1>OpenLabs no Telecentro</h1>",
    "<p><b>Cidadao:</b> quem nao tem computador nem internet em casa e quer aprender tecnologia.</p>",
    "<p><b>Problema:</b> o ensino de tecnologia gratuito e pratico nao chega a periferia.</p>",
    `<p><b>Rede:</b> 192.168.${t.x}.0/24 em tres VLANs, Wi-Fi ${t.ssid}.</p>`,
    "<p><b>ODS:</b> 4, 9, 10 e 11.</p>",
    "</body></html>",
  ].join("\n");
}

/** Para o filme e o simulador: os aparelhos que um pedido pode ter como alvo. */
export const ALVOS: readonly DispId[] = ["srv", "pc", "laptop", "r1", "web"];
