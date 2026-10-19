# @ovh/handbook-format

Pre-release authoring SDK for OpenLabs handbooks. Node.js 24 or newer.

Install a release tarball in your own project, then use the CLI:

```sh
npm install /path/to/ovh-handbook-format-0.1.0-alpha.3.tgz
npx --no-install openlabs-handbook new networking --github your-handle --name "Your Name"
cd networking
../node_modules/.bin/openlabs-handbook check
../node_modules/.bin/openlabs-handbook export --out handbook.json
../node_modules/.bin/openlabs-handbook inspect handbook.json
```

The project contains `handbook.yaml` and `articles/<article-id>.md`. No clone of
OpenLabs, Astro, compiler or flow engine is needed by the installed CLI.
`check --json` provides structured diagnostics for editors and agents.

The package root includes filesystem readers. The `/contract` entry has no
Node filesystem dependency and can be used by a Studio or a bundle consumer:

```js
import { lerPacote, labsExigidos } from "@ovh/handbook-format/contract";

const result = lerPacote(JSON.parse(json));
if (!result.ok) throw new Error(result.errors.join("\n"));
const { handbook, articles } = result.value;
const requirements = labsExigidos(result.value);
```

The reader checks versions, structure, curriculum, article completeness,
frontmatter, source citation references and drill-down structure. It does not
establish that claims or sources are scientifically correct.

`openlabs/bundle/v1` carries the normalized handbook and Markdown articles.
Available labs are **requirements on the host**, not included implementations.
The host must resolve those labs before presenting them as runnable. This SDK
does not execute received Markdown, install lab code or provide a site renderer.

The SDK package version, the handbook `apiVersion`, and `bundleVersion` serve
different purposes. An alpha SDK can continue to read the existing v1 contract.
The bundle format remains compatible with the original export command.

Alpha.3 also exports lab descriptors (`flow`, `state`, `direct`), host templates
and runnable delivery contracts. `flow` requires its canonical Mermaid source;
the other kinds do not require the flow engine. Exact runtime and implementation
versions are checked independently of content versions.

```js
import { assembleDelivery } from "@ovh/handbook-format/contract";

const { release, files } = await assembleDelivery({
  bundle: result.value,
  version: "0.1.0",
  template, // reviewed openlabs/host-template/v1 data
  load: async (path) => readHostAsset(path), // Uint8Array
});
```

Assembly validates requirements and asset SHA-256 digests. The caller writes
the returned relative files to a folder or ZIP. This generic SDK does not
include a host implementation or load code from a received bundle.

Code: Apache-2.0. Content bundled by authors keeps its own license; this package
does not grant a license to that content.
