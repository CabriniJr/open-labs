import type { AnyObject, Kind, Wire as WorldWire, WorldSpec } from "@ovh/depth-core";
import { consumo, fonte, retencao } from "@ovh/model-format";
import type { Arg } from "@ovh/model-format";
import type { Skeleton, SkeletonEdge, SkeletonNode, SkeletonSubgraph } from "./types.js";

/**
 * De `Skeleton` (o desenho) para `WorldSpec` (o mundo que o motor roda).
 *
 * A camada de baixo é a mesma do `model-format`: uma tabela `CONTRATOS` que diz
 * quais `kind` o compilador sabe montar e quais portas cada um tem, mais uma
 * tabela `RECUSADOS` que responde por que os outros ainda não passam. Um
 * `.mmd` que só usa `source`/`buffer`/`sink` compila hoje; qualquer outro
 * `kind` é recusado com mensagem, na mesma voz que o `compileModelet` já usa,
 * para que o autor não fique procurando o silêncio de um comportamento que
 * não roda.
 *
 * A diferença estrutural em relação a um `modelet`: um cenário não tem
 * fronteira (`ports` de contorno). O `root` é um `composite` sem porta
 * externa, cujos filhos são os nós de topo do desenho — incluindo subgrafos,
 * que viram `composite` recursivos com seus próprios filhos.
 */

interface Contrato {
  readonly entradas: readonly string[];
  readonly saidas: readonly string[];
}

/**
 * Tabela local, deliberadamente separada da do `model-format`: a lista de
 * `kind` que o motor sabe rodar hoje é a mesma dos dois lados, mas cada
 * compilador conhece a **sua** tabela de argumentos, e um dia ela vai divergir
 * (um `.mmd` não expressa argumentos ainda; um `.modelet.yaml` sim).
 */
const CONTRATOS: Readonly<Record<string, Contrato>> = {
  source: { entradas: [], saidas: ["out"] },
  buffer: { entradas: ["in"], saidas: ["out", "drop"] },
  sink: { entradas: ["in"], saidas: [] },
};

/** Mesmo texto do `model-format` — `docs/kinds.md` §3–5 e §9. */
const RECUSADOS: Readonly<Record<string, string>> = {
  channel: "canal é aresta, não filho: ele É a linha entre dois objetos",
  router:
    "router escolhe uma porta segundo uma política, e o formato ainda não tem como declarar política de rota",
  static: "placa é dado anexado, consultado e nunca atravessado: o formato ainda não declara o conteúdo dela",
  switch: "switch chega quando router chegar; mesma questão de política",
  sequencer: "sequencer é controlador; nenhum kind de hoje tem porta de controle",
  store: "store guarda carga e o formato ainda não declara política de retenção",
};

const ONDAS: Readonly<Record<string, string>> = {
  transform: "onda 1",
  merge: "onda 1",
  batch: "onda 1",
  clock: "onda 1",
  arbiter: "onda 1",
};

export interface CompileOptions {
  readonly seed?: number;
  readonly edgeTicks?: number;
  /**
   * Argumentos por nó, indexados pelo `id`. `source.rate`, `buffer.capacity` e
   * `buffer.drain` são os únicos lidos hoje. `.mmd` não expressa argumentos, e
   * a saída disso é passar por fora até a §embarcar-no-mermaid da spec fechar.
   */
  readonly args?: Readonly<Record<string, Readonly<Record<string, number | { readonly param: string }>>>>;
}

export type CompileResult =
  | { readonly ok: true; readonly world: WorldSpec }
  | { readonly ok: false; readonly errors: readonly string[] };

export function compileSkeleton(sk: Skeleton, opts: CompileOptions = {}): CompileResult {
  const erros: string[] = [];

  const params = extractParams(sk.frontMatter, erros);
  const nodesById = new Map<string, SkeletonNode>();
  for (const n of sk.nodes) nodesById.set(n.id, n);
  const subgraphsById = new Map<string, SkeletonSubgraph>();
  for (const g of sk.subgraphs) subgraphsById.set(g.id, g);

  const argsByNode = opts.args ?? {};
  const argOf = (nodeId: string, name: string, padrao: number): Arg => {
    const bag = argsByNode[nodeId];
    if (bag === undefined) return { at: "const", value: padrao };
    const cru = bag[name];
    if (cru === undefined) return { at: "const", value: padrao };
    if (typeof cru === "number") return { at: "const", value: cru };
    const ref = cru.param;
    if (params[ref] === undefined) {
      erros.push(`o nó "${nodeId}" referencia o parâmetro "${ref}" que não está no front-matter`);
      return { at: "const", value: padrao };
    }
    return { at: "param", name: ref };
  };

  const contratoDe = new Map<string, Contrato>();
  const buildLeaf = (n: SkeletonNode): AnyObject | null => {
    if (n.kind === null) {
      erros.push(
        `o nó "${n.id}" não tem kind — declare com \`classDef X kind:...\` ` +
          `e aplique com \`${n.id}[...]:::X\``,
      );
      return null;
    }
    const contrato = CONTRATOS[n.kind];
    if (contrato === undefined) {
      const recusa = RECUSADOS[n.kind];
      const onda = ONDAS[n.kind];
      if (recusa !== undefined) erros.push(`o nó "${n.id}" usa kind "${n.kind}", que o compilador recusa: ${recusa}`);
      else if (onda !== undefined) {
        erros.push(
          `o nó "${n.id}" usa kind "${n.kind}", que ainda não existe no motor — chega na ${onda} (docs/kinds.md)`,
        );
      } else {
        erros.push(
          `o nó "${n.id}" usa kind "${n.kind}", que não está no catálogo — disponíveis hoje: ${Object.keys(CONTRATOS).join(", ")}`,
        );
      }
      return null;
    }
    contratoDe.set(n.id, contrato);
    if (n.kind === "source") return fonte(n.id, n.label, "item", argOf(n.id, "rate", 1));
    if (n.kind === "buffer") return retencao(n.id, n.label, argOf(n.id, "capacity", 16), argOf(n.id, "drain", 1));
    if (n.kind === "sink") return consumo(n.id, n.label);
    erros.push(`kind "${n.kind}" tem contrato mas não tem builder — bug do compilador`);
    return null;
  };

  const buildSubgraph = (g: SkeletonSubgraph): AnyObject => {
    const filhos: AnyObject[] = [];
    for (const childId of g.children) {
      const asNode = nodesById.get(childId);
      if (asNode !== undefined) {
        const leaf = buildLeaf(asNode);
        if (leaf !== null) filhos.push(leaf);
        continue;
      }
      const asSub = subgraphsById.get(childId);
      if (asSub !== undefined) {
        filhos.push(buildSubgraph(asSub));
        continue;
      }
      erros.push(`subgraph "${g.id}" lista filho "${childId}" que não existe`);
    }
    return {
      id: g.id,
      kind: "composite" satisfies Kind,
      label: g.label,
      children: filhos,
    };
  };

  const topLevel: AnyObject[] = [];
  for (const id of sk.topLevel) {
    const node = nodesById.get(id);
    if (node !== undefined) {
      const leaf = buildLeaf(node);
      if (leaf !== null) topLevel.push(leaf);
      continue;
    }
    const sub = subgraphsById.get(id);
    if (sub !== undefined) topLevel.push(buildSubgraph(sub));
  }

  const fios: WorldWire[] = [];
  for (const e of sk.edges) {
    const wire = compileEdge(e, nodesById, subgraphsById, contratoDe, erros);
    if (wire !== null) fios.push(wire);
  }

  if (erros.length > 0) return { ok: false, errors: erros };

  const world: WorldSpec = {
    id: sk.id,
    seed: opts.seed ?? readSeed(sk.frontMatter) ?? 1,
    root: {
      id: `${sk.id}-root`,
      kind: "composite" satisfies Kind,
      label: sk.title,
      children: topLevel,
    },
    wires: fios,
    params,
    ...(opts.edgeTicks === undefined ? {} : { edgeTicks: opts.edgeTicks }),
  };
  return { ok: true, world };
}

function extractParams(front: Readonly<Record<string, unknown>>, erros: string[]): Record<string, number> {
  const raw = front["params"];
  if (raw === undefined) return {};
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    erros.push("front-matter.params precisa ser um mapa");
    return {};
  }
  const params: Record<string, number> = {};
  for (const [nome, valor] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof valor === "number" && Number.isFinite(valor)) params[nome] = valor;
    else erros.push(`front-matter.params.${nome} precisa ser número — MVP não interpreta unidade`);
  }
  return params;
}

function readSeed(front: Readonly<Record<string, unknown>>): number | null {
  const s = front["seed"];
  return typeof s === "number" && Number.isFinite(s) ? s : null;
}

function compileEdge(
  e: SkeletonEdge,
  nodesById: Map<string, SkeletonNode>,
  subgraphsById: Map<string, SkeletonSubgraph>,
  contratoDe: Map<string, Contrato>,
  erros: string[],
): WorldWire | null {
  const fromNode = nodesById.get(e.from);
  const toNode = nodesById.get(e.to);
  const fromSub = subgraphsById.get(e.from);
  const toSub = subgraphsById.get(e.to);

  if (fromNode === undefined && fromSub === undefined) {
    erros.push(`aresta parte de "${e.from}" que não existe`);
    return null;
  }
  if (toNode === undefined && toSub === undefined) {
    erros.push(`aresta chega em "${e.to}" que não existe`);
    return null;
  }

  // Para um subgraph, o motor sabe entrar/sair pela composição — não checamos
  // porta. Para folha, exigimos que a porta exista no contrato do kind.
  let port: string;
  if (fromNode !== undefined) {
    const contrato = contratoDe.get(fromNode.id);
    if (contrato === undefined) return null; // kind já foi recusado
    const escolhida = e.fromPort ?? (contrato.saidas[0] ?? null);
    if (escolhida === null) {
      erros.push(`"${fromNode.id}" (kind "${fromNode.kind}") não emite por nenhuma porta`);
      return null;
    }
    if (!contrato.saidas.includes(escolhida)) {
      erros.push(
        `"${fromNode.id}" não emite pela porta "${escolhida}": ` +
          `as saídas de "${fromNode.kind}" são ${contrato.saidas.join(", ") || "nenhuma"}`,
      );
      return null;
    }
    port = escolhida;
  } else {
    // Subgraph como origem: o motor resolve pela árvore. Usamos "out" como
    // placeholder de porta, que o `validateWorld` cruza com `outlets` do composite.
    port = e.fromPort ?? "out";
  }

  if (toNode !== undefined) {
    const contrato = contratoDe.get(toNode.id);
    if (contrato === undefined) return null;
    if (e.line === "control") {
      // Nenhum kind de hoje tem porta de controle — mesma recusa do `model-format`.
      erros.push(
        `fio de controle chega em "${toNode.id}", e nenhum kind de hoje tem porta de controle ` +
          `(clock e arbiter chegam na onda 1, docs/kinds.md §3)`,
      );
      return null;
    }
    if (contrato.entradas.length === 0) {
      erros.push(`"${toNode.id}" (kind "${toNode.kind}") não recebe por nenhuma porta`);
      return null;
    }
    // Carga entra pela primeira porta de entrada; o motor acha a folha.
  }

  const wire: WorldWire = e.line === "control"
    ? { from: e.from, port, to: e.to, line: "control", toPort: e.toPort ?? "in" }
    : { from: e.from, port, to: e.to };
  return wire;
}
