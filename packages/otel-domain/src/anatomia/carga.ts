/**
 * O que viaja neste lab: a chamada, e o span que cada serviço exporta por conta
 * própria.
 *
 * Os dois são **mensagens diferentes em fios diferentes**, e isso é a tese
 * desenhada: a requisição continua para o próximo serviço; o span sai para o
 * lado, para o backend. Nenhum serviço manda a árvore para lugar nenhum, porque
 * nenhum serviço tem a árvore.
 */

/** A chamada que atravessa a fronteira, com o cabeçalho — ou sem ele. */
export interface Chamada {
  readonly n: number;
  /**
   * O `traceparent`, quando ele sobrevive à travessia.
   *
   * Ausente é o caso real e caro: um proxy que remove cabeçalho desconhecido,
   * um cliente que remonta a requisição, uma fila que carrega só o payload.
   */
  readonly traceparent?: string;
}

/** O que um serviço instrumentado exporta. Ele sabe o pai, e nada além. */
export interface SpanExportado {
  /** Em que tick ele chegou ao backend. Quem carimba é o backend, na chegada. */
  readonly chegouEm?: number;
  readonly traceId: string;
  readonly spanId: string;
  /** O id do pai. Ausente no span raiz — e ausente também num órfão de verdade. */
  readonly parentId?: string;
  readonly servico: string;
  readonly n: number;
  readonly amostrado: boolean;
}

/**
 * Um id hexadecimal derivado do texto. Determinístico de propósito: o mesmo run
 * duas vezes conta a mesma história, e um lab que muda de resposta entre dois
 * carregamentos não é evidência de nada.
 *
 * A aleatoriedade do id de verdade não é o assunto aqui — o assunto é que
 * **ninguém os aloca**, e isso continua valendo com um id derivado.
 */
export function idHex(digitos: number, semente: string): string {
  let h = 2166136261 >>> 0;
  let saida = "";
  while (saida.length < digitos) {
    for (const caractere of `${semente}:${saida.length}`) {
      h ^= caractere.charCodeAt(0);
      h = Math.imul(h, 16777619) >>> 0;
    }
    saida += h.toString(16).padStart(8, "0");
  }
  const cortado = saida.slice(0, digitos);
  // Só zeros é inválido no W3C, e um id inválido não é um id: empurra para 1.
  return /^0+$/u.test(cortado) ? cortado.slice(0, -1) + "1" : cortado;
}

/**
 * A decisão de cabeça, derivada do número da requisição.
 *
 * `TraceIdRatioBased` decide pelo id do trace; aqui o número faz o mesmo papel e
 * mantém o run repetível. O que importa para o lab é que a decisão é **uma só,
 * tomada na raiz**, e que ela viaja.
 */
export function amostradaNaRaiz(n: number, taxa: number): boolean {
  if (taxa >= 1) return true;
  if (taxa <= 0) return false;
  return (n * 2654435761) % 1000 < taxa * 1000;
}
