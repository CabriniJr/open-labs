/**
 * O que atravessa este lab: uma requisição, e o que cada gravador guarda dela.
 *
 * A requisição é **uma coisa só**, e é o ponto do lab inteiro: os três
 * gravadores olham exatamente o mesmo evento e ficam com coisas diferentes. Se
 * cada um tivesse a sua própria fonte, a demonstração seria um truque.
 */
export interface Requisicao {
  /** Um número que cresce. É a identidade que a métrica vai descartar. */
  readonly n: number;
  readonly rota: string;
  /** Quanto ela demorou, em milissegundos. */
  readonly latencia: number;
  /** `2xx` ou `5xx`: o lab não precisa de mais que isso. */
  readonly erro: boolean;
  /** Quem pediu. É a cardinalidade esperando para acontecer. */
  readonly usuario: string;
  /** O tick em que ela aconteceu. */
  readonly tick: number;
}

/**
 * Os limites do histograma, em milissegundos.
 *
 * São os padrões da spec para `http.server.request.duration` reduzidos ao que
 * cabe na tela — e o que importa aqui não são os números, é que **eles existem
 * antes da medição**. Um balde é uma decisão tomada na escrita, e é ela que
 * torna a identidade irrecuperável: o valor entra, a contagem sobe, e o que
 * sobra é a contagem.
 */
export const BALDES: readonly number[] = [50, 100, 250, 500, 1000];

/** Em qual balde esta latência cai. O último é o "de lá para cima". */
export function baldeDe(latencia: number): string {
  for (const limite of BALDES) {
    if (latencia <= limite) return `≤ ${limite} ms`;
  }
  return `> ${BALDES[BALDES.length - 1]} ms`;
}

/** O conjunto de atributos com que a medição é registrada. A chave É o conjunto. */
export function chaveDaSerie(req: Requisicao, comUsuario: boolean): string {
  const partes = [`http.route=${req.rota}`, `http.status=${req.erro ? "500" : "200"}`];
  if (comUsuario) partes.push(`user.id=${req.usuario}`);
  return partes.join(", ");
}
