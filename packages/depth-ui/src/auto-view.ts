import { flowChildren, isOpenable, visibleChild } from "@ovh/depth-core";
import type { TreeIndex, Wire } from "@ovh/depth-core";
import type { NodePlacement, View } from "./view.js";

/**
 * Uma view montada sozinha para um foco qualquer.
 *
 * Existe para que **descer seja sempre possível**: uma view desenhada à mão dá
 * o enquadramento bonito dos lugares que importam, e esta cobre todo o resto —
 * sem ela, abrir um objeto que ninguém desenhou não mostraria nada, e a
 * profundidade viraria promessa em vez de caminho.
 *
 * Ela mostra **um nível**. Todo filho que tem interior sai marcado `collapsed`,
 * que é a forma declarada de dizer "há mais aqui dentro" — o mesmo invariante
 * de qualquer view: nem inventa, nem esconde calado.
 */

const LARGURA = 168;
const ALTURA = 66;
const FOLGA_X = 96;
const FOLGA_Y = 34;
const MARGEM = 40;

/** Em que camada cada filho cai: o caminho mais longo até ele, entre irmãos. */
function camadas(
  tree: TreeIndex,
  focus: string,
  filhos: readonly string[],
  wires: readonly Wire[],
): Map<string, number> {
  const doFoco = new Set(filhos);
  /** A qual filho do foco este objeto pertence (ele mesmo, ou um ancestral). */
  const irmao = (id: string): string | undefined => {
    if (doFoco.has(id)) return id;
    const onde = visibleChild(tree, focus, id);
    return onde.at === "child" ? onde.id : undefined;
  };

  const arestas: Array<[string, string]> = [];
  for (const wire of wires) {
    const de = irmao(wire.from);
    const para = typeof wire.to === "string" ? irmao(wire.to) : undefined;
    if (de === undefined || para === undefined || de === para) continue;
    arestas.push([de, para]);
  }

  const nivel = new Map<string, number>(filhos.map((id) => [id, 0]));
  // Relaxa N vezes: sem ciclo isto converge no caminho mais longo, e com ciclo
  // (realimentação, que é legítima) ele para em vez de girar para sempre.
  for (let passada = 0; passada < filhos.length; passada += 1) {
    let mexeu = false;
    for (const [de, para] of arestas) {
      const candidato = (nivel.get(de) ?? 0) + 1;
      if (candidato > (nivel.get(para) ?? 0) && candidato < filhos.length) {
        nivel.set(para, candidato);
        mexeu = true;
      }
    }
    if (!mexeu) break;
  }
  return nivel;
}

export function autoView(tree: TreeIndex, focus: string, wires: readonly Wire[]): View {
  const filhos = flowChildren(tree, focus);
  const nivel = camadas(tree, focus, filhos, wires);

  const porCamada = new Map<number, string[]>();
  for (const id of filhos) {
    const camada = nivel.get(id) ?? 0;
    const lista = porCamada.get(camada) ?? [];
    lista.push(id);
    porCamada.set(camada, lista);
  }

  const places: NodePlacement[] = [];
  let colunas = 0;
  let linhas = 0;
  for (const [camada, ids] of [...porCamada].sort((a, b) => a[0] - b[0])) {
    colunas = Math.max(colunas, camada + 1);
    linhas = Math.max(linhas, ids.length);
    ids.forEach((id, i) => {
      places.push({
        id,
        x: MARGEM + camada * (LARGURA + FOLGA_X),
        y: MARGEM + i * (ALTURA + FOLGA_Y),
        w: LARGURA,
        h: ALTURA,
        // Tem interior: some com ele agora, mas diz que ele existe.
        ...(isOpenable(tree, id) ? { collapsed: true as const } : {}),
      });
    });
  }

  const node = tree.byId.get(focus);
  return {
    id: `auto:${focus}`,
    focus,
    title: node?.label ?? focus,
    width: Math.max(360, MARGEM * 2 + colunas * LARGURA + (colunas - 1) * FOLGA_X),
    height: Math.max(200, MARGEM * 2 + linhas * ALTURA + (linhas - 1) * FOLGA_Y),
    places,
  };
}

/** O caminho da raiz até este objeto — a trilha de migalhas de quem desceu. */
export function pathTo(tree: TreeIndex, id: string): readonly string[] {
  const caminho = [id];
  let cursor = tree.parent.get(id);
  while (cursor !== undefined) {
    caminho.unshift(cursor);
    cursor = tree.parent.get(cursor);
  }
  return caminho;
}
