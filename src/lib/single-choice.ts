import { usesSingleChoicePresentation } from '@/lib/data-entry-types';
import {
  normalizeFieldInputValue,
  type FieldDefinition,
} from '@/lib/field-schema';

export type SingleChoiceSuggestion = {
  type: 'choice';
  id: string;
  label: string;
  description: string;
  canonicalValue: string;
  available: boolean;
  selected: boolean;
};

/** Derive tap targets from the field schema's sole authoritative option list. */
export function buildSingleChoiceSuggestions(
  field: FieldDefinition,
  currentValue: string | null | undefined,
): SingleChoiceSuggestion[] {
  if (!usesSingleChoicePresentation(field)) {
    return [];
  }

  const normalizedCurrentValue = currentValue
    ? normalizeFieldInputValue(field, currentValue)
    : null;

  return (field.options ?? []).map((option) => ({
    type: 'choice',
    id: `choice-${field.pathKey}-${option.value}`,
    label: option.label,
    description: `Set ${field.label.toLowerCase()} to ${option.label}.`,
    canonicalValue: option.value,
    available: option.available !== false,
    selected: option.value === normalizedCurrentValue,
  }));
}
