# Language and appearance

Open the hamburger **Settings** menu to select **English** or **Português
(Brasil)** and a light, dark or system appearance. Both preferences are saved
in this browser and survive navigation and reload. When storage is unavailable,
the choice remains usable on the current page. The default language follows
the browser preference; the original HTML stays readable without JavaScript.

The language layer covers the published handbooks, articles, documentation,
interactive lab controls, Studio, assessments and resolutions. The portable
host includes the same settings and local language packs. Switching languages
fetches only assets from the current host and works without an external
translation service. Search compares both localized documentation and original
text, showing results in the chosen language.

## Source and behavior remain stable

Translations change displayed text and accessibility labels. They never rewrite
native manifests, source editors, snippets, URLs, ids, submitted answers or the
canonical Mermaid files. A container request written `3000m` remains `3000m`.
An assessment still grades the same alternative ids and pins the original bank.
Educator approval binds the original question, sources and objective; it does
not assert that an assisted translation has received separate human review.

Content authored or imported by a company remains local. The application has
no automatic translation API for private projects. Text absent from the installed
catalog falls back to the author's original language. New handbook authors can
supply native-language content and contribute reviewed catalog entries through
the framework's normal source/release process.

## Translation coverage and review

Catalogs are generated from published HTML and UI/model message definitions,
including conditional states and assessment bank resolutions. Build-time tools
inventory the public source text and check that both target languages have
entries with unchanged interpolation slots. The runtime skips code and editable
source inputs and waits for React islands to hydrate before translating them.

The initial sweep uses assisted translation of public project text, with reviewed
overrides for interface wording and scientific/assessment terminology. It is not
a claim of complete human linguistic review. Preserve native API vocabulary and
verify explanations against their primary sources when reviewing translations.
Use `apps/site/src/locales/overrides.ts` for editorial corrections; a changed
source phrase needs a new catalog entry and cannot silently reuse stale wording.

Normal builds consume committed catalogs and perform no translation requests.
To refresh the inventory after building:

```sh
node scripts/locale-inventory.mjs
node scripts/check-locales.mjs
```

`dist/locale-inventory.json` is a generated review report. The explicit
`scripts/translate-public-locales.py` helper can populate a resumable catalog
using Google Translate's public text endpoint at development time. Run it only
for text its author has already published. It is never invoked by the site,
Studio, CI or a private handbook delivery. Review the resulting catalog diff
and terminology overrides before release.

Translated search indexes are built locally from the same catalogs. The source
content, translation packs and runtime files are all included in a runnable
release's integrity index. Language choice is presentation state; it does not
change an engine, a model's structure or a learner's stored answers.
