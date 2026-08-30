import type { WorldState } from "@ovh/depth-core";
import type { EstadoFita, EstadoPilha, EstadoVisor, Token } from "./rpn.js";

export interface Linha {
  readonly chave: string;
  readonly valor: string;
  readonly ativo?: boolean;
}

/**
 * O que cada caixa guarda agora.
 *
 * A pilha é a peça inteira deste algoritmo: sem ver o que há nela, "notação
 * polonesa reversa" continua sendo uma frase. Ela aparece com o topo em cima,
 * porque é assim que se desenha uma pilha e porque é de cima que se tira.
 */
export function conteudoDaCaixa(
  state: WorldState,
  tokens: readonly Token[],
): (id: string) => readonly Linha[] | undefined {
  return (id) => {
    if (id === "pilha") return daPilha(state);
    if (id === "fita") return daFita(state, tokens);
    if (id === "visor") return doVisor(state);
    return undefined;
  };
}

function daPilha(state: WorldState): readonly Linha[] | undefined {
  const pilha = state.nodes.pilha as EstadoPilha | undefined;
  if (pilha === undefined || pilha.itens.length === 0) return undefined;
  const topo = pilha.itens.length - 1;
  return pilha.itens
    .map((valor, i) => ({
      chave: i === topo ? "top" : String(topo - i),
      valor: String(valor),
      ...(i === topo ? { ativo: true as const } : {}),
    }))
    .reverse();
}

/** A fita mostra a expressão, e o símbolo que já saiu dela fica marcado. */
function daFita(state: WorldState, tokens: readonly Token[]): readonly Linha[] | undefined {
  if (tokens.length === 0) return undefined;
  const fita = state.nodes.fita as EstadoFita | undefined;
  const emVoo = (fita?.pos ?? 0) - 1;
  return tokens.map((token, i) => ({
    chave: String(i + 1),
    valor: token.tipo === "numero" ? String(token.valor) : token.op,
    ...(i === emVoo ? { ativo: true as const } : {}),
  }));
}

function doVisor(state: WorldState): readonly Linha[] | undefined {
  const visor = state.nodes.visor as EstadoVisor | undefined;
  if (visor === undefined) return undefined;
  if (visor.erro !== undefined) return [{ chave: "!", valor: visor.erro, ativo: true }];
  if (visor.resultados.length === 0) return undefined;
  const ultimo = visor.resultados.length - 1;
  return visor.resultados.map((valor, i) => ({
    chave: `#${i + 1}`,
    valor: String(valor),
    ...(i === ultimo ? { ativo: true as const } : {}),
  }));
}
