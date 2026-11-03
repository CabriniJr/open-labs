#!/usr/bin/env node
/**
 * QA duro dos labs publicados.
 *
 * Não é teste de comportamento — isso é a suíte e2e. É a pergunta que a suíte
 * não faz: **o lab aguenta o navegador de quem vai usá-lo?** Para cada lab do
 * build, nos dois enquadramentos (desktop e celular):
 *
 * - erro de página ou de console reprova;
 * - rolagem horizontal da página reprova;
 * - botão sem nome acessível e palco sem rótulo reprovam;
 * - quadro com a CPU a 4×: p95 do intervalo entre quadros e soma de long tasks,
 *   parado e durante zoom (quando há palco de profundidade), contra um
 *   orçamento — acima dele é ALERTA, e com `--strict` reprova;
 * - fotografia de cada capítulo de cada filme, e de cada vista (plana,
 *   topologia, isométrica), para a revisão visual que nenhum número substitui.
 *
 * Uso: `pnpm build && pnpm qa:labs [--strict] [--only=labs/x/] [--fast]`.
 * Saída em `apps/site/qa-report/` (fora do git): `report.md`, `report.json` e
 * as fotografias.
 *
 * O binário do Chromium vem do Playwright do projeto; num contêiner com outro,
 * `PW_CHROMIUM=/caminho/do/chromium`.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "@playwright/test";

const AQUI = dirname(fileURLToPath(import.meta.url));
const SITE = join(AQUI, "..");
const DIST = join(SITE, "dist");
const SAIDA = join(SITE, "qa-report");
const PORTA = 4398;
const BASE = `http://127.0.0.1:${PORTA}/`;

const args = new Set(process.argv.slice(2));
const STRICT = args.has("--strict");
const FAST = args.has("--fast");
const ONLY = [...args].find((a) => a.startsWith("--only="))?.slice(7);

/** Orçamentos com CPU a 4×. Escolhidos para "não trava", não para "voa". */
const ORCAMENTO = {
  paradoP95: 50, // ms entre quadros: abaixo disto o olho lê movimento contínuo
  zoomP95: 120, // ms: o gesto responde, mesmo que não a 60 fps
  longasPorSegundo: 250, // ms de long task por segundo de uso
};

function labsDoBuild() {
  const raiz = join(DIST, "labs");
  if (!existsSync(raiz)) throw new Error("Sem build: rode `pnpm build` antes do QA.");
  return readdirSync(raiz, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(raiz, e.name, "index.html")))
    .map((e) => `labs/${e.name}/`)
    .filter((l) => ONLY === undefined || l === ONLY)
    .sort();
}

async function subirPreview() {
  const proc = spawn("npx", ["astro", "preview", "--port", String(PORTA), "--host", "127.0.0.1"], { cwd: SITE, stdio: "ignore" });
  for (let i = 0; i < 60; i += 1) {
    try {
      const r = await fetch(BASE);
      if (r.ok) return proc;
    } catch {
      // ainda subindo
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  proc.kill();
  throw new Error("O preview não subiu na porta " + PORTA);
}

async function sondar(page) {
  await page.evaluate(() => {
    window.__qa = { f: [], lt: [] };
    let ultimo = performance.now();
    const laco = (t) => {
      window.__qa.f.push(t - ultimo);
      ultimo = t;
      window.__qa.raf = requestAnimationFrame(laco);
    };
    window.__qa.raf = requestAnimationFrame(laco);
    window.__qa.obs = new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__qa.lt.push(e.duration);
    });
    window.__qa.obs.observe({ type: "longtask" });
  });
}

async function colher(page, ms) {
  return page.evaluate((duracao) => {
    cancelAnimationFrame(window.__qa.raf);
    window.__qa.obs.disconnect();
    const f = window.__qa.f.slice(2).sort((a, b) => a - b);
    const q = (p) => (f.length ? f[Math.min(f.length - 1, Math.floor(f.length * p))] : 0);
    const soma = f.reduce((a, b) => a + b, 0);
    const longas = window.__qa.lt.reduce((a, b) => a + b, 0);
    return {
      fps: f.length ? Math.round((10000 * f.length) / soma) / 10 : 0,
      p95: Math.round(q(0.95)),
      max: Math.round(f.at(-1) ?? 0),
      longasPorSegundo: Math.round((longas / duracao) * 1000),
    };
  }, ms);
}

async function zoom(page) {
  const palco = page.locator("svg.dui-stage").first();
  if ((await palco.count()) === 0) return false;
  await palco.scrollIntoViewIfNeeded();
  const b = await palco.boundingBox();
  const v = page.viewportSize();
  if (b === null || v === null) return false;
  const x = (Math.max(0, b.x) + Math.min(v.width, b.x + b.width)) / 2;
  const y = (Math.max(0, b.y) + Math.min(v.height, b.y + b.height)) / 2;
  for (const delta of [-120, 120]) {
    for (let i = 0; i < 12; i += 1) {
      await page.mouse.move(x, y);
      await page.mouse.wheel(0, delta);
      await page.waitForTimeout(40);
    }
    await page.waitForTimeout(400);
  }
  return true;
}

async function acessibilidade(page) {
  return page.evaluate(() => {
    const semNome = [...document.querySelectorAll("main button, main [role=button], main [role=radio]")].filter((el) => {
      const nome = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim() || el.getAttribute("title");
      return !nome;
    }).length;
    const palcos = [...document.querySelectorAll("svg.dui-stage, svg.mo-stage, .iso-stage")];
    const palcosSemRotulo = palcos.filter((p) => !(p.getAttribute("aria-label") ?? "").trim()).length;
    return { semNome, palcos: palcos.length, palcosSemRotulo };
  });
}

/** Fotografa capítulos e vistas de cada player de filme. */
async function fotografarFilmes(page, pasta, prefixo) {
  const fotos = [];
  const players = page.locator(".mo-player");
  const n = await players.count();
  for (let i = 0; i < n; i += 1) {
    const player = players.nth(i);
    // Um modo fechado (showcase escondido atrás da aba) não se fotografa.
    if (!(await player.isVisible())) continue;
    await player.scrollIntoViewIfNeeded();
    const vistas = player.locator(".mo-views__opt");
    const nomes = (await vistas.count()) > 0 ? await vistas.allTextContents() : ["flat"];
    const capitulos = player.locator(".mo-chapter");
    const total = await capitulos.count();
    for (const [vi, vista] of nomes.entries()) {
      if ((await vistas.count()) > 0) {
        await vistas.nth(vi).click();
        if (["iso", "3d"].includes(vista.toLowerCase())) await player.locator('.iso-stage[data-ready="true"]').waitFor({ timeout: 20_000 });
        else await page.waitForTimeout(300);
      }
      const escolhidos = FAST ? [total - 1] : [...Array(total).keys()];
      for (const c of escolhidos) {
        // O fim do capítulo é o quadro com tudo o que ele mostrou.
        const range = player.locator(".mo-scrub__input");
        const fim = await capitulos.nth(c).evaluate((_, idx) => idx, c);
        await capitulos.nth(fim).click();
        await page.keyboard.press("k").catch(() => undefined);
        const max = Number(await range.getAttribute("max"));
        const alvo = await page.evaluate(
          ({ idx }) => {
            const segs = [...document.querySelectorAll(".mo-scrub__seg")];
            const pesos = segs.map((s) => Number(getComputedStyle(s).flexGrow) || 0);
            const tot = pesos.reduce((a, b) => a + b, 0);
            return pesos.slice(0, idx + 1).reduce((a, b) => a + b, 0) / tot;
          },
          { idx: c },
        );
        await range.evaluate((el, v) => {
          const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          set.call(el, String(v));
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }, Math.max(0, Math.round((max * alvo) / 10) * 10 - 20));
        await page.waitForTimeout(250);
        const arquivo = `${prefixo}-player${i}-${vista.toLowerCase()}-cap${String(c + 1).padStart(2, "0")}.png`;
        await player.locator(".mo-player__screen").screenshot({ path: join(pasta, arquivo) });
        fotos.push(arquivo);
      }
      const theme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
      await page.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
      await page.waitForTimeout(250);
      const dark = `${prefixo}-player${i}-${vista.toLowerCase()}-dark.png`;
      await player.locator(".mo-player__screen").screenshot({ path: join(pasta, dark) });
      fotos.push(dark);
      await page.evaluate(previous => { if (previous) document.documentElement.dataset.theme = previous; else document.documentElement.removeAttribute("data-theme"); }, theme);
    }
  }
  return fotos;
}

async function fotografarCluster(page, pasta, prefixo) {
  const views = page.locator(".podlab-vistas [role=radio]");
  const fotos = [];
  for (let i = 0; i < await views.count(); i++) {
    const view = views.nth(i), name = (await view.textContent()).toLowerCase();
    await view.click();
    if (["iso", "3d"].includes(name)) await page.locator('.iso-stage[data-ready="true"]').waitFor({ timeout: 20_000 });
    const theme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    for (const mode of ["light", "dark"]) {
      await page.evaluate(value => { document.documentElement.dataset.theme = value; }, mode);
      await page.waitForTimeout(250);
      const file = `${prefixo}-cluster-${name}-${mode}.png`;
      await page.locator(".podlab-graph-panel").screenshot({ path: join(pasta, file) });
      fotos.push(file);
    }
    await page.evaluate(previous => { if (previous) document.documentElement.dataset.theme = previous; else document.documentElement.removeAttribute("data-theme"); }, theme);
  }
  return fotos;
}

/** Measure the actual GPU views too; a fast flat view says nothing about 3D. */
async function medir3d(page, cdp) {
  const results = [];
  for (const name of ["Iso", "3D"]) {
    const radio = page.getByRole("radio", { name, exact: true });
    if (!await radio.count()) continue;
    await radio.click();
    const stage = page.locator('.iso-stage[data-ready="true"]');
    await stage.waitFor({ timeout: 20_000 });
    await stage.scrollIntoViewIfNeeded();
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await sondar(page); await page.waitForTimeout(3000);
    const perf = await colher(page, 3000);
    // Exercise the real pointer and zoom handlers while the GPU is visible.
    const b = await stage.boundingBox();
    await sondar(page);
    const started = Date.now();
    await page.mouse.move(b.x + b.width * .5, b.y + b.height * .5);
    await page.mouse.down();
    for (let i = 1; i <= 24; i++) {
      await page.mouse.move(b.x + b.width * (.5 + .15 * i / 24), b.y + b.height * (.5 + .05 * i / 24));
      await page.waitForTimeout(24);
    }
    await page.mouse.up();
    await page.getByRole("button", { name: "Zoom in 3D", exact: true }).click();
    await page.getByRole("button", { name: "Zoom out in 3D", exact: true }).click();
    const gesture = await colher(page, Date.now() - started);
    await page.getByRole("button", { name: "Reset camera", exact: true }).click();
    const layout = await acessibilidade(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const backend = await stage.getAttribute("data-backend");
    results.push({ view: name, backend, perf, gesture, a11y: layout, overflow });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  }
  return results;
}

async function auditar(browser, lab, perfil) {
  const ctx = await browser.newContext(perfil.contexto);
  const page = await ctx.newPage();
  const erros = [];
  page.on("pageerror", (e) => erros.push(`pageerror: ${String(e).slice(0, 240)}`));
  page.on("console", (m) => {
    if (m.type() === "error") erros.push(`console: ${m.text().slice(0, 240)}`);
  });
  const cdp = await ctx.newCDPSession(page);
  await page.goto(BASE + lab, { waitUntil: "load" });
  const palco = page.locator("svg.dui-stage, .mo-player, [data-testid]").first();
  await palco.scrollIntoViewIfNeeded().catch(() => undefined);
  await page.waitForTimeout(1200);

  const transbordo = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const a11y = await acessibilidade(page);

  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  // Nome exato: por texto parcial, "Run" casava com a aba "watch it run" do showcase.
  const tocar = page.locator('.mo-player button[aria-label="Play"], button:text-is("Run")').first();
  if ((await tocar.count()) > 0) await tocar.click().catch(() => undefined);
  await sondar(page);
  await page.waitForTimeout(3000);
  const parado = await colher(page, 3000);
  let noZoom = null;
  if (!perfil.toque) {
    await sondar(page);
    const t0 = Date.now();
    if (await zoom(page)) noZoom = await colher(page, Date.now() - t0);
    else await colher(page, 1);
  }
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

  const pasta = join(SAIDA, "shots");
  const prefixo = `${lab.replace(/^labs\//, "").replace(/\/$/, "")}-${perfil.nome}`;
  await page.screenshot({ path: join(pasta, `${prefixo}-pagina.png`), fullPage: false });
  const spatial = await medir3d(page, cdp);
  const fotos = perfil.toque && FAST ? [] : [...await fotografarFilmes(page, pasta, prefixo), ...await fotografarCluster(page, pasta, prefixo)];
  // Lab com dois modos: a vitrine também passa pelo QA — erros, rolagem e fotos.
  const abaShowcase = page.getByRole("tab", { name: /Showcase/ });
  if ((await abaShowcase.count()) > 0) {
    await abaShowcase.first().click();
    await page.waitForTimeout(800);
    const transbordoDaVitrine = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (transbordoDaVitrine > 1) erros.push(`showcase: rolagem horizontal de ${transbordoDaVitrine}px`);
    if (!(perfil.toque && FAST)) fotos.push(...(await fotografarFilmes(page, pasta, `${prefixo}-showcase`)));
  }

  const falhas = [];
  const alertas = [];
  if (erros.length > 0) falhas.push(`${erros.length} erro(s) no console/página`);
  if (transbordo > 1) falhas.push(`rolagem horizontal de ${transbordo}px`);
  if (a11y.semNome > 0) falhas.push(`${a11y.semNome} controle(s) sem nome acessível`);
  if (a11y.palcosSemRotulo > 0) falhas.push(`${a11y.palcosSemRotulo} palco(s) sem rótulo`);
  if (parado.p95 > ORCAMENTO.paradoP95) alertas.push(`parado: p95 ${parado.p95} ms > ${ORCAMENTO.paradoP95}`);
  if (parado.longasPorSegundo > ORCAMENTO.longasPorSegundo) alertas.push(`parado: ${parado.longasPorSegundo} ms/s de long task`);
  if (noZoom !== null && noZoom.p95 > ORCAMENTO.zoomP95) alertas.push(`zoom: p95 ${noZoom.p95} ms > ${ORCAMENTO.zoomP95}`);
  for (const s of spatial) {
    if (!["webgpu", "webgl2"].includes(s.backend)) falhas.push(`${s.view}: GPU backend unavailable (${s.backend})`);
    if (s.perf.p95 > ORCAMENTO.paradoP95) alertas.push(`${s.view}: p95 ${s.perf.p95} ms > ${ORCAMENTO.paradoP95}`);
    if (s.perf.longasPorSegundo > ORCAMENTO.longasPorSegundo) alertas.push(`${s.view}: ${s.perf.longasPorSegundo} ms/s de long task`);
    if (s.gesture.p95 > ORCAMENTO.zoomP95) alertas.push(`${s.view} gesture: p95 ${s.gesture.p95} ms > ${ORCAMENTO.zoomP95}`);
    if (s.gesture.longasPorSegundo > ORCAMENTO.longasPorSegundo) alertas.push(`${s.view} gesture: ${s.gesture.longasPorSegundo} ms/s de long task`);
    if (s.overflow > 1) falhas.push(`${s.view}: rolagem horizontal de ${s.overflow}px`);
    if (s.a11y.semNome || s.a11y.palcosSemRotulo) falhas.push(`${s.view}: controles ou palco sem nome`);
  }
  await ctx.close();
  return { lab, perfil: perfil.nome, transbordo, a11y, parado, zoom: noZoom, spatial, erros, fotos, falhas, alertas };
}

function relatorio(resultados) {
  const linhas = [
    `# QA dos labs — ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
    "",
    `CPU a 4×. Orçamento: parado p95 ≤ ${ORCAMENTO.paradoP95} ms, zoom p95 ≤ ${ORCAMENTO.zoomP95} ms, long tasks ≤ ${ORCAMENTO.longasPorSegundo} ms/s.`,
    "",
    "| lab | perfil | parado fps · p95 | zoom fps · p95 | veredito |",
    "|---|---|---|---|---|",
  ];
  for (const r of resultados) {
    const z = r.zoom === null ? "—" : `${r.zoom.fps} · ${r.zoom.p95} ms`;
    const v = r.falhas.length > 0 ? `❌ ${r.falhas.join("; ")}` : r.alertas.length > 0 ? `⚠️ ${r.alertas.join("; ")}` : "✅";
    linhas.push(`| ${r.lab} | ${r.perfil} | ${r.parado.fps} · ${r.parado.p95} ms | ${z} | ${v} |`);
  }
  const comErro = resultados.filter((r) => r.erros.length > 0);
  linhas.push("", "## Vistas espaciais · CPU a 4×", "", "| lab | perfil | vista · backend | playback fps · p95 | orbit + zoom fps · p95 | long tasks playback / gesture ms/s |", "|---|---|---|---|---|---|");
  for (const r of resultados) for (const s of r.spatial ?? []) linhas.push(`| ${r.lab} | ${r.perfil} | ${s.view} · ${s.backend} | ${s.perf.fps} · ${s.perf.p95} ms | ${s.gesture.fps} · ${s.gesture.p95} ms | ${s.perf.longasPorSegundo} / ${s.gesture.longasPorSegundo} |`);
  if (comErro.length > 0) {
    linhas.push("", "## Erros", "");
    for (const r of comErro) for (const e of r.erros) linhas.push(`- \`${r.lab}\` (${r.perfil}): ${e}`);
  }
  linhas.push("", "## Revisão visual", "", "Fotografias em `qa-report/shots/`: uma por lab e perfil, e uma por capítulo e vista de cada filme. Olhe todas antes de aprovar — número não vê texto sobreposto, corte de câmera nem cor errada.");
  return linhas.join("\n") + "\n";
}

async function main() {
  const labs = labsDoBuild();
  rmSync(SAIDA, { recursive: true, force: true });
  mkdirSync(join(SAIDA, "shots"), { recursive: true });
  const preview = await subirPreview();
  const exe = process.env.PW_CHROMIUM;
  const browser = await chromium.launch(exe === undefined ? {} : { executablePath: exe });
  const perfis = [
    { nome: "desktop", toque: false, contexto: { viewport: { width: 1366, height: 820 } } },
    { nome: "mobile", toque: true, contexto: { ...devices["Pixel 7"] } },
  ];
  const resultados = [];
  try {
    for (const lab of labs) {
      for (const perfil of perfis) {
        const r = await auditar(browser, lab, perfil);
        resultados.push(r);
        const v = r.falhas.length > 0 ? "FALHA" : r.alertas.length > 0 ? "alerta" : "ok";
        console.log(`${v.padEnd(6)} ${lab} ${perfil.nome} parado ${r.parado.fps}fps p95 ${r.parado.p95}ms${r.zoom ? ` · zoom ${r.zoom.fps}fps p95 ${r.zoom.p95}ms` : ""}${r.falhas.length ? ` — ${r.falhas.join("; ")}` : ""}`);
      }
    }
  } finally {
    await browser.close();
    preview.kill();
  }
  writeFileSync(join(SAIDA, "report.json"), JSON.stringify({ orcamento: ORCAMENTO, resultados }, null, 2));
  writeFileSync(join(SAIDA, "report.md"), relatorio(resultados));
  const falhas = resultados.filter((r) => r.falhas.length > 0).length;
  const alertas = resultados.filter((r) => r.alertas.length > 0).length;
  console.log(`\n${resultados.length} auditorias · ${falhas} com falha · ${alertas} com alerta · relatório em apps/site/qa-report/report.md`);
  process.exit(falhas > 0 || (STRICT && alertas > 0) ? 1 : 0);
}

await main();
