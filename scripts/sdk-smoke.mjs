#!/usr/bin/env node
// Install the actual tarballs in an unrelated project, then author and consume.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { values } = parseArgs({ options: { artifacts: { type: "string", default: "dist/sdk" } } });
const artifacts = resolve(values.artifacts);
const index = JSON.parse(readFileSync(join(artifacts, "artifacts.json"), "utf8"));
assert.equal(index.artifactVersion, "openlabs/sdk-artifacts/v1");
const files = index.packages.map((p) => {
  assert.equal(p.filename, basename(p.filename));
  const file = join(artifacts, p.filename);
  assert.equal(createHash("sha256").update(readFileSync(file)).digest("hex"), p.sha256, `${p.name}: artifact checksum`);
  const entries = execFileSync("tar", ["-tzf", file], { encoding: "utf8" }).split("\n");
  assert(!entries.some((entry) => /(?:\.test\.|\/src\/|\/conformance\/|tsbuildinfo)/u.test(entry)), "tarball contains only production modules");
  return file;
});
const consumer = mkdtempSync(join(tmpdir(), "openlabs-consumer-"));

function cli(args, cwd = consumer, expected = 0) {
  const result = spawnSync(join(consumer, "node_modules", ".bin", "openlabs-handbook"), args, { cwd, encoding: "utf8" });
  assert.equal(result.status, expected, result.stdout + result.stderr);
  return result;
}

try {
  writeFileSync(join(consumer, "package.json"), JSON.stringify({ name: "openlabs-external-consumer", private: true, type: "module" }));
  execFileSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false", ...files], { cwd: consumer, stdio: ["ignore", "pipe", "pipe"] });
  for (const developmentDependency of ["typescript", "vitest", "astro"]) assert(!existsSync(join(consumer, "node_modules", developmentDependency)));
  cli(["new", "networking", "--github", "octocat", "--name", "Training: Team"]);
  const project = join(consumer, "networking");
  assert.equal(JSON.parse(cli(["check", "--json"], project).stdout).ok, true);
  cli(["export", "--out", "empty.json"], project);
  assert.equal(JSON.parse(cli(["inspect", "empty.json", "--json"], project).stdout).articles, 0);
  cli(["new", "../escape", "--github", "octocat", "--name", "Octo Cat"], consumer, 1);
  assert(!existsSync(join(consumer, "escape")));

  // An existing handbook, copied into the external layout, proves authored
  // articles and host lab requirements survive the portable round trip.
  const kube = join(consumer, "training-project");
  mkdirSync(join(kube, "articles"), { recursive: true });
  copyFileSync(join(root, "handbooks", "kubernetes", "handbook.yaml"), join(kube, "handbook.yaml"));
  const article = join(kube, "articles", "a-pod-is-not-its-container.md");
  copyFileSync(join(root, "apps", "site", "src", "content", "articles", "kubernetes", "a-pod-is-not-its-container.md"), article);
  cli(["check", "--dir", kube]);
  cli(["export", "--dir", kube, "--out", join(consumer, "kubernetes.json")]);
  const summary = JSON.parse(cli(["inspect", "kubernetes.json", "--json"]).stdout);
  assert.equal(summary.id, "kubernetes");
  assert.equal(summary.articles, 1);
  assert.deepEqual(summary.requiredLabs, [{ id: "pod-lifecycle", href: "labs/pod-lifecycle" }]);
  execFileSync(process.execPath, ["--input-type=module", "-e", `
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import { lerPacote, labsExigidos, lerManifesto, serializarManifesto } from '@ovh/handbook-format/contract';
    import { InteractiveSession } from '@ovh/interactive-core';
    const result = lerPacote(JSON.parse(readFileSync('kubernetes.json', 'utf8')));
    assert(result.ok);
    assert.equal(result.value.articles[0].id, 'a-pod-is-not-its-container');
    assert.equal(labsExigidos(result.value)[0].href, 'labs/pod-lifecycle');
    assert.deepEqual(lerManifesto(serializarManifesto(result.value.handbook), 'consumer').handbook, result.value.handbook);
    const session = new InteractiveSession({ id: 'counter', initial: () => 0, transition: (s, e) => s + e }, 10);
    session.dispatch(2); session.dispatch(4); session.seek(1); session.dispatch(3);
    assert.equal(session.state, 5); assert.equal(session.length, 2);
  `], { cwd: consumer, stdio: "pipe" });
  const invalid = JSON.parse(readFileSync(join(consumer, "kubernetes.json"), "utf8"));
  invalid.bundleVersion = "openlabs/bundle/v99";
  writeFileSync(join(consumer, "future.json"), JSON.stringify(invalid));
  assert.match(cli(["inspect", "future.json"], consumer, 1).stderr, /bundleVersion/u);

  // The same defect fails the external check and refuses an export artifact.
  writeFileSync(article, readFileSync(article, "utf8").replace("phase: 1", "phase: 2"));
  const invalidReport = JSON.parse(cli(["check", "--dir", kube, "--json"], consumer, 1).stdout);
  assert.equal(invalidReport.ok, false);
  assert.match(invalidReport.problems.join(" "), /fase/u);
  cli(["export", "--dir", kube, "--out", join(consumer, "rejected.json")], consumer, 1);
  assert(!existsSync(join(consumer, "rejected.json")));
  console.log("✓ Tarballs installed outside the repo: scaffold, check, export, consume, runtime replay and invalid-input refusals passed.");
} finally {
  rmSync(consumer, { recursive: true, force: true });
}
