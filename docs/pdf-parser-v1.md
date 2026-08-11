# PDF Parser v1.2.2

PDF Parser v1 is development-only onboarding tooling for digitally generated
PDFs with selectable text. It produces neutral structural evidence before any
PII minimisation or semantic mapping:

```text
PDF
→ ParsedFirmDocument
→ deterministic PII minimisation
→ deterministic semantic fragment extraction
```

It is a Node-side tool and is not imported by the React Native/Expo runtime,
the Muffle Engine, report generation, or a production `FirmAdapter`.

## Why PDF.js

Parser v1.2.2 uses `pdfjs-dist`. PDF.js exposes page boundaries and low-level text
items with text, coordinates, dimensions, font identifiers, and line-break
evidence. That is enough for deterministic line, paragraph, and heading
heuristics without OCR, a native rendering pipeline, an external service, or
an ML layout model.

The parser uses PDF.js for text extraction only. It does not render pages or
interpret images. PDF.js declares an optional prebuilt canvas package, but
Parser v1.2.2 has no canvas API, native compilation, CUDA, or GPU requirement.

## Run the parser

Human-readable structural output:

```text
npm run onboarding:parse-pdf -- "C:\path\to\report.pdf"
```

Machine-readable JSON on stdout:

```text
npm run onboarding:parse-pdf -- "C:\path\to\report.pdf" --json
```

Include coordinates, font evidence, and source item counts in human output:

```text
npm run onboarding:parse-pdf -- "C:\path\to\report.pdf" --debug
```

Write JSON explicitly:

```text
npm run onboarding:parse-pdf -- "C:\path\to\report.pdf" --output "C:\temp\parsed.json"
```

## Parse selected pages

Use `--pages` to extract only selected source PDF pages. Page numbers are
human-facing and 1-based:

```text
npm run onboarding:parse-pdf -- "report.pdf" --pages 5
npm run onboarding:parse-pdf -- "report.pdf" --pages 5,10,14
npm run onboarding:parse-pdf -- "report.pdf" --pages 5-10
npm run onboarding:parse-pdf -- "report.pdf" --pages 2,5-8,14,20
```

Duplicate pages are removed and the selection is parsed in ascending order.
Invalid, reversed, zero, negative, malformed, empty, or out-of-range page
selections fail explicitly. Source page numbers and block IDs are preserved;
page 14 still produces `page: 14` and IDs such as `p14-b1`.

Selection works with every existing output mode:

```text
npm run onboarding:parse-pdf -- "report.pdf" --pages 5,10 --json
npm run onboarding:parse-pdf -- "report.pdf" --debug --pages 5,10
npm run onboarding:parse-pdf -- "report.pdf" --pages 14-18 --json --output "pages-14-18.json"
```

For practical manual review:

```text
npm run onboarding:parse-pdf -- "C:\Users\AslanS\Downloads\rhs_level_two.pdf" --pages 5,10,14,18,22,28,34,40,44,47
```

PDF.js loads and extracts only the requested pages. In selected-page output,
`pageCount` remains the total source PDF page count and `parsedPages` records
the pages extracted for that invocation.

## Output

`ParsedFirmDocument` contains:

- the source filename and page count;
- ordered `heading`, `paragraph`, `list`, `marker`, `table`, `image`, or `unknown`
  blocks;
- page number and stable page-local block ID;
- PDF-point bounds, measured from the lower-left page origin;
- available font size, family, and weight evidence;
- the number of source PDF text items used;
- conservative repeated-content and likely-page-furniture flags.

Block types and page-furniture flags are parser heuristics, not canonical
survey truth. Repeated content is flagged and retained rather than deleted.
The parser never maps wording such as `D4 Main Walls` to an ontology concept.

## Parser v1.2.2 structural improvements

Parser v1.2.2 retains list continuation and adds conservative deterministic
layout refinements:

- A list line may absorb an immediately following wrapped paragraph line when
  vertical spacing, indentation, font family, size, and weight are compatible.
  A new bullet or a visually separated paragraph remains a separate block.
- Compact tokens in an isolated side column may be emitted as parser-only
  `marker` blocks. This preserves badge-like layout without assigning semantic
  meaning to values such as a number or short uppercase token. Standalone page
  numbers and tightly attached heading/list prefixes are not markers.
- Raw PDF.js item evidence is included in explicit `--debug` output: source
  order, text, bounds, font name, and transform matrix. Normal output and JSON
  remain concise unless a debug parse is requested.
- Parser-only `marker` blocks preserve compact side badges separately from a
  descriptive region when their geometry supports separation. An attached
  section identifier such as `D4 Main Walls` remains integrated.
- Form-interrupted prose is reconstructed from visual order rather than raw
  PDF.js item order. The focused rule requires substantial unfinished prose at
  the left, a short lowercase orphan after a bounded same-baseline gap, and the
  immediate next physical line returning to the original left margin with
  compatible body typography. If content also continues below the right-side
  orphan like a second column, no merge occurs.
- The parser joins only extracted text and never invents the missing form
  value. Labels, table cells, headings, markers, terminated sentences, and
  genuine columns remain separate.
- Reconstruction remains deterministic and layout-only: no OCR, LLM, or
  surveying-specific semantic inference participates.

Useful manual smoke-test targets include wrapped list items, isolated
rating/status badges, and reminder-page sentences interrupted by blank form
fields. Real firm PDFs and their parsed output must not be committed.

## Unicode output

Parser strings, JSON serialization, and explicit `--output` files preserve
Unicode text such as `–`, `’`, `•`, and `©`; output files are written as UTF-8.
If redirected PowerShell output displays mojibake, prefer the parser's direct
`--output result.json` path for saved JSON. Alternatively configure the
shell’s redirection encoding before capturing human-readable output:

```powershell
$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
npm run onboarding:parse-pdf -- "report.pdf" --pages 5,10 | Tee-Object -FilePath parsed.txt
```

This is a terminal/redirection concern; it does not change parser text or JSON
values.

When `--pages` is used, repeated/page-furniture detection is relative only to
the selected subset. Parser v1 does not scan unrequested pages solely to infer
document-wide repetition.

## Current limitations

- Selectable text is required. Image-only/scanned PDFs fail clearly.
- OCR, handwriting, image interpretation, and image extraction are not
  implemented.
- Reading order is conservative. Simple top-to-bottom layouts and separated
  columns are supported; complex tables and multi-column designs may produce
  `paragraph` or `unknown` blocks.
- There is no full table extraction engine.
- Form widgets are not extracted as structured fields, and arbitrary complex
  forms or multi-column layouts are not fully solved.
- Signatures, handwriting, and semantic condition-rating interpretation are
  not implemented.
- Deterministic PII minimisation and semantic fragment extraction are derived
  downstream stages. See `docs/pii-minimization-v1.md` and
  `docs/semantic-fragments-v1.md`.

Parser output faithfully contains source text and may therefore contain
confidential firm, client, or property information. Do not commit real PDFs or
their parsed JSON output to the repository.
