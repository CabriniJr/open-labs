/**
 * Quanto espaguete tem um desenho.
 *
 * "Está bagunçado" é gosto, e gosto não segura nada: a próxima vista nasce um
 * pouco pior, ninguém sabe dizer o quanto, e três meses depois o desenho é uma
 * meada. Cruzamento de fio se conta, e contado ele vira orçamento — uma
 * mudança que embaralhe a figura reprova em vez de passar despercebida.
 *
 * **Mede-se o que foi desenhado, e não o que se pretendia desenhar.** As
 * funções daqui leem os caminhos que saíram na tela (`M x y H x V y H x`).
 * Recalcular as rotas para medi-las seria um segundo roteador, e ele
 * discordaria do primeiro exatamente no dia em que o primeiro piorasse.
 *
 * Duas coisas são contadas, e são defeitos diferentes:
 *
 * - **cruzamento** — dois fios se atravessam. Inevitável em alguma medida, e é
 *   por isso que o orçamento é um número e não zero;
 * - **sobreposição** — dois fios andam por cima um do outro no mesmo trecho.
 *   Pior que cruzar: dois fios sobrepostos são desenhados como um só, e o
 *   leitor vê uma ligação onde há duas. É a mesma espécie da linha que
 *   atravessa uma caixa e parece entrar nela.
 */

export interface Segmento {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

/** Um `d` de cotovelos retos, quebrado nos trechos que ele desenha. */
export function segmentos(d: string): readonly Segmento[] {
  const partes = d.trim().split(/\s+/);
  const saida: Segmento[] = [];
  let x = 0;
  let y = 0;
  let i = 0;
  while (i < partes.length) {
    const comando = partes[i];
    if (comando === "M") {
      x = Number(partes[i + 1]);
      y = Number(partes[i + 2]);
      i += 3;
      continue;
    }
    if (comando === "H") {
      const destino = Number(partes[i + 1]);
      if (destino !== x) saida.push({ x1: x, y1: y, x2: destino, y2: y });
      x = destino;
      i += 2;
      continue;
    }
    if (comando === "V") {
      const destino = Number(partes[i + 1]);
      if (destino !== y) saida.push({ x1: x, y1: y, x2: x, y2: destino });
      y = destino;
      i += 2;
      continue;
    }
    // Curva, arco, fechamento: não é trecho reto e esta conta não fala dele.
    // Pular calado seria a conta dizer "limpo" sobre um desenho que ela não
    // sabe ler, então quem chama precisa saber que só cotovelo reto conta.
    i += 1;
  }
  return saida;
}

const horizontal = (s: Segmento): boolean => s.y1 === s.y2;
const entre = (v: number, a: number, b: number): boolean =>
  v > Math.min(a, b) + 0.5 && v < Math.max(a, b) - 0.5;

/**
 * Um cruzamento de verdade: um trecho deitado e um em pé se atravessando **no
 * meio dos dois**. Encostar na ponta não conta — é assim que um fio chega numa
 * porta, e contar isso como bagunça acusaria todo desenho correto.
 */
function seCruzam(a: Segmento, b: Segmento): boolean {
  if (horizontal(a) === horizontal(b)) return false;
  const deitado = horizontal(a) ? a : b;
  const emPe = horizontal(a) ? b : a;
  return entre(emPe.x1, deitado.x1, deitado.x2) && entre(deitado.y1, emPe.y1, emPe.y2);
}

/**
 * O quanto dois trechos precisam se cobrir para se lerem como um só.
 *
 * O defeito é "o leitor vê uma ligação onde existem duas", e isso pede um
 * trecho comum **longo o bastante para parecer uma linha**. Dois fios que se
 * roçam por dois pixels numa quina não enganam ninguém, e acusá-los enche a
 * medida de ruído — uma medida que acusa o que não é defeito é ignorada, e
 * medida ignorada não segura nada.
 *
 * Oito unidades é menos que a menor caixa do desenho, então nenhuma
 * sobreposição que atravesse alguma coisa escapa por aqui.
 */
const LEGIVEL = 8;

/** O quanto dois intervalos se cobrem. Negativo quando nem se tocam. */
function cobertura(a1: number, a2: number, b1: number, b2: number): number {
  return (
    Math.min(Math.max(a1, a2), Math.max(b1, b2)) - Math.max(Math.min(a1, a2), Math.min(b1, b2))
  );
}

/** Dois trechos na mesma reta, andando por cima um do outro. */
function seSobrepoem(a: Segmento, b: Segmento): boolean {
  if (horizontal(a) !== horizontal(b)) return false;
  return horizontal(a)
    ? a.y1 === b.y1 && cobertura(a.x1, a.x2, b.x1, b.x2) > LEGIVEL
    : a.x1 === b.x1 && cobertura(a.y1, a.y2, b.y1, b.y2) > LEGIVEL;
}

export interface Meada {
  readonly cruzamentos: number;
  readonly sobreposicoes: number;
}

/** Quanto espaguete há entre estes caminhos. Fio consigo mesmo não conta. */
export function meada(caminhos: readonly string[]): Meada {
  const porFio = caminhos.map(segmentos);
  let cruzamentos = 0;
  let sobreposicoes = 0;
  for (let i = 0; i < porFio.length; i += 1) {
    for (let j = i + 1; j < porFio.length; j += 1) {
      for (const a of porFio[i] ?? []) {
        for (const b of porFio[j] ?? []) {
          if (seCruzam(a, b)) cruzamentos += 1;
          else if (seSobrepoem(a, b)) sobreposicoes += 1;
        }
      }
    }
  }
  return { cruzamentos, sobreposicoes };
}

export interface Ponto {
  readonly x: number;
  readonly y: number;
}

/**
 * Onde os fios se **juntam**, para o desenho poder marcar com um ponto.
 *
 * É a convenção mais antiga do esquemático, e a mais barata: **o T ganha
 * pontinho e o X não ganha**. Sem ela o leitor não tem como saber se duas
 * linhas que se tocam estão ligadas ou só passam uma pela outra — e no desenho
 * de hoje um leque sai da mesma porta como três linhas empilhadas, que se leem
 * como uma linha só. Ele vê uma ligação onde existem três.
 *
 * A regra é geométrica e não precisa saber o que é leque: junção é a **ponta**
 * de um fio caindo no **meio** do trecho de outro. Duas pontas no mesmo lugar
 * não contam — isso é o encontro dos dois numa porta, e a porta já está
 * desenhada ali. Dois meios se cruzando também não: é o X, e a ausência do
 * ponto é o que diz que eles não se falam.
 */
export function juncoes(caminhos: readonly string[]): readonly Ponto[] {
  const porFio = caminhos.map(segmentos);
  const achadas = new Map<string, Ponto>();

  const noMeio = (p: Ponto, s: Segmento): boolean =>
    horizontal(s)
      ? p.y === s.y1 && entre(p.x, s.x1, s.x2)
      : p.x === s.x1 && entre(p.y, s.y1, s.y2);

  for (let i = 0; i < porFio.length; i += 1) {
    for (const segmento of porFio[i] ?? []) {
      for (const ponta of [
        { x: segmento.x1, y: segmento.y1 },
        { x: segmento.x2, y: segmento.y2 },
      ]) {
        for (let j = 0; j < porFio.length; j += 1) {
          if (i === j) continue;
          if (!(porFio[j] ?? []).some((outro) => noMeio(ponta, outro))) continue;
          achadas.set(`${ponta.x},${ponta.y}`, ponta);
        }
      }
    }
  }
  return [...achadas.values()];
}
