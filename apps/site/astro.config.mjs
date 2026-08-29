import react from "@astrojs/react";
import pagefind from "astro-pagefind";
import { defineConfig } from "astro/config";

// O GitHub Pages serve em /<repo>/; a Vercel serve na raiz. Quem chama o build
// declara onde vai servir, em vez de o código adivinhar.
const base = process.env.PUBLIC_BASE_PATH ?? "/";
const site = process.env.PUBLIC_SITE_URL ?? "https://otel-visual-handbook.vercel.app";

/**
 * Todo documento em `docs/` abre com `# Título`, porque também é lido no
 * repositório. A página de capítulo já imprime o título vindo do manifesto —
 * sem isto a página sai com dois `<h1>`, e leitor de tela passa a ter dois
 * começos de documento. O `#` do arquivo é o que sai, não o do site: o
 * manifesto é a fonte do título na navegação, e os dois têm que combinar.
 */
function removerTituloDuplicado() {
  return (tree) => {
    const i = tree.children.findIndex(
      (node) => node.type === "element" && node.tagName === "h1",
    );
    if (i !== -1) tree.children.splice(i, 1);
  };
}

export default defineConfig({
  site,
  base,
  integrations: [react(), pagefind()],
  markdown: { rehypePlugins: [removerTituloDuplicado] },
  build: { inlineStylesheets: "auto" },
});
