import { defineConfig, devices } from "@playwright/test";

// O e2e precisa apontar para o mesmo caminho-base do build; se ele cravasse o
// prefixo do Pages, quebraria no destino canônico (Vercel, raiz).
const basePath = process.env.PUBLIC_BASE_PATH ?? "/";
// 127.0.0.1 e não `localhost`, de propósito: `localhost` resolve para IPv6
// primeiro no Chrome, e qualquer processo escutando em [::1]:4321 — um servidor
// de dev esquecido, por exemplo — sequestra a corrida inteira. Os testes então
// reprovam com a tela de outro programa, que é o tipo de falha que faz perder
// meia hora procurando no lugar errado.
// Porta própria, separada da 4321 do servidor de dev. Elas dividiam a porta, e
// aí uma corrida de teste ou pegava o dev (que serve outra coisa) ou não subia
// — e a falha aparecia como asserção estranha, longe da causa.
const origin = `http://127.0.0.1:4399${basePath}`;

export default defineConfig({
  testDir: "./tests",
  use: { baseURL: origin },
  webServer: {
    // `--host 127.0.0.1` casa com a origem acima: sem isso o preview escuta só
    // em IPv6 e a espera do Playwright nunca termina.
    command: "pnpm build && pnpm preview --port 4399 --host 127.0.0.1",
    url: origin,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
