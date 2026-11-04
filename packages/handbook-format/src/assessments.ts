import { z } from "zod";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { IdSchema } from "./schema.js";
import { VersionSchema } from "./version.js";
import type { HandbookNormalizado } from "./versoes.js";

export const ASSESSMENT_API_VERSION = "openlabs/assessment-set/v1";
export const ATTEMPT_API_VERSION = "openlabs/assessment-attempt/v1";
const Text = z.string().trim().min(1);
const Https = z.string().url().refine((s) => s.startsWith("https://"), "Use an HTTPS source URL");
const Digest = z.string().regex(/^[a-f0-9]{64}$/u);
const License = z.object({ id: Text, url: Https }).strict();
const Provenance = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("original"), author: Text, license: License }).strict(),
  z.object({ kind: z.enum(["adapted", "reproduced"]), author: Text, bank: Text, item: Text, url: Https, license: License, attribution: Text }).strict(),
]);
export const QuestionReviewSchema = z.object({
  status: z.enum(["draft", "in-review", "changes-requested", "approved"]),
  reviewer: Text.optional(), reviewedAt: z.string().datetime().optional(), contentDigest: Digest.optional(), notes: z.string().default(""),
}).strict().superRefine((r, c) => {
  if (r.status === "approved" && (!r.reviewer || !r.reviewedAt || !r.contentDigest)) c.addIssue({ code: "custom", message: "Approval requires reviewer, date and the exact content digest" });
});
const common = {
  id: IdSchema, revision: z.number().int().positive(), prompt: Text,
  objective: IdSchema, points: z.number().int().positive().max(100),
  explanation: Text, sourceIds: z.array(IdSchema).min(1), provenance: Provenance,
  review: QuestionReviewSchema,
  remediation: Text,
};
const Option = z.object({ id: IdSchema, text: Text, explanation: Text }).strict();
const choice = { options: z.array(Option).min(2), correct: IdSchema };
export const QuestionSchema = z.discriminatedUnion("type", [
  z.object({ ...common, type: z.literal("single-choice"), ...choice }).strict(),
  z.object({ ...common, type: z.literal("multiple-response"), options: z.array(Option).min(2), correct: z.array(IdSchema).min(1) }).strict(),
  z.object({ ...common, type: z.literal("code-analysis"), ...choice, language: Text, code: Text }).strict(),
  z.object({ ...common, type: z.literal("ordering"), items: z.array(z.object({ id: IdSchema, text: Text }).strict()).min(2), correct: z.array(IdSchema).min(2), scoring: z.enum(["exact", "per-item"]) }).strict(),
  z.object({ ...common, type: z.literal("matching"), items: z.array(z.object({ id: IdSchema, text: Text, target: IdSchema, explanation: Text }).strict()).min(2), targets: z.array(z.object({ id: IdSchema, text: Text }).strict()).min(2), scoring: z.enum(["exact", "per-item"]) }).strict(),
]);
export type AssessmentQuestion = z.infer<typeof QuestionSchema>;
export const AssessmentSchema = z.object({
  id: IdSchema, title: Text, description: Text,
  scope: z.discriminatedUnion("kind", [z.object({ kind: z.literal("lab"), lab: IdSchema }).strict(), z.object({ kind: z.literal("handbook") }).strict()]),
  questions: z.array(IdSchema).min(1), passPercentage: z.number().int().min(0).max(100),
}).strict();
export type AssessmentDefinition = z.infer<typeof AssessmentSchema>;
export const AssessmentSetSchema = z.object({
  apiVersion: z.literal(ASSESSMENT_API_VERSION), id: IdSchema, version: VersionSchema, handbook: IdSchema,
  title: Text, objectives: z.array(z.object({ id: IdSchema, title: Text }).strict()).min(1),
  sources: z.array(z.object({ id: IdSchema, title: Text, url: Https, license: License }).strict()).min(1),
  questions: z.array(QuestionSchema).min(1), assessments: z.array(AssessmentSchema).min(1),
}).strict();
export type AssessmentSet = z.infer<typeof AssessmentSetSchema>;

/** Stable key ordering makes review independent of JSON formatting and key order. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b, "en")).map(([key, v]) => `${JSON.stringify(key)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
export function assessmentDigest(value: unknown): string { return bytesToHex(sha256(new TextEncoder().encode(canonical(value)))); }
export function questionDigest(question: AssessmentQuestion, bank: Pick<AssessmentSet, "sources" | "objectives">): string {
  const { review: _review, ...content } = question;
  return assessmentDigest({ question: content, sources: bank.sources.filter((s) => question.sourceIds.includes(s.id)), objective: bank.objectives.find((o) => o.id === question.objective) ?? null });
}
export function reviewIsCurrent(question: AssessmentQuestion, bank: Pick<AssessmentSet, "sources" | "objectives">): boolean { return question.review.status === "approved" && question.review.contentDigest === questionDigest(question, bank); }

export function validateAssessments(bank: AssessmentSet, handbook?: Pick<HandbookNormalizado, "id" | "labs">): string[] {
  const errors: string[] = [];
  const duplicate = (ids: string[], where: string) => { if (new Set(ids).size !== ids.length) errors.push(`Duplicate ${where}.`); };
  duplicate(bank.objectives.map((o) => o.id), "objective id"); duplicate(bank.sources.map((s) => s.id), "source id"); duplicate(bank.questions.map((q) => q.id), "question id"); duplicate(bank.assessments.map((a) => a.id), "assessment id");
  if (handbook && bank.handbook !== handbook.id) errors.push("Assessment bank belongs to a different handbook.");
  for (const q of bank.questions) {
    if (!bank.objectives.some((o) => o.id === q.objective)) errors.push(`${q.id}: unknown learning objective.`);
    duplicate(q.sourceIds, `${q.id} source reference`);
    for (const id of q.sourceIds) if (!bank.sources.some((s) => s.id === id)) errors.push(`${q.id}: unknown source ${id}.`);
    if (q.type === "single-choice" || q.type === "multiple-response" || q.type === "code-analysis") {
      duplicate(q.options.map((o) => o.id), `${q.id} option id`);
      const answers = Array.isArray(q.correct) ? q.correct : [q.correct]; duplicate(answers, `${q.id} correct answer`);
      if (answers.some((id) => !q.options.some((o) => o.id === id))) errors.push(`${q.id}: correct answer is not an option.`);
    }
    if (q.type === "ordering") {
      duplicate(q.items.map((i) => i.id), `${q.id} item id`); duplicate(q.correct, `${q.id} order id`);
      if (q.correct.length !== q.items.length || q.correct.some((id) => !q.items.some((i) => i.id === id))) errors.push(`${q.id}: correct order must contain every item exactly once.`);
    }
    if (q.type === "matching") {
      duplicate(q.items.map((i) => i.id), `${q.id} item id`); duplicate(q.targets.map((t) => t.id), `${q.id} target id`);
      if (q.items.some((i) => !q.targets.some((t) => t.id === i.target))) errors.push(`${q.id}: unknown matching target.`);
    }
    if (q.review.status === "approved" && !reviewIsCurrent(q, bank)) errors.push(`${q.id}: approval is stale; content changed after review.`);
  }
  if (bank.assessments.filter((a) => a.scope.kind === "handbook").length !== 1) errors.push("A bank needs exactly one final handbook assessment.");
  const final = bank.assessments.find((a) => a.scope.kind === "handbook");
  if (final) for (const objective of bank.objectives) {
    if (!final.questions.some((id) => bank.questions.some((q) => q.id === id && q.objective === objective.id))) errors.push(`${final.id}: missing final coverage for objective ${objective.id}.`);
  }
  if (handbook) for (const lab of handbook.labs.filter((l) => l.status === "available")) {
    if (!bank.assessments.some((a) => a.scope.kind === "lab" && a.scope.lab === lab.id)) errors.push(`Missing end-of-lab assessment: ${lab.id}.`);
  }
  const scopes = bank.assessments.filter((a) => a.scope.kind === "lab").map((a) => a.scope.kind === "lab" ? a.scope.lab : ""); duplicate(scopes, "lab assessment scope");
  for (const a of bank.assessments) {
    duplicate(a.questions, `${a.id} question reference`);
    for (const id of a.questions) if (!bank.questions.some((q) => q.id === id)) errors.push(`${a.id}: unknown question ${id}.`);
    if (handbook && a.scope.kind === "lab") {
      const labId = a.scope.lab;
      if (!handbook.labs.some((l) => l.id === labId && l.status === "available")) errors.push(`${a.id}: lab ${labId} is not available in this handbook.`);
    }
  }
  return errors;
}
export function readAssessments(doc: unknown, handbook?: Pick<HandbookNormalizado, "id" | "labs">): AssessmentSet {
  const bank = AssessmentSetSchema.parse(doc), errors = validateAssessments(bank, handbook);
  if (errors.length) throw new Error(errors.join("\n"));
  return bank;
}

export const AnswerSchema = z.union([z.string(), z.array(z.string()), z.record(z.string())]);
export type AssessmentAnswer = z.infer<typeof AnswerSchema>;
export const AssessmentAnswersSchema = z.record(AnswerSchema);
export type AssessmentAnswers = Record<string, AssessmentAnswer>;
export const AssessmentAttemptSchema = z.object({
  apiVersion: z.literal(ATTEMPT_API_VERSION), id: z.string().uuid(),
  bank: z.object({ id: IdSchema, version: VersionSchema, digest: Digest }).strict(),
  assessment: IdSchema, startedAt: z.string().datetime(), submittedAt: z.string().datetime(),
  answers: AssessmentAnswersSchema,
}).strict();
export type AssessmentAttempt = z.infer<typeof AssessmentAttemptSchema>;

function fraction(q: AssessmentQuestion, answer: AssessmentAnswer | undefined): number {
  if (answer === undefined || answer === "" || (Array.isArray(answer) && !answer.length)) return 0;
  if (q.type === "single-choice" || q.type === "code-analysis") {
    if (typeof answer !== "string" || !q.options.some((o) => o.id === answer)) throw new Error(`${q.id}: invalid option answer.`);
    return answer === q.correct ? 1 : 0;
  }
  if (q.type === "multiple-response") {
    if (!Array.isArray(answer) || new Set(answer).size !== answer.length || answer.some((id) => !q.options.some((o) => o.id === id))) throw new Error(`${q.id}: invalid multiple response.`);
    return answer.length === q.correct.length && answer.every((id) => q.correct.includes(id)) ? 1 : 0;
  }
  if (q.type === "ordering") {
    if (!Array.isArray(answer) || answer.length !== q.items.length || new Set(answer).size !== answer.length || answer.some((id) => !q.items.some((i) => i.id === id))) throw new Error(`${q.id}: invalid ordering answer.`);
    const correct = answer.filter((id, index) => id === q.correct[index]).length;
    return q.scoring === "exact" ? Number(correct === q.items.length) : correct / q.items.length;
  }
  if (typeof answer !== "object" || Array.isArray(answer) || Object.keys(answer).some((id) => !q.items.some((i) => i.id === id)) || Object.values(answer).some((id) => !q.targets.some((t) => t.id === id))) throw new Error(`${q.id}: invalid matching answer.`);
  const correct = q.items.filter((i) => answer[i.id] === i.target).length;
  return q.scoring === "exact" ? Number(correct === q.items.length) : correct / q.items.length;
}
export function gradeAssessment(bank: AssessmentSet, assessmentId: string, answers: AssessmentAnswers) {
  const a = bank.assessments.find((a) => a.id === assessmentId); if (!a) throw new Error("Unknown assessment.");
  if (Object.keys(answers).some((id) => !a.questions.includes(id))) throw new Error("Answer belongs to a different assessment.");
  const rows = a.questions.map((id) => {
    const q = bank.questions.find((q) => q.id === id)!; const value = fraction(q, answers[id]);
    const answer = answers[id];
    const answered = answer !== undefined && answer !== "" && (typeof answer === "string" || (Array.isArray(answer) ? answer.length > 0 : Object.keys(answer).length > 0));
    return { id, objective: q.objective, earned: value * q.points, possible: q.points, outcome: !answered ? "unanswered" : value === 1 ? "correct" : value > 0 ? "partial" : "incorrect" } as const;
  });
  const earned = rows.reduce((n, r) => n + r.earned, 0), possible = rows.reduce((n, r) => n + r.possible, 0);
  const percentage = earned / possible * 100;
  return { assessment: a.id, earned, possible, percentage, grade: percentage / 10, passed: percentage >= a.passPercentage, rows,
    objectives: bank.objectives.filter((o) => rows.some((r) => r.objective === o.id)).map((o) => ({ ...o, earned: rows.filter((r) => r.objective === o.id).reduce((n, r) => n + r.earned, 0), possible: rows.filter((r) => r.objective === o.id).reduce((n, r) => n + r.possible, 0) })),
  };
}
export function readAssessmentAttempt(doc: unknown, bank: AssessmentSet) {
  const attempt = AssessmentAttemptSchema.parse(doc);
  if (attempt.bank.id !== bank.id || attempt.bank.version !== bank.version || attempt.bank.digest !== assessmentDigest(bank)) throw new Error("Attempt requires its original bank version and content.");
  if (Date.parse(attempt.submittedAt) < Date.parse(attempt.startedAt)) throw new Error("Attempt was submitted before it started.");
  return { attempt, result: gradeAssessment(bank, attempt.assessment, attempt.answers) };
}
