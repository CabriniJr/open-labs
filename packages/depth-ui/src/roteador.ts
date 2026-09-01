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

/**
 * O caminho de um fio, em cotovelos retos — é assim que esquemático se desenha,
 * e a diagonal esconderia por onde a linha passa.
 *
 * O cotovelo **desvia de quem estiver no caminho**. Uma linha que atravessa uma
 * caixa parece entrar nela, e o leitor passa a ver uma ligação que não existe —
 * é mentira de desenho, e custa o mesmo tanto que mentira de número.
 */
/**
 * As retas por onde algum fio já passou.
 *
 * O roteador desviava de caixas e não sabia nada de fios: dois fios sem nada em
 * comum escolhiam a MESMA coluna de cotovelo, porque o desempate era a
 * proximidade do centro e os dois queriam o centro. Desenhados um por cima do
 * outro, eles se leem como um só — o leitor vê uma ligação onde existem duas.
 *
 * A chave é `"v:375"` ou `"h:220"`.
 *
 * **Os pesos são a hierarquia dos defeitos, escrita como número.** São três
 * espécies, e elas não se equivalem:
 *
 * - **atravessar uma caixa é mentira** — a linha parece entrar nela, e o leitor
 *   passa a ver uma ligação que não existe. Custa cem;
 * - **repetir a reta de outro fio é ambiguidade** — os dois se leem como um só.
 *   Custa um, então nenhuma quantidade de repetição paga uma mentira;
 * - **sair do centro da caixa é estética** — custa um décimo de milésimo, e só
 *   serve para desempatar entre caminhos igualmente honestos.
 *
 * Com os três na mesma ordem de grandeza, a soma decidia por acaso: bastavam
 * duas retas repetidas para o roteador preferir cortar uma caixa.
 */
export type Ocupadas = ReadonlySet<string>;

const MENTIRA = 100;
const REPETIR = 1;

/** Onde este caminho passa, para o próximo fio saber. */
export function retasDe(d: string): readonly string[] {
  const partes = d.trim().split(/\s+/);
  const retas: string[] = [];
  let x = 0;
  let y = 0;
  let i = 0;
  while (i < partes.length) {
    if (partes[i] === "M") {
      x = Number(partes[i + 1]);
      y = Number(partes[i + 2]);
      i += 3;
    } else if (partes[i] === "H") {
      const destino = Number(partes[i + 1]);
      if (destino !== x) retas.push(`h:${y}`);
      x = destino;
      i += 2;
    } else if (partes[i] === "V") {
      const destino = Number(partes[i + 1]);
      if (destino !== y) retas.push(`v:${x}`);
      y = destino;
      i += 2;
    } else {
      i += 1;
    }
  }
  return retas;
}

/**
 * As duas pontas de um caminho.
 *
 * Existe porque **a porta tem de ficar onde o fio chega**. As portas eram
 * distribuídas em alturas iguais pela borda e o roteador escolhia a altura por
 * conta própria: o desenho mostrava uma entrada e uma linha que não a tocava, e
 * o leitor não tinha como saber por onde a coisa de fato entrou. Perguntar ao
 * caminho onde ele começa e termina inverte a dependência — quem manda é a
 * geometria da ligação, e a porta é o desenho dela.
 */
export function pontasDe(d: string): { readonly inicio: Ponto; readonly fim: Ponto } {
  const partes = d.trim().split(/\s+/u);
  let x = 0;
  let y = 0;
  let inicio: Ponto | undefined;
  let i = 0;
  while (i < partes.length) {
    if (partes[i] === "M") {
      x = Number(partes[i + 1]);
      y = Number(partes[i + 2]);
      inicio ??= { x, y };
      i += 3;
    } else if (partes[i] === "H") {
      x = Number(partes[i + 1]);
      i += 2;
    } else if (partes[i] === "V") {
      y = Number(partes[i + 1]);
      i += 2;
    } else {
      i += 1;
    }
  }
  return { inicio: inicio ?? { x, y }, fim: { x, y } };
}

/**
 * O afastamento da mira, em unidades de desenho.
 *
 * A mira — a saída aponta para o destino, a entrada aponta para a origem — é o
 * que ordena um leque, e foi ela que levou o somador de vinte e oito
 * cruzamentos para quatro. Ela não se toca.
 *
 * O que ela não resolve é o par: **duas portas diferentes ligando as mesmas
 * duas caixas miram o mesmo ponto**, saem na mesma altura e são desenhadas uma
 * por cima da outra — o leitor vê uma ligação onde existem duas, e a caixa
 * parece ter uma porta só. O desvio afasta as portas em torno da mira, e é
 * pequeno de propósito: a ordem global continua sendo da mira, e o desvio só
 * desempata quem ela empatou.
 */
export interface Ancoras {
  readonly desvioSaida?: number | undefined;
  readonly desvioEntrada?: number | undefined;
}

export function caminho(
  de: NodePlacement,
  para: NodePlacement,
  faixa: number,
  obstaculos: readonly Retangulo[],
  ocupadas: Ocupadas = new Set(),
  ancoras: Ancoras = {},
): string {
  const repetido = (chave: string): number => (ocupadas.has(chave) ? REPETIR : 0);
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
    /*
      A saída MIRA o destino, e é isso que impede o leque de embaraçar.

      Doze dos vinte e oito cruzamentos do lab das portas eram um leque só:
      oito fios saindo da mesma caixa de entradas para quatro somadores, cada
      um escolhendo a altura de saída por conta própria — e o que ia para o
      somador de baixo saía por cima do que ia para o de cima. Nenhum deles
      estava errado sozinho; errado era não haver ordem.

      Mirar é uma regra local com efeito global: o fio que vai mais para cima
      sai mais para cima, sem o roteador precisar saber que existem irmãos.
      Duas saídas ordenadas pelo destino não têm como se cruzar, e o leque abre
      como um pente.

      A mira é a PRIMEIRA tentativa, e não a única: honestidade vem antes de
      ordem, e um caminho mirado que atravesse uma caixa perde para um caminho
      torto que não atravesse nada. Só aí as cinco alturas voltam.
    */
    const mira = Math.max(
      de.y + 6,
      Math.min(de.y + de.h - 6, b.y + (ancoras.desvioSaida ?? 0)),
    );
    // E a entrada mira a origem, pelo mesmo motivo e com a mesma consequência:
    // vários fios chegando na mesma caixa entram ordenados por de onde vieram,
    // e ordem preservada nas duas pontas é o que faz o feixe inteiro não
    // trançar. O leque e a convergência são a mesma figura, invertida.
    const miraEntrada = Math.max(
      para.y + 6,
      Math.min(para.y + para.h - 6, a.y + (ancoras.desvioEntrada ?? 0)),
    );
    const custoDe = ({ x, y1, y2 }: { x: number; y1: number; y2: number }): number =>
      outros.filter((r) => cruzaHorizontal(y1, saida.x, x, r)).length * MENTIRA +
      outros.filter((r) => cruzaVertical(x, y1, y2, r)).length * MENTIRA +
      outros.filter((r) => cruzaHorizontal(y2, x, para.x, r)).length * MENTIRA +
      repetido(`v:${x}`) +
      repetido(`h:${y1}`) +
      repetido(`h:${y2}`) +
      (Math.abs(y1 - a.y) + Math.abs(y2 - b.y)) / 10_000;
    const candidatos = (alturasDe: readonly number[], alturasPara: readonly number[]) =>
      colunas.flatMap((x) => alturasDe.flatMap((y1) => alturasPara.map((y2) => ({ x, y1, y2 }))));
    const mirado = melhorEntre(candidatos([mira], [miraEntrada]), custoDe);
    const melhor =
      custoDe(mirado) < MENTIRA
        ? mirado
        : melhorEntre(candidatos(alturasEm(de), alturasEm(para)), custoDe);
    // "Sem mentira" — e não "sem custo nenhum". Com a repetição de reta
    // pesando um, este limiar em um passou a recusar caminhos honestos que só
    // dividiam uma reta com outro fio, mandando-os para o corredor caro.
    if (custoDe(melhor) < MENTIRA) {
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
        // O corredor já é o caminho torto: aqui a mira não se sustenta, e as
        // cinco alturas voltam porque o que importa é não atravessar ninguém.
        alturasEm(de).flatMap((y1) =>
          alturasEm(para).map((y2) => ({ lane, y1, y2, x0: saida.x + 14, x1: para.x - 14 })),
        ),
      ),
      ({ lane, y1, y2, x0, x1 }) =>
        outros.filter((r) => cruzaHorizontal(y1, saida.x, x0, r)).length * MENTIRA +
        outros.filter((r) => cruzaVertical(x0, y1, lane, r)).length * MENTIRA +
        outros.filter((r) => cruzaHorizontal(lane, x0, x1, r)).length * MENTIRA +
        outros.filter((r) => cruzaVertical(x1, lane, y2, r)).length * MENTIRA +
        outros.filter((r) => cruzaHorizontal(y2, x1, para.x, r)).length * MENTIRA +
        repetido(`h:${lane}`) +
        repetido(`v:${x0}`) +
        repetido(`v:${x1}`) +
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
            outros.filter((r) => cruzaVertical(x1, inicioY, lane, r)).length * MENTIRA +
            outros.filter((r) => cruzaHorizontal(lane, x1, x2, r)).length * MENTIRA +
            outros.filter((r) => cruzaVertical(x2, lane, fimY, r)).length * MENTIRA +
            repetido(`v:${x1}`) +
            repetido(`v:${x2}`) +
            repetido(`h:${lane}`) +
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
  const coluna = saida.x + 14;
  // A volta corre por baixo de TODO MUNDO que estiver no caminho, e não só por
  // baixo das duas pontas: entre a origem e o destino costuma haver uma
  // terceira caixa mais alta, e a faixa calculada só pelas pontas passava por
  // dentro dela. As faixas candidatas saem dos obstáculos, que é de onde a
  // resposta certa pode vir.
  const faixas = [
    base + faixa,
    base + faixa + 14,
    base + faixa + 28,
    base + faixa - 10,
    ...outros.map((r) => r.y + r.h + 16),
  ].filter((c) => c > base - 12);
  const entradas = [b.x, para.x + para.w * 0.3, para.x + para.w * 0.7, para.x + 8, para.x + para.w - 8];
  const volta = melhorEntre(
    faixas.flatMap((lane) => entradas.map((x2) => ({ lane, x2 }))),
    ({ lane, x2 }) =>
      outros.filter((r) => cruzaVertical(coluna, saida.y, lane, r)).length * MENTIRA +
      outros.filter((r) => cruzaHorizontal(lane, coluna, x2, r)).length * MENTIRA +
      outros.filter((r) => cruzaVertical(x2, lane, para.y + para.h, r)).length * MENTIRA +
      (Math.abs(x2 - b.x) + Math.abs(lane - base) / 8) / 10_000,
  );
  return `M ${saida.x} ${saida.y} H ${coluna} V ${volta.lane} H ${volta.x2} V ${para.y + para.h}`;
}

