#!/usr/bin/env node
// Build local, installable prerelease artifacts. No registry or Git mutation.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { values } = parseArgs({ options: { out: { type: "string", default: "dist/sdk" } } });
const out = resolve(values.out);
const staging = mkdtempSync(join(tmpdir(), "openlabs-sdk-"));
const packages = ["handbook-format", "interactive-core"];

try {
  mkdirSync(out, { recursive: true });
  const artifacts = [];
  for (const id of packages) {
    const source = join(root, "packages", id);
    const target = join(staging, id);
    const metadata = JSON.parse(readFileSync(join(source, "package.json"), "utf8"));
    if (!/^\d+\.\d+\.\d+-[a-z]+\.\d+$/u.test(metadata.version)) throw new Error(`${metadata.name}: expected an explicit prerelease version`);
    for (const [name, version] of Object.entries(metadata.dependencies ?? {})) {
      if (/^(workspace:|file:|link:)/u.test(version)) throw new Error(`${metadata.name}: unresolved local dependency ${name}`);
    }
    mkdirSync(target, { recursive: true });
    execFileSync(join(root, "node_modules", ".bin", "tsc"), ["-p", join(source, "tsconfig.release.json"), "--outDir", join(target, "dist")], { stdio: "inherit" });
    const entry = { types: "./dist/index.d.ts", import: "./dist/index.js" };
    const manifest = {
      ...metadata,
      main: "./dist/index.js", types: "./dist/index.d.ts", engines: { node: ">=24" },
      exports: { ".": entry, ...(id === "handbook-format" ? { "./contract": { types: "./dist/contract.d.ts", import: "./dist/contract.js" } } : {}) },
      files: ["dist", "bin", "README.md", "LICENSE"],
      ...(id === "handbook-format" ? { bin: { "openlabs-handbook": "./bin/handbook.mjs" } } : {}),
    };
    delete manifest.scripts;
    delete manifest.devDependencies;
    writeFileSync(join(target, "package.json"), JSON.stringify(manifest, null, 2) + "\n");
    cpSync(join(root, "LICENSE"), join(target, "LICENSE"));
    cpSync(join(source, "README.md"), join(target, "README.md"));
    if (existsSync(join(source, "bin"))) cpSync(join(source, "bin"), join(target, "bin"), { recursive: true });
    const [packed] = JSON.parse(execFileSync("npm", ["pack", "--offline", "--ignore-scripts", "--json", "--pack-destination", out], { cwd: target, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }));
    const bytes = readFileSync(join(out, packed.filename));
    artifacts.push({ name: metadata.name, version: metadata.version, filename: packed.filename, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  // Read the actual supported-contract table with workspace dependency resolution.
  // The tarballs above contain only compiled production modules, not this build.
  execFileSync(join(root, "node_modules", ".bin", "tsc"), ["-b", join(root, "packages", "handbook-format")], { stdio: "inherit" });
  const contracts = await import(pathToFileURL(join(root, "packages", "handbook-format", "dist", "contract.js")));
  writeFileSync(join(out, "artifacts.json"), JSON.stringify({
    artifactVersion: "openlabs/sdk-artifacts/v1", packages: artifacts,
    contracts: { handbook: contracts.VERSOES_EM_ARQUIVO.map((v) => v.apiVersion), bundle: contracts.VERSAO_DO_PACOTE, bundles: contracts.VERSOES_DO_PACOTE, assessments: contracts.ASSESSMENT_API_VERSION, attempt: contracts.ATTEMPT_API_VERSION, lab: contracts.LAB_API_VERSION, hostTemplate: contracts.HOST_TEMPLATE_API_VERSION, delivery: contracts.DELIVERY_API_VERSION },
  }, null, 2) + "\n");
  console.log(`✓ ${out}/artifacts.json`);
} finally {
  rmSync(staging, { recursive: true, force: true });
}
