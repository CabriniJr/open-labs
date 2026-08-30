import type { Message } from "@ovh/depth-core";

/**
 * O que a carga leva, para ler enquanto ela anda na linha.
 *
 * Sem isto ela é um ponto anônimo: dá para ver que **alguma coisa** passou, e
 * não o quê — e num algoritmo o que passa é a coisa toda.
 */
export function leituraDaCarga(mensagem: Message): string | undefined {
  const d = mensagem.data;
  switch (mensagem.kind) {
    case "numero":
    case "empilhar":
      return String(d.valor);
    case "operador":
    case "operacao":
      return String(d.op);
    case "topo":
      return `${d.a} ${d.b}`;
    case "resultado":
      return `${d.a} ${d.op} ${d.b} = ${d.valor}`;
    case "erro":
      return "error";
    case "avanca":
      return "next";
    default:
      return undefined;
  }
}
