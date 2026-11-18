/**
 * A mochila 0/1 da sessão no telecentro: quais labs cabem nos minutos de
 * computador para aprender o máximo. É a mesma pergunta que o planejador em
 * Python da GS (`programacao-dinamica/planejador/sessao.py`) responde, sobre o
 * mesmo catálogo; o lab do site mostra a tabela enchendo.
 *
 * `T[i][c]` = o máximo de pontos usando só os `i` primeiros labs e `c` colunas
 * de tempo (cada coluna é `PASSO` minutos):
 *
 *     T[0][c] = 0
 *     T[i][c] = max(T[i-1][c], pontos(i) + T[i-1][c - colunas(i)])   se cabe
 *
 * A reconstrução anda da última linha para a primeira: se a célula mudou em
 * relação à de cima, o lab da linha entrou. A recursão sem memória faz a
 * mesma conta, mas abre duas chamadas por célula e recalcula as repetidas — é a
 * contagem que o lab põe ao lado da tabela.
 */
export class ErroDeMochila extends Error {}

/** O tempo anda em blocos de 5 minutos: a tabela cabe numa tela. */
export const PASSO = 5;
export const MAIOR_SESSAO = 180;
export const MAIS_ITENS = 12;

export interface ItemDaMochila {
  readonly id: string;
  readonly nome: string;
  readonly minutos: number;
  readonly pontos: number;
}

/**
 * Labs reais do OpenLabs. Os minutos são os de `T_LAB` no banco da GS; os
 * pontos (objetivos de aprendizagem) são a estimativa da equipe, os mesmos de
 * `programacao-dinamica/dados/labs.json`.
 */
export const CATALOGO: readonly ItemDaMochila[] = [
  { id: "telecentro-network", nome: "Telecentre Wi-Fi", minutos: 30, pontos: 5 },
  { id: "telecentro-database", nome: "Telecentre database", minutos: 30, pontos: 5 },
  { id: "join-by-hand", nome: "JOIN by hand", minutos: 20, pontos: 3 },
  { id: "rpn", nome: "Stack machine", minutos: 20, pontos: 3 },
  { id: "how-work-grows", nome: "How work grows", minutos: 25, pontos: 4 },
  { id: "sorting-race", nome: "Sorting race", minutos: 30, pontos: 4 },
  { id: "what-is-a-graph", nome: "What a graph is", minutos: 15, pontos: 2 },
  { id: "shortest-path", nome: "Shortest paths", minutos: 30, pontos: 5 },
  { id: "greedy-change", nome: "Greedy change", minutos: 20, pontos: 3 },
  { id: "three-pillars", nome: "Three pillars", minutos: 25, pontos: 3 },
  { id: "pod-lifecycle", nome: "Pod lifecycle", minutos: 20, pontos: 3 },
  { id: "splunk-ingest", nome: "Splunk ingest", minutos: 25, pontos: 3 },
];

export interface CenarioDaMochila {
  readonly id: string;
  readonly nome: string;
  readonly itens: readonly string[];
  readonly sessao: number;
  readonly nota: string;
}

export const CENARIOS_DA_MOCHILA: readonly CenarioDaMochila[] = [
  {
    id: "rafa",
    nome: "Rafa, 90 minutes",
    itens: ["telecentro-network", "rpn", "sorting-race", "shortest-path", "greedy-change", "join-by-hand", "three-pillars"],
    sessao: 90,
    nota: "Seven labs unlocked, an hour and a half of computer time. Picking by points per minute leaves a point on the table.",
  },
  {
    id: "trap",
    nome: "The smallest trap",
    itens: ["what-is-a-graph", "how-work-grows", "three-pillars"],
    sessao: 50,
    nota: "Greedy takes the two densest labs and leaves ten minutes no lab fits in. The best plan uses all fifty.",
  },
  {
    id: "cida",
    nome: "Dona Cida, 60 minutes",
    itens: ["telecentro-database", "rpn", "how-work-grows", "what-is-a-graph", "three-pillars", "pod-lifecycle"],
    sessao: 60,
    nota: "Six labs unlocked, one hour. Here greedy happens to find the best plan too.",
  },
];

export function conferirItens(itens: readonly ItemDaMochila[]): void {
  if (itens.length > MAIS_ITENS) throw new ErroDeMochila(`at most ${MAIS_ITENS} labs in one session, got ${itens.length}`);
  const vistos = new Set<string>();
  for (const it of itens) {
    if (vistos.has(it.id)) throw new ErroDeMochila(`${it.nome} appears twice`);
    vistos.add(it.id);
    if (!Number.isInteger(it.minutos) || it.minutos < PASSO || it.minutos > 120 || it.minutos % PASSO !== 0)
      throw new ErroDeMochila(`${it.nome}: minutes must be a multiple of ${PASSO} from ${PASSO} to 120, got ${it.minutos}`);
    if (!Number.isInteger(it.pontos) || it.pontos < 0 || it.pontos > 10) throw new ErroDeMochila(`${it.nome}: points must be a whole number from 0 to 10, got ${it.pontos}`);
  }
}

export function conferirSessao(sessao: number): void {
  if (!Number.isInteger(sessao) || sessao < 0 || sessao > MAIOR_SESSAO || sessao % PASSO !== 0)
    throw new ErroDeMochila(`the session must be a multiple of ${PASSO} minutes from 0 to ${MAIOR_SESSAO}, got ${sessao}`);
}

export interface Mochila {
  /** `T[i][c]`: linhas 0..n, colunas 0..sessao/PASSO. */
  readonly T: readonly (readonly number[])[];
  /** Índices (em `itens`) dos labs escolhidos, em ordem. */
  readonly escolhidos: readonly number[];
  /** As células que a reconstrução visita, de baixo para cima: [linha, coluna]. */
  readonly caminho: readonly (readonly [number, number])[];
  readonly pontos: number;
  readonly minutos: number;
  /** Células calculadas: n × (colunas + 1). */
  readonly celulas: number;
}

export function mochila(itens: readonly ItemDaMochila[], sessao: number): Mochila {
  conferirItens(itens);
  conferirSessao(sessao);
  const colunas = sessao / PASSO;
  const T: number[][] = [new Array<number>(colunas + 1).fill(0)];
  let celulas = 0;
  itens.forEach((it, k) => {
    const cima = T[k]!;
    const w = it.minutos / PASSO;
    const linha = cima.map((deixa, c) => {
      celulas += 1;
      return w <= c ? Math.max(deixa, it.pontos + cima[c - w]!) : deixa;
    });
    T.push(linha);
  });

  const escolhidos: number[] = [];
  const caminho: [number, number][] = [];
  let c = colunas;
  for (let i = itens.length; i > 0; i -= 1) {
    caminho.push([i, c]);
    if (T[i]![c] !== T[i - 1]![c]) {
      escolhidos.push(i - 1);
      c -= itens[i - 1]!.minutos / PASSO;
    }
  }
  caminho.push([0, c]);
  escolhidos.reverse();
  return {
    T,
    escolhidos,
    caminho,
    pontos: T[itens.length]![colunas]!,
    minutos: escolhidos.reduce((s, k) => s + itens[k]!.minutos, 0),
    celulas,
  };
}

/** Por que a célula vale o que vale: deixar o lab da linha, ou levá-lo. */
export function porQue(itens: readonly ItemDaMochila[], T: Mochila["T"], i: number, c: number): { readonly deixa: number; readonly leva: number | null; readonly valor: number } {
  if (i === 0) return { deixa: 0, leva: null, valor: 0 };
  const it = itens[i - 1]!;
  const w = it.minutos / PASSO;
  return { deixa: T[i - 1]![c]!, leva: w <= c ? it.pontos + T[i - 1]![c - w]! : null, valor: T[i]![c]! };
}

export interface Gulosa {
  readonly escolhidos: readonly number[];
  readonly pontos: number;
  readonly minutos: number;
}

/** Pontos por minuto, do mais denso para o menos; empate pelo nome. */
export function gulosa(itens: readonly ItemDaMochila[], sessao: number): Gulosa {
  conferirItens(itens);
  conferirSessao(sessao);
  const ordem = itens.map((_, k) => k).sort((a, b) => itens[b]!.pontos / itens[b]!.minutos - itens[a]!.pontos / itens[a]!.minutos || itens[a]!.nome.localeCompare(itens[b]!.nome));
  const escolhidos: number[] = [];
  let sobra = sessao;
  for (const k of ordem) {
    if (itens[k]!.minutos <= sobra) {
      escolhidos.push(k);
      sobra -= itens[k]!.minutos;
    }
  }
  return { escolhidos, pontos: escolhidos.reduce((s, k) => s + itens[k]!.pontos, 0), minutos: sessao - sobra };
}

/**
 * Quantas chamadas a recorrência faz **sem memória**, contadas rodando-a. Cada
 * chamada com um lab que cabe abre duas; as que dão no mesmo (i, c) são
 * recalculadas do zero. Com 12 labs, no máximo 2¹³ − 1.
 */
export function chamadasSemMemoria(itens: readonly ItemDaMochila[], sessao: number): number {
  conferirItens(itens);
  conferirSessao(sessao);
  let chamadas = 0;
  const m = (i: number, c: number): number => {
    chamadas += 1;
    if (i === 0) return 0;
    const it = itens[i - 1]!;
    const w = it.minutos / PASSO;
    const deixa = m(i - 1, c);
    return w <= c ? Math.max(deixa, it.pontos + m(i - 1, c - w)) : deixa;
  };
  m(itens.length, sessao / PASSO);
  return chamadas;
}

/** Quantas chamadas com memória: cada (i, c) visitado é resolvido uma vez. */
export function chamadasComMemoria(itens: readonly ItemDaMochila[], sessao: number): number {
  conferirItens(itens);
  conferirSessao(sessao);
  const memo = new Map<number, number>();
  const colunas = sessao / PASSO + 1;
  let chamadas = 0;
  const m = (i: number, c: number): number => {
    chamadas += 1;
    if (i === 0) return 0;
    const chave = i * colunas + c;
    const visto = memo.get(chave);
    if (visto !== undefined) return visto;
    const it = itens[i - 1]!;
    const w = it.minutos / PASSO;
    const deixa = m(i - 1, c);
    const r = w <= c ? Math.max(deixa, it.pontos + m(i - 1, c - w)) : deixa;
    memo.set(chave, r);
    return r;
  };
  m(itens.length, sessao / PASSO);
  return chamadas;
}

/** O melhor por força bruta, para conferir (2ⁿ subconjuntos). */
export function forcaBruta(itens: readonly ItemDaMochila[], sessao: number): number {
  conferirItens(itens);
  conferirSessao(sessao);
  let melhor = 0;
  for (let mascara = 0; mascara < 1 << itens.length; mascara += 1) {
    let min = 0;
    let pts = 0;
    itens.forEach((it, k) => {
      if (mascara & (1 << k)) {
        min += it.minutos;
        pts += it.pontos;
      }
    });
    if (min <= sessao && pts > melhor) melhor = pts;
  }
  return melhor;
}

export function itensDoCenario(cenario: CenarioDaMochila): ItemDaMochila[] {
  return cenario.itens.map((id) => {
    const it = CATALOGO.find((c) => c.id === id);
    if (it === undefined) throw new ErroDeMochila(`unknown lab ${id}`);
    return it;
  });
}
