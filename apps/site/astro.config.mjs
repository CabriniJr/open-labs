import react from "@astrojs/react";
import { defineConfig } from "astro/config";

// O GitHub Pages serve em /<repo>/; a Vercel serve na raiz. Quem chama o build
// declara onde vai servir, em vez de o código adivinhar.
const base = process.env.PUBLIC_BASE_PATH ?? "/";
const site = process.env.PUBLIC_SITE_URL ?? "https://otel-visual-handbook.vercel.app";

export default defineConfig({
  site,
  base,
  integrations: [react()],
  build: { inlineStylesheets: "auto" },
});
