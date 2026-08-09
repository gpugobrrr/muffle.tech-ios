# Local semantic mapping proof

This is development-only onboarding tooling. It proposes mappings from firm
terminology to existing ontology IDs; it does not modify the ontology,
canonical survey records, or the production `FirmAdapter`.

The flow is:

```text
firm fragment
→ deterministic lexical retrieval
→ top-five ontology candidates
→ localhost llama.cpp proposal
→ strict proposal and candidate-ID validation
→ human approval (future)
```

The normal unit tests do not require a model server:

```text
npm run test:semantic-mapping
```

To run the live proof, start `llama-server` separately with the proven model at:

```text
http://127.0.0.1:8080
```

Then run:

```text
npm run semantic-mapping:local
```

The mapper defaults to `http://127.0.0.1:8080`. A different local port can be
provided with `MUFFLE_LLAMA_CPP_BASE_URL`; only `localhost` and `127.0.0.1`
HTTP URLs are accepted. `MUFFLE_LLAMA_CPP_MODEL` optionally sets the model
name sent to the OpenAI-compatible endpoint.

The mapper uses deterministic inference settings:

- `temperature: 0`;
- `chat_template_kwargs.enable_thinking: false`;
- JSON response mode where supported;
- a modest `max_tokens` limit.

The response is still treated as untrusted. Invalid JSON, malformed proposal
objects, out-of-range confidence, unknown fields, and selected or alternative
IDs outside the supplied candidate set are rejected.

The live mapper is not imported by the report runtime. No LLM result is
automatically approved or written into a firm adapter.

## Local PDF fragment mapping inspection

The developer-only inspection harness connects the existing onboarding stages
without changing their semantics:

```text
PDF
→ parseFirmPdf
→ minimizeParsedDocument
→ extractSemanticFragments
→ selectRetrievalEligibleFragments
→ toFirmSemanticFragment
→ default top-five CandidateRetriever
→ localhost LlamaCppSemanticMapper
→ MappingProposal
→ UTF-8 inspection JSON
```

The parser output is minimised before fragments are selected or sent to the
mapper. Administrative fragments excluded by retrieval eligibility never
reach candidate retrieval or Qwen. Each model request contains one compact
`FirmSemanticFragment` and only its retrieved candidate IDs, labels, aliases,
and descriptions.

Start llama.cpp separately with the local GGUF model:

```text
llama-server -m "<path-to-local-model.gguf>" --host 127.0.0.1 --port 8080
```

In PowerShell, check the local server before running the inspection:

```text
Invoke-RestMethod "http://127.0.0.1:8080/health"
```

Then run:

```text
npm run onboarding:map-fragments-local -- "C:\Users\AslanS\Downloads\muffle_synthetic_filled_pii_test.pdf" --pages 1-6 --output ".\semantic-mapping-results.json"
notepad ".\semantic-mapping-results.json"
```

`--pages` uses the existing parser selection syntax and `--output` must be a
JSON file. Parent directories are created and output is overwritten as UTF-8.
The source path and filename are not included in the result.

The schema-versioned output records:

- source page counts, but not the source path;
- complete and retrieval-eligible fragment counts;
- each eligible fragment and its source-block provenance;
- the exact `FirmSemanticFragment` retrieval input;
- deterministic scored top-five candidates;
- the validated proposal, or an operational `unresolved`, `retrieval_empty`,
  or `mapper_error` status;
- per-fragment and aggregate mapper latency.

Fragments are processed sequentially in source order. Empty retrieval skips
the mapper. Invalid mapper output is recorded safely for that fragment and
inspection continues; a localhost transport failure stops the command with an
actionable message. Proposals remain diagnostic only: the command does not
approve mappings, publish a `FirmAdapter`, mutate the ontology, or generate a
report.

## Semantic Mapping Benchmark v1

The version-controlled benchmark dataset contains 30 PII-free, human-labelled
cases. Positive labels use only canonical IDs already present in the ontology;
unresolved cases deliberately use concepts outside the current narrow slice.

Run deterministic tests without a model server:

```text
npm run test:semantic-mapping
```

Run the live benchmark after starting `llama-server` separately:

```text
npm run semantic-mapping:benchmark
npm run semantic-mapping:benchmark -- --json
npm run semantic-mapping:benchmark -- --failures
npm run semantic-mapping:benchmark -- --quiet
```

Normal runs print transient per-case progress, including candidate retrieval,
mapping start/completion, classification, latency, running totals, and elapsed
time. This is useful for larger local models whose 30-case run may take several
minutes. `--quiet` keeps only the final human-readable report. `--json`
suppresses progress so stdout remains valid JSON for tooling. `--failures`
keeps progress and adds the detailed failure report after the final summary.

`--failures` prints the firm context, expected rank, scored candidate details,
selected ID, confidence, rationale, latency, and classification for each
failed case. A positive case whose expected ID is absent from top-5 is a
retrieval failure; a mapper-eligible positive case that is selected
incorrectly is a mapper failure.

## Prompt v1 and v2 comparison

Prompt v1 is the original JSON-oriented prompt and remains available for
reproducibility. Prompt v2 keeps the same transport, inference settings,
candidate boundary, output validation, and ID safety checks, but formats the
context and candidates explicitly and emphasizes canonical semantic
classification, contextual reasoning, specificity, and legitimate null
answers.

Run both prompts against the same frozen benchmark and the same in-memory
candidate sets:

```text
npm run semantic-mapping:benchmark:compare
npm run semantic-mapping:benchmark:compare -- --json
npm run semantic-mapping:benchmark:compare -- --quiet
```

The comparison prints the same per-case progress for Prompt v1 and Prompt v2.
JSON and quiet modes suppress intermediate progress; the final comparison
metrics remain authoritative.

The comparison reports cases fixed by v2, regressed by v2, wrong in both, and
correct in both. A fixed case means the validated mapper result changed from
incorrect to correct; it does not claim an automatic root cause. Candidate
overlap, missing context, prompt ambiguity, and benchmark-label concerns
remain human diagnostic categories.

Retrieval and mapper performance are measured separately:

- retrieval top-1, recall@3, and recall@5 measure whether the labelled concept
  entered the candidate set;
- conditional mapper accuracy measures selection only when the expected concept
  was present in top-5;
- end-to-end positive accuracy includes retrieval failures;
- unresolved accuracy treats `selectedConceptId: null` as correct;
- false positives count non-null selections for unresolved cases.

Therefore, weak recall@5 with strong conditional mapper accuracy indicates a
retrieval bottleneck. Strong recall@5 with weak conditional mapper accuracy
indicates a prompt, context, candidate-description, or model bottleneck.

Safety failures are reported separately: hallucinated/non-candidate IDs,
invalid JSON, other proposal-validation failures, and HTTP failures. They are
never converted into successful mappings. Model confidence is recorded but is
not treated as calibrated probability.

Future real report fragments should be PII-minimised before being added as
human-labelled fixtures. The benchmark never writes proposals to adapters,
canonical records, or the ontology.

Prompt v2 experimentation prepares the mapper for future PII-minimised
semantic fragments. It is not PDF ingestion and does not add document parsing,
RAG, embeddings, or production report generation.
