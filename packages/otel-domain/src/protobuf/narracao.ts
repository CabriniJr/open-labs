import { hex, type EtapaDaCodificacao } from "./codificar.js";

/**
 * O que dizer em cada etapa da codificação, lido da própria etapa: a conta da
 * chave em bits, como o valor foi escrito e a reação de cada mensagem em volta.
 * Nenhum número aqui é digitado; todos saem dos bytes.
 */
export interface NarracaoDaEtapa {
  readonly titulo: string;
  /** A conta da chave, bit a bit. */
  readonly chave: readonly (readonly [string, string])[];
  readonly valor: string;
  readonly abertas: string;
  readonly reacoes: readonly { readonly texto: string; readonly cresceu: boolean }[];
}

const bin = (n: number, w = 8) => n.toString(2).padStart(w, "0");

export function narrarEtapa(e: EtapaDaCodificacao): NarracaoDaEtapa {
  const c = e.campo;
  const b = [...e.cod.bytes.slice(c.inicio + c.cabeca, c.fim)];
  const corpo = b.length;
  const chave = (c.numero << 3) | c.wire;
  const contaDaChave: (readonly [string, string])[] = [
    [`field ${c.numero}`, bin(c.numero, 5)],
    ["<< 3", bin(c.numero << 3)],
    [`| wire ${c.wire}`, `${bin(chave)} = 0x${hex(chave)}`],
  ];
  let valor: string;
  if (c.tipo === "string") valor = `"${c.valor}" is ${corpo} UTF-8 bytes: the key, the length (${corpo}), then the bytes as they are.`;
  else if (c.tipo === "bytes") valor = `${corpo} raw bytes: the same id you read as ${corpo * 2} hex characters in a traceparent, written without the text.`;
  else if (c.tipo === "fixed64") valor = `Always 8 bytes, little-endian: ${b.map(hex).join(" ")}. Nanoseconds since 1970 would take 9 bytes as a varint.`;
  else {
    const grupos = b.map((x, i) => `${hex(x)} = ${i < b.length - 1 ? "1" : "0"}·${bin(x & 0x7f, 7)}`);
    valor = `${c.valor} as a varint, ${corpo} byte${corpo > 1 ? "s" : ""}: ${grupos.join(", ")}. The high bit says "another byte follows"; the low seven are the number, least significant group first.`;
  }
  const abertas =
    e.abertas.length === 0
      ? ""
      : `Opens ${e.abertas.map((m) => m.nome).join(" → ")}: each one is a key and a length written before the field, so the reader knows where it ends.`;
  const reacoes = e.reacoes.map((r) => ({
    cresceu: r.cresceu,
    texto: r.cresceu
      ? `${r.campo.nome}: ${r.antes} → ${r.depois} B. It passed 127, so its length now takes two bytes (${[...e.cod.bytes.slice(r.campo.inicio, r.campo.inicio + r.campo.cabeca)].slice(1).map(hex).join(" ")}) and every byte after it moved one place.`
      : `${r.campo.nome}: ${r.antes} → ${r.depois} B`,
  }));
  // O nome sozinho é ambíguo (há três `name` e quatro `key`): o título leva o pai.
  const partes = c.caminho.split(".");
  return { titulo: `${partes.slice(-2).join(".")} · field ${c.numero}`, chave: contaDaChave, valor, abertas, reacoes };
}
