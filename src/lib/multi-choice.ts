import type { FieldDefinition } from '@/lib/field-schema';

export type MultiChoiceOptionSuggestion = {
  type: 'choice';
  id: string;
  label: string;
  description: string;
  canonicalValue: string;
  available: boolean;
  selected: boolean;
};

export type MultiChoiceCommitSuggestion = {
  type: 'multi-commit';
  id: string;
  label: 'done';
  description: string;
  available: boolean;
};

export type MultiChoiceSuggestion =
  | MultiChoiceOptionSuggestion
  | MultiChoiceCommitSuggestion;

export type MultiChoicePrepareResult =
  | {
      ok: true;
      /** Schema-ordered canonical values ready for Engine write. */
      values: string[];
      /** True when the registered field declares a controlled set operation. */
      engineWritable: boolean;
    }
  | { ok: false; message: string };

/** Toggle membership in a working selection (order is not significant). */
export function toggleMultiChoiceValue(
  selected: readonly string[],
  canonicalValue: string,
): string[] {
  if (selected.includes(canonicalValue)) {
    return selected.filter((value) => value !== canonicalValue);
  }
  return [...selected, canonicalValue];
}

/**
 * Project a selection into schema option order.
 * Controlled vocabulary order is authoritative; user tap order is not.
 */
export function orderMultiChoiceValues(
  field: FieldDefinition,
  selected: readonly string[],
): string[] {
  const selectedSet = new Set(selected);
  return (field.options ?? [])
    .filter(
      (option) =>
        option.available !== false && selectedSet.has(option.value),
    )
    .map((option) => option.value);
}

/**
 * Validate a whole selection against the field schema.
 * Rejects unknown / unavailable values; does not invent Engine writes.
 */
export function normalizeMultiChoiceValues(
  field: FieldDefinition,
  selected: readonly string[],
): string[] | null {
  if (field.valueType !== 'multiSelect') return null;

  const availableValues = new Set(
    (field.options ?? [])
      .filter((option) => option.available !== false)
      .map((option) => option.value),
  );

  for (const value of selected) {
    if (!availableValues.has(value)) return null;
  }

  return orderMultiChoiceValues(field, selected);
}

/** Prepare an atomic multi-choice commit without mutating canonical state. */
export function prepareMultiChoiceCommit(
  field: FieldDefinition,
  selected: readonly string[],
): MultiChoicePrepareResult {
  if (field.valueType !== 'multiSelect') {
    return { ok: false, message: 'Not a multi-choice field' };
  }

  const values = normalizeMultiChoiceValues(field, selected);
  if (!values) {
    return { ok: false, message: 'Choose available options only' };
  }

  // Registered set-valued controlled fields write through the generic Engine op.
  return {
    ok: true,
    values,
    engineWritable: field.operationId === 'survey.controlled_fact_set.set',
  };
}

/** Derive toggle targets + explicit [done] from the schema option list. */
export function buildMultiChoiceSuggestions(
  field: FieldDefinition,
  selectedValues: readonly string[],
): MultiChoiceSuggestion[] {
  if (field.valueType !== 'multiSelect') return [];

  const selectedSet = new Set(selectedValues);
  const options: MultiChoiceSuggestion[] = (field.options ?? []).map(
    (option) => ({
      type: 'choice' as const,
      id: `multi-choice-${field.pathKey}-${option.value}`,
      label: option.label,
      description: selectedSet.has(option.value)
        ? `Remove ${option.label} from ${field.label.toLowerCase()}.`
        : `Add ${option.label} to ${field.label.toLowerCase()}.`,
      canonicalValue: option.value,
      available: option.available !== false,
      selected: selectedSet.has(option.value),
    }),
  );

  return [
    ...options,
    {
      type: 'multi-commit',
      id: `multi-choice-commit-${field.pathKey}`,
      label: 'done',
      description: `Commit ${field.label.toLowerCase()} selection.`,
      available: true,
    },
  ];
}
