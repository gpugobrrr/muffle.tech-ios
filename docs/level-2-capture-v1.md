# Level 2 capture shell v1

The Level 2 capture shell uses the RICS Home Survey Level 2 document as a
requirements corpus. It does not copy report section codes into canonical
semantics.

The layers remain separate:

- RICS publication wording describes required report coverage.
- SVYR routes provide low-friction inspection context.
- Muffle Engine operations own canonical record changes.
- FirmAdapter and report projection will later place canonical meaning into
  publication sections.

The authoritative, deterministic coverage manifest is
`LEVEL_2_COVERAGE_MANIFEST` in `src/lib/level-2-capture.ts`. It is derived from
the same command nodes used by the existing SVYR parser and menu renderer.

## Status meanings

- `interactive`: the route can commit through an existing canonical operation.
- `pre-populated`: existing job/property state supplies the value.
- `navigation-only`: a domain concept or coverage destination exists, but no
  supported write is available.
- `derived-publication`: the content should be projected from canonical capture.
- `blocked`: required semantics or Engine support do not yet exist.

## Route tree

```text
SVYR
├─ prep
│  ├─ brief
│  │  ├─ instr
│  │  │  ├─ party
│  │  │  ├─ client
│  │  │  ├─ ref
│  │  │  └─ source
│  │  ├─ purp
│  │  ├─ deliv
│  │  └─ limit
│  ├─ scope
│  ├─ access
│  ├─ equipment
│  ├─ plan
│  └─ ready
├─ property
│  ├─ address
│  ├─ type
│  ├─ age
│  ├─ extension
│  ├─ conversion
│  ├─ flat
│  ├─ construction
│  ├─ accommodation
│  ├─ roof-spaces
│  ├─ energy
│  │  ├─ mains-services
│  │  └─ heating
│  ├─ location
│  │  ├─ grounds
│  │  ├─ facilities
│  │  └─ environment
├─ external
│  ├─ limitation
│  ├─ chimney
│  ├─ roof
│  ├─ rainwater
│  ├─ walls
│  │  ├─ observe
│  │  ├─ condition
│  │  ├─ defect
│  │  ├─ recommend
│  │  ├─ limit
│  │  ├─ further
│  │  ├─ risk
│  │  └─ evidence
│  ├─ windows
│  ├─ doors
│  ├─ porch
│  ├─ joinery
│  └─ other
├─ internal
│  ├─ limitation
│  ├─ roof-structure
│  ├─ ceilings
│  ├─ walls-partitions
│  ├─ floors
│  ├─ fireplaces-flues
│  ├─ built-ins
│  ├─ woodwork
│  ├─ bathroom
│  └─ other
├─ services
│  ├─ limitation
│  ├─ electricity
│  ├─ gas-oil
│  ├─ water
│  ├─ heating
│  ├─ water-heating
│  ├─ drainage
│  └─ common
├─ grounds
│  ├─ limitation
│  ├─ garage
│  ├─ outbuildings
│  └─ other
├─ evidence
├─ summary
└─ report
```

## Interactive capture

PREP retains its existing behavior. In the current brief, only instructing
party and source have write/read operations. Other established PREP fields
remain visible and schema-defined but do not gain fabricated operations.

`external/walls` is the only Level 2 inspection subject with runtime finding
support because `building_element.external_wall` is the only current
`BuildingElementConceptId`.

These leaves use the existing `survey.inspection.finding.upsert` operation:

- `external/walls/observe`
- `external/walls/condition`
- `external/walls/defect`
- `external/walls/recommend`
- `external/walls/evidence`

The shell uses stable finding ID `finding.external-wall.1`. Observation creates
the finding. Optional fields require that observation first. Evidence input is
a stable reference ID only; the shell does not claim to acquire or store media.

## Gap totals

The manifest contains 65 requirement/routes:

- 7 interactive;
- 1 pre-populated;
- 13 navigation-only;
- 2 derived/publication;
- 42 blocked.

## Technical gap report

Property:

- `property/address` — pre-populated from `ActiveJob.property.address`.
- All other property routes — blocked by missing property-description,
  construction, accommodation, EPC, service-presence or location schemas.
- Later work should distinguish imported facts, surveyor observations and
  derived data before adding operations.

External:

- `external/walls` and its five supported leaves — interactive through the
  existing external-wall finding operation.
- `external/chimney`, `external/rainwater`, `external/windows` and
  `external/porch` — navigation-only because their ontology concepts are
  type-only.
- Roof, doors, joinery, other and limitations — blocked by unresolved subject
  or limitation semantics.

Internal:

- Ceiling, fireplace and staircase-related routes — navigation-only because
  the available concepts are type-only.
- Roof structure, partitions, floors, built-ins, bathroom, other and
  limitations — blocked by unresolved canonical/Engine models.

Services:

- All routes are blocked. They intentionally imply visual coverage only and do
  not imply specialist testing, safety certification or operation.

Grounds:

- All routes are blocked pending the separately deferred site/grounds taxonomy.
  Garage and outbuilding are not promoted by this shell.

Evidence, summary and report:

- Top-level evidence is navigation-only; evidence references are captured once
  on findings.
- Summary and report are derived/publication destinations. They do not create
  duplicate manual fields.

Cross-cutting blockers:

- Finding-level and section limitations remain distinct from PREP brief
  limitations.
- Condition ratings remain unresolved and are not represented as canonical
  values.
- Cause, further investigation, implication, risk and significance are
  type-only ontology concepts and receive no bindings here.
- No Level 2 completion model exists. Existing PREP completion remains
  unchanged and navigation never implies completion.
- Notes remain path-keyed adjunct state, non-evidence and excluded from
  completion/report projection.
