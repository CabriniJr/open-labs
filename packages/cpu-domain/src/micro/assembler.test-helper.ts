/**
 * Montar e desembrulhar, para os testes que não estão testando o montador.
 *
 * Existe para que um programa mal escrito num teste de caminho de dados falhe
 * dizendo o que está errado, em vez de silenciosamente montar bytes vazios e
 * fazer o teste falhar num lugar que não tem nada a ver.
 */
import { montarMicro } from "./assembler.js";

export const bytesDe = (fonte: string): Uint8Array => {
  const r = montarMicro(fonte);
  if (!r.ok) throw new Error(r.errors.map((e) => `linha ${e.linha}: ${e.message}`).join(" | "));
  return r.bytes;
};
