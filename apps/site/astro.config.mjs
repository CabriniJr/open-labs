import react from "@astrojs/react";
import pagefind from "astro-pagefind";
import { defineConfig } from "astro/config";
import { drillDown } from "./src/lib/drill.ts";

// O GitHub Pages serve em /<repo>/; a Vercel serve na raiz. Quem chama o build
// declara onde vai servir, em vez de o código adivinhar.
const base = process.env.PUBLIC_BASE_PATH ?? "/";
/**
 * O endereço público, e ele precisa ser o de verdade.
 *
 * O padrão apontava para um domínio que **não existe** — respondia 404, e era o
 * nome antigo do projeto. Enquanto nada gera URL canônica nem sitemap, um errado
 * não aparece em lugar nenhum; no dia em que gerar, ele publica endereço morto
 * em toda página, e a descoberta vem de fora, tarde.
 *
 * Quem serve em outro lugar declara `PUBLIC_SITE_URL`.
 */
const site = process.env.PUBLIC_SITE_URL ?? "https://openlabs-guaxinims-projects.vercel.app";

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
  server: {
    port: 4321,
    /**
     * E se a porta estiver ocupada, **falhe**.
     *
     * Sem isto o Astro escorrega para a porta seguinte em silêncio — e como o
     * digest de configuração inclui a porta, a subida seguinte nasce com o
     * armazém de conteúdo limpo e todo `/docs/*` em 500. O sintoma aparece
     * longe da causa. Falhar alto é o comportamento certo: o serviço reinicia
     * até a porta liberar, e a mensagem diz o que houve.
     */
    strictPort: true,
  },
  integrations: [react(), pagefind()],
  markdown: { rehypePlugins: [removerTituloDuplicado, drillDown] },
  build: { inlineStylesheets: "auto" },
});
