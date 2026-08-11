import type { FieldDefinition } from '@/lib/field-schema';

export type NumericFieldConstraints = {
  /** When true, reject any decimal point. */
  integer?: boolean;
  min?: number;
  max?: number;
  /** Maximum digits after the decimal point when decimals are allowed. */
  maxFractionDigits?: number;
  /**
   * Display-only unit (e.g. `%`, `m`). Never concatenated into the canonical
   * scalar string unless a future field explicitly requires that encoding.
   */
  displayUnit?: string;
  /** Opt-in; most survey quantities disallow negatives. */
  allowNegative?: boolean;
};

export type NumericPrepareResult =
  | {
      ok: true;
      value: string;
      /** True only when the field declares an Engine write operation. */
      engineWritable: boolean;
    }
  | { ok: false; message: string };

/** True when the field is the reusable scalar numeric capture kind. */
export function isNumericField(
  field: FieldDefinition | null | undefined,
): field is FieldDefinition & { valueType: 'number' } {
  return field?.valueType === 'number';
}

/**
 * Validate and normalize a raw numeric draft into the canonical scalar string.
 *
 * Intermediate editing states such as `1.` are invalid at commit time.
 * No silent coercion of malformed input (`12..5`, `abc12`).
 */
export function normalizeNumericFieldInput(
  field: FieldDefinition,
  input: string,
): string | null {
  if (field.valueType !== 'number') return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  const constraints = field.numeric ?? {};
  const allowNegative = Boolean(constraints.allowNegative);
  const integerOnly = Boolean(constraints.integer);

  // Exact shape only — no locale commas, no scientific notation.
  const pattern = integerOnly
    ? allowNegative
      ? /^-?\d+$/
      : /^\d+$/
    : allowNegative
      ? /^-?\d+(\.\d+)?$/
      : /^\d+(\.\d+)?$/;

  if (!pattern.test(trimmed)) return null;

  if (!integerOnly && typeof constraints.maxFractionDigits === 'number') {
    const fraction = trimmed.split('.')[1];
    if (fraction && fraction.length > constraints.maxFractionDigits) {
      return null;
    }
  }

  const numericValue = Number(trimmed);
  if (!Number.isFinite(numericValue)) return null;

  if (typeof constraints.min === 'number' && numericValue < constraints.min) {
    return null;
  }
  if (typeof constraints.max === 'number' && numericValue > constraints.max) {
    return null;
  }

  // Deterministic canonical form: drop redundant leading zeros on the integer
  // part while preserving an explicit leading minus and fractional digits.
  if (integerOnly) {
    const negative = trimmed.startsWith('-');
    const digits = negative ? trimmed.slice(1) : trimmed;
    const normalizedDigits = digits.replace(/^0+(?=\d)/, '');
    return `${negative ? '-' : ''}${normalizedDigits}`;
  }

  const negative = trimmed.startsWith('-');
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [whole = '0', fraction] = unsigned.split('.');
  const normalizedWhole = whole.replace(/^0+(?=\d)/, '') || '0';
  const canonical = fraction
    ? `${normalizedWhole}.${fraction}`
    : normalizedWhole;
  return `${negative ? '-' : ''}${canonical}`;
}

/**
 * Validate a numeric draft for commit. Does not invent Engine writes —
 * `engineWritable` is false unless the field already declares `operationId`.
 */
export function prepareNumericCommit(
  field: FieldDefinition,
  input: string,
): NumericPrepareResult {
  if (field.valueType !== 'number') {
    return { ok: false, message: 'Not a numeric field' };
  }
  const value = normalizeNumericFieldInput(field, input);
  if (value == null) {
    return { ok: false, message: 'Enter a valid number' };
  }
  return {
    ok: true,
    value,
    engineWritable: Boolean(field.operationId),
  };
}
