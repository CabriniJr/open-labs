import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { criarManifesto, lerArtigo } from "@ovh/handbook-format/contract";
import { marked } from "marked";
import DOMPurify from "dompurify";
import {
  aiBrief, draftArticle, exportProject, MAX_PROJECT_BYTES, projectFromBundle, projectFromZip,
  projectZip, readDraft, saveableDraft, STUDIO_STORAGE_KEY, validateProject,
} from "../lib/studio.js";
import type { StudioProject } from "../lib/studio.js";

interface HostLab { readonly href: string; readonly url: string; readonly title: string }
interface Props { readonly example: StudioProject; readonly hostLabs: readonly HostLab[] }

function download(name: string, value: string | Uint8Array, type: string) {
  const blob = new Blob([typeof value === "string" ? value : new Uint8Array(value).buffer], { type });
  const uri = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = uri; anchor.download = name; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(uri), 1000);
}

/** Preview sanitizes Markdown output, without images or executable embeds. */
function previewHtml(markdown: string): string {
  const clean = DOMPurify.sanitize(marked.parse(markdown, { async: false }), {
    ALLOWED_TAGS: ["p", "h1", "h2", "h3", "h4", "h5", "h6", "a", "strong", "em", "del", "code", "pre", "ul", "ol", "li", "blockquote", "hr", "br", "table", "thead", "tbody", "tr", "td", "th"],
    ALLOWED_ATTR: ["href", "title"],
  });
  const doc = new DOMParser().parseFromString(clean, "text/html");
  for (const heading of doc.querySelectorAll("h1")) {
    const replacement = doc.createElement("h2"); replacement.append(...heading.childNodes); heading.replaceWith(replacement);
  }
  for (const link of doc.querySelectorAll("a")) {
    const href = link.getAttribute("href") ?? "";
    if (href.startsWith("#src-")) link.setAttribute("href", href.replace("#src-", "#studio-src-"));
    else if (/^https:\/\//u.test(href)) { link.setAttribute("rel", "noopener noreferrer"); link.setAttribute("target", "_blank"); }
    else link.removeAttribute("href");
  }
  for (const quote of doc.querySelectorAll("blockquote")) {
    const first = quote.querySelector("p");
    const match = /^\[!deeper\]\s*(.*)/u.exec(first?.textContent ?? "");
    if (!match) continue;
    const detail = doc.createElement("details"), summary = doc.createElement("summary");
    summary.textContent = match[1] || "Go deeper"; first?.remove();
    detail.append(summary, ...quote.childNodes); quote.replaceWith(detail);
  }
  return doc.body.innerHTML;
}

export function HandbookStudio({ example, hostLabs }: Props) {
  const [project, setProject] = useState<StudioProject>(example);
  const [hydrated, setHydrated] = useState(false);
  const [autosave, setAutosave] = useState(true);
  const [saved, setSaved] = useState(false);
  const [selected, setSelected] = useState("handbook.yaml");
  const [previous, setPrevious] = useState<StudioProject | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("A working Kubernetes handbook is open. Edit it, or start your own.");
  const [busy, setBusy] = useState(false);
  const [newForm, setNewForm] = useState(false);
  const [view, setView] = useState<"roadmap" | "article">("roadmap");
  const [previewArticle, setPreviewArticle] = useState(example.articles[0]?.id ?? "");
  const [briefOpen, setBriefOpen] = useState(false);
  const [goal, setGoal] = useState("Improve this learning sequence: what should the learner predict, change, observe, explain and transfer?");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STUDIO_STORAGE_KEY);
      if (stored) { const restored = readDraft(stored); setProject(restored); setPreviewArticle(restored.articles[0]?.id ?? ""); setMessage("Restored your draft from this browser."); }
    } catch { setAutosave(false); setError("Could not restore browser storage. Download sources to keep your work."); }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !autosave) return;
    try { localStorage.setItem(STUDIO_STORAGE_KEY, saveableDraft(project)); setSaved(true); }
    catch { setSaved(false); }
  }, [project, hydrated, autosave]);

  const deferred = useDeferredValue(project);
  const validation = useMemo(() => validateProject(deferred), [deferred]);
  const { handbook, diagnostics } = validation;
  const validating = deferred !== project;
  const article = project.articles.find((a) => `articles/${a.id}.md` === selected);
  const text = selected === "handbook.yaml" ? project.manifest : article?.markdown ?? "";
  const availableDrafts = handbook?.articles.filter((a) => !project.articles.some((f) => f.id === a.id)) ?? [];
  const [draftId, setDraftId] = useState("");
  const chosenDraft = availableDrafts.some((a) => a.id === draftId) ? draftId : availableDrafts[0]?.id ?? "";
  const previewFile = deferred.articles.find((a) => a.id === previewArticle) ?? deferred.articles[0];
  const parsedArticle = useMemo(() => previewFile ? lerArtigo(previewFile.markdown) : null, [previewFile]);
  const html = useMemo(() => parsedArticle?.ok ? previewHtml(parsedArticle.body) : "", [parsedArticle]);
  const brief = useMemo(() => briefOpen ? aiBrief(project, goal) : "", [briefOpen, project, goal]);

  const replace = (next: StudioProject, note: string) => {
    setPrevious(project); setProject(next); setSelected("handbook.yaml");
    setPreviewArticle(next.articles[0]?.id ?? ""); setView("roadmap"); setError(""); setMessage(note);
  };
  const edit = (value: string) => {
    setSaved(false); setError("");
    setProject((p) => selected === "handbook.yaml" ? { ...p, manifest: value } : { ...p, articles: p.articles.map((a) => a.id === article?.id ? { ...a, markdown: value } : a) });
  };
  const run = (action: () => void) => { try { action(); setError(""); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } };
  const openFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      if (file.size > MAX_PROJECT_BYTES) throw new Error("Keep the project below 2 MB.");
      const next = file.name.toLowerCase().endsWith(".zip") ? projectFromZip(new Uint8Array(await file.arrayBuffer())) : projectFromBundle(await file.text());
      replace(next, `Opened ${file.name}. Previous project is available with Restore previous.`);
    } catch (e) { setError(`Could not open project: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  };
  const create = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    run(() => {
      replace({ manifest: criarManifesto({ id: String(data.get("id")), nome: String(data.get("name")), github: String(data.get("github")) }), articles: [] }, "Created a new curriculum. Add your concepts before drafting articles.");
      setNewForm(false);
    });
  };
  const theme = { "--studio-accent-light": handbook?.tema.claro.acento, "--studio-accent-dark": handbook?.tema.escuro.acento ?? handbook?.tema.claro.acento } as CSSProperties;

  return <div className="studio" data-testid="handbook-studio" data-hydrated={hydrated}>
    <div className="studio-toolbar">
      <div className="studio-project-title"><span className="studio-project-icon" aria-hidden="true">▤</span><div><strong>{handbook?.name ?? "Handbook draft"}</strong><small role="status">{saved ? "Saved in this browser" : hydrated ? "Download sources to keep a copy" : "Opening local workspace…"}</small></div></div>
      <div className="studio-actions">
        <button onClick={() => setNewForm(!newForm)} aria-expanded={newForm}>New handbook</button>
        <button onClick={() => input.current?.click()} disabled={busy}>{busy ? "Opening…" : "Open project"}</button>
        <input ref={input} type="file" accept=".zip,.json,application/json,application/zip" className="studio-hidden-file" aria-label="Open project file" onChange={(e) => void openFile(e.target.files?.[0])} />
        <button onClick={() => run(() => download("handbook-sources.zip", projectZip(project), "application/zip"))}>Download sources</button>
        <button className="studio-primary" disabled={busy || validating || !handbook || diagnostics.length > 0} onClick={() => run(() => { download(`${handbook?.id ?? "handbook"}.json`, exportProject(project, new Date().toISOString().slice(0, 10)), "application/json"); setMessage("Exported a validated content bundle. The host provides its lab implementations."); })}>Export bundle <span aria-hidden="true">↗</span></button>
      </div>
    </div>

    {newForm && <form className="studio-new" onSubmit={create}><label>Handbook id<input name="id" placeholder="networking" pattern="[a-z0-9]+(-[a-z0-9]+)*" required autoFocus /></label><label>Maintainer name<input name="name" autoComplete="name" required /></label><label>GitHub handle<input name="github" placeholder="your-handle" required /></label><button className="studio-primary" type="submit">Create handbook</button><button type="button" onClick={() => setNewForm(false)}>Cancel</button></form>}
    <div className="studio-subbar"><span><b className={diagnostics.length ? "studio-issues" : "studio-valid"}>{validating ? "Checking…" : diagnostics.length ? `${diagnostics.length} issue${diagnostics.length === 1 ? "" : "s"}` : "✓ Ready to export"}</b><span className="studio-contract">handbook/v1</span></span><div>{previous && <button onClick={() => { const old = previous; replace(old, "Restored the previous project."); }}>Restore previous</button>}<button onClick={() => replace(example, "Opened the Kubernetes example. Your previous project can be restored.")}>Kubernetes example</button><button className={briefOpen ? "studio-active" : ""} aria-expanded={briefOpen} onClick={() => setBriefOpen(!briefOpen)}>AI brief</button></div></div>
    {error && <p className="studio-error" role="alert">{error}</p>}

    {briefOpen && <section className="studio-brief" aria-label="AI authoring brief"><div><p className="studio-eyebrow">AUTHOR WITH YOUR ASSISTANT</p><h2>Give the next change a clear brief.</h2><p>Prepare the objective, source files and current diagnostics for Claude or another assistant. Review the returned changes and open their source archive here.</p><p>Your files stay in this browser. This action prepares a brief; it does not call a model.</p><label htmlFor="studio-goal">What should the assistant help with?</label><textarea id="studio-goal" value={goal} onChange={(e) => setGoal(e.target.value)} rows={4} /><div className="studio-actions"><button onClick={() => run(() => download("openlabs-authoring-brief.md", brief, "text/markdown"))}>Download AI brief</button><button onClick={() => { if (!navigator.clipboard) { setError("Clipboard unavailable. Download the brief instead."); return; } void navigator.clipboard.writeText(brief).then(() => setMessage("Brief copied. Share it with your assistant when ready.")).catch(() => setError("Clipboard unavailable. Download the brief instead.")); }}>Copy brief</button></div></div><label className="studio-brief-output">Prepared brief<textarea aria-label="Prepared AI brief" readOnly value={brief} /></label></section>}

    <div className="studio-workspace">
      <aside className="studio-files" aria-label="Project files"><div className="studio-panel-head">SOURCES <span>{project.articles.length + 1} files</span></div>
        <button className="studio-file" aria-current={selected === "handbook.yaml" ? "true" : undefined} onClick={() => setSelected("handbook.yaml")}><span aria-hidden="true">◇</span> handbook.yaml</button>
        <p className="studio-folder">articles/</p>
        {project.articles.map((a) => <button className="studio-file" key={a.id} aria-current={selected === `articles/${a.id}.md` ? "true" : undefined} onClick={() => { setSelected(`articles/${a.id}.md`); setPreviewArticle(a.id); setView("article"); }}><span aria-hidden="true">¶</span><span>{a.id}.md</span>{diagnostics.some((d) => d.file === `articles/${a.id}.md`) && <span className="studio-issues" aria-label="Has diagnostics">●</span>}</button>)}
        {!project.articles.length && <p className="studio-muted">Your articles will appear here.</p>}
        {availableDrafts.length > 0 && <div className="studio-add"><label>Curriculum article<select value={chosenDraft} onChange={(e) => setDraftId(e.target.value)}>{availableDrafts.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</select></label><button onClick={() => run(() => { const next = draftArticle(project, chosenDraft); setPrevious(project); setProject(next); setSelected(`articles/${chosenDraft}.md`); setPreviewArticle(chosenDraft); setView("article"); setMessage("Draft created. Add primary sources and citations before exporting."); })}>Draft article +</button></div>}
        <p className="studio-file-note">Edit your curriculum in the manifest. Drafts remain editable while validation fails.</p>
      </aside>

      <section className="studio-editor" aria-label="Source editor"><div className="studio-panel-head"><span className="mono">{selected}</span><span>{text.split("\n").length} lines</span></div><textarea aria-label={`Edit ${selected}`} value={text} onChange={(e) => edit(e.target.value)} disabled={busy} spellCheck={false} wrap="off" />
        {article && <div className="studio-editor-foot"><span>Markdown + primary sources</span><button onClick={() => { setPrevious(project); setProject({ ...project, articles: project.articles.filter((a) => a.id !== article.id) }); setSelected("handbook.yaml"); setMessage("File removed. Update its curriculum entry, or use Restore previous."); }}>Remove file</button></div>}
        <section className="studio-diagnostics" aria-label="Validation diagnostics"><div className="studio-panel-head">VALIDATION <span>{diagnostics.length ? `${diagnostics.length} to resolve` : "contract checked"}</span></div>{diagnostics.length ? <ul>{diagnostics.map((d, i) => <li key={i}><button onClick={() => setSelected(d.file)}>{d.file}</button><p>{d.message}</p></li>)}</ul> : <p className="studio-muted">Curriculum and article checks pass. Review scientific claims against the cited sources before releasing.</p>}</section>
      </section>

      <section className="studio-preview" aria-label="Handbook preview" style={theme}><div className="studio-panel-head">LEARNER PREVIEW <div className="studio-preview-tabs"><button aria-pressed={view === "roadmap"} onClick={() => setView("roadmap")}>Roadmap</button><button aria-pressed={view === "article"} onClick={() => setView("article")}>Article</button></div></div>
        {!handbook ? <p className="studio-muted">Fix the manifest diagnostics to preview the curriculum. Your source text is preserved.</p> : <div className="studio-preview-body"><div className="studio-book-head"><p className="studio-eyebrow">{handbook.subject} / {handbook.stage}</p><h2>{handbook.name}</h2><p>{handbook.tagline}</p></div>
          {view === "roadmap" ? <div className="studio-roadmap">{handbook.phases.map((phase) => <section key={phase.number}><div className="studio-phase-number">{String(phase.number).padStart(2, "0")}</div><div><h3>{phase.title}</h3><p>{phase.line}</p>{handbook.articles.filter((a) => a.phase === phase.number).map((a) => <button className="studio-curriculum-item" key={a.id} disabled={!deferred.articles.some((f) => f.id === a.id)} onClick={() => { setPreviewArticle(a.id); setView("article"); }}><span>{a.title}</span><small>{a.status === "available" ? "article" : a.status}</small></button>)}{handbook.labs.filter((l) => l.phase === phase.number).map((lab) => {
            const installed = hostLabs.find((l) => l.href === lab.href);
            return <div className="studio-lab-requirement" key={lab.id}><span>◈ {lab.title}</span>{lab.status !== "available" ? <small>{lab.status}</small> : installed ? <a href={installed.url} target="_blank" rel="noopener noreferrer">Open installed lab ↗</a> : <small>Host implementation required</small>}</div>;
          })}</div></section>)}</div> : !previewFile ? <p className="studio-muted">Draft an article from the curriculum to preview it here.</p> : parsedArticle?.ok ? <article className="studio-article"><h3>{parsedArticle.data.title}</h3><p className="studio-dek">{parsedArticle.data.dek}</p><div className="studio-markdown" dangerouslySetInnerHTML={{ __html: html }} /><section className="studio-sources"><h4>Primary sources</h4>{parsedArticle.data.sources.map((s, i) => <p key={`${s.id}-${i}`} id={`studio-src-${s.id}`}><strong>{s.title}</strong> — {s.author}, {s.year}. {s.url?.startsWith("https://") ? <a href={s.url} target="_blank" rel="noopener noreferrer">Read source ↗</a> : s.where}<small>{s.note}</small></p>)}</section></article> : <p className="studio-muted">Complete the article frontmatter to see its reading preview. The diagnostics name the missing fields.</p>}
        </div>}
      </section>
    </div>
    <p className="studio-message" role="status">{message}</p>
    <footer className="studio-footnote"><span>Local workspace · source ZIPs and validated content bundles</span><span>Sources stay editable. The host supplies runnable labs.</span></footer>
  </div>;
}
