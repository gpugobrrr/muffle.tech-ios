# Deterministic PII minimisation v1

PII minimisation v1 is a development-only privacy boundary for firm-document
onboarding:

```text
raw ParsedFirmDocument
→ deterministic PII minimiser
→ PiiMinimizedDocument
→ future semantic fragment extractor
→ CandidateRetriever
→ local SemanticMapper
→ human approval
→ deterministic FirmAdapter
```

The mapper must eventually receive only fragments derived from minimised
blocks. LLM output never directly becomes report output.

## Derived representation

`minimizeParsedDocument()` returns a new `PiiMinimizedDocument`; it does not
mutate the source parser result. Each derived block retains its source block
ID, page, structural type, repeated/furniture flags, minimised text, and safe
action counts.

The derived representation intentionally excludes:

- `sourceFile`, because filenames may identify clients or properties;
- raw PDF.js debug items;
- original block text;
- bounds, fonts, and source-item evidence;
- matched sensitive values in actions or summaries.

The controlled onboarding process may retain the raw parser result separately
for audit and debugging. `sourceBlockId` and page provide safe traceability
between the two representations without copying original values downstream.

## Deterministic coverage

High-confidence inline replacements are:

- conventional email addresses → `[EMAIL]`;
- plausible UK telephone numbers beginning with `0` or `+44` → `[PHONE]`;
- UK postcode-shaped values → `[POSTCODE]`.

Exact contextual labels can also protect a short, geometrically adjacent value:

- client or surveyor name → `[PERSON]`;
- property or surveyor address → `[ADDRESS]`;
- report reference → `[REFERENCE]`;
- signature text → `[SIGNATURE]`;
- surveyor professional identifier → `[PROFESSIONAL_ID]`.

The same contextual replacements apply to explicit inline `label: value` or
`label – value` text. Labels remain intact because terms such as `Client's
name`, `Property address`, `Email`, and `Signature` describe useful template
structure.

Placeholders are stable, contain no source value, and are idempotent. No
hashes, pseudonyms, random identifiers, or timestamps are generated.

## Preservation policy

The minimiser does not perform ontology mapping or surveying interpretation.
Ordinary report language, headings, lists, markers, condition ratings,
measurements, dates, RICS terminology, firm branding, and public organisation
names remain unless they contain a separately detected high-confidence value.

URLs are not automatically removed in v1. Public standards and organisation
URLs can be useful firm-template evidence, while reliably distinguishing
personal from organisational URLs requires more context.

## Security scope and limitations

This layer reduces unnecessary identifying data before semantic modelling. It
is not anonymisation and provides no guarantee that every identifying detail
has been detected. Minimised output remains sensitive onboarding material and
is not safe for public distribution.

Known limitations include:

- ambiguous person names in prose are retained;
- free-form postal addresses without strong label context may be retained;
- only conservative adjacent label/value layouts are understood;
- cross-block entities and arbitrary forms are not fully handled;
- graphical signatures, handwriting, and scanned/image-only content are not
  interpreted;
- URLs and firm identities are preserved by policy.

Processing is local and deterministic. It uses no Qwen, LLM, OCR, external
PII service, telemetry, or network call. Human review remains required.

Real firm/client PDFs, raw parser JSON, and minimised derived artifacts must
not be committed.

## Local inspection CLI

Run the parser and minimiser together and write human-readable UTF-8 output:

```text
npm run onboarding:minimize-pii -- "C:\Users\AslanS\Downloads\rhs_level_two.pdf" --pages 1-6 --output ".\pii-minimized.txt"
```

Write the existing `PiiMinimizedDocument` JSON representation:

```text
npm run onboarding:minimize-pii -- "C:\Users\AslanS\Downloads\rhs_level_two.pdf" --pages 1-6 --json --output ".\pii-minimized.json"
```

Without `--output`, the selected minimised representation is printed to
stdout. Page selection accepts the parser's existing single-page, comma-list,
range, and mixed syntax.

The command never emits parser debug items or a raw-text appendix. Direct
`--output` writes UTF-8 and is preferred over PowerShell piping so characters
such as `–`, `’`, `•`, and `©` are preserved reliably.

This command performs only local PDF parsing and deterministic minimisation. It
does not use Qwen, an LLM, OCR, telemetry, or a network service. Its output
remains sensitive, is not guaranteed anonymised, and must not be committed.
Raw firm/client PDFs remain confidential.

## Future work

Potential later phases are improved contextual person-name and postal-address
detection, structured form-field understanding, cross-block entity detection,
optional local NER evaluation if justified, and the semantic fragment
extractor. These are not part of v1.
