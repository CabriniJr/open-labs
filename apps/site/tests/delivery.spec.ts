import { expect, test } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { readFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { strFromU8, unzipSync } from "fflate";
import { assembleDelivery, HostTemplateSchema, lerPacote } from "@ovh/handbook-format/contract";
import { STATIC_LABS } from "@ovh/handbook-catalog";

const root = new URL("../../../", import.meta.url);
let processes: ChildProcess[] = [], folders: string[] = [];
test.afterEach(async () => { for (const p of processes) p.kill(); for (const d of folders) rmSync(d, { recursive: true, force: true }); processes = []; folders = []; });
async function start(files: Record<string, Uint8Array>) {
  const dir = mkdtempSync(join(tmpdir(), "openlabs-browser-release-")); folders.push(dir);
  for (const [name, bytes] of Object.entries(files)) { mkdirSync(dirname(join(dir, name)), { recursive: true }); writeFileSync(join(dir, name), bytes); }
  const socket = createServer(); await new Promise<void>((r) => socket.listen(0, "127.0.0.1", r)); const port = (socket.address() as { port: number }).port; await new Promise<void>((r) => socket.close(() => r()));
  const child = spawn(process.execPath, [join(dir, "serve.mjs"), "--port", String(port)], { cwd: dir }); processes.push(child);
  await new Promise<void>((resolve, reject) => { const timer = setTimeout(() => reject(new Error("Runner timeout")), 10000); child.stdout!.once("data", () => { clearTimeout(timer); resolve(); }); child.once("exit", (code) => { clearTimeout(timer); if (code) reject(new Error(`Runner exited ${code}`)); }); });
  return `http://127.0.0.1:${port}`;
}

test("o Studio entrega um ZIP que roda conteúdo e Pod lifecycle fora do repositório", async ({ page, context }) => {
  await page.goto("studio/");
  await expect(page.getByTestId("handbook-studio")).toHaveAttribute("data-hydrated", "true");
  const editor = page.getByRole("textbox", { name: "Edit handbook.yaml", exact: true });
  await editor.fill((await editor.inputValue()).replace("Kubernetes Visual Handbook", "Company Kubernetes"));
  await page.getByRole("button", { name: "Delivery", exact: true }).click();
  const button = page.getByRole("button", { name: "Download runnable release", exact: true }); await expect(button).toBeEnabled();
  const download = page.waitForEvent("download"); await button.click();
  const stream = await (await download).createReadStream(); const chunks: Buffer[] = []; if (!stream) throw new Error("No release download"); for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const files = unzipSync(Buffer.concat(chunks));
  const release = JSON.parse(strFromU8(files["release.json"]!));
  expect(release.version).toBe("0.1.0"); expect(release.labs[0].interaction.kind).toBe("state");
  const origin = await start(files), runner = await context.newPage();
  await runner.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await runner.goto(origin);
  await expect(runner.getByRole("heading", { level: 1 })).toHaveText("Company Kubernetes");
  await runner.getByRole("navigation", { name: "Handbook curriculum" }).getByRole("button", { name: /controller that replaces it/ }).click();
  await expect(runner.getByTestId("ready-count")).toHaveText("2 / 2");
  const yaml = runner.getByLabel("Kubernetes manifest"); await yaml.fill((await yaml.inputValue()).replace("replicas: 2", "replicas: 6"));
  await runner.getByRole("button", { name: "Apply manifest", exact: true }).click();
  for (let i = 0; i < 3; i++) await runner.getByRole("button", { name: "Next step", exact: true }).click();
  await expect(runner.getByTestId("ready-count")).toHaveText("6 / 6");
  expect(await runner.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test("o mesmo host monta fluxo com contrato mmd e manipulação direta sem motor de fluxo", async ({ page }) => {
  const templateDirectory = new URL("apps/site/public/delivery-host/", root);
  const template = HostTemplateSchema.parse(JSON.parse(readFileSync(new URL("host.json", templateDirectory), "utf8")));
  const data = JSON.parse(readFileSync(new URL("packages/handbook-format/src/conformance/bundle-v1.json", root), "utf8"));
  data.handbook.labs = STATIC_LABS.map((l) => ({ id: l.id, title: l.title, href: l.href, status: "available", phase: 1 }));
  const bundle = lerPacote(data); if (!bundle.ok) throw new Error(bundle.errors.join("\n"));
  const result = await assembleDelivery({ bundle: bundle.value, version: "0.2.0", template, load: async (p) => new Uint8Array(readFileSync(new URL(p, templateDirectory))) });
  expect(Buffer.from(result.files["contracts/collector.mmd"]!).equals(readFileSync(new URL("packages/otel-domain/src/collector/collector.mmd", root)))).toBe(true);
  const origin = await start(result.files); await page.goto(origin);
  const nav = page.getByRole("navigation", { name: "Handbook curriculum" });
  await nav.getByRole("button", { name: /The Collector pipeline/ }).click();
  await expect(page.locator(".collector-lab")).toBeVisible();
  await expect(page.getByRole("link", { name: "Canonical Mermaid contract ↓", exact: true })).toHaveAttribute("href", "contracts/collector.mmd");
  await nav.getByRole("button", { name: /Cardinality and the bill/ }).click();
  await expect(page.locator(".cardinalidade__produto")).toBeVisible();
  await expect(page.locator(".dui-stage")).toHaveCount(0);
});
