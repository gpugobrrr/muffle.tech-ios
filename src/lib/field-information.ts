import { parseEditableCommand } from '@/lib/command-edit';
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
 * Keys are space-joined lowercased token arrays (not the visible slash syntax).
 * Path resolution must not drive the visible info bar — only execution does.
 */
const FIELD_PATHS: Record<string, FieldPathDefinition> = {
  'prep brief instr party': {
    key: 'Instructing party',
    read: (state) => state.inspectionBrief.instruction.instructingParty,
  },
  'prep brief instr client': {
    key: 'Client',
    read: (state) => state.inspectionBrief.instruction.client,
  },
  'prep brief instr ref': {
    key: 'Instruction reference',
    read: (state) => state.inspectionBrief.instruction.reference,
  },
};

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
  const key = commandPath
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
    .join(' ');

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
