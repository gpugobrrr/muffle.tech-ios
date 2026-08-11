import {
  COMMAND_ALIASES,
  findCommandNode,
} from '@/lib/command-registry';
import { allFieldDefinitions } from '@/lib/field-schema';
import {
  MUFFLE_ONTOLOGY_V1,
  serializeMuffleOntologyV1,
  type MuffleOntologyV1,
} from '@/domain/ontology/muffle-ontology.v1';

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function validateMuffleOntologyV1(
  ontology: MuffleOntologyV1 = MUFFLE_ONTOLOGY_V1,
): string[] {
  const failures: string[] = [];
  if (ontology.ontologyId !== 'muffle-ontology') {
    failures.push('ontologyId must be "muffle-ontology"');
  }
  if (ontology.version !== '1.2.0') {
    failures.push('ontology version must be "1.2.0"');
  }

  const byId = new Map<string, number>();
  for (const concept of ontology.concepts) {
    byId.set(concept.id, (byId.get(concept.id) ?? 0) + 1);
  }
  for (const [id, count] of byId) {
    if (count > 1) failures.push(`duplicate concept id: ${id}`);
  }

  for (const concept of ontology.concepts) {
    if (concept.parentId && !byId.has(concept.parentId)) {
      failures.push(
        `${concept.id}: unresolved parentId "${concept.parentId}"`,
      );
    }
    if (concept.source.length === 0) {
      failures.push(`${concept.id}: source traceability is required`);
    }

    const aliases = concept.aliases?.map(normalize) ?? [];
    if (new Set(aliases).size !== aliases.length) {
      failures.push(`${concept.id}: aliases are not unique after normalization`);
    }
  }

  const schemaFields = allFieldDefinitions();
  const schemaById = new Map(
    schemaFields.map((field) => [field.fieldId, field]),
  );
  const ontologyFieldConcepts = ontology.concepts.filter(
    (concept) => concept.bindings?.canonicalFieldId,
  );

  for (const concept of ontologyFieldConcepts) {
    const fieldId = concept.bindings?.canonicalFieldId;
    const field = fieldId ? schemaById.get(fieldId) : undefined;
    if (!field) {
      failures.push(
        `${concept.id}: canonicalFieldId "${fieldId}" is not in field schema`,
      );
      continue;
    }
    if (concept.bindings?.schemaPath !== field.pathKey) {
      failures.push(`${concept.id}: schemaPath does not match field schema`);
    }
    if (concept.bindings?.svyrToken !== field.token) {
      failures.push(`${concept.id}: svyrToken does not match field schema`);
    }
    if (concept.bindings?.setOperationId !== field.operationId) {
      failures.push(`${concept.id}: set operation does not match field schema`);
    }
    if (concept.bindings?.readOperationId !== field.readOperationId) {
      failures.push(`${concept.id}: read operation does not match field schema`);
    }
    const optionValues = field.options?.map((option) => option.value);
    if (
      JSON.stringify(concept.valueType?.options) !==
      JSON.stringify(optionValues)
    ) {
      failures.push(`${concept.id}: value options do not match field schema`);
    }
  }

  for (const field of schemaFields) {
    const matches = ontologyFieldConcepts.filter(
      (concept) => concept.bindings?.canonicalFieldId === field.fieldId,
    );
    if (matches.length !== 1) {
      failures.push(
        `${field.fieldId}: expected one ontology field mapping, found ${matches.length}`,
      );
    }
  }

  const conceptsByToken = new Map<string, string[]>();
  for (const concept of ontology.concepts) {
    const token = concept.bindings?.svyrToken;
    const path = concept.bindings?.svyrPath;
    if (!token) continue;

    conceptsByToken.set(token, [
      ...(conceptsByToken.get(token) ?? []),
      concept.id,
    ]);
    if (!path) {
      failures.push(`${concept.id}: svyrToken requires svyrPath`);
      continue;
    }
    const node = findCommandNode(path.split('/'));
    if (!node || node.token !== token) {
      failures.push(
        `${concept.id}: SVYR mapping "${path}" → "${token}" does not resolve`,
      );
    }
  }
  for (const [token, conceptIds] of conceptsByToken) {
    if (conceptIds.length > 1) {
      failures.push(
        `ambiguous SVYR token "${token}": ${conceptIds.join(', ')}`,
      );
    }
  }

  for (const concept of ontology.concepts) {
    const token = concept.bindings?.svyrToken;
    if (!token) continue;
    const expectedAliases = Object.entries(COMMAND_ALIASES)
      .filter(([, target]) => target === token)
      .map(([alias]) => alias)
      .sort();
    const actualAliases = [...(concept.aliases ?? [])].sort();
    if (JSON.stringify(actualAliases) !== JSON.stringify(expectedAliases)) {
      failures.push(`${concept.id}: aliases do not match COMMAND_ALIASES`);
    }
  }

  try {
    const serialized = JSON.stringify(ontology);
    JSON.parse(serialized);
    if (
      ontology === MUFFLE_ONTOLOGY_V1 &&
      serializeMuffleOntologyV1(0) !== serialized
    ) {
      failures.push('ontology serialization is not deterministic');
    }
  } catch (error) {
    failures.push(`ontology is not JSON serializable: ${String(error)}`);
  }

  return failures;
}
