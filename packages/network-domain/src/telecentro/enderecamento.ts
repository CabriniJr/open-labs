/**
 * Endereços IPv4 como números de 32 bits, e o cálculo das sub-redes (VLSM).
 *
 * Nada aqui é escrito à mão: a faixa 192.168.X.0/24 é dividida a partir de
 * quantos hosts cada setor precisa, do maior para o menor, cada bloco alinhado
 * ao seu tamanho. O plano de endereçamento do lab, os comandos do Packet
 * Tracer e o filme saem todos deste cálculo — mudar X ou um pedido de hosts
 * muda os três juntos.
 */
export type Ipv4 = number;

export function ip(texto: string): Ipv4 {
  const partes = texto.split(".").map(Number);
  if (partes.length !== 4 || partes.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    throw new Error(`"${texto}" is not an IPv4 address`);
  }
  return ((partes[0]! << 24) >>> 0) + (partes[1]! << 16) + (partes[2]! << 8) + partes[3]!;
}

export function texto(endereco: Ipv4): string {
  return [24, 16, 8, 0].map((s) => (endereco >>> s) & 255).join(".");
}

export function mascara(prefixo: number): Ipv4 {
  return prefixo === 0 ? 0 : (0xffffffff << (32 - prefixo)) >>> 0;
}

/** A máscara invertida que ACL e OSPF usam: 0 onde o bit importa. */
export function curinga(prefixo: number): Ipv4 {
  return ~mascara(prefixo) >>> 0;
}

export function naRede(endereco: Ipv4, rede: Ipv4, prefixo: number): boolean {
  const m = mascara(prefixo);
  return ((endereco & m) >>> 0) === ((rede & m) >>> 0);
}

export type SetorId = "cidadao" | "equipe" | "servidores";

export interface PedidoDeSubrede {
  readonly setor: SetorId;
  readonly vlan: number;
  /** Nome da VLAN no switch: sem espaço nem acento, como o IOS aceita. */
  readonly nome: string;
  /** Para quem é, em uma linha. */
  readonly papel: string;
  /** Quantos hosts o setor precisa, contando o que vier a crescer. */
  readonly hosts: number;
}

export interface Subrede extends PedidoDeSubrede {
  readonly rede: Ipv4;
  readonly prefixo: number;
  readonly broadcast: Ipv4;
  /** O primeiro endereço utilizável fica com o gateway (a subinterface do roteador). */
  readonly gateway: Ipv4;
  readonly ultimoUtil: Ipv4;
  /** Quantos hosts cabem: 2^(32-prefixo) - 2. */
  readonly capacidade: number;
}

/** O menor prefixo que acomoda `hosts` mais rede e broadcast. */
export function prefixoPara(hosts: number): number {
  if (!Number.isInteger(hosts) || hosts < 1) throw new Error(`a subnet needs at least one host, got ${hosts}`);
  const bits = Math.ceil(Math.log2(hosts + 2));
  return 32 - bits;
}

/**
 * VLSM: do maior pedido para o menor, cada bloco começa onde o anterior
 * terminou. Como os tamanhos são potências de dois em ordem decrescente, cada
 * bloco já nasce alinhado ao próprio tamanho. Recusa o que não couber na base.
 */
export function vlsm(base: Ipv4, prefixoDaBase: number, pedidos: readonly PedidoDeSubrede[]): Subrede[] {
  const fim = base + 2 ** (32 - prefixoDaBase);
  let cursor = base;
  const ordem = [...pedidos].sort((a, b) => b.hosts - a.hosts || a.vlan - b.vlan);
  const subredes: Subrede[] = [];
  for (const p of ordem) {
    const prefixo = prefixoPara(p.hosts);
    const tamanho = 2 ** (32 - prefixo);
    if (cursor % tamanho !== 0) cursor += tamanho - (cursor % tamanho);
    if (cursor + tamanho > fim) {
      throw new Error(`the ${p.nome} subnet (/${prefixo}) does not fit in ${texto(base)}/${prefixoDaBase}`);
    }
    subredes.push({ ...p, rede: cursor, prefixo, broadcast: cursor + tamanho - 1, gateway: cursor + 1, ultimoUtil: cursor + tamanho - 2, capacidade: tamanho - 2 });
    cursor += tamanho;
  }
  return subredes;
}

export function cidr(rede: Ipv4, prefixo: number): string {
  return `${texto(rede)}/${prefixo}`;
}
