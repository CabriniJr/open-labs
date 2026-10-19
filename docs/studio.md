# Handbook Studio

The alpha Studio is a local workspace for authoring guided concept handbooks.
Open **Studio** in the main navigation. It starts with the Kubernetes handbook
as an editable example and uses the same contract as the standalone CLI.

## The authoring loop

1. Edit `handbook.yaml`: the curriculum, phases, items, maintainer and theme.
2. Choose a curriculum article and select **Draft article**. The Studio creates
   its source file and marks the curriculum entry available. The draft contains
   no invented sources: add real primary sources and citations to make it valid.
3. Edit the Markdown and inspect **Validation**. A diagnostic names its file;
   select the file to correct it. The reading preview includes source notes
   and expandable deeper blocks.
4. Inspect the roadmap as a learner would see it. Installed labs can be opened
   in a separate tab. Unresolved labs explicitly require a host implementation.
5. Download editable sources at any time, or export a content bundle once all
   mechanical checks pass. **Delivery** additionally assembles the runnable
   host and required lab contracts into a versioned ZIP. Scientific review
   remains the author's job.

Invalid text stays in the editor. While the manifest is invalid the Studio
does not show a stale curriculum as if it represented the current source.
Source editing and export do not require a flow engine or Mermaid. A lab using
the compositional flow engine still uses Mermaid as its structural contract.

## Open and save a project

**Open project** accepts either:

- a validated `openlabs/bundle/v1` or `v2` JSON export from the CLI or Studio;
- a source ZIP containing `handbook.yaml`, optional `assessments.json` and
  `articles/<id>.md`, optionally
  under one enclosing folder. A source ZIP can contain an unfinished draft.

The source ZIP is the standalone project's layout. To prepare one from that
project, archive only those files:

```sh
zip -r networking-sources.zip handbook.yaml articles
# Include assessments.json too when the project has a bank.
```

**Download sources** preserves the current file text, including invalid text.
**Export bundle** validates through the SDK before writing v1 for content alone
or v2 when an assessment bank is included. Importing a bundle reconstructs editable YAML from its normalized
metadata; comments that were never in the bundle cannot be recovered.
The source ZIP retains the exact YAML text. Creating an article is a structured
curriculum edit and rewrites the manifest using the v1 writer.

Files are read in the browser. Opening a bad bundle leaves the existing project
untouched. After replacing a project or removing a file, **Restore previous**
offers the preceding project in this session; replacing again updates that slot.

There is one autosaved project per browser origin, including invalid drafts.
Autosave is not a shared workspace or a backup. When browser storage is blocked,
unreadable or full, the Studio remains editable and prompts for a source download.
An unreadable saved draft is not overwritten automatically. Use source downloads
to transfer your project to another browser, another host or version control.
Imports and saved projects are limited to 2 MB; source archives to 200 files.

## Prepare a brief for your assistant

Select **AI brief**, describe the desired learning outcome, and download or copy
the prepared brief. It contains the objective, exact source files, current
diagnostics, contract versions and source-review rules. Use it with Claude or
another assistant, review its file changes, then open the resulting source ZIP.

The brief preserves the conceptual sequence **predict → change → observe →
explain → transfer**, the role of Mermaid for flow scenarios, and the distinction
between content and installed lab implementations. The Studio does not call a
model, send your files to an AI provider or hold an API key. You decide where
to share the brief.

## Deliver a runnable handbook

**Assessments** adds or imports `assessments.json`. Use its source editor and
diagnostics to author the bank, **Preview assessment** to answer a checkpoint
or final, and the educator checklist to review individual questions. Exported
source ZIPs preserve draft bank text. Content bundles with assessments use v2;
content-only bundles retain v1. **Open attempt report** recomputes a submitted
result against its original bank. The chapter **Interactive assessments** covers
scoring, review states, public-bank provenance and current service boundaries.

Open **Delivery** to inspect the installed labs, interaction types and exact
versions. Set the handbook release version and select **Download runnable
release**. The SDK checks the content and capabilities, verifies the prebuilt
host assets and writes `release.json`, `handbook.json` and the runtime files.
Missing lab implementations block this export rather than producing dead links.

Extract the ZIP and run `node serve.mjs` using Node.js 24, or serve the files on
your existing HTTPS host. No npm install is needed by a learner. All assembly
happens locally; only static runtime assets are fetched from the Studio host.
See **Runnable handbook deliveries** in the authoring index for private hosting,
integrity checks and exact compatibility rules.

This ZIP is a runnable release, distinct from the editable source ZIP accepted
by **Open project**. Keep the sources or content bundle for subsequent edits.

## Preview and distribution limits

The reading preview sanitizes Markdown output, omits images and executable embeds,
and activates primary-source links using HTTPS. It is a reading aid, not an
execution environment for arbitrary labs. The host's known lab catalog decides
which lab links can run here. A bundle never installs lab code.

This alpha edits curriculum and articles and assembles runnable releases. The
host includes Pod lifecycle, Collector pipeline and cardinality adapters. Adding
another implementation requires a reviewed host build. The Studio does not yet
author TypeScript behavior, synchronize with Git, provide multiplayer editing
or deploy a release automatically. Private organization authentication belongs
to the infrastructure serving the release.
