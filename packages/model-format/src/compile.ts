import { DROP } from "@ovh/depth-core";
import type { AnyObject, Kind, Wire as WorldWire, WorldSpec } from "@ovh/depth-core";
import { consumo, fonte, retencao } from "./behaviors.js";
import type { Arg } from "./behaviors.js";
import { parseModelet } from "./modelet.js";
import type { Child, Endpoint, Modelet } from "./modelet.js";
import type { Param } from "./schema.js";

/**
 * Os `kind` que o compilador sabe montar hoje, com as portas de cada um e os
 * argumentos que ele de fato implementa.
 *
 * A tabela é a peça central desta camada. Sem ela, `queue.saida` num fio vira
 * uma emissão que o motor não entrega e ninguém acusa; e `on_full: {param: x}`
 * vira um controle que o autor arrasta sem nada acontecer. Os dois são a mesma
 * falha — a que este projeto chama de mentira silenciosa — e a tabela os torna
 * impossíveis em vez de improváveis.
 */
interface Contrato {
  readonly entradas: readonly string[];
  readonly saidas: readonly string[];
  /** Argumentos numéricos aceitos, com o valor usado quando o autor cala. */
  readonly args: Readonly<Record<string, number>>;
}

const CONTRATOS: Readonly<Record<string, Contrato>> = {
  source: { entradas: [], saidas: ["out"], args: { rate: 1 } },
  buffer: { entradas: ["in"], saidas: ["out", "drop"], args: { capacity: 16, drain: 1 } },
  sink: { entradas: ["in"], saidas: [], args: {} },
};

/**
 * `kind` que o motor tem e o compilador ainda recusa, cada um pelo seu motivo.
 * Recusar dizendo por quê é melhor que montar algo que roda de mentira.
 */
const RECUSADOS: Readonly<Record<string, string>> = {
  composite:
    'contêiner não é folha: um filho de modelet precisa agir. Composição se faz com "wires", ou com um modelet aninhado, que ainda não existe',
  pipeline:
    'contêiner não é folha: um filho de modelet precisa agir. Composição se faz com "wires", ou com um modelet aninhado, que ainda não existe',
  channel:
    "canal é aresta, não filho: ele É a linha entre dois objetos. O formato ainda não declara canal em fio",
  router:
    "router escolhe uma porta segundo uma política, e o formato ainda não tem como declarar política de rota — sem ela o compilador teria de inventar uma",
  static:
    "placa é dado anexado, consultado e nunca atravessado: o formato ainda não declara o conteúdo dela",
};

/** Onde cada `kind` do catálogo chega. `docs/kinds.md` §3–5 e §9. */
const ONDAS: Readonly<Record<string, string>> = {
  transform: "onda 1",
  tee: "onda 1",
  merge: "onda 1",
  batch: "onda 1",
  clock: "onda 1",
  arbiter: "onda 1",
  log: "onda 2",
  deliver: "onda 2",
  supervisor: "onda 2",
  store: "onda 3",
  probe: "onda 3",
  fragment: "onda 4",
  reassemble: "onda 4",
  mux: "onda 4",
  demux: "onda 4",
};

/**
 * O que um parâmetro vale para o motor, e o que ele significa para quem lê.
 *
 * `WorldSpec.params` é `Record<string, number>` — só número. Um `enum` não tem
 * número honesto: escolher um índice inventaria uma correspondência que
 * ninguém declarou. Então enum **não** entra em `params`; fica aqui, com os
 * valores, e nenhum `kind` de hoje aceita argumento enum, o que fecha o buraco
 * em vez de tapá-lo.
 */
export interface ParamInfo {
  readonly name: string;
  readonly type: Param["type"];
  /** Unidade do número em `WorldSpec.params`. Duração vira milissegundos. */
  readonly unit?: string;
  readonly values?: readonly string[];
  /** Ausente quando o parâmetro não tem número honesto (enum). */
  readonly value?: number;
}

export interface CompileOptions {
  readonly seed?: number;
  readonly edgeTicks?: number;
}

export type CompileResult =
  | { readonly ok: true; readonly world: WorldSpec; readonly params: readonly ParamInfo[] }
  | { readonly ok: false; readonly errors: readonly string[] };

const MS: Readonly<Record<string, number>> = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000 };

function emMilissegundos(texto: string): number {
  const m = /^(\d+)(ms|s|m|h)$/.exec(texto);
  // `DuracaoSchema` já garantiu o formato; o ramo existe porque o tipo não prova
  if (m === null) return 0;
  return Number(m[1]) * (MS[m[2] ?? "ms"] ?? 1);
}

function paramInfo(name: string, p: Param): ParamInfo {
  if (p.type === "enum") return { name, type: "enum", values: p.values };
  if (p.type === "duration") {
    return { name, type: "duration", unit: "ms", value: emMilissegundos(p.default) };
  }
  return { name, type: p.type, unit: p.unit, value: p.default };
}

/** Prefixo dos nós de contorno. `@` é impossível num nome do formato. */
const ENTRADA = (porta: string): string => `@in-${porta}`;
const SAIDA = (porta: string): string => `@out-${porta}`;

/**
 * Compila um `modelet` para um mundo que o motor roda.
 *
 * A fronteira é alimentada por contorno (`docs/model-format.md` §1.2): cada
 * porta de entrada ganha uma fonte sintética e cada porta de saída um consumo
 * sintético. É aproximação declarada, não escondida — os nós de contorno têm
 * prefixo `@`, que nenhum nome do formato pode ter.
 */
export function compileModelet(m: Modelet, opts: CompileOptions = {}): CompileResult {
  const erros: string[] = [];

  // --- parâmetros
  const params: Record<string, number> = {};
  const infos: ParamInfo[] = [];
  for (const [nome, p] of Object.entries(m.params)) {
    const info = paramInfo(nome, p);
    infos.push(info);
    if (info.value !== undefined) params[nome] = info.value;
  }

  // --- filhos
  const nos: AnyObject[] = [];
  const contratoDe = new Map<string, Contrato>();

  const arg = (filho: Child, nome: string, kind: string, padrao: number): Arg => {
    const cru = (filho as Record<string, unknown>)[nome];
    if (cru === undefined) return { at: "const", value: padrao };
    if (typeof cru === "number") return { at: "const", value: cru };
    if (typeof cru === "object" && cru !== null) {
      const ref = (cru as Record<string, unknown>)["param"];
      if (typeof ref === "string") {
        const p = m.params[ref];
        if (p === undefined) return { at: "const", value: padrao };
        if (p.type === "enum" || p.type === "duration") {
          erros.push(
            `"${kind}" recebe "${nome}" como número, e { param: ${ref} } é do tipo ` +
              `"${p.type}" — o compilador teria de inventar a correspondência`,
          );
          return { at: "const", value: padrao };
        }
        return { at: "param", name: ref };
      }
    }
    erros.push(`o argumento "${nome}" de "${kind}" precisa ser um número ou { param: nome }`);
    return { at: "const", value: padrao };
  };

  for (const [nome, filho] of Object.entries(m.children)) {
    const kind = filho.kind;
    const contrato = CONTRATOS[kind];
    if (contrato === undefined) {
      const recusa = RECUSADOS[kind];
      const onda = ONDAS[kind];
      if (recusa !== undefined) {
        erros.push(`o filho "${nome}" usa kind "${kind}", que o compilador recusa: ${recusa}`);
      } else if (onda !== undefined) {
        erros.push(
          `o filho "${nome}" usa kind "${kind}", que ainda não existe no motor — ` +
            `chega na ${onda} (docs/kinds.md)`,
        );
      } else {
        erros.push(
          `o filho "${nome}" usa kind "${kind}", que não está no catálogo — ` +
            `provável erro de digitação. Disponíveis hoje: ${Object.keys(CONTRATOS).join(", ")}`,
        );
      }
      continue;
    }
    contratoDe.set(nome, contrato);

    // Argumento que o kind não implementa é pior que argumento inexistente: o
    // autor acha que configurou algo, e nada acontece.
    for (const chave of Object.keys(filho)) {
      if (chave === "kind" || contrato.args[chave] !== undefined) continue;
      erros.push(
        `"${kind}" não implementa o argumento "${chave}" (em "${nome}") — ` +
          `implementados: ${Object.keys(contrato.args).join(", ") || "nenhum"}`,
      );
    }

    if (kind === "source") {
      nos.push(fonte(nome, nome, "item", arg(filho, "rate", kind, 1)));
    } else if (kind === "buffer") {
      nos.push(
        retencao(nome, nome, arg(filho, "capacity", kind, 16), arg(filho, "drain", kind, 1)),
      );
    } else {
      nos.push(consumo(nome, nome));
    }
  }

  // --- contorno da fronteira
  for (const [nome, porta] of Object.entries(m.ports)) {
    if (porta.direction === "in") {
      const carga = porta.role === "control" ? "signal" : (porta.accepts ?? "item");
      nos.push(fonte(ENTRADA(nome), nome, carga, { at: "const", value: 1 }));
    } else if (porta.direction === "out") {
      nos.push(consumo(SAIDA(nome), nome));
    }
    // `drop` não ganha nó: a saída dele é o descarte, que é a ausência de
    // destino dita em voz alta — `DROP` no motor.
  }

  // --- fios
  const fios: WorldWire[] = [];
  const origem = (e: Endpoint): { from: string; port: string } | null => {
    if (e.at === "self") return { from: ENTRADA(e.port), port: "out" };
    const contrato = contratoDe.get(e.child);
    if (contrato === undefined) return null; // kind já recusado acima
    if (!contrato.saidas.includes(e.port)) {
      erros.push(
        `"${e.child}" não emite pela porta "${e.port}": as saídas de ` +
          `"${m.children[e.child]?.kind ?? "?"}" são ${contrato.saidas.join(", ") || "nenhuma"}`,
      );
      return null;
    }
    return { from: e.child, port: e.port };
  };
  const destino = (e: Endpoint): string | null => {
    if (e.at === "self") {
      return m.ports[e.port]?.direction === "drop" ? DROP : SAIDA(e.port);
    }
    const contrato = contratoDe.get(e.child);
    if (contrato === undefined) return null;
    if (!contrato.entradas.includes(e.port)) {
      erros.push(
        `"${e.child}" não recebe pela porta "${e.port}": as entradas de ` +
          `"${m.children[e.child]?.kind ?? "?"}" são ${contrato.entradas.join(", ") || "nenhuma"}`,
      );
      return null;
    }
    return e.child;
  };

  for (const fio of m.wires) {
    // Nenhum kind de hoje tem porta de controle — controlador chega na onda 1.
    // Deixar passar um fio de controle até um filho desenharia um gatilho que
    // não dispara nada.
    if (fio.line === "control" && (fio.from.at === "child" || fio.to.at === "child")) {
      erros.push(
        `fio de controle liga um filho, e nenhum kind de hoje tem porta de controle — ` +
          `clock e arbiter chegam na onda 1 (docs/kinds.md §3)`,
      );
      continue;
    }
    const de = origem(fio.from);
    const para = destino(fio.to);
    if (de === null || para === null) continue;
    // Sinal chega numa entrada nomeada: o nome é o da porta de destino, que é
    // por onde quem recebe reconhece qual sinal é. Carga não leva `toPort` —
    // ela entra no objeto e o motor acha a folha de entrada.
    fios.push(
      fio.line === "control"
        ? { from: de.from, port: de.port, to: para, line: fio.line, toPort: fio.to.port }
        : { from: de.from, port: de.port, to: para, line: fio.line },
    );
  }

  // Duas linhas de dado saindo da mesma porta: `resolveTarget` devolve a
  // primeira que casa, então a segunda seria desenhada e nunca percorrida — o
  // desenho mostraria uma bifurcação que o motor não faz. Replicar é `tee`.
  const jaSai = new Set<string>();
  for (const fio of fios) {
    if (fio.line === "control") continue;
    const chave = `${fio.from}.${fio.port}`;
    if (jaSai.has(chave)) {
      erros.push(
        `mais de um fio de dado sai de "${chave}": o motor segue só o primeiro, ` +
          `e o segundo seria desenho sem percurso. Replicar carga é o kind "tee", ` +
          `que chega na onda 1 (docs/kinds.md §3)`,
      );
      continue;
    }
    jaSai.add(chave);
  }

  if (erros.length > 0) return { ok: false, errors: erros };

  const world: WorldSpec = {
    id: m.modelet,
    seed: opts.seed ?? 1,
    root: {
      id: `${m.modelet}-root`,
      kind: "composite" satisfies Kind,
      label: m.title,
      children: nos,
    },
    wires: fios,
    params,
    ...(opts.edgeTicks === undefined ? {} : { edgeTicks: opts.edgeTicks }),
  };

  return { ok: true, world, params: infos };
}

/** Lê e compila numa passada. Os erros das duas etapas têm a mesma forma. */
export function compileSource(source: string, opts: CompileOptions = {}): CompileResult {
  const lido = parseModelet(source);
  if (!lido.ok) return { ok: false, errors: lido.errors };
  return compileModelet(lido.value, opts);
}
