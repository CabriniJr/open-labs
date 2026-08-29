import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { READING_ORDER, THEMES, neighbours, themeOf } from "./docs-index.js";

// Lê o diretório em vez de `getCollection`: o teste roda sob Vitest, fora do
// ambiente do Astro. O que importa é que um capítulo listado e inexistente
// quebre aqui, e não vire link morto em produção.
const DOCS = fileURLToPath(new URL("../../../../docs", import.meta.url));

function idsExistentes(): Set<string> {
  const out = new Set<string>();
  for (const nome of readdirSync(DOCS)) {
    if (nome.endsWith(".md")) out.add(nome.slice(0, -3));
  }
  for (const sub of ["superpowers/specs", "superpowers/plans"]) {
    for (const nome of readdirSync(`${DOCS}/${sub}`)) {
      if (nome.endsWith(".md")) out.add(`${sub}/${nome.slice(0, -3)}`);
    }
  }
  return out;
}

/** Só a raiz: em `superpowers/` mora processo, e listar tudo lá é ruído. */
function idsDeRaiz(): string[] {
  return readdirSync(DOCS)
    .filter((n) => n.endsWith(".md"))
    .map((n) => n.slice(0, -3));
}

describe("índice da documentação", () => {
  it("todo capítulo do índice existe como documento", () => {
    const existentes = idsExistentes();
    for (const chapter of READING_ORDER) {
      expect(
        existentes.has(chapter.id),
        `capítulo "${chapter.id}" está no índice e não existe em docs/`,
      ).toBe(true);
    }
  });

  // A recíproca, que é a que de fato pega erro: sem ela, um documento novo
  // entra no repositório e some do site em silêncio — que é exatamente o
  // defeito que este projeto persegue em toda parte.
  it("todo documento da raiz de docs/ está em algum tema", () => {
    const indexados = new Set(READING_ORDER.map((c) => c.id));
    for (const id of idsDeRaiz()) {
      expect(indexados.has(id), `"docs/${id}.md" existe e não está em nenhum tema`).toBe(true);
    }
  });

  it("nenhum capítulo aparece em dois temas", () => {
    const ids = READING_ORDER.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("todo tema tem pelo menos um capítulo", () => {
    for (const theme of THEMES) expect(theme.chapters.length).toBeGreaterThan(0);
  });

  it("a ordem de leitura tem pontas: o primeiro não tem anterior, o último não tem próximo", () => {
    const primeiro = READING_ORDER[0];
    const ultimo = READING_ORDER[READING_ORDER.length - 1];
    expect(primeiro).toBeDefined();
    expect(ultimo).toBeDefined();
    expect(neighbours(primeiro!.id).prev).toBeUndefined();
    expect(neighbours(ultimo!.id).next).toBeUndefined();
    expect(neighbours("nao-existe")).toEqual({ prev: undefined, next: undefined });
  });

  it("todo capítulo sabe a que tema pertence", () => {
    for (const chapter of READING_ORDER) {
      expect(themeOf(chapter.id)?.chapters).toContain(chapter);
    }
  });
});
