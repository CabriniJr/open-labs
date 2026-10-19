import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { zipSync } from "fflate";
import { buildDeliveryHost, templateDir } from "./build-delivery-host.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { values } = parseArgs({ options: { handbook: { type: "string" }, bundle: { type: "string" }, version: { type: "string", default: "0.1.0" }, out: { type: "string", default: "dist/deliveries" } } });
if (values.handbook && values.bundle) throw new Error("Choose --handbook or --bundle.");
const template = await buildDeliveryHost();
const sdk = await import(pathToFileURL(join(root, "packages/handbook-format/dist/contract.js")));
const text = values.bundle ? readFileSync(resolve(values.bundle), "utf8") : execFileSync(process.execPath, [join(root, "scripts/handbook.mjs"), "export", values.handbook ?? "kubernetes"], { encoding: "utf8" });
const read = sdk.lerPacote(JSON.parse(text)); if (!read.ok) throw new Error(read.errors.join("\n"));
const result = await sdk.assembleDelivery({ bundle: read.value, template, version: values.version, load: async (path) => new Uint8Array(readFileSync(join(templateDir, path))) });
const out = resolve(values.out), directory = join(out, `${result.release.id}-${result.release.version}`);
if (existsSync(directory)) throw new Error(`Delivery already exists: ${directory}. Choose another --out or version.`);
mkdirSync(directory, { recursive: true });
for (const [path, bytes] of Object.entries(result.files)) { mkdirSync(dirname(join(directory, path)), { recursive: true }); writeFileSync(join(directory, path), bytes); }
const archive = join(out, `${result.release.id}-${result.release.version}.zip`);
writeFileSync(archive, zipSync(result.files, { level: 6 }));
console.log(`✓ ${archive}\nRun: node ${join(directory, "serve.mjs")} --port 4173`);
