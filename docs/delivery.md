# Runnable handbook deliveries

A delivery joins a validated content bundle to a versioned, compiled host and
its installed labs. Extract its ZIP and run `node serve.mjs` with Node.js 24.
Recipients need no repository checkout, compiler, registry access or npm install.
The same files can be served by an existing HTTPS static host.

## Three interaction contracts

`openlabs/lab/v1` describes an implementation, not executable model behavior:

| Kind | Structural contract | Execution |
| --- | --- | --- |
| `flow` | Canonical `.mmd`, `openlabs/mermaid-skeleton/v1` | Explicit runtime and model |
| `state` | Domain model, such as the native Kubernetes manifest | Explicit event/state runtime |
| `direct` | Domain-specific inputs and outputs | Dedicated implementation; no flow engine required |

Mermaid is the structural source for compositional flows. Its exact source file
ships in the delivery and has a digest; it is not a visualization generated
from an alternative graph. The existing Collector parser and conformance tests
still enforce the relationship between that source and the compiled model.
Changing a delivered `.mmd` alone does not recompile a lab.

State and direct labs are first-class contracts. The Pod lifecycle lab uses
`interactive-core` and `kubernetes-domain`; cardinality uses direct manipulation.
Neither is adapted into a flow graph. Behavior stays in reviewed TypeScript,
with the model's tests, rather than a new universal programming language in YAML.

Every descriptor pins an id, version, route and interaction. Flow and state also
pin their runtime version. The host resolves both lab id and route, supports the
interaction kind and matches runtime versions exactly. Missing implementations,
duplicate identities and mismatched descriptors prevent release or execution.

## Independent content and runtime releases

The existing `openlabs/handbook/v1` and `openlabs/bundle/v1` remain readable.
Optional assessment banks travel in `openlabs/bundle/v2`; content-only exports
keep v1. The alpha.2 portable host mounts end-of-lab and final assessments with
late feedback, objective scores and local attempt reports. See **Interactive assessments**.
Authors can edit and release content without changing an engine. A bundle
contains the normalized curriculum and Markdown; it never installs lab code.

`openlabs/host-template/v1` identifies a compiled host, capabilities, installed
lab descriptors and file digests. `openlabs/delivery/v1` pins the handbook
release, host, required lab descriptors and SHA-256 digests of all shipped
assets. `release.json` is the index and does not hash itself. Contract versions,
package versions and an author's release version have different purposes.
Explicit release versions use `major.minor.patch`, optionally with a SemVer
prerelease suffix. This alpha uses exact compatibility, with no range solver.

The generic assembly API lives in `@ovh/handbook-format/contract` (alpha.4).
The separate `handbook-catalog` package holds this host's reviewed lab catalog.
It keeps subject-specific installation decisions out of the SDK.

## Build or download

In the Studio, open **Delivery**, inspect the required implementations, set a
release version and select **Download runnable release**. Validation errors or
unknown labs block this download. Source ZIP and content bundle exports remain
available for their own purposes. The browser fetches the prebuilt host assets;
the handbook stays local and is assembled into the ZIP in the browser.

From a framework checkout:

```sh
pnpm install
pnpm delivery:build --handbook kubernetes --version 0.1.0
# Or content exported by an independent author:
pnpm delivery:build --bundle /path/to/handbook.json --version 0.1.0
```

Output is a folder and ZIP under `dist/deliveries/`. An existing output folder
is refused. After extracting:

```sh
cd kubernetes-0.1.0
node serve.mjs
# Open the address printed by the server.
```

The server verifies every indexed file before listening and serves only those
verified bytes. Modified or missing files refuse startup. The browser validates
the bundle, host and lab compatibility, handbook digest and canonical Mermaid
digests before mounting a lab. SHA-256 detects inconsistent files; the release
index is not a publisher signature. Distribute the complete archive through
your organization's trusted channel.

## Private use and current limits

Companies can build the framework, keep handbook sources private and serve the
result entirely inside their infrastructure. System fonts and bundled assets
allow the learning interactions to run without a public OpenLabs origin.
Article references are optional outbound navigation. HTTPS or localhost is
required by browser integrity checks. Organization access control belongs to
the existing hosting or proxy layer; the bundled server provides local serving.

The alpha host compiles three reviewed adapters: Pod lifecycle, Collector
pipeline and cardinality. Only required labs appear in a handbook's curriculum;
the compiled host contains all three. Adding another implementation currently
requires extending the host's catalog/component registry and rebuilding it.
Content cannot import remote modules or arbitrary plugin code. General adapter
packaging, publisher signatures, hosted organization management and automatic
deployment are future work. AI assistance currently uses the Studio's explicit
brief handoff, without sending private sources to a model automatically.
