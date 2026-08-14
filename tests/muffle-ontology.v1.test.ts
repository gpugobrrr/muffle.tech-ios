import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MUFFLE_ONTOLOGY_V1,
  findOntologyAliases,
  getConceptByCanonicalField,
  getConceptBySvyrToken,
  getOntologyConcept,
  serializeMuffleOntologyV1,
} from '../src/domain/ontology/muffle-ontology.v1';
import { validateMuffleOntologyV1 } from '../src/domain/ontology/validate-muffle-ontology.v1';
import { allFieldDefinitions } from '../src/lib/field-schema';

test('muffle ontology v1 satisfies its structural and source contracts', () => {
  assert.deepEqual(validateMuffleOntologyV1(), []);
  assert.equal(MUFFLE_ONTOLOGY_V1.ontologyId, 'muffle-ontology');
  assert.equal(MUFFLE_ONTOLOGY_V1.version, '1.2.0');
});

test('concept identifiers are unique and parents resolve', () => {
  const ids = MUFFLE_ONTOLOGY_V1.concepts.map((concept) => concept.id);
  assert.equal(new Set(ids).size, ids.length);

  for (const concept of MUFFLE_ONTOLOGY_V1.concepts) {
    if (concept.parentId) {
      assert.ok(getOntologyConcept(concept.parentId));
    }
  }
});

test('every unique field-schema id has ontology field semantics', () => {
  const seenFieldIds = new Set<string>();
  for (const field of allFieldDefinitions()) {
    if (seenFieldIds.has(field.fieldId)) continue;
    seenFieldIds.add(field.fieldId);
    const concept = getConceptByCanonicalField(field.fieldId);
    assert.ok(concept, field.fieldId);
    assert.equal(typeof concept.id, 'string');
    assert.ok(concept.id.length > 0, field.fieldId);
    assert.equal(concept.bindings?.canonicalFieldId, field.fieldId);
  }

  const electricity = getConceptByCanonicalField(
    'property.energy.mains_services.electricity',
  );
  assert.equal(electricity?.id, 'property.energy.mains_services.electricity');
  assert.equal(
    electricity?.bindings?.schemaPath,
    'property/energy/mains-services/electricity',
  );
});

test('every current canonical field has exactly one ontology concept', () => {
  const seenFieldIds = new Set<string>();
  for (const field of allFieldDefinitions()) {
    if (seenFieldIds.has(field.fieldId)) continue;
    seenFieldIds.add(field.fieldId);
    const concept = getConceptByCanonicalField(field.fieldId);
    assert.ok(concept, field.fieldId);
    assert.equal(concept.bindings?.schemaPath, field.pathKey);
    assert.equal(concept.bindings?.svyrToken, field.token);
  }
});

test('SVYR tokens and explicit aliases resolve without semantic merging', () => {
  assert.equal(
    getConceptBySvyrToken('party')?.id,
    'inspection_brief.instruction.instructing_party',
  );
  assert.equal(
    findOntologyAliases('reference')[0]?.id,
    'inspection_brief.instruction.reference',
  );
  assert.equal(
    findOntologyAliases('instruction')[0]?.id,
    'workflow.preparation.brief.instruction',
  );
  assert.notEqual(
    getConceptByCanonicalField('instruction.client')?.id,
    getConceptByCanonicalField('instruction.instructingParty')?.id,
  );
});

test('source enumeration values are represented from the field schema', () => {
  const source = getConceptByCanonicalField('instruction.source');
  assert.deepEqual(source?.valueType?.options, [
    'email',
    'portal',
    'phone',
    'letter',
    'internal',
    'other',
  ]);
  for (const value of source?.valueType?.options ?? []) {
    assert.ok(
      getOntologyConcept(`inspection_brief.instruction.source.${value}`),
    );
  }
});

test('notes remain non-canonical, excluded from completion, and not evidence', () => {
  const note = getOntologyConcept('note');
  const evidence = getOntologyConcept('evidence');
  assert.equal(note?.canonical, false);
  assert.equal(note?.ownership, 'adjunct-state');
  assert.equal(note?.completion, 'excluded');
  assert.equal(evidence?.canonical, true);
  assert.equal(evidence?.bindings?.domainType, 'InspectionEvidenceReference');
  assert.notEqual(note?.id, evidence?.id);
});

test('property identity is canonical adjacent job state', () => {
  const property = getOntologyConcept('property');
  const address = getOntologyConcept('property.address');
  assert.equal(property?.canonical, true);
  assert.equal(property?.ownership, 'job-state');
  assert.equal(address?.bindings?.domainType, 'StructuredAddress');
  assert.equal(getOntologyConcept('property.address.place_id'), undefined);
});

test('inspection finding slice is canonical and engine-backed', () => {
  for (const id of [
    'inspection',
    'inspection.finding',
    'building_element',
    'building_element.external_wall',
    'observation',
    'condition',
    'defect',
    'recommendation',
    'evidence',
  ]) {
    const concept = getOntologyConcept(id);
    assert.ok(concept, id);
    assert.equal(concept.canonical, true, id);
    assert.equal(concept.introducedIn, '1.1.0', id);
  }
  assert.equal(
    getOntologyConcept('building_element.external_wall')?.parentId,
    'building_element',
  );
  assert.equal(
    getOntologyConcept('inspection.finding')?.bindings?.setOperationId,
    'survey.inspection.finding.upsert',
  );
});

test('human-approved v1.2 concepts remain canonical; inspection subjects may gain Engine bindings', () => {
  const typeOnlyBuildingElements = [
    'building_element.damp_proof_course',
    'building_element.fireplace',
    'building_element.porch',
    'building_element.staircase',
  ];
  const engineBackedBuildingElements = [
    'building_element.ceiling',
    'building_element.chimney',
    'building_element.external_door',
    'building_element.floor',
    'building_element.internal_wall',
    'building_element.rainwater_goods',
    'building_element.roof_covering',
    'building_element.roof_structure',
    'building_element.window',
  ];
  const typeOnlyFindingFields = ['cause', 'implication', 'significance'];
  const engineBackedFindingFields = [
    'limitation',
    'further_investigation',
    'risk',
  ];
  const approved = [
    ...typeOnlyBuildingElements,
    ...engineBackedBuildingElements,
    ...typeOnlyFindingFields,
    ...engineBackedFindingFields,
  ];

  const propertyDescriptionFields = [
    'property.type',
    'property.construction_period',
    'property.extension',
    'property.conversion',
  ];

  assert.equal(
    MUFFLE_ONTOLOGY_V1.concepts.filter(
      ({ introducedIn }) => introducedIn === '1.2.0',
    ).length,
    approved.length + propertyDescriptionFields.length + 1,
  );
  for (const id of approved) {
    const concept = getOntologyConcept(id);
    assert.ok(concept, id);
    assert.equal(concept.canonical, true, id);
    assert.equal(concept.introducedIn, '1.2.0', id);
    assert.equal(concept.ownership, 'engine-record', id);
    assert.ok(
      concept.source?.some(
        (source) =>
          source.type === 'ontology-review' &&
          source.id === 'canonical-promotion-batch-1',
      ),
      id,
    );
  }
  for (const id of typeOnlyBuildingElements) {
    const concept = getOntologyConcept(id);
    assert.equal(concept?.maturity, 'type-only', id);
    assert.equal(concept?.bindings, undefined, id);
    assert.equal(concept?.completion, undefined, id);
    assert.equal(concept?.parentId, 'building_element', id);
    assert.equal(concept?.kind, 'value', id);
    assert.deepEqual(concept?.valueType, { kind: 'text' }, id);
  }
  for (const id of engineBackedBuildingElements) {
    const concept = getOntologyConcept(id);
    assert.equal(concept?.maturity, 'engine-backed', id);
    assert.deepEqual(concept?.bindings, {
      domainProperty: 'InspectionFinding.elementConceptId',
    });
    assert.equal(concept?.parentId, 'building_element', id);
    assert.equal(concept?.kind, 'value', id);
    assert.deepEqual(concept?.valueType, { kind: 'text' }, id);
  }
  for (const id of typeOnlyFindingFields) {
    const concept = getOntologyConcept(id);
    assert.ok(concept, id);
    assert.equal(concept.maturity, 'type-only', id);
    assert.equal(concept.bindings, undefined, id);
    assert.equal(concept.completion, undefined, id);
    assert.equal(concept.parentId, 'inspection.finding', id);
    assert.equal(concept.kind, 'field', id);
    assert.deepEqual(concept.valueType, { kind: 'text', nullable: true }, id);
  }
  for (const id of engineBackedFindingFields) {
    const concept = getOntologyConcept(id);
    assert.ok(concept, id);
    assert.equal(concept.maturity, 'engine-backed', id);
    assert.equal(concept.parentId, 'inspection.finding', id);
    assert.equal(concept.kind, 'field', id);
    assert.deepEqual(concept.valueType, { kind: 'text', nullable: true }, id);
    assert.match(concept.bindings?.domainProperty ?? '', /^InspectionFinding\./);
  }
  assert.deepEqual(getOntologyConcept('limitation')?.bindings, {
    domainProperty: 'InspectionFinding.limitation',
  });
  assert.deepEqual(getOntologyConcept('further_investigation')?.bindings, {
    domainProperty: 'InspectionFinding.furtherInvestigation',
  });
  assert.deepEqual(getOntologyConcept('risk')?.bindings, {
    domainProperty: 'InspectionFinding.risk',
  });
  const bathroomFitting = getOntologyConcept('building_element.bathroom_fitting');
  assert.ok(bathroomFitting);
  assert.equal(bathroomFitting.canonical, true);
  assert.equal(bathroomFitting.introducedIn, '1.2.0');
  assert.equal(bathroomFitting.ownership, 'engine-record');
  assert.equal(bathroomFitting.maturity, 'engine-backed');
  assert.equal(bathroomFitting.parentId, 'building_element');
  assert.deepEqual(bathroomFitting.bindings, {
    domainProperty: 'InspectionFinding.elementConceptId',
  });
  assert.equal(
    bathroomFitting.source?.some(
      (source) =>
        source.type === 'ontology-review' &&
        source.id === 'canonical-promotion-batch-1',
    ),
    false,
  );
  assert.ok(
    bathroomFitting.source?.some(
      (source) =>
        source.type === 'domain-type' &&
        source.id === 'BuildingElementConceptId:building_element.bathroom_fitting',
    ),
  );
  assert.equal(
    getOntologyConcept('inspection_brief.limitation')?.id,
    'inspection_brief.limitation',
  );
  for (const id of propertyDescriptionFields) {
    const concept = getOntologyConcept(id);
    assert.ok(concept, id);
    assert.equal(concept.canonical, true, id);
    assert.equal(concept.introducedIn, '1.2.0', id);
    assert.equal(concept.kind, 'field', id);
    assert.equal(concept.maturity, 'engine-backed', id);
    assert.equal(concept.bindings?.canonicalFieldId, id);
  }
});

test('report concepts are derived rather than canonical survey truth', () => {
  for (const id of [
    'report_document',
    'report.identity',
    'report.identity.address',
    'report.finding',
  ]) {
    const concept = getOntologyConcept(id);
    assert.equal(concept?.canonical, false, id);
    assert.equal(concept?.ownership, 'report-model', id);
  }
});

test('v1.0.0 concepts remain present in the additive v1.2.0 registry', () => {
  const originalConcepts = MUFFLE_ONTOLOGY_V1.concepts.filter(
    (concept) => concept.introducedIn === '1.0.0',
  );
  assert.equal(originalConcepts.length, 49);
});

test('deferred and unapproved survey semantics remain absent', () => {
  for (const absentId of [
    'construction',
    'building_element.foundation',
    'building_element.driveway',
    'building_element.garage',
    'measurement',
    'building_element.balcony',
    'building_element.boundary',
    'building_element.external_drainage',
    'building_element.external_finish',
    'building_element.gas_installation',
    'building_element.hot_water_system',
    'building_element.internal_door',
    'building_element.renewable_energy_system',
    'building_element.retaining_wall',
    'building_element.roof_void',
    'legal_matter',
    'summary',
  ]) {
    assert.equal(getOntologyConcept(absentId), undefined, absentId);
  }
  assert.equal(findOntologyAliases('Main Walls').length, 0);
  assert.equal(findOntologyAliases('D4 Main Walls').length, 0);
  assert.equal(
    MUFFLE_ONTOLOGY_V1.concepts.some(
      ({ id }) => id.startsWith('candidate-relation.'),
    ),
    false,
  );
});

test('serialization is deterministic JSON with no executable values', () => {
  const first = serializeMuffleOntologyV1();
  const second = serializeMuffleOntologyV1();
  assert.equal(first, second);
  assert.deepEqual(JSON.parse(first), MUFFLE_ONTOLOGY_V1);
  assert.equal(first.includes('[Function'), false);
});
