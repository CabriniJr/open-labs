import { uniformInt } from "pure-rand/distribution/uniformInt";
import { xoroshiro128plus } from "pure-rand/generator/xoroshiro128plus";

const RANGE = 2 ** 30;

/**
 * Mistura os três eixos num inteiro de 32 bits (FNV-1a sobre o sal, temperado
 * com semente e tick). Não precisa ser criptográfico — precisa é espalhar, para
 * que dois objetos vizinhos no mesmo tick não sorteiem valores correlacionados.
 */
function mix(seed: number, tick: number, salt: string): number {
  let h = 0x811c9dc5 ^ (seed >>> 0);
  for (let i = 0; i < salt.length; i += 1) {
    h ^= salt.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= tick + 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  return (h ^ (h >>> 13)) >>> 0;
}

/**
 * Aleatoriedade como **função** de (semente, tick, sal), nunca como fluxo.
 *
 * Um gerador com estado escondido obrigaria a rebobinar do tick 0 para chegar
 * ao tick 40, e faria a ordem das chamadas dentro de um tick virar parte do
 * resultado. Aqui cada sorteio é endereçável: o mesmo endereço devolve sempre o
 * mesmo valor, e é isso que torna o `seek` exato em vez de aproximado.
 *
 * O `salt` é o que separa dois sorteios no mesmo tick — use o id do objeto,
 * ou o id mais o propósito quando ele sortear duas vezes.
 */
export function randomAt(seed: number, tick: number, salt: string): number {
  const gerador = xoroshiro128plus(mix(seed, tick, salt));
  return uniformInt(gerador, 0, RANGE - 1) / RANGE;
}
