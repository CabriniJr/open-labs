import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { readDelivery } from "@ovh/handbook-format/contract";

const root = dirname(fileURLToPath(import.meta.url));
const { values } = parseArgs({ options: { port: { type: "string", default: "4173" }, host: { type: "string", default: "127.0.0.1" } } });
const port = Number(values.port);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid port.");
try {
  const release = readDelivery(JSON.parse(readFileSync(resolve(root, "release.json"), "utf8")));
  const files = new Map<string, Buffer>([["release.json", readFileSync(resolve(root, "release.json"))]]);
  for (const item of release.files) {
    const path = realpathSync(resolve(root, item.path));
    if (!path.startsWith(root + sep)) throw new Error(`Asset outside release: ${item.path}`);
    const bytes = readFileSync(path);
    if (createHash("sha256").update(bytes).digest("hex") !== item.sha256) throw new Error(`Integrity mismatch: ${item.path}`);
    files.set(item.path, bytes);
  }
  const mime: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".mmd": "text/plain; charset=utf-8", ".md": "text/plain; charset=utf-8" };
  const server = createServer((req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); res.end(); return; }
    let path: string;
    try { path = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname).slice(1) || "index.html"; }
    catch { res.writeHead(400); res.end(); return; }
    const bytes = files.get(path);
    if (!bytes) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "Content-Type": mime[extname(path)] ?? "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" });
    res.end(req.method === "HEAD" ? undefined : bytes);
  });
  server.listen(port, values.host, () => console.log(`OpenLabs ${release.id}@${release.version}: http://${values.host}:${port}`));
  server.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
} catch (error) { console.error(`Delivery refused: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; }
