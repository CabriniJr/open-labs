import { defineConfig, devices } from "@playwright/test";

// O e2e precisa apontar para o mesmo caminho-base do build; se ele cravasse o
// prefixo do Pages, quebraria no destino canônico (Vercel, raiz).
const basePath = process.env.PUBLIC_BASE_PATH ?? "/";
const origin = `http://localhost:4321${basePath}`;

export default defineConfig({
  testDir: "./tests",
  use: { baseURL: origin },
  webServer: {
    command: "pnpm build && pnpm preview --port 4321",
    url: origin,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
