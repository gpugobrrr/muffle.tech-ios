# Muffle Ontology v1

`muffle-ontology` version `1.1.0` is a machine-readable extraction of the
semantics currently implemented by muffle.tech. It is not a replacement for
the runtime schema, command registry, engine, or domain records.

The TypeScript registry is:

`src/domain/ontology/muffle-ontology.v1.ts`

It can be serialized with `serializeMuffleOntologyV1()` or exported as JSON
with:

```text
npm run ontology:export
```

The JSON development export is written to:

`dist/ontology/muffle-ontology.v1.1.json`

## Version contract

- Additive, backwards-compatible concepts may be released in a future `1.x`.
- Removing an ID, reusing an ID for different meaning, or changing semantic
  meaning requires a new major ontology version.
- Runtime schema and engine sources remain authoritative. Ontology validation
  detects drift between those sources and this semantic registry.

Version `1.1.0` is additive: all 49 concepts introduced in `1.0.0` remain
present. It adds the first inspection-finding slice and one derived report
block.

## Authoritative repository sources

| Source | Identifiers | Responsibility |
| --- | --- | --- |
| `src/types/workspace.ts` | Type and property names | Canonical job, property, address, brief, and completion records |
| `src/lib/field-schema.ts` | `fieldId`, `pathKey`, option value | Field definitions, value types, requiredness, normalization, record access |
| `src/lib/survey-operations.ts` | `operationId` | Engine-backed field reads and writes |
| `src/lib/command-registry.ts` | SVYR token and path | Navigation/discovery graph, explicit input aliases, help metadata |
| `src/lib/completion.ts` | Schema path | Required/optional completion and applicability semantics |
| `src/lib/svyr-notes.ts` | Note path key | Non-canonical path-keyed notes |
| `src/types/report.ts` | Report block kind/type | Publication model |

## Meaning of canonical

`canonical: true` means **authoritative semantic/domain truth**. It does not
mean merely renderable or reportable.

- Engine records and canonical job state may be canonical.
- Report-model concepts are deterministic projections from canonical records,
  so they are `canonical: false` with ownership `report-model`.
- Firm wording is presentation configuration and is not canonical.
- Workflow vocabulary and notes remain non-canonical.

This resolves the ambiguity in `1.0.0`, where report concepts were marked
canonical despite being derived publication data. Changing those flags does
not change report runtime behavior.

## Ontology schema

Each concept has:

- a stable `id`;
- a semantic `kind`, label, and description;
- canonical ownership and implementation maturity;
- an optional parent;
- serializable value metadata;
- optional canonical field, schema, SVYR, and engine bindings;
- source traceability using repository symbol identifiers rather than absolute
  file paths.

Concept kinds used in v1 are:

`entity`, `field`, `attribute`, `workflow`, `value`, `publication`, `adjunct`.

## Canonical entities and attributes

| ID | Label | Kind | Parent | Ownership | Maturity |
| --- | --- | --- | --- | --- | --- |
| `active_job` | Active job | entity | — | job state | implemented |
| `property` | Property | entity | `active_job` | job state | implemented |
| `property.address` | Structured address | entity | `property` | job state | implemented |
| `property.display_address` | Display address | attribute | `property` | job state | implemented |
| `property.instruction_type` | Instruction type | attribute | `property` | job state | type-only |
| `inspection_brief` | Inspection brief | entity | — | engine record | implemented |
| `inspection_brief.instruction` | Instruction | entity | `inspection_brief` | engine record | implemented |
| `field_completion_metadata` | Field completion metadata | entity | — | engine record | type-only |
| `field_completion_metadata.not_applicable` | Not applicable | attribute | `field_completion_metadata` | engine record | type-only |
| `field_completion_metadata.invalid` | Invalid | attribute | `field_completion_metadata` | engine record | type-only |

`property.instruction_type` is represented because it exists in
`ActiveProperty`, but it is not currently populated by the address-selection
flow. The ontology marks it `type-only`; it must not be treated as captured
report data.

## Inspection finding slice

The first canonical inspection slice is deliberately limited to one building
element:

```text
building_element
└── building_element.external_wall
```

| ID | Meaning | Ownership | Value |
| --- | --- | --- | --- |
| `inspection` | The active job's inspection record | job state | object |
| `inspection.finding` | A stable-ID canonical finding | engine record | object |
| `building_element` | Subject classification for a finding | engine record | object |
| `building_element.external_wall` | The single implemented element value | engine record | text |
| `observation` | What the surveyor directly observed | engine record | required text |
| `condition` | Project-neutral condition assessment | engine record | optional text |
| `defect` | Identified adverse condition | engine record | optional text |
| `recommendation` | Recommended action | engine record | optional text |
| `evidence` | Stable supporting-evidence reference | engine record | optional object |

`InspectionFinding` is stored in `InspectionRecord.findings`, keyed by its
stable `id`. `survey.inspection.finding.upsert` replaces the record at that key;
`survey.inspection.finding.read` reads it. The operation normalizes text and
evidence IDs. Editing therefore updates one finding without creating a
duplicate.

Condition is free text because no project-neutral condition scale currently
exists. Evidence is only `{ id }`; capture, media storage, EXIF, annotation,
and gallery behavior remain outside this ontology slice.

Canonical example:

```text
elementConceptId: building_element.external_wall
observation: Stepped cracking above rear opening.
defect: Masonry cracking.
recommendation: Obtain structural engineer advice.
evidence: photo-001
```

## Structured property address

Property identity belongs to adjacent canonical job state, not to a Muffle
Engine operation. These concepts are derived from `StructuredAddress`:

| ID | Label | Value type |
| --- | --- | --- |
| `property.address.formatted_address` | Formatted address | text |
| `property.address.line_1` | Address line 1 | text |
| `property.address.line_2` | Address line 2 | text |
| `property.address.line_3` | Address line 3 | text |
| `property.address.line_4` | Address line 4 | text |
| `property.address.street_number` | Street number | text |
| `property.address.building_name` | Building name | text |
| `property.address.sub_building_name` | Sub-building name | text |
| `property.address.sub_building_number` | Sub-building number | text |
| `property.address.route` | Street | text |
| `property.address.locality` | Locality | text |
| `property.address.town_or_city` | Town or city | text |
| `property.address.administrative_area` | Administrative area | text |
| `property.address.district` | District | text |
| `property.address.postal_code` | Postcode | text |
| `property.address.country` | Country | text |
| `property.address.country_code` | Country code | text |
| `property.address.latitude` | Latitude | number |
| `property.address.longitude` | Longitude | number |

`StructuredAddress.placeId` is deliberately not an ontology concept. It is a
provider identifier, not core surveying meaning. Coordinates remain job-state
address attributes and are excluded from the current report address model.

## Canonical field relationships

Field concepts are generated from `allFieldDefinitions()` so value types,
options, requiredness, paths, and operation IDs are not duplicated manually.
Only semantic IDs and concise definitions are curated in the ontology.

| Ontology ID | Canonical field ID | Schema/SVYR path | Value | Completion | Maturity |
| --- | --- | --- | --- | --- | --- |
| `inspection_brief.instruction.instructing_party` | `instruction.instructingParty` | `prep/brief/instr/party` | text | required | engine-backed |
| `inspection_brief.instruction.client` | `instruction.client` | `prep/brief/instr/client` | text | optional | schema-only |
| `inspection_brief.instruction.reference` | `instruction.reference` | `prep/brief/instr/ref` | text | optional | schema-only |
| `inspection_brief.instruction.source` | `instruction.source` | `prep/brief/instr/source` | single-select/custom text | required | engine-backed |
| `inspection_brief.purpose` | `purpose` | `prep/brief/purp` | text | required | schema-only |
| `inspection_brief.deliverable` | `deliverable` | `prep/brief/deliv` | text | required | schema-only |
| `inspection_brief.limitation` | `limitation` | `prep/brief/limit` | text | required | schema-only |

“Schema-only” means the canonical record slot and field definition exist, but
there is no current engine operation that can commit the field.

### Instruction source values

The following values come directly from the field schema:

- `inspection_brief.instruction.source.email`
- `inspection_brief.instruction.source.portal`
- `inspection_brief.instruction.source.phone`
- `inspection_brief.instruction.source.letter`
- `inspection_brief.instruction.source.internal`
- `inspection_brief.instruction.source.other`

The current normalizer also accepts non-empty custom source text. The six
values above are therefore canonical options, not an exhaustive closed enum.

## SVYR relationships

The workflow concepts below reflect real schema directories and registry
paths. They are navigation/workflow concepts, not canonical survey entities:

| Ontology ID | SVYR path | Token | Parent |
| --- | --- | --- | --- |
| `workflow.preparation` | `prep` | `prep` | — |
| `workflow.preparation.brief` | `prep/brief` | `brief` | `workflow.preparation` |
| `workflow.preparation.brief.instruction` | `prep/brief/instr` | `instr` | `workflow.preparation.brief` |

`pin`, `unpin`, `lookup`, parser result types, autocomplete placeholders, and
display separators are interactions or grammar and are not ontology concepts.

Disabled presentation tokens remain outside the command registry. The new
`evidence` ontology concept comes from the canonical finding domain type, not
from the disabled presentation token.

## Aliases discovered

Only explicit aliases in `COMMAND_ALIASES` are included:

| Current term | Canonical SVYR token | Ontology concept |
| --- | --- | --- |
| `instruction`, `instructions` | `instr` | `workflow.preparation.brief.instruction` |
| `purpose` | `purp` | `inspection_brief.purpose` |
| `deliverable` | `deliv` | `inspection_brief.deliverable` |
| `limitation`, `limitations` | `limit` | `inspection_brief.limitation` |
| `reference` | `ref` | `inspection_brief.instruction.reference` |

`client` and `instructing party` are separate canonical fields. They are not
aliases and are not automatically merged for firm mapping.

## Report concepts

| ID | Label | Parent | Source |
| --- | --- | --- | --- |
| `report_document` | Report document | — | `ReportDocument` |
| `report.identity` | Identity block | `report_document` | `IdentityBlock` |
| `report.identity.address` | Report address | `report.identity` | `ReportAddress` |
| `report.finding` | Finding block | `report_document` | `FindingBlock` |

Report concepts describe the semantic publication model, not PDF pages or app
screens. All report concepts are `canonical: false`: they are derived from
canonical job/engine records.

The neutral projector emits `External wall` while retaining
`building_element.external_wall`. The demo `FirmAdapter` applies the explicit
mapping:

```text
Main Walls → building_element.external_wall
```

For output, the reverse lookup presents the section heading `Main Walls`.
Neither direction changes the finding's canonical element concept ID.

## Notes

`note` is an adjunct concept:

- `canonical: false`;
- ownership `adjunct-state`;
- completion `excluded`;
- not evidence;
- not included in the current report projector.

This preserves the existing separation implemented by `SvyrNotesByPath`.

## Terminology and ambiguity audit

| Finding | Treatment |
| --- | --- |
| `instr` / Instruction, `purp` / Purpose, `deliv` / Deliverables, `limit` / Limitations | Machine concept ID is separate from SVYR token and display label |
| Client vs instructing party | Kept as distinct fields; ambiguity prevents merging |
| Singular `deliverable` / plural “Deliverables” | One concept bound to canonical field ID `deliverable` |
| Singular `limitation` / plural “Limitations” | One concept bound to canonical field ID `limitation` |
| Registry says source is “not yet implemented” but source has engine operations | Schema and operations determine maturity; registry copy remains an audited inconsistency |
| Registry requiredness differs for client/reference | Completion semantics come from field schema |
| Source options duplicated in UI fallback | Ontology derives options only from field schema |
| `notesEnabled: false` but party note wiring exists | Note remains adjunct; no field is reclassified |
| “Cause” in Loqate errors | Not a surveying cause concept |

## Current semantic gaps

| Candidate | Status | Repository evidence |
| --- | --- | --- |
| Cause | Not yet canonical | No finding property or operation |
| Implication | Not yet canonical | No finding property or operation |
| Significance | Not yet canonical | No finding property or operation |
| Risk | Not yet canonical | No finding property or operation |
| Further investigation | Not yet canonical | Kept distinct from recommendation |
| Finding-level limitation | Not yet canonical | Brief-level limitation is a separate concept |
| Legal matter | Not yet canonical | No finding property or operation |
| Summary propagation | Not implemented | One finding maps to one report block only |
| Condition-scale mapping | Not implemented | Condition remains project-neutral text |
| Construction | Does not exist | No domain representation |
| Limitation | Partially exists | Brief field/schema slot; no engine write |

No roof, windows, services, floors, grounds, defect taxonomy, firm condition
scale, or full report ontology is introduced in `1.1.0`.

## Validation

`validateMuffleOntologyV1()` verifies:

- ontology ID and version;
- unique concept IDs;
- resolvable parents;
- source traceability;
- normalized alias uniqueness;
- one ontology mapping for every field definition;
- canonical field, schema path, value options, and operation alignment;
- resolvable and unambiguous SVYR mappings;
- exact alias agreement with `COMMAND_ALIASES`;
- deterministic JSON serialization.

The ontology is not imported by the application UI, controller, parser, engine,
completion logic, or report renderer. It remains an extracted semantic
contract with validation back to runtime sources.
