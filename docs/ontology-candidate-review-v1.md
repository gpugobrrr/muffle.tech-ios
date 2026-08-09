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
→ expert surveyor review
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
