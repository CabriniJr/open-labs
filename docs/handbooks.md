# Submitting a handbook

This is the golden path: how to create a handbook in OpenLabs, get it published,
and keep owning it afterwards. It is written to be followed by a person or by an
agent, in that order of difficulty — an agent should be able to execute it
without reading anything else.

**The promise.** A handbook is a directory with one manifest in it. You declare
yourself its maintainer, you keep it, and a release of OpenLabs that changes the
format does not break what you wrote. The contract version you wrote against
stays readable.

```
node scripts/handbook.mjs new my-handbook --github your-handle
node scripts/handbook.mjs check my-handbook
```

That is the whole entry point. Everything below explains what the check asks of
you and why.

---

## 1. The shape of a submission

```
handbooks/my-handbook/handbook.yaml           the manifest — this is your handbook
apps/site/src/content/articles/my-handbook/   your articles, one .md per article
labs/<slug>/                                  (optional) a counterpart that runs
```

Three directories, and the split is not arbitrary:

- the **manifest** is yours alone. Nothing in it describes the site;
- the **articles** live where every article in this repository lives, and that
  is on purpose. They face the same guards ours do: every source listed has to
  be cited in the body, every citation has to point at a listed source, every
  article needs at least one drill-down, and the catalogue and the files have to
  agree in both directions. Putting submitted articles in a tidier,
  submitter-owned folder would have bought tidiness by weakening the promise;
- the **lab counterpart**, if you build one, is the thing that makes a claim
  checkable against a binary instead of only against a simulation.

You own the first two. `CODEOWNERS` is generated from the `maintainers` field of
your manifest, so submitting a handbook is also claiming it.

## 2. The manifest

`handbook.yaml`, and `node scripts/handbook.mjs new` writes a valid one. The
fields:

| field | what it is |
| --- | --- |
| `apiVersion` | the **contract** version, not your version. See §6 |
| `id` | lowercase, hyphens. It is the URL and the directory name — they must match |
| `name` | the title on the handbook page |
| `subject` | one or two words, for the label on the catalogue card |
| `tagline` | one sentence: what the reader will be able to *see* |
| `blurb` | two or three sentences for the catalogue card |
| `model` | the `.model` this handbook instantiates (`otel.model`, `cpu.model`, …) |
| `stage` | `building` or `planned` |
| `maintainers` | at least one `{ name, github }`. This is ownership, not credit |
| `theme` | the closed set of colours this handbook paints. See §4 |
| `phases` | the curriculum: the order in which the concepts hold each other up |
| `articles` / `labs` | the items, each with `status` and `phase` |
| `reference` | optional: where the model came from, when it is not yours |

### The rules the check enforces, and what each one prevents

- **An unknown key is refused, not ignored.** `titel:` instead of `title:` would
  publish an item with no title. A typo must be a refusal with a name on it.
- **`status: available` requires `href`; anything else forbids it.** An item
  announced as ready with no link is an invitation that opens nothing; a link to
  a page nobody wrote is a dead link in production, and the reader finds it by
  clicking.
- **Every item's `phase` must exist.** The page groups by phase, so an item in a
  phase you did not declare does not render — it disappears silently, which is
  the defect this project treats as the most expensive one.
- **No phase may be empty on both sides.** A phase with no article and no lab is
  a missing step in the staircase. Declare at least one item, even as `coming`.
- **Phases are in ascending order.** The order *is* the curriculum, and the page
  prints it as written.
- **An article that exists as a file must be announced as `available`**, and an
  article announced as `available` must exist as a file. The two directions fail
  differently: the first makes a written text invisible, the second is a dead
  link.

## 3. Articles

One Markdown file per article, in `apps/site/src/content/articles/<id>/`, named
`<article-id>.md` — the same id the manifest uses. The frontmatter:

```yaml
---
title: "What an attribute costs"
dek: "One paragraph that states the practical concept, defined."
handbook: my-handbook
phase: 5
lab: labs/my-lab          # optional: the lab this article is the theory of
sources:
  - id: some-primary-source
    author: "Who wrote it"
    year: "2015"
    title: "The title"
    where: "Where it was published"
    url: "https://..."    # optional: omit rather than invent one
    note: "Why it is worth opening this one, in one sentence."
---
```

What the guards ask of the body:

- **every technical claim traces back to a source.** Cite with
  `([source](#src-<source-id>))`. A source listed and never cited is
  bibliographic decoration; a citation pointing at a source that is not listed
  is a dead anchor. Both halves are checked;
- **at least one drill-down.** A `> [!deeper]` block: the article answers on the
  first read and keeps the next step for whoever wants it;
- **the title and the phase must match the manifest.** Two places saying the
  same thing diverge, so one of them is checked against the other.

A handbook with every article `coming` is a legitimate submission — it is a
curriculum with nothing written yet, and the page says so instead of hiding it.

## 4. The theme

A handbook has to look like itself, and the set of what it may paint is
**closed**: the accent, the four signals, the two families on the stage, and the
four cargo species. Background and typography belong to the house — a theme that
touches the paper becomes a banner.

Colours are six-digit hex, and that is a mechanical requirement rather than a
style: contrast in this repository is **measured** in a test, and the measurement
has to be able to read the value. `rebeccapurple` is valid CSS that the meter
cannot read, and a theme that cannot be measured is a theme that can be born
illegible.

`dark` is partial on purpose: declare only what the dark paper forces you to
change, usually the accent. Repeating what already works invites the two to
diverge.

## 5. What the manifest does **not** describe

**Behaviour.** A lab that runs is a model — objects, wires, parameters, and the
behaviour that animates them — and behaviour is TypeScript. No data format in
this repository describes it, and inventing one that half-describes it would be
worse than saying this plainly.

So a submitted handbook can:

- declare labs as `coming` (a curriculum that names what it will run);
- point `available` labs at pages that exist.

To add a lab that runs, follow `docs/authoring.md`: the model goes in a domain
package, the topology in a `.mmd` skeleton, the page in the site. The check tells
you this by name if you announce a lab whose page does not exist.

### What a submitted lab gets for free

Since 19 October 2026, the screen guards derive the list of labs to sweep from
the **catalogue** rather than from the two oldest handbooks' roadmap maps. So a
lab announced as `available` in your manifest is automatically measured for
horizontal overflow at phone width, and is required to have a measured ceiling
for how many of its wires cross. Neither of those is optional and neither needs
you to remember a test file: the first one fails in CI if your page scrolls
sideways on a 412px screen, and the second one fails naming your lab and asking
for the number that the measurement gave.

**The interactive roadmap map** is the other gap. `map` is a drawing with
coordinates, and the two oldest handbooks (OTel, CPU) still live in TypeScript
because of it. That is the honest reason, written down rather than discovered.

## 6. Versions, and the compatibility promise

`apiVersion` names the contract your file is written against:

```yaml
apiVersion: openlabs/handbook/v1
```

**The promise: the release that introduces a new contract version keeps reading
the previous one.** You do not have to touch your handbook because the house
moved.

```
node scripts/handbook.mjs versions     # what this release reads
node scripts/handbook.mjs migrate <id> # rewrite a manifest to the current version
```

How the promise is kept, mechanically — because a promise of this kind does not
survive on good intentions:

- the supported versions are **one list**, with a state (`atual`/`anterior`), a
  date, and a reader per version (`packages/handbook-format/src/versoes.ts`);
- every supported version has a **conformance example** that is loaded by the
  suite on every run. Deleting the reader for a version that is still on the list
  breaks the suite naming that version;
- a version can only be retired once there is an automatic migration to the next
  one. `migrate` is where it lives;
- the refusal separates the two directions, which fail differently. A handbook
  written against a **newer** version than the release knows is told to update
  OpenLabs — nothing in the file is wrong. One written against a **retired**
  version is told to run `migrate`. "Invalid version" would send both people to
  look in the wrong place.

The two versions on that list today are real, not a placeholder for a future
`v2`: the three original handbooks are hand-written TypeScript objects, which is
literally the previous version of this contract, and it is named as such. The
`algorithms` handbook was migrated from it to `v1`, and the object as it was
before the migration is frozen in `handbooks.test.ts` as the expectation, field
by field. That equality is what makes "migrating is mechanical" a measured fact.

## 7. Using a handbook outside this repository

```
node scripts/handbook.mjs export my-handbook --out my-handbook.json
```

A portable bundle: the normalized manifest plus every article with its body, in
one JSON file carrying its own `bundleVersion` and the `apiVersion` of the
contract inside it. Anything that can read JSON can render your handbook without
this monorepo, this Astro, or this directory layout.

The command refuses to export a handbook that does not pass `check`. Exporting
something broken would hand a broken artefact to an environment with no way to
tell.

## 8. Submitting

1. `node scripts/handbook.mjs check` — the same command CI runs;
2. `node scripts/handbook.mjs codeowners --write` if you are the first
   maintainer of a new directory, and include the result in the commit;
3. `pnpm test` if you touched articles: the article guards live there;
4. open the PR.

What a reviewer will look at, and in this order: whether every technical claim
in the articles traces to a primary source, whether the phases hold each other
up as a curriculum, and whether anything the handbook *asserts* is something a
model or a source sustains. The last one is the project's oldest rule: a lab or
an article that asserts what nothing sustains is the most expensive defect here,
and it is the one thing a format cannot check for you.

## 9. Maintaining

The directory is yours. `CODEOWNERS` is derived from your manifest, so reviews
of your handbook come to you, and changes elsewhere in OpenLabs do not ask
anything of you unless `check` starts refusing — which happens only when a rule
is added, and a rule is added with a migration.

If you stop maintaining it, say so in the PR that removes your handle. A
handbook with no maintainer is the house's problem, and the house would rather
know than find out.
