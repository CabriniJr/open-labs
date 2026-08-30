import type { AnyObject, Message, ObjectSpec, WorldSpec } from "@ovh/depth-core";
import { ROTULOS } from "./labels.js";

/**
 * A calculadora polonesa reversa, como composição.
 *
 * Ela existe para provar uma coisa sobre este motor: um algoritmo é um sistema
 * distribuído pequeno. Há uma fita de entrada, uma esteira que leva o próximo
 * símbolo, um despachante que decide o que ele é, uma pilha que guarda, um
 * operador que transforma e uma fita de saída. Nenhuma dessas peças é metáfora
 * — todas rodam, e o resultado sai do que elas fizeram.
 *
 * O compasso não é um número escolhido: **a pilha pede o próximo símbolo
 * quando termina de aplicar o anterior**. É por isso que dois operadores
 * seguidos não se atropelam, e é por isso que a máquina fica mais lenta quando
 * o trabalho é maior — que é o que compasso quer dizer num sistema de verdade.
 */

export type Sinal = "+" | "-" | "*" | "/";

export type Token =
  | { readonly tipo: "numero"; readonly valor: number }
  | { readonly tipo: "operador"; readonly op: Sinal };

export interface ErroDeExpressao {
  /** Qual símbolo, contando de 1. Zero quando o erro é da expressão inteira. */
  readonly posicao: number;
  readonly message: string;
}

export type LeituraDaExpressao =
  | { readonly ok: true; readonly tokens: readonly Token[] }
  | { readonly ok: false; readonly errors: readonly ErroDeExpressao[] };

const OPERADORES: ReadonlySet<string> = new Set(["+", "-", "*", "/"]);

/**
 * Lê a expressão e **recusa a que não fecha**.
 *
 * A aridade é conferida aqui, e não no operador, de propósito: um operador que
 * encontrasse a pilha curta emitiria nada, a máquina travaria em silêncio, e um
 * travamento silencioso é a pior coisa que este projeto pode produzir. Validado
 * aqui, o travamento deixa de ser possível — a máquina só roda expressão que
 * fecha.
 */
export function lerExpressao(fonte: string): LeituraDaExpressao {
  const pedacos = fonte.trim().split(/\s+/u).filter((p) => p.length > 0);
  const errors: ErroDeExpressao[] = [];
  const tokens: Token[] = [];
  let altura = 0;

  pedacos.forEach((pedaco, i) => {
    const posicao = i + 1;
    if (OPERADORES.has(pedaco)) {
      if (altura < 2) {
        errors.push({
          posicao,
          message: `"${pedaco}" needs two values on the stack, and there ${
            altura === 1 ? "is one" : "are none"
          }`,
        });
      }
      altura = Math.max(0, altura - 1);
      tokens.push({ tipo: "operador", op: pedaco as Sinal });
      return;
    }
    if (!/^-?\d+$/u.test(pedaco)) {
      errors.push({ posicao, message: `"${pedaco}" is neither a whole number nor + - * /` });
      return;
    }
    altura += 1;
    tokens.push({ tipo: "numero", valor: Number(pedaco) });
  });

  if (errors.length === 0 && tokens.length === 0) {
    errors.push({ posicao: 0, message: "the expression is empty" });
  }
  if (errors.length === 0 && altura !== 1) {
    errors.push({
      posicao: 0,
      message: `the expression leaves ${altura} values on the stack, and an expression leaves one`,
    });
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, tokens };
}

/** O que a máquina calcularia, escrito de um jeito só. É a referência. */
export function avaliar(tokens: readonly Token[]): number | undefined {
  const pilha: number[] = [];
  for (const token of tokens) {
    if (token.tipo === "numero") {
      pilha.push(token.valor);
      continue;
    }
    const b = pilha.pop();
    const a = pilha.pop();
    if (a === undefined || b === undefined) return undefined;
    const r = aplicar(token.op, a, b);
    if (r === undefined) return undefined;
    pilha.push(r);
  }
  return pilha.length === 1 ? pilha[0] : undefined;
}

/** Divisão inteira que trunca na direção do zero, como a de uma máquina. */
export function aplicar(op: Sinal, a: number, b: number): number | undefined {
  if (op === "+") return (a + b) | 0;
  if (op === "-") return (a - b) | 0;
  if (op === "*") return Math.trunc(a * b) | 0;
  return b === 0 ? undefined : Math.trunc(a / b) | 0;
}

export interface EstadoFita {
  /** Quantos símbolos já saíram. O símbolo em voo é `pos - 1`. */
  readonly pos: number;
}
export interface EstadoPilha {
  readonly itens: readonly number[];
}
export interface EstadoVisor {
  /** Cada resultado produzido, na ordem. O último é a resposta. */
  readonly resultados: readonly number[];
  readonly erro?: string;
}

const achar = (inbox: readonly Message[], kind: string): Message | undefined =>
  inbox.find((m) => m.kind === kind);

/**
 * A fita de entrada. Ela não anda sozinha: anda quando pedem.
 *
 * O primeiro símbolo é a exceção, e precisa ser: sem alguém para começar, uma
 * máquina puxada por pedido nunca sai do lugar.
 */
function fita(tokens: readonly Token[]): ObjectSpec<EstadoFita> {
  return {
    id: "fita",
    kind: "store",
    label: ROTULOS.fita,
    leaf: true,
    init: (): EstadoFita => ({ pos: 0 }),
    behavior: (state, _inbox, ctx) => {
      if (ctx.phase !== "commit") return { state, out: [] };
      const pedido = ctx.signals["avanca"]?.length ?? 0;
      if (state.pos > 0 && pedido === 0) return { state, out: [] };
      const token = tokens[state.pos];
      if (token === undefined) return { state, out: [] };
      const message =
        token.tipo === "numero"
          ? ctx.emit("numero", 1, { valor: token.valor, indice: state.pos })
          : ctx.emit("operador", 1, { op: token.op, indice: state.pos });
      return { state: { pos: state.pos + 1 }, out: [{ port: "out", message }] };
    },
  };
}

/**
 * A esteira. Transporta e não altera — que é a definição da família dela, e a
 * razão de o símbolo levar um tick para chegar: transporte custa tempo.
 */
const esteira: ObjectSpec<Record<string, never>> = {
  id: "esteira",
  kind: "channel",
  label: ROTULOS.esteira,
  leaf: true,
  behavior: (state, inbox, ctx) =>
    ctx.phase !== "commit" || inbox.length === 0
      ? { state, out: [] }
      : { state, out: inbox.map((m) => ({ port: "out", message: m })) },
};

/**
 * O despachante: um símbolo entra, e a pergunta "número ou operador?" decide
 * por qual saída ele continua. É o `router` no sentido literal do catálogo.
 */
const despachante: ObjectSpec<Record<string, never>> = {
  id: "despachante",
  kind: "router",
  label: ROTULOS.despachante,
  leaf: true,
  behavior: (state, inbox, ctx) => {
    if (ctx.phase === "settle") {
      const op = achar(inbox, "operador");
      return op === undefined
        ? { state, out: [] }
        : {
            state,
            out: [{ port: "op", message: ctx.emit("operacao", 1, { op: op.data.op }) }],
          };
    }
    const numero = achar(inbox, "numero");
    return numero === undefined
      ? { state, out: [] }
      : {
          state,
          out: [{ port: "valor", message: ctx.emit("empilhar", 1, { valor: numero.data.valor }) }],
        };
  },
};

/**
 * A pilha. Ela anuncia o topo o tempo todo — é isso que `drives` quer dizer — e
 * guarda no confronto, que é onde estado muda.
 *
 * Aplicado o símbolo, ela pede o próximo. O pedido é linha de controle porque é
 * sinal e não carga: nada viaja nele, e por isso ele não aparece na contagem.
 */
const pilha: ObjectSpec<EstadoPilha> = {
  id: "pilha",
  kind: "store",
  label: ROTULOS.pilha,
  leaf: true,
  drives: true,
  init: (): EstadoPilha => ({ itens: [] }),
  behavior: (state, inbox, ctx) => {
    if (ctx.phase === "settle") {
      const n = state.itens.length;
      return {
        state,
        out: [
          {
            port: "topo",
            message: ctx.emit("topo", 1, {
              a: state.itens[n - 2] ?? 0,
              b: state.itens[n - 1] ?? 0,
              altura: n,
            }),
          },
        ],
      };
    }

    const resultado = achar(inbox, "resultado");
    const empilhar = achar(inbox, "empilhar");
    if (resultado === undefined && empilhar === undefined) return { state, out: [] };

    let itens = [...state.itens];
    // Primeiro o que consome, depois o que produz: é a ordem da própria
    // expressão, e trocá-la deixaria o resultado embaixo do próximo número.
    if (resultado !== undefined) {
      itens = itens.slice(0, Math.max(0, itens.length - 2));
      itens.push(resultado.data.valor as number);
    }
    if (empilhar !== undefined) itens.push(empilhar.data.valor as number);

    return {
      state: { itens },
      out: [{ port: "pedir", message: ctx.emit("avanca", 1, { altura: itens.length }) }],
    };
  },
};

/**
 * O operador. Ele lê o topo pela acomodação — ler não consome, e não custa
 * ciclo — e o resultado volta pela borda de relógio, que é o que impede o laço
 * pilha → operador → pilha de ser combinacional.
 *
 * Divisão por zero não vira zero. Vira erro dito em voz alta, e a máquina para
 * onde parou: um resultado inventado seria o modelo mentindo.
 */
const operador: ObjectSpec<Record<string, never>> = {
  id: "operador",
  kind: "router",
  label: ROTULOS.operador,
  leaf: true,
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit") return { state, out: [] };
    const operacao = achar(inbox, "operacao");
    const topo = achar(inbox, "topo");
    if (operacao === undefined || topo === undefined) return { state, out: [] };
    const op = operacao.data.op as Sinal;
    const a = topo.data.a as number;
    const b = topo.data.b as number;
    const valor = aplicar(op, a, b);
    if (valor === undefined) {
      return {
        state,
        out: [
          { port: "erro", message: ctx.emit("erro", 1, { message: `${a} ${op} ${b} does not exist` }) },
        ],
      };
    }
    return { state, out: [{ port: "out", message: ctx.emit("resultado", 1, { valor, op, a, b }) }] };
  },
};

/** A fita de saída: cada resultado produzido, na ordem. O último é a resposta. */
const visor: ObjectSpec<EstadoVisor> = {
  id: "visor",
  kind: "sink",
  label: ROTULOS.visor,
  leaf: true,
  init: (): EstadoVisor => ({ resultados: [] }),
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit" || inbox.length === 0) return { state, out: [] };
    const erro = achar(inbox, "erro");
    if (erro !== undefined) return { state: { ...state, erro: String(erro.data.message) }, out: [] };
    const novos = inbox.filter((m) => m.kind === "resultado").map((m) => m.data.valor as number);
    return novos.length === 0
      ? { state, out: [] }
      : { state: { ...state, resultados: [...state.resultados, ...novos] }, out: [] };
  },
};

export function rpnWorld(tokens: readonly Token[], seed = 1): WorldSpec {
  const root: AnyObject = {
    id: "maquina",
    kind: "composite",
    label: ROTULOS.maquina,
    children: [fita(tokens), esteira, despachante, pilha, operador, visor],
  };

  return {
    id: "rpn",
    seed,
    edgeTicks: 1,
    root,
    params: {},
    wires: [
      // o símbolo sai da fita e atravessa a esteira — transporte custa tick
      { from: "fita", port: "out", to: "esteira", timing: "clocked" },
      { from: "esteira", port: "out", to: "despachante", timing: "clocked" },

      // número vai para a pilha; operador vai para quem opera
      { from: "despachante", port: "valor", to: "pilha", timing: "clocked" },
      { from: "despachante", port: "op", to: "operador", timing: "settle" },

      // ler o topo não consome e não custa ciclo
      { from: "pilha", port: "topo", to: "operador", timing: "settle" },

      // o que volta atravessa a borda de relógio, e por isso não fecha laço
      { from: "operador", port: "out", to: "pilha", timing: "clocked" },
      { from: "operador", port: "out", to: "visor", timing: "clocked" },
      { from: "operador", port: "erro", to: "visor", timing: "clocked" },

      // o compasso: a pilha pede o próximo quando terminou o anterior
      { from: "pilha", port: "pedir", to: "fita", line: "control", toPort: "avanca", timing: "clocked" },
    ],
  };
}
