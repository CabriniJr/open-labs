import type { AnyObject, Behavior, Kind, PortId, Wire as WorldWire, WorldSpec } from "@ovh/depth-core";
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
  /**
   * Comportamento injetado por nó, indexado pelo `id`.
   *
   * É a promessa da §3 do design tornada mecânica: o `.mmd` descreve o
   * esqueleto — o nó, o `kind` visual, as arestas — e o comportamento vem por
   * cima, no runtime. Quando um id aparece aqui, o compilador **respeita o
   * `kind` declarado no mmd** e não passa o nó pelas tabelas `CONTRATOS`
   * ou `RECUSADOS`. É como um `router` ou um `store` conseguem existir num
   * cenário: o autor toma a responsabilidade das portas e do behavior.
   */
  readonly overrides?: Readonly<Record<string, NodeOverride>>;
  /**
   * O composite raiz aceita `entry` e `exit` — quais filhos recebem carga que
   * vem "de fora" do root e por quais ela sai. Um cenário top-level não tem
   * fora, então isso raramente importa; existe para paridade com o
   * `WorldSpec.root` que a anatomia produzia à mão.
   */
  readonly rootEntry?: string;
  readonly rootExit?: string;
  /** Id do composite raiz. Padrão: `${skeleton.id}-root`. */
  readonly rootId?: string;
  /** Rótulo do composite raiz. Padrão: `skeleton.title`. */
  readonly rootLabel?: string;
}

/**
 * O que o autor pode fornecer por nó, além do que o mmd já disse.
 *
 * `id`, `kind` e `label` **não** entram aqui — eles vêm do desenho. O resto do
 * `ObjectSpec` é livre: `behavior`, `init`, `leaf`, `outlets`, `entry`, `exit`,
 * `drives`, `dynamic`, `replicas`, `shortcut`. Um nó overridden não é validado
 * contra `CONTRATOS`, então o autor é quem sabe quais portas o nó tem.
 */
export interface NodeOverride {
  readonly leaf?: true;
  readonly drives?: true;
  readonly dynamic?: true;
  readonly replicas?: number;
  readonly entry?: string;
  readonly exit?: string;
  readonly outlets?: Readonly<Record<PortId, readonly string[]>>;
  readonly inlets?: Readonly<Record<PortId, readonly string[]>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly init?: () => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly behavior?: Behavior<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly shortcut?: Behavior<any>;
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
  const overriddenIds = new Set<string>(Object.keys(opts.overrides ?? {}));
  const buildLeaf = (n: SkeletonNode): AnyObject | null => {
    if (n.kind === null) {
      erros.push(
        `o nó "${n.id}" não tem kind — declare com \`classDef X kind:...\` ` +
          `e aplique com \`${n.id}[...]:::X\``,
      );
      return null;
    }
    const ov = opts.overrides?.[n.id];
    if (ov !== undefined) {
      // Comportamento injetado: o autor toma a responsabilidade. O compilador
      // respeita o `kind` visual e monta o ObjectSpec sem passar por CONTRATOS.
      // Se as portas declaradas em `outlets`/`inlets` não baterem com as
      // arestas, `validateWorld` cai no `new World(...)` — mesma guarda.
      return { id: n.id, kind: n.kind, label: n.label, ...ov };
    }
    const contrato = CONTRATOS[n.kind];
    if (contrato === undefined) {
      const recusa = RECUSADOS[n.kind];
      const onda = ONDAS[n.kind];
      if (recusa !== undefined) erros.push(`o nó "${n.id}" usa kind "${n.kind}", que o compilador recusa: ${recusa} (ou forneça \`overrides["${n.id}"]\`)`);
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
    const wire = compileEdge(e, nodesById, subgraphsById, contratoDe, overriddenIds, erros);
    if (wire !== null) fios.push(wire);
  }

  if (erros.length > 0) return { ok: false, errors: erros };

  const world: WorldSpec = {
    id: sk.id,
    seed: opts.seed ?? readSeed(sk.frontMatter) ?? 1,
    root: {
      id: opts.rootId ?? `${sk.id}-root`,
      kind: "composite" satisfies Kind,
      label: opts.rootLabel ?? sk.title,
      children: topLevel,
      ...(opts.rootEntry === undefined ? {} : { entry: opts.rootEntry }),
      ...(opts.rootExit === undefined ? {} : { exit: opts.rootExit }),
    },
    wires: fios,
    params,
    ...(() => {
      const et = opts.edgeTicks ?? readNumber(sk.frontMatter, "edgeTicks");
      return et === null ? {} : { edgeTicks: et };
    })(),
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
  return readNumber(front, "seed");
}

function readNumber(front: Readonly<Record<string, unknown>>, key: string): number | null {
  const v = front[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function compileEdge(
  e: SkeletonEdge,
  nodesById: Map<string, SkeletonNode>,
  subgraphsById: Map<string, SkeletonSubgraph>,
  contratoDe: Map<string, Contrato>,
  overriddenIds: ReadonlySet<string>,
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

  // Regra da §3: nó com override é responsabilidade do autor; o compilador
  // aceita a porta que o rótulo diz e deixa `validateWorld` cruzar com
  // `outlets` na hora de instanciar o mundo. Sem override, a porta tem que
  // estar em `CONTRATOS[kind].saidas`.
  let port: string;
  if (fromNode !== undefined) {
    if (overriddenIds.has(fromNode.id)) {
      port = e.fromPort ?? "out";
    } else {
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
    }
  } else {
    // Subgraph como origem: o motor resolve pela árvore.
    port = e.fromPort ?? "out";
  }

  if (toNode !== undefined && !overriddenIds.has(toNode.id)) {
    const contrato = contratoDe.get(toNode.id);
    if (contrato === undefined) return null;
    if (e.line === "control") {
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
  }

  const wire: WorldWire = e.line === "control"
    ? { from: e.from, port, to: e.to, line: "control", toPort: e.toPort ?? "in" }
    : { from: e.from, port, to: e.to };
  return wire;
}
