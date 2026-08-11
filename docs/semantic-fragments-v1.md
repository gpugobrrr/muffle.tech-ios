# Deterministic semantic fragments v1

Semantic fragment extraction is the structural onboarding stage after PII
minimisation:

```text
PiiMinimizedDocument
→ extractSemanticFragments()
→ SemanticFragment[]
→ selectRetrievalEligibleFragments()
→ toFirmSemanticFragment()
→ CandidateRetriever
```

It segments safe-as-practicable document text. It does not classify ontology
concepts, retrieve candidates, generate mapping proposals, or call a model.

## Fragment shape

Each fragment contains:

- a deterministic ID derived from its page and content source block;
- source page and `paragraph` or `list` type;
- minimised semantic text;
- optional broad section and coded element-heading context;
- an ordered `headingPath`;
- source block IDs for the active headings and content block.

Parser bounds, fonts, debug items, raw source text, PII action details, ontology
IDs, candidate scores, and mapping decisions are excluded.

## Deterministic extraction

The extractor reads `PiiMinimizedDocument.blocks` once in their existing order.
An uncoded meaningful heading becomes broad section context and clears the
previous element context. A heading beginning with an uppercase letter and
number, such as `D4 Main walls`, becomes element context beneath the current
section.

Meaningful paragraphs and individual list blocks become fragments with the
current heading context. The parser remains responsible for reconstructing
text and list continuations; the extractor does not repeat PDF layout work.

Blocks marked `likelyPageFurniture` are excluded. A useful repeated heading is
still retained as context when it is not page furniture. Standalone page
numbers, isolated markers, empty or punctuation-only text, and standalone PII
placeholders do not produce fragments. A placeholder inside otherwise useful
prose remains safely present.

## Retrieval compatibility

`toFirmSemanticFragment()` adapts a provenance-bearing fragment to the existing
retrieval contract:

- element heading, then section heading, then text supplies `firmTerm`;
- a broad section supplies `nearbyHeading` for an element fragment;
- fragment text supplies `representativeText`.

Candidate retrieval remains a separate explicit call. No ontology content is
used during extraction.

## Retrieval eligibility

Complete `SemanticFragment[]` remains the audit/provenance representation.
Administrative/template fragments are retained there, then a separate
deterministic selector removes high-confidence noise before ontology
retrieval.

`selectRetrievalEligibleFragments()` excludes:

- a small explicit set of identity, contact, date, reference, company,
  website, and signature field labels;
- those labels with an inline privacy placeholder value;
- the immediately following paragraph value only when it is on the same page,
  has identical heading context, and comes from the next parser block.

Dates, company names, URLs, and placeholders inside meaningful narrative are
not globally excluded. Page or heading transitions prevent label/value
pairing, and uncertain fragments are kept. Filtering preserves order, object
provenance, IDs, text, and the complete source array.

`toRetrievalFirmSemanticFragments()` applies this selector before the existing
`toFirmSemanticFragment()` adapter. CandidateRetriever itself remains
unchanged.

## Privacy and limitations

The extractor accepts only `PiiMinimizedDocument`; it has no raw
`ParsedFirmDocument` overload. Output remains sensitive onboarding material,
is not guaranteed anonymised, and must not be committed from real firm/client
documents.

Generic heading hierarchy is necessarily conservative. Uncoded headings are
treated as broad context, while coded element detection recognises only the
simple uppercase-letter-plus-number form. Arbitrary tables and label/value
grouping are not reconstructed in this stage.

Processing is deterministic and local. It uses no Qwen, LLM, OCR, embedding,
RAG, telemetry, ontology mapping, or network call.

## Local inspection CLI

Inspect fragments from a PDF after the privacy boundary:

```text
npm run onboarding:extract-fragments -- "report.pdf" --pages 1-6 --output ".\semantic-fragments.json"
```

The default output remains the complete audit fragment set. To inspect only
the retrieval-eligible subset:

```text
npm run onboarding:extract-fragments -- "report.pdf" --pages 1-6 --retrieval-only --output ".\semantic-retrieval-fragments.json"
```

The command runs:

```text
parseFirmPdf
→ minimizeParsedDocument
→ extractSemanticFragments
→ UTF-8 JSON
```

It reuses the parser `--pages` syntax. Output is an inspection envelope with
`schemaVersion`, page provenance, `fragmentCount`, and the existing
`SemanticFragment[]`. Direct `--output` is preferred over PowerShell piping.
The CLI does not call CandidateRetriever, Qwen, or any network service.
Minimised fragment JSON remains sensitive and must not be committed from real
firm/client documents.
