# Interactive assessments

An assessment turns a completed experiment into a test of understanding. Each
authored lab has a checkpoint, and each handbook has one cumulative assessment.
Both share a portable bank, deterministic scoring and educator review records.
The Kubernetes handbook is the first complete example: three checkpoint
questions and seven final questions covering the currently available material.
Other handbooks explicitly show that their assessments have not been authored.

Existing predictions and native-code exercises remain part of the lab. They
give immediate feedback during an experiment. An assessment lets learners edit
their answers, submit them together, then inspect the complete resolutions.

## The learner experience

1. Finish the experiment and answer its checkpoint.
2. Use the final assessment at the end of the handbook to revisit objectives
   across the available material.
3. Submit the answers. An incomplete submission requires a second explicit
   action; blank answers earn zero and incomplete matching follows its rubric.
4. Read points, achievement percentage, a grade from 0–10, target outcome and
   the breakdown by learning objective.
5. Review every question, including correct answers: the resolution explains
   the mechanism, each distractor explains its error, sources substantiate the
   answer, and a suggested experiment gives a next step.
6. Start a separate attempt or download the submitted attempt report.

Questions and responses lock after submission. The latest 20 attempts for that
exact bank and assessment are retained locally per browser origin, along with
an unfinished attempt. Storage failure keeps answering and report download
available. Invalid stored data is preserved and reported. A changed bank gets
separate storage; it cannot silently reinterpret an earlier result. This is
practice progress, without authenticated identity or a certification claim.

## Question types and scoring

| Type | Input | Correction |
| --- | --- | --- |
| `single-choice` | One alternative | Exact choice |
| `multiple-response` | Several alternatives | Exact set, no credit for selecting everything |
| `ordering` | Drag, Move up/down, or confirm the displayed order | Exact sequence or fraction of correct positions, declared by author |
| `matching` | Drag items to targets or use accessible selects | Exact mapping or fraction of correct items, declared by author |
| `code-analysis` | Inspect a snippet and choose a diagnosis | Exact alternative; received code is never executed |

Every question declares its points. The percentage is total earned points
divided by total possible points, rather than an average of rounded question
percentages. The grade is percentage divided by ten. The threshold is compared
with the unrounded result. Objective breakdowns use the same points.

Ordering starts with the authored presentation order and counts as unanswered
until the learner moves an item or confirms it. A matching target may be reused;
the prompt states that behavior. Dragging is an additional control: all tasks
also work with keyboard and touch-friendly controls.

## Author a bank

Add `assessments.json` next to `handbook.yaml` and `articles/` in an independent
project. The repository equivalent is `handbooks/<id>/assessments.json`.
The Kubernetes source is a complete example of all five types. In Studio,
**Assessments → Create assessment source** creates an unfinished outline;
**Import question bank** opens a bank supplied in the same JSON contract.
Edit the source, inspect diagnostics and select **Preview assessment**.
The preview selector switches between the final and each checkpoint.

`openlabs/assessment-set/v1` declares:

- bank `id`, explicit `version`, `handbook` and title;
- learning objectives with stable ids;
- primary sources with HTTPS URLs and license metadata;
- question ids and revisions, input type, prompt, objective, points, answer key,
  resolution, remediation, source ids, provenance and review record;
- assessment definitions with stable ids, title, description, question ids,
  pass percentage and scope (`lab` with a lab id, or `handbook`).

A bank has exactly one handbook final and a checkpoint for every available lab.
Missing questions, source/objective references, duplicate ids, invalid keys,
unknown matching targets, malformed permutations and unavailable lab scopes
fail validation. The final must cover every declared learning objective.
Adding an available lab therefore requires adding its checkpoint
when a bank exists. Handbooks without banks remain compatible.

Source ZIPs and autosave preserve invalid drafts as written. Bundle and runnable
delivery exports require validation. The assistant brief includes the assessment
source and review rules. AI-produced questions start as drafts or in review;
an assistant must not invent a human educator's approval.

## Educator review

The Studio's **Assessments** panel displays the key, distractors, resolution,
objective and provenance for each question. Record educator name and notes, then
request changes, send for review or approve it. Approval requires completing the
checklist for correctness, explanations, objective/accessibility and source/reuse
checks. The saved states are `draft`, `in-review`, `changes-requested`, `approved`.

Approval includes timestamp and SHA-256 of the canonical question content,
referenced sources and objective. Reformatting JSON does not change the digest.
Changing the key, wording, points, rationale, provenance, objective or sources
makes approval stale and blocks export until it is reviewed or explicitly
returned to a non-approved state. The Studio records a supplied identity;
an organization's identity provider is a separate integration.

Pending questions remain visibly labeled as a practice bank. The first original
Kubernetes bank is in review; no educator approval has been invented for it.
Advance the bank version before publishing changes. Prefer plausible distractors
derived from misconceptions and final scenarios that transfer the concept to a
new situation. The small POC shares questions between checkpoint and final to
demonstrate the contract; it has not been psychometrically calibrated.

## Public banks, licenses and resolutions

Primary sources supporting an answer and the origin of a question are separate.
An original question records its author and license. Reproduced/adapted questions
must also record bank name, item identifier, URL, license URL and attribution.
Import is local JSON; it neither fetches executable content nor synchronizes a
remote bank. A future GIFT/QTI adapter can convert external banks into this
contract without changing scoring.

Reuse requires item-level license verification, including corporate use and
adaptation conditions. Keep the upstream item id and version/revision in its
provenance and retain attribution in the final resolution. A public URL alone
does not establish reuse permission. Schema checks require metadata; an educator
still verifies that the permission and answer are accurate.

The Kubernetes POC uses original questions, backed by the public Kubernetes
documentation. Its website license is CC BY 4.0, verified against the upstream
`kubernetes/website` LICENSE. The question text uses this repository's CC BY-SA
4.0 content license. No third-party exam bank was copied into the POC.

## Reports and the independent SDK

**Download attempt report** writes `openlabs/assessment-attempt/v1`: attempt id,
bank id/version/digest, assessment id, timestamps and submitted answers. The
Studio's **Open attempt report** recomputes its grade using the original bank;
it refuses mismatched content/version and invalid responses. A submitted grade
in a foreign file is never trusted. Reports contain no built-in student identity.

```js
import {
  readAssessments, gradeAssessment, readAssessmentAttempt,
} from "@ovh/handbook-format/contract";

const bank = readAssessments(JSON.parse(bankJson), handbook);
const result = gradeAssessment(bank, "kubernetes-final", answers);
const reviewed = readAssessmentAttempt(JSON.parse(attemptJson), bank);
```

Content-only exports retain `openlabs/bundle/v1`. Assessments travel in
`openlabs/bundle/v2`; the alpha.4 SDK reads both, with frozen conformance fixtures.
The handbook manifest remains v1. The portable host alpha.2 mounts the same
player after a lab and in the final curriculum entry; delivery v1 hashes the
entire content bundle and runtime assets. The quiz engine imports no flow engine.

## Next service boundaries

Class rosters, authenticated students/reviewers, shared gradebooks, cross-learner
item statistics, manual rubrics and audited teacher overrides need a managed
assessment service. They are not supplied by the static host. An instructor can
already inspect individual exported attempts locally. A future task graded from
a simulation snapshot should identify a versioned, compiled assessor and evidence
contract; a bank must never supply arbitrary grading JavaScript. New input types
or scoring rules require a compatible contract/reader release and conformance
examples.
