/**
 * O caminho de um canal que atravessa a fronteira de uma caixa aberta.
 *
 * Um fio que morre na borda conta uma meia-verdade: o dado entrou ali, e o
 * leitor não vê onde. Com o interior desenhado dentro da caixa, o caminho pode
 * seguir até a peça que de fato recebe — e começar na peça que de fato emitiu.
 * É o item pulando de dimensão, e é o que dá sentido lógico a descer por zoom
 * em vez de a descida ser só uma câmera se aproximando.
 *
 * A função é puramente geométrica de propósito: **quem** recebe e **quem**
 * emite é decidido pelo modelo (bornes de entrada e resolução de emissões), e
 * chega aqui já resolvido. Se o desenho escolhesse essas pontas, ele estaria
 * afirmando ligações que ninguém declarou.
 */
export interface Ponta {
  readonly x: number;
  readonly y: number;
}

/** O primeiro `M x y` de um caminho, ou `null` se ele não começa com um. */
function comeco(d: string): { readonly x: number; readonly y: number; readonly resto: string } | null {
  const m = /^\s*M\s*(-?[\d.]+)[\s,]+(-?[\d.]+)\s*(.*)$/s.exec(d);
  if (m === null) return null;
  return { x: Number(m[1]), y: Number(m[2]), resto: m[3] ?? "" };
}

export function travessia(
  traco: string,
  saiDe: Ponta | undefined,
  chegaEm: Ponta | undefined,
): string {
  let d = traco;

  if (saiDe !== undefined) {
    const inicio = comeco(d);
    // Sem um `M` reconhecível o caminho não é nosso, e emendar nele produziria
    // uma linha inventada. Melhor deixar como está.
    if (inicio !== null) {
      d = `M ${saiDe.x} ${saiDe.y} L ${inicio.x} ${inicio.y} ${inicio.resto}`.trimEnd();
    }
  }

  if (chegaEm !== undefined) {
    d = `${d} L ${chegaEm.x} ${chegaEm.y}`;
  }

  return d;
}
