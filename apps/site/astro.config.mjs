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
  /**
   * A porta é fixa de propósito, e não é preferência.
   *
   * O digest de configuração do Astro inclui a porta do servidor de dev.
   * Subindo numa porta diferente da anterior, ele conclui "config mudou",
   * **limpa o armazém de conteúdo** — e não o repopula naquela mesma corrida.
   * O efeito é a coleção `docs` vir vazia e toda página `/docs/*` responder 500,
   * com uma mensagem que fala de índice e capítulo e não menciona porta nenhuma.
   * É um dia inteiro procurando no lugar errado.
   *
   * Com a porta fixa o digest não muda entre corridas e o armazém sobrevive. Se
   * você precisar de outra porta, use `--port` sabendo que a **primeira** subida
   * depois da troca vem sem os docs: reinicie uma vez e passa.
   */
  server: { port: 4321 },
  integrations: [react(), pagefind()],
  markdown: { rehypePlugins: [removerTituloDuplicado] },
  build: { inlineStylesheets: "auto" },
});
