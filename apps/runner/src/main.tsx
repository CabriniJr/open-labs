import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { checkInstalledDelivery, hashBytes, lerArtigo, lerPacote, readDelivery } from "@ovh/handbook-format/contract";
import type { Delivery, PacoteDeHandbook } from "@ovh/handbook-format/contract";
import { STATIC_HOST, STATIC_LABS } from "@ovh/handbook-catalog";
import { AssessmentPlayer } from "../../site/src/components/AssessmentPlayer.js";
import "../../site/src/components/AssessmentPlayer.css";
import { PodLifecycleLab } from "../../site/src/components/PodLifecycleLab.js";
import { CollectorLab } from "../../site/src/components/CollectorLab.js";
import { CardinalidadeLab } from "../../site/src/components/CardinalidadeLab.js";
import { previewHtml } from "../../site/src/lib/article-html.js";
import { cssDoTema } from "../../site/src/lib/tema.js";
import "../../site/src/styles/tokens.css";
import "../../site/src/styles/base.css";
import "@ovh/depth-ui/src/depth-ui.css";
import "@ovh/depth-ui/src/stage.css";
import "@ovh/depth-ui/src/trilha.css";
import "../../site/src/components/PodLifecycleLab.css";
import "../../site/src/components/CollectorLab.css";
import "../../site/src/components/CardinalidadeLab.css";
import "../../site/src/components/Explorer.css";
import "../../site/src/components/PainelDaCarga.css";
import "../../site/src/components/HandbookStudio.css";
import "./runner.css";

const components = { "pod-lifecycle": PodLifecycleLab, "collector-pipeline": CollectorLab, "cardinality-and-the-bill": CardinalidadeLab };
async function bytes(path: string) { const r = await fetch(new URL(path, document.baseURI)); if (!r.ok) throw new Error(`Cannot load ${path}: HTTP ${r.status}`); return new Uint8Array(await r.arrayBuffer()); }
async function load() {
  const release = readDelivery(JSON.parse(new TextDecoder().decode(await bytes("release.json"))));
  const content = await bytes(release.handbook);
  if (await hashBytes(content) !== release.files.find((f) => f.path === release.handbook)?.sha256) throw new Error("Handbook integrity mismatch.");
  const result = lerPacote(JSON.parse(new TextDecoder().decode(content))); if (!result.ok) throw new Error(result.errors.join("\n"));
  const errors = checkInstalledDelivery(release, result.value, { host: STATIC_HOST, labs: STATIC_LABS }); if (errors.length) throw new Error(errors.join("\n"));
  for (const lab of release.labs) if (lab.interaction.kind === "flow") {
    const source = lab.interaction.structure.source;
    if (await hashBytes(await bytes(source)) !== release.files.find((f) => f.path === source)?.sha256) throw new Error(`Canonical Mermaid integrity mismatch: ${lab.id}`);
  }
  document.documentElement.dataset.domain = result.value.handbook.id;
  document.title = result.value.handbook.name;
  return { release, bundle: result.value };
}

function Article({ file }: { file: PacoteDeHandbook["articles"][number] }) {
  const read = lerArtigo(file.markdown); if (!read.ok) return <p role="alert">{read.errors.join("\n")}</p>;
  return <article className="runner-article"><h2>{read.data.title}</h2><p className="runner-dek">{read.data.dek}</p><div className="studio-markdown" dangerouslySetInnerHTML={{ __html: previewHtml(read.body) }} /><section className="studio-sources"><h3>Primary sources</h3>{read.data.sources.map((s) => <p id={`studio-src-${s.id}`} key={s.id}><strong>{s.title}</strong> — {s.author}, {s.year}. {s.url?.startsWith("https://") && <a href={s.url} target="_blank" rel="noopener noreferrer">Read source ↗</a>}<small>{s.note}</small></p>)}</section></article>;
}

function App() {
  const [data, setData] = useState<{ release: Delivery; bundle: PacoteDeHandbook } | null>(null);
  const [error, setError] = useState(""); const [selected, setSelected] = useState("");
  useEffect(() => { load().then((d) => { setData(d); setSelected(d.bundle.articles[0] ? `article:${d.bundle.articles[0].id}` : d.release.labs[0] ? `lab:${d.release.labs[0].id}` : ""); }).catch((e) => setError(e.message)); }, []);
  if (error) return <main className="runner-error"><h1>Handbook could not start</h1><pre role="alert">{error}</pre><p>Use the complete release archive and its matching host. No lab has been mounted.</p></main>;
  if (!data) return <p className="runner-loading" role="status">Opening handbook…</p>;
  const h = data.bundle.handbook, activeFile = data.bundle.articles.find((a) => selected === `article:${a.id}`), lab = data.release.labs.find((l) => selected === `lab:${l.id}`);
  const bank = data.bundle.assessments, final = bank?.assessments.find((a) => a.scope.kind === "handbook"), checkpoint = bank?.assessments.find((a) => a.scope.kind === "lab" && a.scope.lab === lab?.id);
  const Component = lab ? components[lab.id as keyof typeof components] : undefined;
  return <><style>{cssDoTema(h.id, h.tema)}</style><header className="runner-header"><div><small>OPENLABS / INDEPENDENT HANDBOOK</small><h1>{h.name}</h1><p>{h.tagline}</p></div><div><span className="runner-release">Release {data.release.version}</span><button onClick={() => { const root = document.documentElement; root.dataset.theme = root.dataset.theme === "dark" || (!root.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches) ? "light" : "dark"; }}>Toggle theme</button></div></header><div className="runner-layout"><nav aria-label="Handbook curriculum">{h.phases.map((p) => <section key={p.number}><p className="runner-phase">{String(p.number).padStart(2, "0")} · {p.title}</p>{h.articles.filter((a) => a.phase === p.number).map((a) => a.status === "available" ? <button key={a.id} aria-current={selected === `article:${a.id}` ? "page" : undefined} onClick={() => setSelected(`article:${a.id}`)}>¶ {a.title}</button> : <p className="runner-coming" key={a.id}>{a.title} · {a.status}</p>)}{h.labs.filter((l) => l.phase === p.number).map((l) => l.status === "available" ? <button key={l.id} aria-current={selected === `lab:${l.id}` ? "page" : undefined} onClick={() => setSelected(`lab:${l.id}`)}>◈ {l.title}</button> : <p className="runner-coming" key={l.id}>{l.title} · {l.status}</p>)}</section>)}<section><p className="runner-phase">Assessment</p>{final ? <button aria-current={selected === `assessment:${final.id}` ? "page" : undefined} onClick={() => setSelected(`assessment:${final.id}`)}>◎ {final.title}</button> : <p className="runner-coming">The final assessment has not been authored yet.</p>}</section></nav><main id="content">{bank && final && selected === `assessment:${final.id}` ? <AssessmentPlayer bank={bank} assessmentId={final.id} /> : activeFile ? <Article key={activeFile.id} file={activeFile} /> : lab && Component ? <section className="runner-lab"><div className="runner-lab-title"><h2>{lab.title}</h2><p>{lab.interaction.kind} · {lab.interaction.model} · lab {lab.version}{lab.interaction.kind === "flow" && <> · <a href={lab.interaction.structure.source} download>Canonical Mermaid contract ↓</a></>}</p></div><Component key={lab.id} />{bank && checkpoint && <AssessmentPlayer key={checkpoint.id} bank={bank} assessmentId={checkpoint.id} />}</section> : <p>Select an article or a lab from the curriculum.</p>}</main></div><footer className="runner-footer">Content and lab code are pinned by release.json. <a href="LICENSE">Code license</a> · <a href="LICENSE-content">Content license</a></footer></>;
}
createRoot(document.getElementById("root")!).render(<App />);
