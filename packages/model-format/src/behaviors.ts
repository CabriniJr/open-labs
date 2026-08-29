import type { AnyObject, Behavior, Message } from "@ovh/depth-core";

/**
 * Um argumento de filho: ou o número está escrito no `modelet`, ou ele vem de
 * um parâmetro. Discriminado porque a diferença importa em tempo de execução —
 * o valor de um parâmetro muda no meio da simulação, o literal não.
 */
export type Arg =
  | { readonly at: "const"; readonly value: number }
  | { readonly at: "param"; readonly name: string };

function valor(arg: Arg, params: Readonly<Record<string, number>>): number {
  if (arg.at === "const") return arg.value;
  // `compile` só produz `at: "param"` para nome que existe em `params`, e
  // `World.paramsAt` sempre parte de `WorldSpec.params` — então o nome está lá.
  return params[arg.name] ?? 0;
}

/**
 * Emite `rate` cargas por tick pela porta `out`.
 *
 * É o comportamento mínimo honesto de uma fonte: ritmo constante, declarado.
 * Regime limitado por backpressure chega quando o `arbiter` chegar.
 */
export function sourceBehavior(kind: string, rate: Arg): Behavior<{ readonly made: number }> {
  return (state, _inbox, ctx) => {
    const quantas = Math.max(0, Math.trunc(valor(rate, ctx.params)));
    const out = Array.from({ length: quantas }, (_, i) => ({
      port: "out",
      message: ctx.emit(kind, 1, { seq: state.made + i }),
    }));
    return { state: { made: state.made + quantas }, out };
  };
}

/**
 * Retém e devolve, com capacidade. O que não cabe sai pela porta `drop` — pela
 * porta, e não em silêncio, porque medidor lê porta e um descarte invisível é
 * a mentira que este projeto mais tenta evitar.
 *
 * Só retenção: agrupar é do `batch`, que chega na onda 1 (`docs/kinds.md` §3).
 */
export function bufferBehavior(
  capacity: Arg,
  drain: Arg,
): Behavior<{ readonly queue: readonly Message[] }> {
  return (state, inbox, ctx) => {
    const cap = Math.max(0, Math.trunc(valor(capacity, ctx.params)));
    const passo = Math.max(0, Math.trunc(valor(drain, ctx.params)));

    let fila = [...state.queue];
    const out: { port: string; message: Message }[] = [];
    for (const m of inbox) {
      if (fila.length < cap) fila.push(m);
      else out.push({ port: "drop", message: m });
    }
    const saindo = fila.slice(0, passo);
    fila = fila.slice(saindo.length);
    for (const m of saindo) out.push({ port: "out", message: m });
    return { state: { queue: fila }, out };
  };
}

/** Consome e conta. Transformar é do `transform`, da onda 1. */
export const sinkBehavior: Behavior<{ readonly got: number; readonly weight: number }> = (
  state,
  inbox,
) => ({
  state: {
    got: state.got + inbox.length,
    weight: state.weight + inbox.reduce((acc, m) => acc + m.weight, 0),
  },
  out: [],
});

export function fonte(id: string, label: string, kind: string, rate: Arg): AnyObject {
  return {
    id,
    kind: "source",
    label,
    leaf: true,
    init: () => ({ made: 0 }),
    behavior: sourceBehavior(kind, rate),
  };
}

export function retencao(id: string, label: string, capacity: Arg, drain: Arg): AnyObject {
  return {
    id,
    kind: "buffer",
    label,
    leaf: true,
    init: () => ({ queue: [] as readonly Message[] }),
    behavior: bufferBehavior(capacity, drain),
  };
}

export function consumo(id: string, label: string): AnyObject {
  return {
    id,
    kind: "sink",
    label,
    leaf: true,
    init: () => ({ got: 0, weight: 0 }),
    behavior: sinkBehavior,
  };
}
