import { describe, expect, it } from "vitest";
import { HANDBOOKS } from "../data/handbooks.js";
import { cssDoTema, cssDosTemas, TOKENS_PERMITIDOS } from "./tema.js";

/**
 * A identidade de um handbook é declarada, fechada e conferida.
 *
 * Antes ela era um arquivo CSS por domínio, escrito à mão: um handbook podia
 * nascer sem tema — com a cor da casa, parecendo outro handbook — e ninguém
 * descobria até abrir a página. E não havia nada impedindo um tema de pintar o
 * papel, que é o caminho curto para a página virar banner.
 */

const HEX = /^#[0-9a-f]{3,8}$/iu;

describe("todo handbook tem identidade, e ela é cor de verdade", () => {
  it.each(HANDBOOKS.map((h) => [h.id, h] as const))("%s declara o tema inteiro", (_id, handbook) => {
    const claro = handbook.tema.claro;
    const cores = [
      claro.acento,
      claro.fluxo,
      claro.descarte,
      claro.ok,
      claro.mutacao,
      claro.processador,
      claro.conduite,
      ...claro.especies,
    ];
    for (const cor of cores) expect(cor, `${handbook.id}: "${cor}"`).toMatch(HEX);
    expect(claro.especies).toHaveLength(4);
  });

  it("dois handbooks não têm o mesmo acento", () => {
    // O leitor tem de saber em qual handbook está sem ler o cabeçalho — e numa
    // aba só o acento é tudo o que ele vê.
    const acentos = HANDBOOKS.map((h) => h.tema.claro.acento.toLowerCase());
    expect(new Set(acentos).size).toBe(acentos.length);
  });
});

describe("o tema pinta o que pode, e nada além disso", () => {
  it("o CSS gerado só escreve token da lista fechada", () => {
    // É esta a diferença entre "estilizável" e "tema livre". Fundo e tipografia
    // são da casa; a tinta viva e o nível alto são convenção, não identidade.
    const css = cssDosTemas(HANDBOOKS);
    for (const [, token] of css.matchAll(/(--[\w-]+):/gu)) {
      expect(TOKENS_PERMITIDOS, `o tema escreveu ${token}`).toContain(token);
    }
  });

  it("nenhum tema encosta no papel nem na tipografia", () => {
    const css = cssDosTemas(HANDBOOKS);
    for (const proibido of ["--paper", "--ink:", "--font", "--size-step", "--measure"]) {
      expect(css, `um tema pintou ${proibido}`).not.toContain(proibido);
    }
  });

  it("cada handbook é um seletor próprio, e ele não vaza para os outros", () => {
    for (const handbook of HANDBOOKS) {
      const css = cssDoTema(handbook.id, handbook.tema);
      for (const [, seletor] of css.matchAll(/^(:root[^{]*)\{/gmu)) {
        expect(seletor, `${handbook.id}: ${seletor}`).toContain(`[data-domain="${handbook.id}"]`);
      }
    }
  });
});

describe("os três estados do tema escuro", () => {
  it("quem tem escuro declara o do sistema E o escolhido, com a mesma paleta", () => {
    // O padrão do leitor não marca `data-theme`; a escolha explícita marca.
    // Escrever um e esquecer o outro é como o tema escuro fica pela metade — e
    // o defeito só aparece para quem trocou o tema à mão.
    for (const handbook of HANDBOOKS) {
      if (Object.keys(handbook.tema.escuro).length === 0) continue;
      const css = cssDoTema(handbook.id, handbook.tema);
      expect(css).toContain(`:root[data-domain="${handbook.id}"][data-theme="dark"] {`);
      expect(css).toContain("@media (prefers-color-scheme: dark)");

      const blocos = [...css.matchAll(/\{([^}]*)\}/gu)].map(([, corpo]) =>
        [...(corpo ?? "").matchAll(/(--[\w-]+):\s*([^;]+);/gu)]
          .map(([, token, valor]) => `${token}:${valor?.trim()}`)
          .sort()
          .join("|"),
      );
      // O primeiro é o claro; os dois seguintes são os dois jeitos de pedir o
      // escuro, e eles têm de dizer a mesma coisa.
      expect(blocos[1], handbook.id).toBe(blocos[2]);
    }
  });
});
