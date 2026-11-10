import { buscarNaCidade, BUSCAS_REAIS, type BuscaReal, type PassoDaBusca, type ResultadoReal } from "./buscas.js";
import type { Cidade } from "./cidade.js";

/**
 * Uma rota com paradas: de 2 a 4 pontos que o leitor larga no mapa. A ordem
 * das paradas do meio é escolhida para o menor tempo total — calculada com
 * Dijkstra (exato) entre todos os pares —, e cada busca percorre as pernas
 * nessa ordem, uma depois da outra. A fita de uma rota com paradas é a
 * concatenação das fitas das pernas, cada passo marcado com a perna dele.
 */
export const MAIS_PARADAS = 4;

export interface PassoComPerna {
  readonly passo: PassoDaBusca;
  readonly perna: number;
}

export interface RotaComParadas {
  readonly busca: BuscaReal;
  /** As paradas na ordem visitada (a primeira é sempre a origem que o leitor pôs). */
  readonly ordem: readonly number[];
  readonly pernas: readonly ResultadoReal[];
  /** A fita inteira, perna após perna. */
  readonly passos: readonly PassoComPerna[];
  readonly arestas: readonly number[];
  /** Décimos de segundo, somados nas pernas. */
  readonly tempo: number;
  readonly metros: number;
  readonly resolvidos: number;
}

function permutacoes<T>(xs: readonly T[]): T[][] {
  if (xs.length <= 1) return [[...xs]];
  return xs.flatMap((x, i) => permutacoes([...xs.slice(0, i), ...xs.slice(i + 1)]).map((r) => [x, ...r]));
}

/**
 * A ordem de visita de menor tempo: a primeira parada fica onde está (é de onde
 * se sai); com `fixarFim`, a última também (é aonde se quer chegar). As do meio
 * são permutadas — com no máximo 4 paradas, são no máximo 6 ordens.
 */
export function melhorOrdem(c: Cidade, paradas: readonly number[], fixarFim = false): { ordem: number[]; tempo: number; tempos: number[][] } {
  if (paradas.length < 2) throw new RangeError("a route needs at least two stops");
  if (paradas.length > MAIS_PARADAS) throw new RangeError(`at most ${MAIS_PARADAS} stops`);
  const tempos = paradas.map((a) => paradas.map((b) => (a === b ? 0 : buscarNaCidade(c, "dijkstra", a, b).tempo)));
  const idx = paradas.map((_, i) => i);
  const meio = fixarFim ? idx.slice(1, -1) : idx.slice(1);
  let melhor: number[] = idx;
  let menor = Number.POSITIVE_INFINITY;
  for (const p of permutacoes(meio)) {
    const ordem = fixarFim ? [0, ...p, idx.length - 1] : [0, ...p];
    let t = 0;
    for (let k = 1; k < ordem.length; k += 1) t += tempos[ordem[k - 1]!]![ordem[k]!]!;
    if (t < menor) {
      menor = t;
      melhor = ordem;
    }
  }
  return { ordem: melhor.map((i) => paradas[i]!), tempo: menor, tempos };
}

/** Uma busca percorrendo as pernas na ordem dada. */
export function rotaComParadas(c: Cidade, busca: BuscaReal, ordem: readonly number[]): RotaComParadas {
  const pernas: ResultadoReal[] = [];
  for (let k = 1; k < ordem.length; k += 1) pernas.push(buscarNaCidade(c, busca, ordem[k - 1]!, ordem[k]!));
  const passos: PassoComPerna[] = [];
  pernas.forEach((r, perna) => {
    for (const passo of r.passos) passos.push({ passo, perna });
  });
  return {
    busca,
    ordem,
    pernas,
    passos,
    arestas: pernas.flatMap((r) => r.arestas),
    tempo: pernas.reduce((s, r) => s + r.tempo, 0),
    metros: pernas.reduce((s, r) => s + r.metros, 0),
    resolvidos: pernas.reduce((s, r) => s + r.resolvidos, 0),
  };
}

export interface Cenario {
  readonly id: string;
  readonly nome: string;
  readonly pergunta: string;
  /** Ids de pontos de interesse, na ordem em que o leitor os largaria. */
  readonly paradas: readonly string[];
}

/** Casos reais para comparar: cada um puxa a vantagem de uma busca diferente. */
export const CENARIOS: readonly Cenario[] = [
  { id: "short", nome: "A short hop", pergunta: "Copan to Praça da República, a few blocks: does a clever search even matter?", paradas: ["copan", "praca-da-republica"] },
  { id: "across", nome: "Across the centre", pergunta: "MASP to the Mercadão, corner to corner of the map.", paradas: ["masp", "mercadao"] },
  { id: "aimed", nome: "A clear straight line", pergunta: "Sírio-Libanês to Estação da Luz: the straight line points the right way.", paradas: ["hospital-sirio-libanes", "estacao-da-luz"] },
  { id: "maze", nome: "Behind one-way streets", pergunta: "Bixiga to the Mosteiro de São Bento, through the one-way maze of the Centro.", paradas: ["bixiga", "mosteiro-de-sao-bento"] },
  { id: "tour", nome: "A three-stop tour", pergunta: "MASP, Theatro Municipal and Liberdade — in the best order.", paradas: ["masp", "theatro-municipal", "liberdade"] },
  { id: "errands", nome: "Four errands", pergunta: "Sírio-Libanês, Copan, Mercadão and Catedral da Sé — in the best order.", paradas: ["hospital-sirio-libanes", "copan", "mercadao", "catedral-da-se"] },
];

export interface LinhaDoCenario {
  readonly busca: BuscaReal;
  readonly tempo: number;
  readonly resolvidos: number;
  readonly passos: number;
  /** Quanto pior que o menor tempo, em décimos de segundo (0 = ótimo). */
  readonly excesso: number;
}

export interface ResultadoDoCenario {
  readonly cenario: Cenario;
  readonly ordem: readonly number[];
  readonly linhas: readonly LinhaDoCenario[];
  /** A busca exata que menos trabalhou; a que terminou primeiro (qualquer classe). */
  readonly melhorExata: BuscaReal;
  readonly maisRapida: BuscaReal;
}

/** Todas as buscas, num cenário: o placar que responde "quem é melhor aqui?". */
export function rodarCenario(c: Cidade, cenario: Cenario, buscas: readonly BuscaReal[] = BUSCAS_REAIS): ResultadoDoCenario {
  const nos = cenario.paradas.map((id) => {
    const p = c.pois.find((x) => x.id === id);
    if (p === undefined) throw new RangeError(`no point of interest ${id}`);
    return p.no;
  });
  const { ordem } = melhorOrdem(c, nos);
  const rotas = buscas.map((b) => rotaComParadas(c, b, ordem));
  const otimo = Math.min(...rotas.map((r) => r.tempo));
  const linhas = rotas.map((r) => ({ busca: r.busca, tempo: r.tempo, resolvidos: r.resolvidos, passos: r.passos.length, excesso: r.tempo - otimo }));
  const exatas = linhas.filter((l) => l.busca === "dijkstra" || l.busca === "astar" || l.busca === "bidirectional");
  const melhorExata = [...(exatas.length > 0 ? exatas : linhas)].sort((a, b) => a.passos - b.passos)[0]!.busca;
  const maisRapida = [...linhas].sort((a, b) => a.passos - b.passos)[0]!.busca;
  return { cenario, ordem, linhas, melhorExata, maisRapida };
}
