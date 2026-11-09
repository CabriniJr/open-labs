import dados from "./sao-paulo.json" with { type: "json" };
import { cidadeDe, type Cidade, type DadosDaCidade } from "./cidade.js";

/**
 * São Paulo, Centro e Paulista. Separado de `cidade.ts` para o site poder
 * carregar os 260 KB do mapa só quando o lab abre (`import()` dinâmico).
 */
let cache: Cidade | undefined;
export function saoPaulo(): Cidade {
  cache ??= cidadeDe(dados as DadosDaCidade);
  return cache;
}
