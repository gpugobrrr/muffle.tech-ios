import { parseEditableCommand } from '@/lib/command-edit';
import { findFieldDefinition, resolveFieldValue, toSchemaPath } from '@/lib/field-schema';
import type { InspectionBrief } from '@/types/workspace';

export type ResolvedFieldInformation = {
  key: string;
  value: string;
} | null;

/**
 * Visible SVYR result produced only by a successful command execution.
 * Never derived from the current navigation path alone.
 */
export type SvyrExecutionResult = {
  operationId: string;
  label: string;
  value: string;
  executedCommand: string;
} | null;

export type SurveyFieldState = {
  inspectionBrief: InspectionBrief;
};

type FieldPathDefinition = {
  key: string;
  read: (state: SurveyFieldState) => string | null | undefined;
};

/**
 * Registered field paths for internal lookups.
 * Keys are slash-based schema paths so the lookup layer shares the same
 * source of truth as completion and execution.
 */
const FIELD_PATHS: Record<string, FieldPathDefinition> = {};

function registerFieldPath(path: string[], key: string): void {
  FIELD_PATHS[toSchemaPath(path)] = {
    key,
    read: (state) => {
      const fieldDefinition = findFieldDefinition(path);
      if (!fieldDefinition?.fieldId) return null;
      return resolveFieldValue(state.inspectionBrief, fieldDefinition.fieldId);
    },
  };
}

registerFieldPath(['prep', 'brief', 'instr', 'party'], 'Instructing party');
registerFieldPath(['prep', 'brief', 'instr', 'client'], 'Client');
registerFieldPath(['prep', 'brief', 'instr', 'ref'], 'Instruction reference');
registerFieldPath(['prep', 'brief', 'instr', 'source'], 'Source');
registerFieldPath(['prep', 'brief', 'purp'], 'Purpose');
registerFieldPath(['prep', 'brief', 'deliv'], 'Deliverables');
registerFieldPath(['prep', 'brief', 'limit'], 'Limitations');

export function formatFieldInformation(
  resolved: NonNullable<ResolvedFieldInformation>,
): string {
  return `${resolved.key} · ${resolved.value}`;
}

export function formatExecutionResult(
  result: NonNullable<SvyrExecutionResult>,
): string {
  return `${result.label} · ${result.value}`;
}

/**
 * Match a registered field path and return its currently saved value.
 * Returns null when the path is unregistered or the value is unset.
 * Callers must not render this as live path preview in the info bar.
 */
export function resolveStoredFieldInformation(
  commandPath: string[],
  surveyState: SurveyFieldState,
): ResolvedFieldInformation {
  const key = toSchemaPath(commandPath);

  if (!key) {
    return null;
  }

  const field = FIELD_PATHS[key];
  if (!field) {
    return null;
  }

  const value = field.read(surveyState);
  if (value == null || value.trim() === '') {
    return null;
  }

  return {
    key: field.key,
    value,
  };
}

/**
 * Build the absolute structured command path from pin + editable suffix,
 * ignoring any free-text value currently being typed.
 */
export function structuredCommandPathFromInput(
  commandSuffix: string,
  pinnedPrefix: string[],
): string[] {
  const parsed = parseEditableCommand(commandSuffix, pinnedPrefix);
  return [
    ...pinnedPrefix.map((token) => token.toLowerCase()),
    ...parsed.structuredTokens.map((token) => token.toLowerCase()),
  ];
}
