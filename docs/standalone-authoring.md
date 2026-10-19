# Independent handbook authoring

The authoring SDK can now be installed outside this repository. The release is
an **alpha artifact**, built locally; there is no npm registry publication in
this workflow. Node.js 24 or newer is required.

## Build the SDK artifacts

From an OpenLabs checkout with dependencies installed:

```sh
pnpm sdk:pack
pnpm sdk:smoke
```

`dist/sdk/artifacts.json` names each package's version, tarball and SHA-256,
and the handbook/bundle contracts the release reads. The tarballs are:

- `@ovh/handbook-format`: schemas, validated bundle reader, filesystem readers
  and the `openlabs-handbook` CLI;
- `@ovh/interactive-core`: the independent event/state runtime.

They contain compiled JavaScript and declarations, license and usage docs.
They do not contain workspace links, test fixtures or an authoring compiler.
`sdk:smoke` installs the actual tarballs in a temporary project outside the
checkout, creates a handbook, checks it, exports and consumes it, exercises the
runtime, and verifies refusal of invalid content. CI runs the same proof.

The compositional flow engine, its UI, Kubernetes domain and lab UI are not
part of these two tarballs. Mermaid remains the structural contract of flow
scenarios; this release does not change or distribute that engine.

## Author in a separate project

```sh
mkdir company-training
cd company-training
npm init -y
npm install /path/to/ovh-handbook-format-0.1.0-alpha.4.tgz
npx --no-install openlabs-handbook new networking --github your-handle --name "Your Name"
cd networking
../node_modules/.bin/openlabs-handbook check
```

The generated project is:

```text
networking/
  handbook.yaml
  articles/
```

The folder may be renamed: the handbook's identity comes from its validated
`id`. This differs from an in-repo submission, where the folder also identifies
the CODEOWNER and must match the id. Edit the manifest as described in the
chapter “Submitting a handbook”; write articles under `articles/<id>.md`.

The CLI shares the manifest scaffold and validation functions with the
repository tool. `check --json` returns `ok`, `id` and `problems`, and exits
nonzero on errors, so an editor or agent can consume diagnostics directly.
The checks cover catalog completeness, frontmatter, title/phase, source
citation references and drill-down structure. They cannot establish scientific
truth or whether a URL's document actually supports a claim.

```sh
../node_modules/.bin/openlabs-handbook check --json
../node_modules/.bin/openlabs-handbook export --out networking.json
../node_modules/.bin/openlabs-handbook inspect networking.json --json
```

An export refuses invalid content before writing its output. The artifact
retains the original `openlabs/bundle/v1` shape: `bundleVersion`, `exportedAt`,
normalized `handbook` and Markdown `articles`. A frozen export made before the
SDK is a conformance test of that compatibility.

Add optional `assessments.json` beside the manifest for lab checkpoints and a
final handbook assessment. The CLI validates references, coverage and educator
review digests. Exports containing a bank use `openlabs/bundle/v2`; the SDK reads
both versions. Source drafts and scoring are documented in **Interactive assessments**.
The external SDK smoke also exports a bank and corrects all five question types.

## Consume the artifact in a private application

Install the SDK tarball in that application, transfer the bundle using your
own artifact storage, and validate it before admitting it to a catalog:

```js
import { readFileSync } from "node:fs";
import { lerPacote, labsExigidos } from "@ovh/handbook-format/contract";

const result = lerPacote(JSON.parse(readFileSync("networking.json", "utf8")));
if (!result.ok) throw new Error(result.errors.join("\n"));

const { handbook, articles } = result.value;
const requiredLabs = labsExigidos(result.value);
// Resolve requiredLabs against this application's installed lab catalog.
// Render handbook/articles using this application's renderer.
```

The `/contract` entry does not import the filesystem, Astro or a simulation
engine. It reads data and does not execute received Markdown or lab code.
Markdown rendering and the application's content handling policy belong to
the host.

**A content bundle is not a runnable lab distribution.** `requiredLabs` lists
the available labs' ids and routes. For the Kubernetes handbook it includes
`pod-lifecycle` at `labs/pod-lifecycle`. The host must supply that implementation;
an unresolved route cannot be advertised as runnable. The current OpenLabs
site does not automatically import external bundles or install extensions.

## Versions and ownership

| Value | Changes when | Example |
| --- | --- | --- |
| SDK package version | The tool/library implementation changes | `0.1.0-alpha.1` |
| `apiVersion` | The handbook manifest contract changes | `openlabs/handbook/v1` |
| `bundleVersion` | The exported artifact's structure changes | `openlabs/bundle/v1` |
| Content checksum | The exact released artifact changes | SHA-256 of the JSON file |

An organization can pin the SDK tarball and a content checksum separately.
`exportedAt` is an export date in UTC, not a content version or a proof of
identity. Code is Apache-2.0; the project's editorial content remains under
its content license. Authors and hosts must carry their own content licensing.

This establishes a working distribution boundary. Registry publication,
signed releases, the lab-extension ABI and private hosting configuration remain
separate work. The alpha **Handbook Studio**, available in the main navigation,
now reuses this contract and diagnostics for local curriculum/article editing,
source ZIPs and validated bundles. Its guide is in the authoring index.
