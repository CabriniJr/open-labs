import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createServer } from "node:net";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildDeliveryHost, templateDir } from "./build-delivery-host.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const template = await buildDeliveryHost();
const sdk = await import(pathToFileURL(join(root, "packages/handbook-format/dist/contract.js")));
const bundle = sdk.lerPacote(JSON.parse(readFileSync(join(root, "packages/handbook-format/src/conformance/bundle-v1.json"), "utf8")));
assert(bundle.ok);
const result = await sdk.assembleDelivery({ bundle: bundle.value, version: "0.1.0", template, load: async (p) => new Uint8Array(readFileSync(join(templateDir, p))) });
const dir = mkdtempSync(join(tmpdir(), "openlabs-runnable-"));
let child;
try {
  for (const [path, bytes] of Object.entries(result.files)) { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), bytes); }
  const socket = createServer(); await new Promise((r) => socket.listen(0, "127.0.0.1", r)); const port = socket.address().port; await new Promise((r) => socket.close(r));
  child = spawn(process.execPath, [join(dir, "serve.mjs"), "--port", String(port)], { cwd: dir, stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((ok, fail) => { const timer = setTimeout(() => fail(new Error("Delivery server did not start")), 10000); child.stdout.once("data", () => { clearTimeout(timer); ok(); }); child.once("exit", (code) => { clearTimeout(timer); if (code) fail(new Error(`Delivery server exited ${code}`)); }); });
  const response = await fetch(`http://127.0.0.1:${port}/handbook.json`);
  assert(response.ok); assert.equal((await response.json()).handbook.id, "kubernetes");
  assert.equal((await fetch(`http://127.0.0.1:${port}/package.json`)).status, 404);
  assert.equal((await fetch(`http://127.0.0.1:${port}/`, { method: "POST" })).status, 405);
  child.kill(); await new Promise((r) => child.once("exit", r)); child = null;
  writeFileSync(join(dir, "handbook.json"), "tampered");
  const rejected = spawnSync(process.execPath, [join(dir, "serve.mjs"), "--port", String(port)], { cwd: dir, encoding: "utf8", timeout: 10000 });
  assert.equal(rejected.status, 1); assert.match(rejected.stderr, /Integrity mismatch: handbook.json/u);
  console.log("✓ Extracted delivery starts outside the repo without node_modules; pinned files served; tampered content refused.");
} finally { if (child) child.kill(); rmSync(dir, { recursive: true, force: true }); }
