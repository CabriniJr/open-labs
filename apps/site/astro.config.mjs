import react from "@astrojs/react";
import { defineConfig } from "astro/config";

// GitHub Pages serve em /<repo>/ até existir domínio próprio.
export default defineConfig({
  site: "https://cabrinijr.github.io",
  base: "/otel-visual-handbook",
  integrations: [react()],
  build: { inlineStylesheets: "auto" },
});
