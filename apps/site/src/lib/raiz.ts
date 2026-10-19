import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * A raiz do repositório, achada subindo até o `pnpm-workspace.yaml`.
 *
 * Contar pastas a partir de `import.meta.url` não serve: no `astro build` os
 * módulos são empacotados em `dist/chunks/`, e a mesma contagem aponta para um
 * caminho que não existe. A âncora tem de ser um arquivo que só existe na raiz,
 * e a busca falha dizendo o que procurava.
 *
 * Estava escrito dentro de `exercicios.ts`, e saiu de lá quando o catálogo
 * passou a ler handbooks submetidos do disco: duas cópias da mesma busca
 * divergem na primeira vez que alguém mexer na estrutura de pastas.
 */
export function raizDoRepo(): string {
  let dir = process.cwd();
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const acima = dirname(dir);
    if (acima === dir) {
      throw new Error(
        `não achei a raiz do repositório (pnpm-workspace.yaml) subindo de ${process.cwd()}`,
      );
    }
    dir = acima;
  }
}

/** A mesma raiz como URL, para quem lê com `new URL(..., raiz)`. */
export function raizDoRepoUrl(): URL {
  return pathToFileURL(`${raizDoRepo()}/`);
}
