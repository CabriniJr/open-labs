import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assessmentDigest, ATTEMPT_API_VERSION, gradeAssessment, questionDigest, readAssessmentAttempt, readAssessments, reviewIsCurrent } from "./assessments.js";
import type { AssessmentAnswers, AssessmentAttempt, AssessmentSet } from "./assessments.js";
import { criarPacote, lerPacote } from "./bundle.js";

const raw = JSON.parse(readFileSync(new URL("./conformance/assessment-set-v1.json", import.meta.url), "utf8"));
const original = JSON.parse(readFileSync(new URL("./conformance/bundle-v1.json", import.meta.url), "utf8"));
const bank = readAssessments(raw, original.handbook);
const answers = (): AssessmentAnswers => Object.fromEntries(bank.questions.map((q) => [q.id, q.type === "matching" ? Object.fromEntries(q.items.map((i) => [i.id, i.target])) : q.correct]));
const attempt = (set = bank): AssessmentAttempt => ({ apiVersion: ATTEMPT_API_VERSION, id: "19a5523f-fc21-4e77-a7ab-84d56880d04e", bank: { id: set.id, version: set.version, digest: assessmentDigest(set) }, assessment: "kubernetes-final", startedAt: "2026-10-19T12:00:00.000Z", submittedAt: "2026-10-19T12:01:00.000Z", answers: answers() });

describe("avaliações independentes do motor de fluxos", () => {
  it("corrige as cinco interações e relata pontos, nota e objetivos", () => {
    expect(new Set(bank.questions.map((q) => q.type)).size).toBe(5);
    const result = gradeAssessment(bank, "kubernetes-final", answers());
    expect(result).toMatchObject({ earned: 14, possible: 14, percentage: 100, grade: 10, passed: true });
    expect(result.objectives).toHaveLength(4);
    expect(result.rows.every((r) => r.outcome === "correct")).toBe(true);
  });
  it("não responder vale zero e selecionar tudo não ganha crédito parcial", () => {
    expect(gradeAssessment(bank, "kubernetes-final", {}).rows.every((r) => r.outcome === "unanswered")).toBe(true);
    const a = answers(); a["requests-and-limits"] = ["requests-place", "memory-kill", "limits-scale", "requests-usage"];
    expect(gradeAssessment(bank, "kubernetes-final", a).rows.find((r) => r.id === "requests-and-limits")).toMatchObject({ earned: 0, outcome: "incorrect" });
  });
  it("crédito por posição e associação é explícito, incluindo resposta incompleta", () => {
    const a = answers(); a["startup-sequence"] = ["created", "scheduled", "ready", "started"]; a["who-does-what"] = { create: "controller" };
    const result = gradeAssessment(bank, "kubernetes-final", a);
    expect(result.rows.find((r) => r.id === "startup-sequence")).toMatchObject({ earned: 1, possible: 2, outcome: "partial" });
    expect(result.rows.find((r) => r.id === "who-does-what")).toMatchObject({ earned: 1, possible: 3, outcome: "partial" });
    const exact = structuredClone(bank); for (const q of exact.questions) if (q.type === "matching" || q.type === "ordering") q.scoring = "exact";
    expect(gradeAssessment(exact, "kubernetes-final", a).rows.filter((r) => ["startup-sequence", "who-does-what"].includes(r.id)).every((r) => r.earned === 0)).toBe(true);
  });
  it("a decisão do limiar não arredonda a porcentagem", () => {
    const b = structuredClone(bank); b.assessments[1]!.questions = ["who-does-what"]; b.assessments[1]!.passPercentage = 67;
    const result = gradeAssessment(b, "kubernetes-final", { "who-does-what": { create: "controller", bind: "scheduler" } });
    expect(result.percentage).toBeCloseTo(66.666666); expect(result.passed).toBe(false);
  });
  it("recusa respostas forjadas, duplicadas, estranhas ou de outra avaliação", () => {
    for (const invalid of [ { "restart-identity": "not-an-option" }, { "requests-and-limits": ["requests-place", "requests-place"] }, { "startup-sequence": ["created", "created", "created", "created"] }, { "who-does-what": { create: "unknown" } }, { invented: "anything" } ]) expect(() => gradeAssessment(bank, "kubernetes-final", invalid)).toThrow();
    expect(() => gradeAssessment(bank, "pod-lifecycle-checkpoint", { "memory-pressure": "oom" })).toThrow(/different assessment/u);
  });
  it("valida referências, cobertura por lab, final único e licenças de bancos externos", () => {
    const change = (edit: (b: any) => void) => { const b = structuredClone(raw); edit(b); return () => readAssessments(b, original.handbook); };
    expect(change((b) => { b.questions[0].sourceIds = ["invented"]; })).toThrow(/unknown source/u);
    expect(change((b) => { b.questions[0].correct = "unknown"; })).toThrow(/not an option/u);
    expect(change((b) => { b.questions[2].correct = ["created", "created"]; })).toThrow(/order/u);
    expect(change((b) => { b.assessments = [b.assessments[1]]; })).toThrow(/Missing end-of-lab/u);
    expect(change((b) => { b.assessments = [b.assessments[0]]; })).toThrow(/exactly one final/u);
    expect(change((b) => { b.questions[0].provenance = { kind: "adapted", author: "Someone" }; })).toThrow();
  });
  it("revisão vincula a pergunta, objetivo e fontes e fica obsoleta quando mudam", () => {
    const b = structuredClone(bank), q = b.questions[0]!;
    q.review = { status: "approved", reviewer: "Educator fixture", reviewedAt: "2026-10-19T12:00:00.000Z", contentDigest: questionDigest(q, b), notes: "Reviewed all distractors and sources." };
    expect(reviewIsCurrent(q, b)).toBe(true); expect(readAssessments(b)).toEqual(b);
    q.points = 2; expect(() => readAssessments(b)).toThrow(/stale/u); q.points = 1;
    b.sources[0]!.url += "#different"; expect(() => readAssessments(b)).toThrow(/stale/u);
    const ordered = Object.fromEntries(Object.entries(bank).reverse()); expect(assessmentDigest(ordered)).toBe(assessmentDigest(bank));
  });
  it("recalcula o relatório e recusa revisão/versão diferente do banco original", () => {
    expect(readAssessmentAttempt(attempt(), bank).result.grade).toBe(10);
    expect(() => readAssessmentAttempt(attempt(), { ...bank, version: "0.2.0" })).toThrow(/original bank/u);
    const changed = structuredClone(bank); changed.questions[0]!.points = 2;
    expect(() => readAssessmentAttempt(attempt(), changed)).toThrow(/original bank/u);
    expect(() => readAssessmentAttempt({ ...attempt(), submittedAt: "2026-10-19T11:00:00.000Z" }, bank)).toThrow(/before/u);
  });
  it("mantém o v1 congelado e só emite v2 quando há avaliações", () => {
    expect(lerPacote(original)).toEqual({ ok: true, value: original });
    const v2 = criarPacote(original.handbook, original.articles, original.exportedAt, bank);
    expect(v2.bundleVersion).toBe("openlabs/bundle/v2"); expect(lerPacote(v2)).toEqual({ ok: true, value: v2 });
    expect(lerPacote({ ...original, assessments: bank }).ok).toBe(false);
    expect(lerPacote({ ...v2, assessments: undefined }).ok).toBe(false);
    const frozen = JSON.parse(readFileSync(new URL("./conformance/bundle-v2.json", import.meta.url), "utf8"));
    expect(lerPacote(frozen)).toEqual({ ok: true, value: frozen });
  });
});
