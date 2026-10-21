import { useEffect, useMemo, useRef, useState } from "react";
import { assessmentDigest, AssessmentSetSchema, questionDigest, readAssessmentAttempt, reviewIsCurrent } from "@ovh/handbook-format/contract";
import type { AssessmentSet } from "@ovh/handbook-format/contract";

interface Props { source: string | undefined; handbookId: string; labs: readonly { id: string; status: string }[]; onChange: (source: string) => void; onEditSource: () => void; onPreview: () => void; onRemove: () => void }
const checks = ["Correct answer and scientific accuracy", "Distractors and explanations teach the reason", "Learning objective, wording and accessibility", "Sources, attribution and reuse permission"];

export function AssessmentEditor({ source, handbookId, labs, onChange, onEditSource, onPreview, onRemove }: Props) {
  const parsed = useMemo(() => { try { return AssessmentSetSchema.safeParse(JSON.parse(source ?? "null")); } catch { return null; } }, [source]);
  const bank = parsed?.success ? parsed.data : undefined;
  const [selected, setSelected] = useState("");
  const question = bank?.questions.find((q) => q.id === selected) ?? bank?.questions[0];
  const [educator, setEducator] = useState(""), [notes, setNotes] = useState("");
  const [checked, setChecked] = useState<boolean[]>(checks.map(() => false));
  const [message, setMessage] = useState("");
  const [report, setReport] = useState<ReturnType<typeof readAssessmentAttempt> | null>(null);
  const digest = question && bank ? questionDigest(question, bank) : "";
  useEffect(() => { setChecked(checks.map(() => false)); }, [digest]);
  const importInput = useRef<HTMLInputElement>(null), reportInput = useRef<HTMLInputElement>(null);
  const choose = (id: string) => { setSelected(id); setChecked(checks.map(() => false)); setNotes(""); setMessage(""); };
  const update = (status: "approved" | "changes-requested" | "in-review") => {
    if (!bank || !question) return;
    if (!educator.trim()) { setMessage("Enter the educator name for this review record."); return; }
    if (status === "approved" && !checked.every(Boolean)) return;
    const review = { status, reviewer: educator.trim(), reviewedAt: new Date().toISOString(), contentDigest: questionDigest(question, bank), notes: notes.trim() };
    const next: AssessmentSet = { ...bank, questions: bank.questions.map((q) => q.id === question.id ? { ...q, review } : q) };
    onChange(JSON.stringify(next, null, 2) + "\n"); setChecked(checks.map(() => false));
    setMessage(`Recorded ${status} for ${question.id}. Advance the bank version before publishing changed content.`);
  };
  const open = async (file: File | undefined, kind: "bank" | "report") => {
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error("Keep the file below 2 MB.");
      const text = await file.text();
      if (kind === "bank") { onChange(text); setReport(null); choose(""); setMessage("Opened the assessment source. Inspect its diagnostics and reuse permissions before exporting."); }
      else {
        setReport(null);
        if (!bank) throw new Error("Open the original bank first.");
        setReport(readAssessmentAttempt(JSON.parse(text), bank)); setMessage("Recomputed the result from the original bank and submitted answers.");
      }
    } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
  };
  const create = () => {
    const scopes = labs.filter((l) => l.status === "available").map((lab) => ({ id: `${lab.id}-checkpoint`, title: `${lab.id} checkpoint`, description: "Describe the learning goal of this checkpoint.", scope: { kind: "lab", lab: lab.id }, questions: [], passPercentage: 70 }));
    onChange(JSON.stringify({ apiVersion: "openlabs/assessment-set/v1", id: `${handbookId}-concepts`, version: "0.1.0", handbook: handbookId, title: "Concept assessments", objectives: [], sources: [], questions: [], assessments: [...scopes, { id: `${handbookId}-final`, title: "Handbook assessment", description: "Describe which authored objectives the final assessment covers.", scope: { kind: "handbook" }, questions: [], passPercentage: 70 }] }, null, 2) + "\n");
    onEditSource(); setMessage("Created an unfinished assessment source. Add objectives, primary sources and reviewed questions; source download remains available while it is invalid.");
  };
  return <section className="studio-assessment-editor" aria-label="Assessment authoring and educator review"><header><p className="studio-eyebrow">ASSESS · EXPLAIN · IMPROVE</p><h2>Turn the experiment into understanding.</h2><p>Author checkpoints and a final handbook assessment in one portable question bank. Learners receive their grade, objective breakdown and resolutions after submission.</p><div className="studio-actions"><button onClick={() => importInput.current?.click()}>Import question bank</button>{source === undefined ? <button onClick={create}>Create assessment source</button> : <button onClick={onEditSource}>Edit assessments.json</button>}<button disabled={!bank} onClick={onPreview}>Preview assessment</button><button disabled={!bank} onClick={() => reportInput.current?.click()}>Open attempt report</button>{source !== undefined && <button onClick={onRemove}>Remove assessment source</button>}</div><input ref={importInput} type="file" accept=".json,application/json" className="studio-hidden-file" aria-label="Import question bank file" onChange={(e) => { void open(e.target.files?.[0], "bank"); e.target.value = ""; }} /><input ref={reportInput} type="file" accept=".json,application/json" className="studio-hidden-file" aria-label="Open attempt report file" onChange={(e) => { void open(e.target.files?.[0], "report"); e.target.value = ""; }} /></header>
    {source !== undefined && !bank && <p>Complete the assessment source structure to enable educator review. The source editor and diagnostics identify what needs attention.</p>}
    {bank && question && <div className="studio-review-layout"><div><p className="studio-eyebrow">EDUCATOR REVIEW · {bank.questions.filter((q) => reviewIsCurrent(q, bank)).length} / {bank.questions.length} APPROVED</p><label>Question to review<select value={question.id} onChange={(e) => choose(e.target.value)}>{bank.questions.map((q) => <option key={q.id} value={q.id}>{q.id} · {reviewIsCurrent(q, bank) ? "approved" : q.review.status === "approved" ? "stale approval" : q.review.status}</option>)}</select></label><h3>{question.prompt}</h3><p>{question.type} · {question.points}{question.points === 1 ? " point" : " points"} · objective {question.objective} · revision {question.revision}</p>{"code" in question && <pre><code>{question.code}</code></pre>}<details><summary>Inspect key, distractors, resolution and provenance</summary><pre>{JSON.stringify({ ...question, contentDigest: questionDigest(question, bank), referencedSources: bank.sources.filter((s) => question.sourceIds.includes(s.id)) }, null, 2)}</pre></details><p><strong>Current review: </strong>{question.review.status}{question.review.reviewer ? ` · ${question.review.reviewer}` : ""}{question.review.reviewedAt ? ` · ${question.review.reviewedAt}` : ""}</p>{question.review.notes && <p>{question.review.notes}</p>}</div><div><label>Educator name<input value={educator} onChange={(e) => setEducator(e.target.value)} autoComplete="name" /></label><label>Review notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Record ambiguities, source checks and suggested improvements." /></label><fieldset><legend>Review checklist</legend>{checks.map((check, i) => <label className="studio-review-check" key={check}><input type="checkbox" checked={checked[i]} onChange={(e) => setChecked((old) => old.map((v, j) => i === j ? e.target.checked : v))} />{check}</label>)}</fieldset><div className="studio-actions"><button className="studio-primary" disabled={!educator.trim() || !checked.every(Boolean)} onClick={() => update("approved")}>Approve this question</button><button disabled={!educator.trim() || !notes.trim()} onClick={() => update("changes-requested")}>Request changes</button><button disabled={!educator.trim()} onClick={() => update("in-review")}>Send for review</button></div><p>Review records name the supplied educator and pin the question, sources and objective. This local Studio does not authenticate the reviewer. Content changes require a fresh review.</p></div></div>}
    {report && bank && report.attempt.bank.digest === assessmentDigest(bank) && <section className="studio-attempt-review" aria-label="Recomputed attempt result"><h3>Practice report · {report.result.grade.toFixed(2)} / 10</h3><p>{report.attempt.assessment} · bank {report.attempt.bank.version} · {report.result.percentage.toFixed(1)}% achievement</p><p>Calculated from submitted answers; the file supplies no trusted student identity.</p><ul>{report.result.rows.map((row) => <li key={row.id}>{row.id}: {row.outcome} · {row.earned.toFixed(2)} / {row.possible}</li>)}</ul></section>}
    {message && <p role="status" className="studio-assessment-message">{message}</p>}
  </section>;
}
