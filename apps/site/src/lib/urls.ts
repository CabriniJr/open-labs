/**
 * URLs do site, com o caminho-base aplicado.
 *
 * Vive aqui, e não em cada `.astro`, por dois motivos: o base é configurável
 * (a Vercel serve na raiz, o Pages num subdiretório), e o compilador do Astro
 * não aceita literal de expressão regular dentro de uma expressão no template —
 * a barra do regex fecha a tag. Colapsar barras é justamente o que estas
 * funções fazem.
 */
const BASE = import.meta.env.BASE_URL;

function juntar(...partes: readonly string[]): string {
  return `/${partes.join("/")}/`.replace(/\/{2,}/g, "/");
}

/** Uma página do site, a partir da raiz publicada. */
export function url(caminho = ""): string {
  return juntar(BASE, caminho);
}

/** A página de um capítulo da documentação. */
export function docUrl(id: string): string {
  return juntar(BASE, "docs", id);
}

export const docsHome = (): string => juntar(BASE, "docs");
