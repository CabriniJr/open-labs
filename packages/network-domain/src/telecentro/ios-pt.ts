// locale: skip-file — comentários e descrições do IOS em português, para o .pkt e o PDF de entrega; não são interface do site.
import type { TextosIos } from "./ios.js";

/** A versão em português de `TEXTOS` (`ios.ts`). Sem acento: o IOS não garante UTF-8. */
export const TEXTOS_PT: TextosIos = {
  roteador: "! --- router-on-a-stick: uma porta fisica, uma subinterface por VLAN",
  wan: "! --- WAN ate o provedor (ISP)",
  descWan: "WAN PARA O ISP",
  dhcp: "! --- DHCP: um pool por VLAN, sem o gateway e sem o servidor",
  nat: "! --- NAT/PAT: todo endereco interno sai com o endereco WAN do R1",
  acl: (vlan) => `! --- ACL: o que o Wi-Fi publico pode alcancar (entrada da G0/0.${vlan})`,
  gerencia: "! --- gerencia so por SSH, e so a partir da VLAN da equipe",
  descTrunk: "TRUNK PARA O R1",
  descIspTelecentro: "LINK COM O TELECENTRO (R1)",
  descIspInternet: "A INTERNET SIMULADA",
  semRota: "! sem rota para 192.168.0.0/16: endereco privado nao circula na internet",
};
