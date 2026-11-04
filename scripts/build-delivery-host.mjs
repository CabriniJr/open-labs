import { build } from "vite";
import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const templateDir = join(root, "apps/site/public/delivery-host");

export async function buildDeliveryHost() {
  execFileSync(join(root, "node_modules/.bin/tsc"), ["-b", join(root, "packages/handbook-format")], { stdio: "inherit" });
  const sdk = await import(pathToFileURL(join(root, "packages/handbook-format/dist/contract.js")));
  const raw = JSON.parse(readFileSync(join(root, "packages/handbook-catalog/src/catalog.json"), "utf8"));
  const catalog = { STATIC_HOST: sdk.HostCapabilitiesSchema.parse(raw.host), STATIC_LABS: raw.labs.map((l) => sdk.LabDescriptorSchema.parse(l)) };
  await build({ configFile: false, root: join(root, "apps/runner"), base: "./", plugins: [react()], build: { outDir: templateDir, emptyOutDir: true } });
  await build({ configFile: false, root: join(root, "apps/runner"), ssr: { noExternal: true }, build: { ssr: join(root, "apps/runner/serve.ts"), outDir: templateDir, emptyOutDir: false, rollupOptions: { output: { entryFileNames: "serve.mjs", format: "es" } } } });
  mkdirSync(join(templateDir, "contracts"), { recursive: true });
  cpSync(join(root, "packages/otel-domain/src/collector/collector.mmd"), join(templateDir, "contracts/collector.mmd"));
  for (const license of ["LICENSE", "LICENSE-content"]) cpSync(join(root, license), join(templateDir, license));

  // Preserve the actual bundled dependencies' license notices in the release.
  mkdirSync(join(templateDir, "third-party"), { recursive: true });
  for (const [name, from, entry] of [["react", ""], ["react-dom", ""], ["scheduler", "node_modules/react-dom"], ["marked", "apps/site"], ["dompurify", "apps/site"], ["yaml", "packages/handbook-format"], ["zod", "packages/handbook-format"], ["@noble/hashes", "packages/handbook-format", "@noble/hashes/sha2.js"]]) {
    const require = createRequire(realpathSync(join(root, from, "package.json")));
    let directory = dirname(require.resolve(entry ?? name));
    while (!existsSync(join(directory, "package.json")) || JSON.parse(readFileSync(join(directory, "package.json"), "utf8")).name !== name) {
      const parent = dirname(directory); if (parent === directory) throw new Error(`Cannot find license package: ${name}`); directory = parent;
    }
    const licenses = readdirSync(directory).filter((f) => /^(license|copying|notice)(\.|$)/iu.test(f));
    if (!licenses.length) throw new Error(`No license notice found for ${name}`);
    for (const file of licenses) cpSync(join(directory, file), join(templateDir, "third-party", `${name.replaceAll("/", "-").replaceAll("@", "")}-${file}`));
  }
  writeFileSync(join(templateDir, "README.md"), "# OpenLabs runnable handbook\n\nRequires Node.js 24 or newer. Extract the complete archive and run:\n\n    node serve.mjs --port 4173\n\nOpen http://127.0.0.1:4173. No npm install or repository checkout is needed.\nThe server checks every release asset before listening and serves only pinned files.\nThe complete directory can also be hosted by your existing static server under HTTPS.\nUse your organization's access controls for private hosting.\nContent and reviewed lab implementations are packaged separately inside one release.\nThe content checksum detects changes; it is not a publisher signature.\nSee release.json, LICENSE, LICENSE-content and third-party/ for provenance.\n");
  const paths = readdirSync(templateDir, { recursive: true, withFileTypes: true }).filter((f) => f.isFile()).map((f) => relative(templateDir, join(f.parentPath, f.name)).replaceAll("\\", "/")).sort();
  const files = paths.map((path) => ({ path, sha256: createHash("sha256").update(readFileSync(join(templateDir, path))).digest("hex") }));
  const template = { apiVersion: "openlabs/host-template/v1", host: catalog.STATIC_HOST, labs: catalog.STATIC_LABS, files };
  writeFileSync(join(templateDir, "host.json"), JSON.stringify(template, null, 2) + "\n");
  return template;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildDeliveryHost();
