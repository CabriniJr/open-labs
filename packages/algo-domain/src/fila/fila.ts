import { gerador } from "../semente.js";

/**
 * Uma fila de pedidos na frente de um atendente só, com um número fixo de vagas.
 *
 * As duas estruturas guardam a MESMA fila e atendem na mesma ordem. O que muda
 * é o preço: o anel anda dois números (cabeça e tamanho), e o vetor empurra todo
 * mundo uma casa a cada atendimento. Cada empurrão é um passo gravado e uma
 * operação contada, então o custo sai do modelo, não do texto.
 *
 * E a política só aparece quando a fila enche: recusar o novo ou expulsar o mais
 * antigo. Uma fila absorve uma rajada; ela não absorve uma carga acima do ritmo
 * do atendente — e é aí que a política decide quem se perde.
 */

export type Estrutura = "anel" | "vetor";
export type Politica = "recusar" | "expulsar";
export type Carga = "steady" | "burst" | "overload";

export interface OpcoesDaFila {
  readonly estrutura: Estrutura;
  readonly politica: Politica;
  readonly carga: Carga;
  readonly semente: number;
  /** Quantas vagas a fila tem. */
  readonly vagas?: number;
  /** O atendente leva este número de ticks por pedido. */
  readonly servico?: number;
  /** Por quantos ticks os pedidos chegam (depois, a fila só esvazia). */
  readonly ticks?: number;
  /** Chegadas por tick, explícitas: ganham da carga e da semente. */
  readonly chegadas?: readonly number[];
}

export const VAGAS = 16;
export const SERVICO = 2;
export const TICKS = 64;
export const MAIS_VAGAS = 64;
const VAZIO = -1;

export type TipoDoPasso = "chega" | "recusa" | "expulsa" | "atende" | "move";

export interface PassoDaFila {
  readonly t: TipoDoPasso;
  /** Cada vaga, com o id do pedido ou -1. */
  readonly vagas: readonly number[];
  readonly cabeca: number;
  readonly tamanho: number;
  /** O pedido envolvido. */
  readonly id: number;
  /** Para `move`: a vaga de destino. Para os outros: a vaga tocada (-1 = nenhuma). */
  readonly vaga: number;
  /** A linha do código em execução (`CODIGO`). */
  readonly linha: number;
  readonly ops: number;
  readonly atendidos: number;
  readonly perdidos: number;
  readonly maiorEspera: number;
  readonly tick: number;
}

/** O estado no fim de um tick: o que a simulação mostra ao arrastar o tempo. */
export interface FotoDaFila {
  readonly tick: number;
  readonly vagas: readonly number[];
  readonly cabeca: number;
  readonly tamanho: number;
  readonly ops: number;
  readonly atendidos: number;
  readonly perdidos: number;
  readonly chegaram: number;
}

export interface RodadaDaFila {
  readonly opcoes: OpcoesDaFila;
  readonly vagas: number;
  readonly passos: readonly PassoDaFila[];
  readonly linhaDoTempo: readonly FotoDaFila[];
  readonly chegaram: number;
  readonly atendidos: number;
  readonly perdidos: number;
  readonly ops: number;
  readonly maiorEspera: number;
  /** Ids na ordem em que foram atendidos. */
  readonly ordemAtendida: readonly number[];
  /** Ids na ordem em que se perderam. */
  readonly ordemPerdida: readonly number[];
}

export const ESTRUTURAS: readonly { readonly id: Estrutura; readonly nome: string; readonly custo: string }[] = [
  { id: "anel", nome: "Ring buffer", custo: "O(1) per request" },
  { id: "vetor", nome: "Shifting array", custo: "O(n) per request" },
];

export const CARGAS: readonly { readonly id: Carga; readonly nome: string; readonly nota: string }[] = [
  { id: "burst", nome: "Bursts", nota: "2–3 per tick for 5 ticks, then 11 quiet ticks" },
  { id: "steady", nome: "Steady", nota: "about 0.4 per tick" },
  { id: "overload", nome: "Overload", nota: "about 1.2 per tick, all the time" },
];

export const POLITICAS: readonly { readonly id: Politica; readonly nome: string }[] = [
  { id: "recusar", nome: "Turn away the new" },
  { id: "expulsar", nome: "Drop the oldest" },
];

export const CODIGO: Readonly<Record<Estrutura, readonly string[]>> = {
  anel: [
    "enqueue(x):",
    "  full? apply the policy",
    "  slots[(head + size) % capacity] = x",
    "dequeue():",
    "  x = slots[head]",
    "  head = (head + 1) % capacity",
  ],
  vetor: [
    "enqueue(x):",
    "  full? apply the policy",
    "  slots[size] = x",
    "dequeue():",
    "  x = slots[0]",
    "  for i = 1 to size-1: slots[i-1] = slots[i]",
  ],
};

export class ErroDaFila extends Error {}

/** Quantos pedidos chegam em cada tick, para uma carga e uma semente. */
export function chegadasDe(carga: Carga, semente: number, ticks = TICKS): number[] {
  const r = gerador(semente);
  return Array.from({ length: ticks }, (_, t) => {
    if (carga === "steady") return r() < 0.42 ? 1 : 0;
    if (carga === "overload") return r() < 0.95 ? 1 + (r() < 0.3 ? 1 : 0) : 0;
    return t % 16 < 5 ? 2 + (r() < 0.5 ? 1 : 0) : 0;
  });
}

export function rodarFila(opcoes: OpcoesDaFila): RodadaDaFila {
  const N = opcoes.vagas ?? VAGAS;
  const servico = opcoes.servico ?? SERVICO;
  if (!Number.isInteger(N) || N < 1 || N > MAIS_VAGAS) throw new ErroDaFila(`A queue needs 1 to ${MAIS_VAGAS} slots, not ${N}.`);
  if (!Number.isInteger(servico) || servico < 1) throw new ErroDaFila(`The server needs a whole number of ticks per request, not ${servico}.`);
  const anel = opcoes.estrutura === "anel";
  const fluxo = opcoes.chegadas ?? chegadasDe(opcoes.carga, opcoes.semente, opcoes.ticks ?? TICKS);

  const vagas = new Array<number>(N).fill(VAZIO);
  const entrouEm = new Map<number, number>();
  const passos: PassoDaFila[] = [];
  const linhaDoTempo: FotoDaFila[] = [];
  const ordemAtendida: number[] = [];
  const ordemPerdida: number[] = [];
  let cabeca = 0;
  let tamanho = 0;
  let ops = 0;
  let atendidos = 0;
  let perdidos = 0;
  let maiorEspera = 0;
  let proximo = 0;
  let tick = 0;

  const gravar = (t: TipoDoPasso, id: number, vaga: number, linha: number): void => {
    passos.push({ t, vagas: [...vagas], cabeca, tamanho, id, vaga, linha, ops, atendidos, perdidos, maiorEspera, tick });
  };

  const tirar = (): number => {
    const id = vagas[cabeca]!;
    vagas[cabeca] = VAZIO;
    ops += 1;
    tamanho -= 1;
    if (anel) cabeca = (cabeca + 1) % N;
    return id;
  };

  /** O vetor paga aqui: tirar a cabeça empurra todo o resto uma casa. */
  const empurrar = (): void => {
    if (anel) return;
    for (let i = 1; i <= tamanho; i += 1) {
      vagas[i - 1] = vagas[i]!;
      vagas[i] = VAZIO;
      ops += 1;
      gravar("move", vagas[i - 1]!, i - 1, 5);
    }
  };

  const entrar = (id: number): void => {
    const vaga = anel ? (cabeca + tamanho) % N : tamanho;
    vagas[vaga] = id;
    tamanho += 1;
    ops += 1;
    entrouEm.set(id, tick);
    gravar("chega", id, vaga, 2);
  };

  for (tick = 0; tick < fluxo.length || tamanho > 0; tick += 1) {
    const quantos = fluxo[tick] ?? 0;
    for (let c = 0; c < quantos; c += 1) {
      const id = proximo;
      proximo += 1;
      if (tamanho < N) {
        entrar(id);
      } else if (opcoes.politica === "recusar") {
        perdidos += 1;
        ordemPerdida.push(id);
        gravar("recusa", id, -1, 1);
      } else {
        const vaga = cabeca;
        const velho = tirar();
        perdidos += 1;
        ordemPerdida.push(velho);
        gravar("expulsa", velho, vaga, 1);
        empurrar();
        entrar(id);
      }
    }
    if (tick % servico === servico - 1 && tamanho > 0) {
      const vaga = cabeca;
      const id = tirar();
      atendidos += 1;
      ordemAtendida.push(id);
      maiorEspera = Math.max(maiorEspera, tick - entrouEm.get(id)!);
      gravar("atende", id, vaga, 4);
      empurrar();
    }
    linhaDoTempo.push({ tick, vagas: [...vagas], cabeca, tamanho, ops, atendidos, perdidos, chegaram: proximo });
  }

  return { opcoes, vagas: N, passos, linhaDoTempo, chegaram: proximo, atendidos, perdidos, ops, maiorEspera, ordemAtendida, ordemPerdida };
}

/** A fila em ordem de atendimento (a cabeça primeiro), lida das vagas. */
export function emOrdem(vagas: readonly number[], cabeca: number, tamanho: number): number[] {
  return Array.from({ length: tamanho }, (_, k) => vagas[(cabeca + k) % vagas.length]!);
}
