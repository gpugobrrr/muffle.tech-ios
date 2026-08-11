# Ontology candidate review v1

`src/domain/ontology/review/muffle-ontology-candidates.v1.ts` is a
version-controlled review register. It is not a second canonical ontology and
is not imported by the Muffle Engine, survey UI, report runtime, or
FirmAdapter.

```text
existing Muffle ontology
+ repository survey/report semantics
+ RICS-style terminology as source evidence
→ candidate register
→ deterministic candidate audit
→ generated and frozen expert question set
→ expert surveyor answers
→ deterministic interpretation artifact
→ ontology promotion proposal
→ explicit human approval
→ separate controlled canonical ontology update
```

The register is a bounded draft for discussion, not semantic authority. It
does not add engine fields, report fields, building-element IDs, or operations.

## Canonical versus publication and workflow

Canonical concepts express stable, authoritative property or survey meaning.
They should survive changes to firm wording, report product, and page layout.

For example, `building_element.external_wall` is canonical. `D4 Main Walls`
is a publication proposal that maps to the canonical element; it must not
become a separate physical building element. The current `FirmAdapter` is the
future deterministic place to map canonical elements to firm headings.

Similarly:

- SVYR `PREP` is workflow/navigation, not domain truth;
- condition ratings are review candidates for decomposition/value mapping, not
  automatic canonical condition meaning;
- notes remain noncanonical adjunct context, excluded from completion and not
  evidence;
- evidence remains a distinct finding-supporting semantic.

RICS or CoreLogic terminology may provide review evidence, aliases, workflow
patterns, or publication behavior. It must not be copied as a proprietary
template or treated as canonical merely because it appears in a report.

## Candidate classification

The register uses a deliberately small classification set:

- `existing-canonical-concept`
- `proposed-canonical-concept`
- `attribute-or-value`
- `alias`
- `relationship`
- `workflow`
- `publication`
- `adjunct`
- `uncertain`

Every record includes source traceability, rationale, confidence, required
expert review, and review status. Confidence prioritizes attention; it never
approves a candidate.

Candidate relationships are separate review entries because current canonical
ontology relationships are limited to taxonomy via `parentId`. They describe
possible future semantic behavior only and do not claim current engine support.

## Expert review workflow

1. Start with `low` confidence and `uncertain` entries.
2. Test each proposal against real survey decisions and Level 2/Level 3
   practice—not just a report heading.
3. Decide whether it is a stable domain concept, a controlled attribute/value,
   a firm alias, workflow, or publication artifact.
4. Record surveyor notes and mark the review status.
5. Resolve duplicates and boundaries, especially observation vs defect,
   recommendation vs further investigation, condition vs significance, and
   evidence vs note.
6. Promote only approved concepts in a later change that updates runtime
   schema/engine evidence and `MUFFLE_ONTOLOGY_V1` together.

No record in v1 is automatically approved.

## Frozen expert question sets

`apps/ontology-review/data/ontology-review-v1.json` is frozen historical
evidence because an expert surveyor has completed it. It must not be
regenerated or rewritten: interpretation must remain reproducible against the
exact wording the surveyor saw.

The corrected future generator writes `ontology-review-v2`. It:

- rejects normalized self-comparisons and comparisons that resolve to the same
  candidate/concept target;
- requires meaningful lexical overlap after generic modifiers such as
  `internal`, `external`, `system`, and `installation` are removed;
- falls back to manual review when audit metadata cannot support one sensible
  binary question;
- uses relationship-predicate templates to ask whether a relationship can
  legitimately exist, rather than whether one concept is defined by another.

Generate the future set with:

```text
npm run ontology:review:generate
```

This writes `apps/ontology-review/data/ontology-review-v2.json`. It does not
change which frozen set the current review app loads.

## Deterministic candidate audit

The candidate register can be mechanically audited before expert review:

```text
npm run ontology:candidates:audit
npm run ontology:candidates:audit -- --json
```

The audit is a transient deterministic analysis. It does not store results in
the candidate register, Muffle Engine, or canonical ontology.

Hard errors are facts software can prove, including duplicate review/proposed
IDs, malformed proposed IDs, empty required fields, unresolved existing/parent
references, unresolved relationship endpoints, self references, and invalid
publication/workflow canonical combinations.

Warnings require professional review. They include normalized label overlap,
overlap with existing canonical concepts, alias conflicts, low-confidence new
canonical concepts, metadata that suggests an attribute/entity mismatch, and
candidate note/evidence confusion. Warnings never change a review status or
proposal.

The intended sequence is:

```text
AI draft
→ deterministic audit
→ correct mechanical errors
→ expert surveyor review of warnings and ambiguity
→ approve / reject / revise
→ separate controlled canonical ontology update
```

Passing an audit means only that a draft is mechanically well-formed enough
for human review. It is not a professional surveying decision and creates no
automatic path to canonical truth.

## Completed-review interpretation

Completed answers are external expert-review evidence. They are not copied
into the repository automatically. Interpret an external answer export
against the frozen v1 question set with:

```text
npm run ontology:review:interpret -- --answers <answers.json>
```

With no output flags, authoritative JSON is written to stdout and a concise
Markdown summary to stderr. To write both artifacts explicitly:

```text
npm run ontology:review:interpret -- \
  --answers <answers.json> \
  --json-output <interpretation.json> \
  --markdown-output <interpretation.md>
```

The interpreter validates versions, reviewer IDs, answer values, duplicate
and unknown question IDs, missing answers, and candidate/relationship
references. Matching is by question ID, never array order. Output ordering is
deterministic and no generated timestamp is added.

The interpretation separates original human evidence from a proposed review
disposition. A valid same-as `YES`, for example, means
`merge-or-alias-review`; it never merges records. A canonical-independence
`YES` means `approve-for-canonical-review`; it never promotes a concept.
Publication wording remains noncanonical unless a later controlled process
decides otherwise.

Known defects in the completed v1 set remain visible for auditability:

- normalized self-comparisons are `invalid-question`;
- the v1 Internal wall/Internal door comparison is `reask-required`;
- all seven v1 relationship questions are `reask-required` because their
  wording tested definition-like phrasing rather than relationship validity.

Those items retain the original question and answer but are marked
`usableAsOntologyEvidence: false`. The six `manualQuestionReview` entries were
not presented as normal questions; they are included without fabricated
answers as `manual-review-required`.

The intended lifecycle is:

```text
candidate register
→ deterministic audit
→ generated expert questions
→ frozen question-set version
→ expert answers
→ deterministic interpretation artifact
→ ontology promotion proposal
→ explicit human approval
→ later controlled ontology promotion
```

The interpreter uses no LLM and is not professional surveying authority.

## Ontology promotion proposal

The next deterministic stage converts an external interpretation artifact into
a non-authoritative promotion proposal:

```text
candidate proposals
→ audit
→ expert questions
→ expert answers
→ interpretation
→ promotion proposal
→ explicit human approval
→ controlled canonical ontology update
```

Build it from an external interpretation path:

```text
npm run ontology:promotion:propose -- \
  --interpretation <interpretation.json> \
  --out-dir <output-directory>
```

When `--out-dir` is supplied, the command writes
`ontology-promotion-proposal-v1.json` and
`ontology-promotion-proposal-v1.md` there. Without it, JSON is written to
stdout and the concise Markdown review summary to stderr. The tool never
copies the interpretation artifact into the repository automatically.

The proposal compares candidate metadata with canonical ID/alias matches,
explicit existing mappings, audit overlap warnings, hierarchy, kind, ownership,
maturity, value type, bindings, and source traceability. It may recommend
actions such as `add-canonical-concept`, `revise-kind`, `revise-parent`,
`treat-as-publication`, `map-to-existing-canonical`, or
`requires-semantic-review`.

An expert `approve-for-canonical-review` result only supports that the
candidate's meaning may survive report headings. It does not approve the
candidate's proposed ID, kind, parent, runtime binding, alias scope, or
relationship edges. The proposal deliberately keeps expert evidence separate
from Muffle's schema recommendation.

Every proposal item has `requiresHumanApproval: true` and
`safeToAutoPromote: false`. No action edits `MUFFLE_ONTOLOGY_V1`, candidate
data, engine records, report mappings, or FirmAdapters. Relationship endpoint
concepts can be proposed independently, but relationship edges require their
own valid expert review and are not promoted by this stage. Publication terms
remain outside canonical truth unless separately justified and approved.

## Review export

The TypeScript register is authoritative for proposal state. Export a
spreadsheet-friendly projection with:

```text
npm run ontology:candidates:export
```

This validates the register and writes:

```text
dist/ontology/muffle-ontology-candidates.v1.csv
```

The CSV is a review projection, not a source of truth. It includes
classification, proposed/existing IDs, aliases, source identifiers, rationale,
confidence, review state, and current audit severity/issue codes. It does not
contain private client documents, CoreLogic material, or report-template text.
