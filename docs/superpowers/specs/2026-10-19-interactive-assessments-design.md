# Interactive assessments and educator review

## Learning contract

Every authored lab has an exit assessment; each handbook has one cumulative
assessment. Both use the same versioned bank and correction engine. Existing
predictions and instrumentation exercises remain in place: they intervene during
an experiment, whereas an assessment collects editable answers and reveals its
resolution only after submission. No assessment depends on the flow engine.

The first vertical slice uses Kubernetes and supports five question types:
single choice, multiple response, ordering, matching and code analysis. Ordering
and matching accept drag gestures and equivalent keyboard/touch controls.
Code is inspected as text; it is never executed. Later question renderers and
manual rubrics require an explicit contract revision, not arbitrary executable
markup in a bank.

## Content and scoring

`openlabs/assessment-set/v1` contains learning objectives, sources, versioned
questions and assessment definitions. An assessment refers to question ids and
declares its lab or handbook scope and pass threshold. Questions declare points,
resolution, remediation and provenance. Every distractor has an explanation.
Ordering/matching explicitly choose exact or per-item scoring. Multiple response
uses exact-set scoring; selecting every option cannot earn partial credit.

The result includes points earned/possible, percentage, grade on a 0–10 scale,
threshold outcome, unanswered/incorrect/partial/correct status and breakdown by
learning objective. Unanswered questions earn zero. Threshold decisions use the
unrounded score; rounding is presentation only. A retry is a new attempt and
does not overwrite a submitted response. The first version stores progress
locally and supports exporting a version-bound attempt for review.

An attempt pins bank id, version and canonical content digest, question ids and
answers, and start/submission timestamps. Re-reading an attempt recomputes its
grade and refuses a different bank. Client-side reports are learning records;
the design does not claim authenticated grading or invigilation. Managed class
rosters, authorized teacher overrides and server-side results are a separate
service boundary if educators need them.

## Educator workflow

A question moves through draft, in-review, changes-requested and approved.
Approval records educator identity as supplied, timestamp, rationale and a
SHA-256 digest of the complete question content except review metadata.
Changing its text, key, explanations, points, objective, provenance or references
makes approval stale. Approval is editorial metadata; the static application
does not authenticate the named educator. The Studio supports inspection,
practice preview and explicit review records. Draft banks are visibly marked
as pending review and can be tried without pretending to be reviewed exams.

Review checks factual correctness, plausible distractors, objective alignment,
accessibility, ambiguity, source validity and reuse permission. Passing a schema
does not approve the science. A bank version must advance when published content
changes; exported attempts keep the original bank digest.

## Public banks and attribution

An original question declares its author and license. A reproduced/adapted
question additionally identifies the bank, item, source URL, license URL and
attribution. Primary sources backing the answer are separate from the origin
of the question. Public availability alone does not establish reuse permission.
The first Kubernetes questions are original, grounded in public Kubernetes
documentation, rather than copied from an exam bank. External banks can be
converted to this JSON contract and imported through the Studio; universal
QTI/GIFT conversion and remote bank synchronization are later adapters.

## Compatibility and delivery

Editable projects add an optional `assessments.json` beside `handbook.yaml` and
`articles/`. Invalid draft text survives source export and autosave. The SDK
validates references and coverage: a bank has one handbook final and a checkpoint
for every available lab. A handbook without a bank remains readable and displays
that assessments have not been authored yet.

Content-only exports retain the exact `openlabs/bundle/v1` shape. Exports with
assessments use `openlabs/bundle/v2`; the new reader reads both, and the frozen
v1 fixture is unchanged. The portable host mounts assessment components after
labs and at the end of the curriculum, using the same scoring contract as the
site and Studio. Host version advances because the compiled runtime changes.
The delivery index still hashes the entire content bundle and runtime assets.

## Acceptance evidence

Tests must cover all five correction types, invalid references/answers,
unanswered and partial scores, exact threshold decisions, stale educator review,
bank-version mismatches and the original v1 fixture. Browser checks must cover
late feedback, answer locking, accessible ordering/matching, explicit retry,
Studio source/bundle round trips, attempt export/review and assessment execution
from an extracted standalone release on desktop and mobile.
