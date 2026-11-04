import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  assessmentDigest, AssessmentAnswersSchema, ATTEMPT_API_VERSION, gradeAssessment, readAssessmentAttempt, reviewIsCurrent,
} from "@ovh/handbook-format/contract";
import type { AssessmentAnswer, AssessmentAnswers, AssessmentAttempt, AssessmentQuestion, AssessmentSet } from "@ovh/handbook-format/contract";

interface Props { readonly bank: AssessmentSet; readonly assessmentId: string }
const number = (n: number) => new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(n);
export function downloadAttempt(attempt: AssessmentAttempt) {
  const uri = URL.createObjectURL(new Blob([JSON.stringify(attempt, null, 2) + "\n"], { type: "application/json" }));
  const a = document.createElement("a"); a.href = uri; a.download = `${attempt.assessment}-${attempt.id}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(uri), 1000);
}

function complete(q: AssessmentQuestion, a: AssessmentAnswer | undefined): boolean {
  if (q.type === "matching") return !!a && typeof a === "object" && !Array.isArray(a) && q.items.every((i) => !!a[i.id]);
  return typeof a === "string" ? a.length > 0 : Array.isArray(a) && a.length > 0;
}
function correctText(q: AssessmentQuestion): string {
  if (q.type === "ordering") return q.correct.map((id) => q.items.find((i) => i.id === id)!.text).join(" → ");
  if (q.type === "matching") return q.items.map((i) => `${i.text}: ${q.targets.find((t) => t.id === i.target)!.text}`).join("; ");
  const ids = Array.isArray(q.correct) ? q.correct : [q.correct]; return q.options.filter((o) => ids.includes(o.id)).map((o) => o.text).join("; ");
}

function Question({ question: q, answer, locked, onAnswer, prefix }: { question: AssessmentQuestion; answer: AssessmentAnswer | undefined; locked: boolean; onAnswer: (a: AssessmentAnswer) => void; prefix: string }) {
  const move = (id: string, target: string) => {
    if (q.type !== "ordering" || locked || id === target) return;
    const order = Array.isArray(answer) ? [...answer] : q.items.map((i) => i.id);
    const from = order.indexOf(id), to = order.indexOf(target); if (from < 0 || to < 0) return;
    order.splice(from, 1); order.splice(to, 0, id); onAnswer(order);
  };
  if (q.type === "ordering") {
    const order = Array.isArray(answer) ? answer : q.items.map((i) => i.id);
    return <div className="assessment-order"><p>Drag items into order, or use the Move up/down buttons. {q.scoring === "per-item" ? "Each correct position earns a share of the points." : "The complete order must be correct."}</p><ol>{order.map((id, index) => <li key={id} draggable={!locked} onDragStart={(e) => e.dataTransfer.setData("application/x-openlabs-order", id)} onDragOver={(e) => { if (!locked) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); move(e.dataTransfer.getData("application/x-openlabs-order"), id); }}><span>{q.items.find((i) => i.id === id)!.text}</span><div><button type="button" disabled={locked || index === 0} aria-label={`Move ${q.items.find((i) => i.id === id)!.text} up`} onClick={() => move(id, order[index - 1]!)}>↑</button><button type="button" disabled={locked || index === order.length - 1} aria-label={`Move ${q.items.find((i) => i.id === id)!.text} down`} onClick={() => move(id, order[index + 1]!)}>↓</button></div></li>)}</ol><button type="button" disabled={locked} onClick={() => onAnswer([...order])}>{answer ? "Order recorded" : "Use this order"}</button></div>;
  }
  if (q.type === "matching") {
    const selected = answer && typeof answer === "object" && !Array.isArray(answer) ? answer : {};
    const assign = (id: string, target: string) => { if (locked || !q.items.some((i) => i.id === id)) return; const next = { ...selected }; if (target) next[id] = target; else delete next[id]; onAnswer(next); };
    return <div className="assessment-matching"><p>Drag a responsibility to a target, or choose its target in the list. Targets can be reused. {q.scoring === "per-item" ? "Each correct match earns a share of the points." : "Every match must be correct."}</p><div className="assessment-match-items">{q.items.map((item) => <label key={item.id}><span className="assessment-drag-item" draggable={!locked} onDragStart={(e) => e.dataTransfer.setData("application/x-openlabs-match", item.id)}>{item.text}</span><select aria-label={`Match: ${item.text}`} disabled={locked} value={selected[item.id] ?? ""} onChange={(e) => assign(item.id, e.target.value)}><option value="">Choose a target</option>{q.targets.map((t) => <option key={t.id} value={t.id}>{t.text}</option>)}</select></label>)}</div><div className="assessment-targets">{q.targets.map((target) => <div key={target.id} className="assessment-target" aria-label={`Drop target: ${target.text}`} onDragOver={(e) => { if (!locked) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); assign(e.dataTransfer.getData("application/x-openlabs-match"), target.id); }}><strong>{target.text}</strong><ul>{q.items.filter((i) => selected[i.id] === target.id).map((i) => <li key={i.id}>{i.text}</li>)}</ul></div>)}</div></div>;
  }
  const multi = q.type === "multiple-response";
  return <><p>{multi ? "Select all that apply. Credit requires exactly the correct set." : "Choose one answer."}</p>{q.type === "code-analysis" && <pre className="assessment-code" aria-label={`${q.language} code to analyze`}><code>{q.code}</code></pre>}<fieldset disabled={locked}><legend className="assessment-sr">{q.prompt}</legend>{q.options.map((option) => <label className="assessment-option" key={option.id}><input type={multi ? "checkbox" : "radio"} name={`${prefix}-${q.id}`} value={option.id} checked={multi ? Array.isArray(answer) && answer.includes(option.id) : answer === option.id} onChange={(e) => { if (multi) { const values = Array.isArray(answer) ? answer : []; onAnswer(e.target.checked ? [...values, option.id] : values.filter((id) => id !== option.id)); } else onAnswer(option.id); }} /><span>{option.text}</span></label>)}</fieldset></>;
}

export function AssessmentPlayer(props: Props) {
  const key = useMemo(() => `${assessmentDigest(props.bank)}:${props.assessmentId}`, [props.bank, props.assessmentId]);
  return <AssessmentSession key={key} {...props} />;
}
function AssessmentSession({ bank, assessmentId }: Props) {
  const definition = bank.assessments.find((a) => a.id === assessmentId)!;
  const questions = definition.questions.map((id) => bank.questions.find((q) => q.id === id)!);
  const digest = useMemo(() => assessmentDigest(bank), [bank]);
  const storageKey = `openlabs:assessment:v1:${digest}:${assessmentId}`, prefix = useId();
  const [answers, setAnswers] = useState<AssessmentAnswers>({});
  const [startedAt, setStartedAt] = useState("");
  const [attempts, setAttempts] = useState<AssessmentAttempt[]>([]);
  const [submitted, setSubmitted] = useState<AssessmentAttempt | null>(null);
  const [hydrated, setHydrated] = useState(false), [canSave, setCanSave] = useState(true);
  const [notice, setNotice] = useState(""), [confirm, setConfirm] = useState(false);
  const resultRef = useRef<HTMLElement>(null);
  useEffect(() => { if (submitted) resultRef.current?.focus(); }, [submitted?.id]);
  useEffect(() => {
    setStartedAt(new Date().toISOString());
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const data = JSON.parse(saved);
        if (data?.storageVersion !== 1 || !Array.isArray(data.attempts) || data.attempts.length > 20) throw new Error("Unrecognized saved assessment.");
        const previous = data.attempts.map((a: unknown) => readAssessmentAttempt(a, bank).attempt);
        if (previous.some((a: AssessmentAttempt) => a.assessment !== assessmentId)) throw new Error("Saved assessment has a different scope.");
        setAttempts(previous);
        if (data.draft !== null) {
          if (!data.draft || typeof data.draft.startedAt !== "string" || Number.isNaN(Date.parse(data.draft.startedAt)) || !data.draft.answers || typeof data.draft.answers !== "object") throw new Error("Invalid saved draft.");
          const restored = AssessmentAnswersSchema.parse(data.draft.answers);
          gradeAssessment(bank, assessmentId, restored); setAnswers(restored); setStartedAt(data.draft.startedAt);
        } else if (previous.length) { setSubmitted(previous.at(-1)!); setAnswers(previous.at(-1)!.answers); }
      }
    } catch { setCanSave(false); setNotice("Browser progress could not be restored. You can answer and download your report; the existing saved data will be kept."); }
    setHydrated(true);
  }, [storageKey]);
  useEffect(() => {
    if (!hydrated || !canSave) return;
    try { localStorage.setItem(storageKey, JSON.stringify({ storageVersion: 1, attempts, draft: submitted ? null : { startedAt, answers } })); }
    catch { setCanSave(false); setNotice("Browser storage is unavailable. Download the report after submitting to keep your result."); }
  }, [answers, attempts, submitted, hydrated, canSave, startedAt, storageKey]);
  const result = submitted ? gradeAssessment(bank, assessmentId, submitted.answers) : null;
  const missing = questions.filter((q) => !complete(q, answers[q.id])).length;
  const unreviewed = questions.filter((q) => !reviewIsCurrent(q, bank)).length;
  const submit = () => {
    if (missing > 0 && !confirm) { setConfirm(true); return; }
    const attempt: AssessmentAttempt = { apiVersion: ATTEMPT_API_VERSION, id: crypto.randomUUID(), bank: { id: bank.id, version: bank.version, digest }, assessment: assessmentId, startedAt, submittedAt: new Date().toISOString(), answers: structuredClone(answers) };
    readAssessmentAttempt(attempt, bank); setAttempts((list) => [...list, attempt].slice(-20)); setSubmitted(attempt); setConfirm(false);
  };
  return <section className="assessment" aria-label={definition.title} data-testid="assessment-player" data-hydrated={hydrated}>
    <header className="assessment-head"><p className="assessment-eyebrow">{definition.scope.kind === "lab" ? "END-OF-LAB CHECKPOINT" : "HANDBOOK ASSESSMENT"} · BANK {bank.version}</p><h2>{definition.title}</h2><p>{definition.description}</p><p>{questions.length} questions · {questions.reduce((n, q) => n + q.points, 0)} points · target {definition.passPercentage}%</p>{unreviewed > 0 && <p className="assessment-review-note">Practice bank · educator review pending for {unreviewed} question{unreviewed === 1 ? "" : "s"}.</p>}</header>
    {notice && <p role="status" className="assessment-notice">{notice}</p>}
    {result && <section ref={resultRef} className="assessment-result" aria-label="Assessment result" tabIndex={-1}><p className="assessment-eyebrow">SUBMITTED · {result.passed ? "TARGET REACHED" : "KEEP PRACTICING"}</p><h3>Grade {number(result.grade)} / 10</h3><p>{number(result.earned)} / {number(result.possible)} points · {number(result.percentage)}% achievement</p><p>{result.rows.filter((r) => r.outcome === "correct").length} correct · {result.rows.filter((r) => r.outcome === "partial").length} partial · {result.rows.filter((r) => r.outcome === "incorrect").length} incorrect · {result.rows.filter((r) => r.outcome === "unanswered").length} unanswered</p><ul className="assessment-objectives">{result.objectives.map((o) => <li key={o.id}><span>{o.title}</span><strong>{number(o.earned / o.possible * 100)}%</strong><meter min={0} max={o.possible} value={o.earned} aria-label={o.title} /></li>)}</ul><div className="assessment-actions"><button type="button" onClick={() => downloadAttempt(submitted!)}>Download attempt report</button><button type="button" onClick={() => { setSubmitted(null); setAnswers({}); setStartedAt(new Date().toISOString()); setConfirm(false); }}>Start a new attempt</button></div><p>Read each resolution below, then revisit the suggested experiment. A new attempt keeps the previous result in this browser's history.</p></section>}
    <form onSubmit={(e) => { e.preventDefault(); submit(); }}><div className="assessment-questions">{questions.map((q, index) => <article className="assessment-question" key={q.id} data-question-id={q.id}><div className="assessment-question-meta"><span>QUESTION {index + 1} · {q.type}</span><span>{q.points} point{q.points === 1 ? "" : "s"}</span></div><h3>{q.prompt}</h3><Question question={q} answer={answers[q.id]} locked={submitted !== null} prefix={prefix} onAnswer={(a) => { setAnswers((v) => ({ ...v, [q.id]: a })); setConfirm(false); }} />{result && <section className="assessment-resolution" aria-label={`Resolution: ${q.id}`}><p className="assessment-outcome">{result.rows[index]!.outcome} · {number(result.rows[index]!.earned)} / {q.points} points</p><h4>Why this answer</h4><p><strong>Correct answer: </strong>{correctText(q)}</p><p>{q.explanation}</p>{"options" in q && <ul>{q.options.map((o) => <li key={o.id}><strong>{o.text}</strong><p>{o.explanation}</p></li>)}</ul>}{q.type === "matching" && <ul>{q.items.map((i) => <li key={i.id}>{i.explanation}</li>)}</ul>}<p><strong>Try next: </strong>{q.remediation}</p><ul className="assessment-source-list">{q.sourceIds.map((id) => { const s = bank.sources.find((s) => s.id === id)!; return <li key={id}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title} ↗</a> · <a href={s.license.url} target="_blank" rel="noopener noreferrer">{s.license.id}</a></li>; })}</ul><p className="assessment-attribution">Question: {q.provenance.kind} · {q.provenance.author} · <a href={q.provenance.license.url} target="_blank" rel="noopener noreferrer">{q.provenance.license.id}</a>{q.provenance.kind !== "original" && <> · <a href={q.provenance.url} target="_blank" rel="noopener noreferrer">{q.provenance.bank} / {q.provenance.item}</a> · {q.provenance.attribution}</>}</p></section>}</article>)}</div>{!submitted && <footer className="assessment-submit"><p role="status">{questions.length - missing} / {questions.length} questions completed. Missing responses earn zero; partial matching follows the stated scoring rule.</p>{confirm && <p className="assessment-notice">{missing} question{missing === 1 ? " is" : "s are"} incomplete. You can go back and finish them, or submit the current answers.</p>}<button type="submit" disabled={!hydrated}>{confirm ? `Submit with ${missing} incomplete` : "Submit assessment"}</button>{confirm && <button type="button" onClick={() => setConfirm(false)}>Keep answering</button>}<p>Answers stay editable until submission. Explanations appear afterwards.</p></footer>}</form>
    {attempts.length > 0 && <details className="assessment-history"><summary>Attempt history · {attempts.length} saved locally</summary><p>The latest 20 attempts for this bank version are retained in this browser.</p><ol>{attempts.map((attempt) => { const score = gradeAssessment(bank, assessmentId, attempt.answers); return <li key={attempt.id}><time dateTime={attempt.submittedAt}>{new Date(attempt.submittedAt).toLocaleString("en")}</time> · {number(score.grade)} / 10 <button type="button" onClick={() => downloadAttempt(attempt)}>Download saved attempt</button></li>; })}</ol></details>}
  </section>;
}
