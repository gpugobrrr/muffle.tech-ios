# Deterministic ontology seed proposals v1

Ontology seed proposals are developer review artifacts. They do not mutate the
canonical Muffle ontology.

```text
RICS or firm PDF corpus
→ parseFirmPdf
→ minimizeParsedDocument
→ structural heading evidence
→ deterministic normalization and grouping
→ existing CandidateRetriever comparison
→ OntologyConceptProposal[]
→ human review
→ future explicit approval
```

The approval and ontology-write stages are intentionally not implemented.
RICS terminology is source evidence, not canonical Muffle naming or a report
template.

## Privacy-safe input

Extraction accepts `PiiMinimizedDocument`, not raw `ParsedFirmDocument`.
Minimised heading text, page, structural type, and source block IDs remain
available. Source filenames, paths, parser geometry/debug data, PII action
details, and original removed values are excluded.

CLI sources receive deterministic local IDs such as `source-1`; paths are
never included in proposal JSON.

## Structural evidence

V1 extracts heading blocks only. It does not mine noun phrases from ordinary
report prose.

- A heading matching uppercase letter + digits, such as `D5 Windows`, is
  `element` evidence.
- An uncoded heading containing coded child headings before the next uncoded
  heading is `section` evidence.
- Other uncoded headings are retained as `unknown` review evidence rather
  than assumed to be canonical leaf concepts.
- Administrative field labels reuse the retrieval-eligibility classifier.
- `Contents`, page furniture, standalone privacy placeholders, paragraphs,
  lists, and markers are excluded.

The original heading remains evidence. Structural codes are removed only from
the normalized grouping term:

```text
D5 Windows → windows
E1 Roof structure → roof structure
```

Normalization uses Unicode NFKC, trimming, whitespace collapse,
case-insensitive comparison, and conservative punctuation removal. V1 does
not stem or singularize terms, so semantically distinct phrases are not merged
because they share a token.

## Proposal model

Each `OntologyTermEvidence` records:

- privacy-safe source document ID;
- `element`, `section`, or `unknown` type;
- original and normalized term;
- page and source block IDs;
- broad section context when available.

Evidence groups produce deterministic `OntologyConceptProposal` records with:

- a stable ID derived from term type and normalized term;
- `candidate` status only;
- source variants and occurrence count;
- distinct source-document count;
- complete minimal heading provenance;
- positive-score matches returned by the existing CandidateRetriever.

Candidate matches expose review evidence; they are not approvals. No proposed
canonical ID, label, alias, description, or parent is fabricated.

Proposals are ordered by `element`, `section`, then `unknown`, with normalized
terms alphabetically ordered within each type. Evidence is ordered by source
ID, page, and source block ID.

## Local inspection CLI

Process one PDF:

```text
npm run onboarding:propose-ontology -- "C:\Users\AslanS\Downloads\rhs_level_two.pdf" --output ".\rics-ontology-proposals.json"
notepad ".\rics-ontology-proposals.json"
```

Optionally select pages:

```text
npm run onboarding:propose-ontology -- "report.pdf" --pages 1-47 --output ".\ontology-proposals.json"
```

Multiple documents can seed one review set:

```text
npm run onboarding:propose-ontology -- "level2.pdf" "level3.pdf" --output ".\rics-ontology-proposals.json"
```

The same page selection applies to each supplied document. Output is
deterministic UTF-8 JSON and parent directories are created automatically.

This tooling uses no Qwen, LLM, OCR, embeddings, RAG, cloud API, automatic
approval, FirmAdapter generation, report generation, or ontology mutation.
