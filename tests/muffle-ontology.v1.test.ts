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
  assert.equal(MUFFLE_ONTOLOGY_V1.version, '1.1.0');
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

test('every current canonical field has exactly one ontology concept', () => {
  for (const field of allFieldDefinitions()) {
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

test('v1.0.0 concepts remain present in the additive v1.1.0 registry', () => {
  const originalConcepts = MUFFLE_ONTOLOGY_V1.concepts.filter(
    (concept) => concept.introducedIn === '1.0.0',
  );
  assert.equal(originalConcepts.length, 49);
});

test('unsupported survey semantics remain absent', () => {
  for (const absentId of [
    'construction',
    'cause',
    'implication',
    'significance',
    'risk',
    'further_investigation',
    'legal_matter',
    'summary',
  ]) {
    assert.equal(getOntologyConcept(absentId), undefined, absentId);
  }
});

test('serialization is deterministic JSON with no executable values', () => {
  const first = serializeMuffleOntologyV1();
  const second = serializeMuffleOntologyV1();
  assert.equal(first, second);
  assert.deepEqual(JSON.parse(first), MUFFLE_ONTOLOGY_V1);
  assert.equal(first.includes('[Function'), false);
});
