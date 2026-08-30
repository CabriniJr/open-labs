import type { NodePlacement } from "./view.js";

/**
 * O roteador de fios: por onde a linha passa entre duas caixas.
 *
 * Mora num arquivo só dele porque é **capacidade de montagem**, e não decoração
 * do palco: é ele que decide se o desenho vai dizer a verdade sobre quem está
 * ligado a quem. Separado, ele é testável sem montar React nenhum — e um
 * roteador que erra é a espécie de defeito que passa despercebido, porque o
 * desenho continua bonito enquanto mente.
 */

export interface Ponto {
  readonly x: number;
  readonly y: number;
}

const centro = (p: NodePlacement): Ponto => ({ x: p.x + p.w / 2, y: p.y + p.h / 2 });

/**
 * O caminho de um fio, em cotovelos retos — é assim que esquemático se desenha,
 * e a diagonal esconderia por onde a linha passa.
 *
 * Quando o destino está atrás da origem, a linha desce para uma faixa livre e
 * volta por baixo: é a realimentação, e ela precisa **parecer** uma volta.
 */
export interface Retangulo {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const cruzaVertical = (x: number, y1: number, y2: number, r: Retangulo): boolean =>
  x > r.x - 6 && x < r.x + r.w + 6 && Math.max(y1, y2) > r.y - 6 && Math.min(y1, y2) < r.y + r.h + 6;

const cruzaHorizontal = (y: number, x1: number, x2: number, r: Retangulo): boolean =>
  y > r.y - 6 && y < r.y + r.h + 6 && Math.max(x1, x2) > r.x - 6 && Math.min(x1, x2) < r.x + r.w + 6;

/**
 * As alturas por onde uma linha pode sair de uma caixa (ou entrar nela).
 *
 * Pelo meio primeiro: uma linha que sai do meio se lê como "esta caixa,
 * inteira". As outras existem para quando o meio não passa — e um desvio de
 * alguns pixels é preço barato perto de atravessar quem está no caminho.
 */
function alturasEm(p: NodePlacement): readonly number[] {
  const c = p.y + p.h / 2;
  return [c, c - p.h * 0.28, c + p.h * 0.28, p.y + 6, p.y + p.h - 6];
}

/** O candidato de menor custo. Nunca devolve nada: desenhar é obrigatório. */
function melhorEntre<T>(candidatos: readonly T[], custo: (c: T) => number): T {
  let melhor = candidatos[0] as T;
  let melhorCusto = Number.POSITIVE_INFINITY;
  for (const c of candidatos) {
    const q = custo(c);
    if (q < melhorCusto) {
      melhor = c;
      melhorCusto = q;
    }
    if (melhorCusto < 1e-6) break;
  }
  return melhor;
}

/** O primeiro candidato que não passa por cima de ninguém, ou o primeiro. */
function escolher(
  candidatos: readonly number[],
  livre: (valor: number) => boolean,
): number {
  return candidatos.find(livre) ?? candidatos[0] ?? 0;
}

/**
 * O caminho de um fio, em cotovelos retos — é assim que esquemático se desenha,
 * e a diagonal esconderia por onde a linha passa.
 *
 * O cotovelo **desvia de quem estiver no caminho**. Uma linha que atravessa uma
 * caixa parece entrar nela, e o leitor passa a ver uma ligação que não existe —
 * é mentira de desenho, e custa o mesmo tanto que mentira de número.
 */
export function caminho(
  de: NodePlacement,
  para: NodePlacement,
  faixa: number,
  obstaculos: readonly Retangulo[],
): string {
  const a = centro(de);
  const b = centro(para);
  const saida = { x: de.x + de.w, y: a.y };
  const outros = obstaculos.filter((r) => r !== de && r !== para);

  // Para a frente: sai pela direita, entra pela esquerda, com um cotovelo no
  // meio. É a leitura natural, e é a maioria dos fios.
  if (para.x >= saida.x + 16) {
    const meio = (saida.x + para.x) / 2;
    const colunas = [meio, meio - 14, meio + 14, saida.x + 12, para.x - 12, meio - 34, meio + 34];
    // As três alturas de saída e de entrada: pelo meio, e um pouco acima ou
    // abaixo dentro da própria caixa. Sair pelo meio é a leitura natural; sair
    // um pouco fora do meio é o preço de não atravessar quem está no caminho.
    const alturasDe = alturasEm(de);
    const alturasPara = alturasEm(para);
    const custoDe = ({ x, y1, y2 }: { x: number; y1: number; y2: number }): number =>
      outros.filter((r) => cruzaHorizontal(y1, saida.x, x, r)).length +
      outros.filter((r) => cruzaVertical(x, y1, y2, r)).length +
      outros.filter((r) => cruzaHorizontal(y2, x, para.x, r)).length +
      (Math.abs(y1 - a.y) + Math.abs(y2 - b.y)) / 10_000;
    const melhor = melhorEntre(
      colunas.flatMap((x) =>
        alturasDe.flatMap((y1) => alturasPara.map((y2) => ({ x, y1, y2 }))),
      ),
      custoDe,
    );
    if (custoDe(melhor) < 1) {
      return `M ${saida.x} ${melhor.y1} H ${melhor.x} V ${melhor.y2} H ${para.x}`;
    }

    /*
      Nada limpo com um cotovelo só: desvia por um corredor.

      É o que um esquemático faz quando a linha reta não cabe — sai da caixa,
      sobe ou desce até uma **faixa livre entre as fileiras**, corre por ela, e
      entra no destino pelo outro lado. Cinco trechos em vez de três, e nenhum
      passando por cima de quem não tem nada com a ligação.

      Só entra aqui quando o caminho curto sujaria o desenho, porque ele custa
      uma busca maior — e a esmagadora maioria dos fios não precisa dele.
    */
    const corredores = [
      ...new Set([a.y, b.y, ...outros.flatMap((r) => [r.y - 12, r.y + r.h + 12])]),
    ];
    const desvio = melhorEntre(
      corredores.flatMap((lane) =>
        alturasDe.flatMap((y1) =>
          alturasPara.map((y2) => ({ lane, y1, y2, x0: saida.x + 14, x1: para.x - 14 })),
        ),
      ),
      ({ lane, y1, y2, x0, x1 }) =>
        outros.filter((r) => cruzaHorizontal(y1, saida.x, x0, r)).length +
        outros.filter((r) => cruzaVertical(x0, y1, lane, r)).length +
        outros.filter((r) => cruzaHorizontal(lane, x0, x1, r)).length +
        outros.filter((r) => cruzaVertical(x1, lane, y2, r)).length +
        outros.filter((r) => cruzaHorizontal(y2, x1, para.x, r)).length +
        (Math.abs(y1 - a.y) + Math.abs(y2 - b.y) + Math.abs(lane - a.y) / 8) / 10_000,
    );
    return `M ${saida.x} ${desvio.y1} H ${desvio.x0} V ${desvio.lane} H ${desvio.x1} V ${desvio.y2} H ${para.x}`;
  }

  // Destino claramente abaixo ou acima: **desce (ou sobe) pela borda**, em vez
  // de sair de lado e cruzar tudo na altura do meio. É o barramento indo até a
  // memória, e é assim que a figura de livro desenha.
  const abaixo = para.y > de.y + de.h + 8;
  const acima = para.y + para.h + 8 < de.y;
  if (abaixo || acima) {
    const entre = abaixo
      ? [(de.y + de.h + para.y) / 2, para.y - 16, de.y + de.h + 16]
      : [(para.y + para.h + de.y) / 2, para.y + para.h + 16, de.y - 16];
    const faixas = entre.flatMap((c) => [c, c - 12, c + 12, c - 24, c + 24]);
    const inicioY = abaixo ? de.y + de.h : de.y;
    const fimY = abaixo ? para.y : para.y + para.h;

    /*
      Os três trechos são conferidos, e não só o do meio.

      A descida saía do centro da origem, corria numa faixa livre e subia no
      centro do destino — e **essa última subida não era conferida contra
      ninguém**. Era ela que atravessava uma caixa pelo meio, e uma linha que
      atravessa uma caixa parece entrar nela: o leitor passa a ver uma ligação
      que não existe. Agora os dois verticais também escolhem por onde passar,
      dentro da largura da caixa a que pertencem — sair um pouco fora do centro
      é preço barato perto de mentir sobre quem está ligado a quem.
    */
    const saidasX = [a.x, de.x + de.w * 0.3, de.x + de.w * 0.7, de.x + 8, de.x + de.w - 8];
    const entradasX = [
      b.x,
      para.x + para.w * 0.3,
      para.x + para.w * 0.7,
      para.x + 8,
      para.x + para.w - 8,
    ];
    let melhor = { x1: a.x, lane: faixas[0] ?? inicioY, x2: b.x, custo: Number.POSITIVE_INFINITY };
    for (const x1 of saidasX) {
      for (const x2 of entradasX) {
        for (const lane of faixas) {
          const custo =
            outros.filter((r) => cruzaVertical(x1, inicioY, lane, r)).length +
            outros.filter((r) => cruzaHorizontal(lane, x1, x2, r)).length +
            outros.filter((r) => cruzaVertical(x2, lane, fimY, r)).length +
            // Empate desfeito pelo centro: entre dois caminhos limpos, o que
            // sai e entra pelo meio é o que se lê como "esta caixa, inteira".
            (Math.abs(x1 - a.x) + Math.abs(x2 - b.x)) / 10_000;
          if (custo < melhor.custo) melhor = { x1, x2, lane, custo };
          if (melhor.custo < 1e-6) break;
        }
      }
    }
    return `M ${melhor.x1} ${inicioY} V ${melhor.lane} H ${melhor.x2} V ${fimY}`;
  }

  // Sobrepostos na vertical: a linha precisa PARECER uma volta. Sai pela
  // direita, contorna por baixo dos dois e entra pela borda de baixo.
  const base = Math.max(de.y + de.h, para.y + para.h);
  const lane = escolher(
    [base + faixa, base + faixa + 14, base + faixa + 28, base + faixa - 10],
    (c) => outros.every((r) => !cruzaHorizontal(c, saida.x + 14, b.x, r)),
  );
  return `M ${saida.x} ${saida.y} H ${saida.x + 14} V ${lane} H ${b.x} V ${para.y + para.h}`;
}

